import type { SupabaseClient } from "@supabase/supabase-js";
import { cobrancasEmitidas } from "@/lib/avisos";
import { gerarCobrancas, lerConfig } from "@/lib/cobrancas";
import { lancarRecorrentes } from "@/lib/recorrentes";

/** Rotina diária (chamada pelo cron): lança as contas mensais e gera a cobrança semanal no dia configurado. */
export async function rotinaDiaria(db: SupabaseClient, agora = new Date()) {
  const cfg = await lerConfig(db);
  // dia da semana em São Paulo (0 = domingo)
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(agora);
  const diaSemana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dia);
  const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const recorrentes = await lancarRecorrentes(db, hojeSP);
  let cobrancas = 0;
  if (diaSemana === Number(cfg.cobranca_dia)) {
    const criadas = await gerarCobrancas(db, hojeSP);
    if (criadas.length) await cobrancasEmitidas(criadas);
    cobrancas = criadas.length;
  }
  return { cobrancas, ...recorrentes };
}
