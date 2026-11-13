import { controlaAlugueis } from "@/lib/cobrancas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularPrevia } from "@/app/admin/repasses/dados";
import { diasAte, mesRelativo, RENOVACAO_DIAS, mesSP } from "@/lib/format";
import type { StatusImovel } from "@/lib/types";
import type { CondominioPortal, ImovelPortal } from "./dados";

/** Palavras do dia a dia para o proprietário. */
export const SITUACAO_IMOVEL: Record<StatusImovel, string> = { locado: "Alugado", vazio: "Vago", devolucao: "Saindo", indisponivel: "Indisponível" };
export const COR_IMOVEL: Record<StatusImovel, string> = { locado: "var(--ok)", devolucao: "var(--dev)", vazio: "var(--warn)", indisponivel: "var(--dim)" };

export type Predio = {
  id: string | null; nome: string; endereco: string; unidades: number;
  porStatus: Record<StatusImovel, number>; aluguelMes: number; vencendo: number;
};

/** Imóveis agrupados por prédio (os sem condomínio ficam em "Imóveis avulsos"). */
export function predios(imoveis: ImovelPortal[], condominios: CondominioPortal[]): Predio[] {
  return condominios.map((c) => {
    const us = imoveis.filter((i) => i.condominioId === c.id);
    const porStatus = { locado: 0, vazio: 0, devolucao: 0, indisponivel: 0 } as Record<StatusImovel, number>;
    us.forEach((u) => porStatus[u.status]++);
    return {
      id: c.id, nome: c.nome, endereco: c.endereco, unidades: us.length, porStatus,
      aluguelMes: us.filter((u) => u.status === "locado" || u.status === "devolucao").reduce((a, u) => a + (u.aluguel ?? 0) * u.percentual / 100, 0),
      vencendo: us.filter((u) => u.status === "locado" && u.fim && diasAte(u.fim) <= RENOVACAO_DIAS).length,
    };
  }).filter((p) => p.unidades);
}

export const resumoPredio = (p: Predio) => {
  const partes = [`${p.porStatus.locado} ${p.porStatus.locado === 1 ? "alugada" : "alugadas"}`];
  if (p.porStatus.vazio) partes.push(`${p.porStatus.vazio} ${p.porStatus.vazio === 1 ? "vaga" : "vagas"}`);
  if (p.porStatus.devolucao) partes.push(`${p.porStatus.devolucao} saindo`);
  return `${p.unidades} ${p.unidades === 1 ? "unidade" : "unidades"} · ${partes.join(" · ")}`;
};

/** Quanto o proprietário recebe pelo mês atual: o repasse fechado ou, se ainda não fechou, a estimativa. */
export async function proximoRecebimento(supabase: SupabaseClient, proprietarioIds: string[]) {
  const mes = mesSP();
  const { data: cfg } = await supabase.from("config").select("repasse_dia").maybeSingle();
  const dia = `${String(cfg?.repasse_dia ?? 10).padStart(2, "0")}/${mesRelativo(mes, 1).slice(5, 7)}`;
  const { data: fechados } = await supabase.from("repasses").select("id, liquido").eq("competencia", `${mes}-01`).in("proprietario_id", proprietarioIds);
  const { data: al } = await controlaAlugueis(supabase) ? await supabase.from("alugueis").select("recebido_em").eq("competencia", `${mes}-01`) : { data: [] };
  const pagos = (al ?? []).filter((a) => a.recebido_em).length, total = (al ?? []).length;
  if (fechados?.length) return { valor: fechados.reduce((a, r) => a + Number(r.liquido), 0), dia, fechado: true, pagos, total, mes, repasseId: fechados.length === 1 ? fechados[0].id as string : null };
  const previa = (await calcularPrevia(supabase, mes, { garantir: false })).filter((r) => proprietarioIds.includes(r.proprietarioId));
  return { valor: previa.reduce((a, r) => a + r.liquido, 0), dia, fechado: false, pagos, total, mes, repasseId: null };
}
