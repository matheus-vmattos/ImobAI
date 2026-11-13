import { marcaRateio } from "@/lib/decisoes";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as avisos from "@/lib/avisos";
import { lancar } from "@/lib/lancamento";

const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Rec = {
  id: string; condominio_id: string | null; imovel_id: string | null; tipo: string; descricao: string; valor: number | null;
  regra: string; divisor: number | null; unidades: { imovelId: string; quantidade: number }[] | null; cobra_taxa_adm: boolean; dia: number; ultimo_mes: string | null;
};

/** Lança as contas mensais do mês que já chegaram no dia. Valor fixo: entra enviada (decisão automática);
 *  valor variável: entra como rascunho esperando o valor e o PDF. */
export async function lancarRecorrentes(db: SupabaseClient, hojeISO: string, soId?: string) {
  const [y, m, d] = hojeISO.split("-").map(Number);
  const mesIni = `${y}-${String(m).padStart(2, "0")}-01`;
  let q = db.from("recorrentes").select("*").eq("ativo", true).lte("dia", soId ? 31 : d);
  if (soId) q = q.eq("id", soId);
  const { data } = await q;
  let lancadas = 0, rascunhos = 0;
  for (const rec of (data ?? []) as Rec[]) {
    if (rec.ultimo_mes && rec.ultimo_mes >= mesIni) continue;
    const competencia = `${MES[m - 1]}/${y}`;
    const destino = { condominioId: rec.condominio_id, imovelId: rec.imovel_id, regra: rec.regra as never, divisor: rec.divisor, unidades: rec.unidades };
    if (rec.valor) {
      const { id, precisam } = await lancar(db, { destino, tipo: rec.tipo, descricao: rec.descricao, total: Number(rec.valor), cobraTaxa: rec.cobra_taxa_adm, competencia, recorrenteId: rec.id, competenciaMes: mesIni });
      if (precisam.length) await avisos.despesaEnviada(id, precisam);
      lancadas++;
    } else {
      const { error } = await db.from("despesas").insert({
        condominio_id: rec.imovel_id ? null : rec.condominio_id, imovel_id: rec.imovel_id, tipo: rec.tipo, descricao: rec.descricao, competencia,
        valor_total: 0, regra: rec.imovel_id ? "integral" : rec.regra, divisor: rec.divisor, unidades: rec.unidades,
        cobra_taxa_adm: rec.cobra_taxa_adm, status: "rascunho", recorrente_id: rec.id, competencia_mes: mesIni,
        rateada_inquilinos: await marcaRateio(db, { condominioId: rec.imovel_id ? null : rec.condominio_id, imovelId: rec.imovel_id }, rec.tipo),
      });
      if (error) throw new Error(error.message);
      rascunhos++;
    }
    await db.from("recorrentes").update({ ultimo_mes: mesIni }).eq("id", rec.id);
  }
  return { lancadas, rascunhos };
}
