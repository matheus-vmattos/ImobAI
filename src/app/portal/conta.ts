import type { SupabaseClient } from "@supabase/supabase-js";
import { extrato, type LinhaCobranca } from "@/lib/contaCorrente";

export type CobrancaPortal = {
  id: string; pagador_id: string; emitida_em: string; inicio: string; fim: string; vencimento: string;
  total: number; pago: number; abonado: number; descontado: number; status: string; quitada_em: string | null; linhas: LinhaCobranca[];
};
export type PagamentoPortal = { id: string; pagador_id: string; valor: number; valor_confirmado: number | null; data: string; forma: string; status: string; motivo_recusa: string | null; created_at: string };

export const saldoCobranca = (c: CobrancaPortal) => Math.round((Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado)) * 100) / 100;

/** Conta corrente do login: cobranças, pagamentos e extrato (o RLS restringe ao que é dele). */
export async function carregarConta(supabase: SupabaseClient) {
  const [{ data: cs }, { data: ps }, { data: cfg }] = await Promise.all([
    supabase.from("cobrancas").select("*").order("emitida_em", { ascending: false }).limit(200),
    supabase.from("pagamentos").select("id, pagador_id, valor, valor_confirmado, data, forma, status, motivo_recusa, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("config").select("favorecido, banco, pix").maybeSingle(),
  ]);
  const cobrancas = (cs ?? []) as CobrancaPortal[];
  const pagamentos = (ps ?? []) as PagamentoPortal[];
  const abertas = cobrancas.filter((c) => c.status === "aberta").sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const ext = extrato({
    cobrancas: cobrancas.filter((c) => c.status !== "cancelada").map((c) => ({
      id: c.id, emitidaEm: c.emitida_em, inicio: c.inicio, fim: c.fim, total: Number(c.total), abonado: Number(c.abonado),
      descontado: Number(c.descontado), quitadaEm: c.quitada_em, qtd: c.linhas.length,
    })),
    pagamentos: pagamentos.filter((p) => p.status === "confirmado").map((p) => ({ id: p.id, data: p.data, valor: Number(p.valor_confirmado), forma: p.forma })),
  });
  return {
    cobrancas, abertas, pagamentos, extrato: ext,
    emConferencia: pagamentos.filter((p) => p.status === "informado"),
    recusados: pagamentos.filter((p) => p.status === "recusado").slice(0, 3),
    devido: abertas.reduce((a, c) => a + saldoCobranca(c), 0),
    pagar: cfg as { favorecido: string | null; banco: string | null; pix: string | null } | null,
  };
}
