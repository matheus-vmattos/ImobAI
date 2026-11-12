import { hojeSP } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cobrancasEmitidas } from "@/lib/avisos";
import { gerarCobrancas, lerConfig } from "@/lib/cobrancas";
import { lancarRecorrentes } from "@/lib/recorrentes";
import { garantirAlugueis } from "@/app/admin/alugueis/dados";

/** Rotina diária (chamada pelo cron): lança as contas mensais e gera a cobrança semanal no dia configurado. */
export async function rotinaDiaria(db: SupabaseClient, agora = new Date()) {
  const cfg = await lerConfig(db);
  // dia da semana em São Paulo (0 = domingo)
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(agora);
  const diaSemana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dia);
  const hoje = hojeSP(agora);
  // aluguéis do mês de todos os contratos, para o proprietário ver pago/atrasado mesmo sem a imobiliária abrir a tela
  await garantirAlugueis(db, hoje.slice(0, 7));
  const recorrentes = await lancarRecorrentes(db, hoje);
  let cobrancas = 0;
  if (diaSemana === Number(cfg.cobranca_dia)) {
    const criadas = await gerarCobrancas(db, hoje);
    if (criadas.length) await cobrancasEmitidas(criadas);
    cobrancas = criadas.length;
  }
  return { cobrancas, ...recorrentes };
}
