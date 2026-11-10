import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarCarteira } from "@/app/admin/despesas/dados";
import { aplicarDecisoesAutomaticas, responsaveis } from "@/lib/decisoes";
import { calcularRateio, distribuir, type Regra, type UnidadeRateio } from "@/lib/rateio";
import { createServiceClient } from "@/lib/supabase/server";

/** Lançamento de despesa fora do formulário principal: contas mensais, lote de PDFs e rascunho completado. */

const MAX_PDF = 10 * 1024 * 1024;

export async function guardarPdf(pdf: FormDataEntryValue | null, despesaId: string) {
  if (!(pdf instanceof File) || pdf.size === 0) return null;
  if (pdf.type !== "application/pdf") throw new Error(`“${pdf.name}” não é PDF.`);
  if (pdf.size > MAX_PDF) throw new Error(`“${pdf.name}” tem mais de 10 MB.`);
  const path = `${despesaId}.pdf`;
  const { error } = await createServiceClient().storage.from("despesas").upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error("Falha ao enviar o PDF: " + error.message);
  return path;
}

export type Destino = {
  condominioId: string | null; imovelId: string | null; regra: Regra; divisor: number | null;
  /** quantidades por unidade; vazio = todas as unidades do condomínio pelas cotas cadastradas */
  unidades: { imovelId: string; quantidade: number }[] | null;
};

/** Rateio com os donos atuais do banco. */
export async function ratear(db: SupabaseClient, d: Destino, total: number, cobraTaxa: boolean) {
  const { condominios, imoveis } = await carregarCarteira(db);
  let regra = d.regra, divisor = d.divisor;
  let unidades: UnidadeRateio[];
  if (d.imovelId) {
    const im = imoveis.find((i) => i.id === d.imovelId);
    if (!im) throw new Error("Imóvel não encontrado.");
    regra = "integral"; divisor = null;
    unidades = [{ imovelId: im.id, quantidade: 1, donos: im.donos }];
  } else {
    const c = condominios.find((x) => x.id === d.condominioId);
    if (!c) throw new Error("Condomínio não encontrado.");
    if (d.unidades?.length) {
      unidades = d.unidades.map((q) => {
        const u = c.unidades.find((x) => x.id === q.imovelId);
        if (!u) throw new Error("Unidade não pertence a este condomínio.");
        return { imovelId: u.id, quantidade: q.quantidade, donos: u.donos };
      });
    } else {
      regra = "cotas";
      unidades = c.unidades.map((u) => ({ imovelId: u.id, quantidade: u.cotas, donos: u.donos }));
      divisor = c.cotasPadrao ?? unidades.reduce((a, u) => a + u.quantidade, 0);
    }
  }
  const taxaDe = (imId: string) => imoveis.find((i) => i.id === imId)?.taxa ?? 10;
  const r = calcularRateio({ total, regra, divisor, unidades, cobraTaxa, taxaPct: taxaDe });
  if (r.erro) throw new Error(r.erro);
  return { r, regra, divisor, unidades: unidades.map((u) => ({ imovelId: u.imovelId, quantidade: u.quantidade })) };
}

export async function gravarItens(db: SupabaseClient, despesaId: string, tipo: string, itens: Awaited<ReturnType<typeof ratear>>["r"]["itens"]) {
  const resp = await responsaveis(db, tipo, itens.map((i) => i.imovelId));
  const { error } = await db.from("despesa_itens").insert(itens.map((i) => ({
    despesa_id: despesaId, imovel_id: i.imovelId, proprietario_id: i.proprietarioId,
    cotas: i.quantidade, percentual_dono: i.percentualDono, valor: i.valor, taxa_adm: i.taxaAdm,
    responsavel: resp.get(i.imovelId) ?? "proprietario",
  })));
  if (error) throw new Error(error.message);
}

/** Marca como enviada e decide automaticamente o que não precisa de resposta. Devolve quem precisa responder. */
export async function enviarDespesa(db: SupabaseClient, despesaId: string) {
  const { error } = await db.from("despesas").update({ status: "enviada", enviada_em: new Date().toISOString() }).eq("id", despesaId);
  if (error) throw new Error(error.message);
  return aplicarDecisoesAutomaticas(db, despesaId);
}

/** Cria e envia uma despesa completa (valor conhecido). */
export async function lancar(db: SupabaseClient, o: {
  destino: Destino; tipo: string; descricao: string; total: number; cobraTaxa: boolean; competencia?: string | null;
  prazo?: string | null; pdf?: FormDataEntryValue | null; recorrenteId?: string; competenciaMes?: string; criadoPor?: string;
}) {
  const id = randomUUID();
  const { r, regra, divisor, unidades } = await ratear(db, o.destino, o.total, o.cobraTaxa);
  const pdf_path = await guardarPdf(o.pdf ?? null, id);
  const { error } = await db.from("despesas").insert({
    id, condominio_id: o.destino.imovelId ? null : o.destino.condominioId, imovel_id: o.destino.imovelId, tipo: o.tipo,
    descricao: o.descricao, competencia: o.competencia ?? null, valor_total: o.total, regra, divisor, valor_fora: r.fora,
    cobra_taxa_adm: o.cobraTaxa, pdf_path, prazo: o.prazo ?? null, unidades, recorrente_id: o.recorrenteId ?? null,
    competencia_mes: o.competenciaMes ?? null, created_by: o.criadoPor ?? null,
  });
  if (error) throw new Error(error.message);
  try { await gravarItens(db, id, o.tipo, r.itens); } catch (e) { await db.from("despesas").delete().eq("id", id); throw e; }
  await gravarTerceiros(db, id, o.destino.imovelId ? null : o.destino.condominioId, r.fora, { regra, divisor, total: o.total });
  const precisam = await enviarDespesa(db, id);
  return { id, precisam };
}

/** Parte das unidades fora da carteira, por terceiro cadastrado no condomínio. Com rateio por cotas,
 *  cada um paga total × cotas ÷ divisor (sem passar do que ficou fora); nas outras regras, a parte de fora
 *  é dividida entre eles pelas cotas. */
export async function gravarTerceiros(db: SupabaseClient, despesaId: string, condominioId: string | null, valorFora: number,
  rateio?: { regra: string; divisor: number | null; total: number }) {
  await db.from("despesa_terceiros").delete().eq("despesa_id", despesaId);
  if (!condominioId || !(valorFora > 0)) return;
  const { data: ts } = await db.from("terceiros").select("id, nome, cotas").eq("condominio_id", condominioId);
  if (!ts?.length) return;
  const cotas = ts.map((t) => Number(t.cotas));
  const porCota = rateio?.regra === "cotas" && Number(rateio.divisor) > 0;
  const base = porCota ? Math.min(valorFora, (rateio!.total * cotas.reduce((a, c) => a + c, 0)) / Number(rateio!.divisor)) : valorFora;
  const partes = distribuir(base, cotas);
  await db.from("despesa_terceiros").insert(ts.map((t, i) => ({ despesa_id: despesaId, terceiro_id: t.id, nome: t.nome, valor: partes[i] })));
}
