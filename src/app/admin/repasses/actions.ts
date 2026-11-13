"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import * as avisos from "@/lib/avisos";
import { calcularPrevia, competenciaOu } from "./dados";

const voltar = (mes: string, params: Record<string, string>): never => redirect(`/admin/repasses?${new URLSearchParams({ mes, ...params })}`);

/** Fecha o repasse do mês dos proprietários marcados: congela as linhas e marca as despesas como repassadas. */
export async function fecharRepasse(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const mes = competenciaOu(String(form.get("mes")));
  const escolhidos = new Set(form.getAll("proprietario_id").map(String));
  if (!escolhidos.size) voltar(mes, { erro: "Marque ao menos um proprietário." });

  const { data: fechados } = await supabase.from("repasses").select("proprietario_id").eq("competencia", `${mes}-01`);
  const jaFechado = new Set((fechados ?? []).map((r) => r.proprietario_id));
  const previa = (await calcularPrevia(supabase, mes)).filter((r) => escolhidos.has(r.proprietarioId) && !jaFechado.has(r.proprietarioId));

  const ids: string[] = [];
  for (const r of previa) {
    // uma transação por proprietário: ou fecha tudo (repasse, contas, cobranças vencidas) ou nada
    const { data, error } = await supabase.rpc("fechar_repasse", {
      p_proprietario: r.proprietarioId, p_competencia: `${mes}-01`, p_aluguel: r.aluguel, p_taxa: r.taxa, p_seguro: r.seguro,
      p_despesas: r.despesas, p_liquido: r.liquido, p_linhas: r.linhas, p_itens: r.itens, p_cobrancas: r.cobrancas, p_user: user.id,
    });
    if (error) voltar(mes, { erro: (ids.length ? `${ids.length} fechado(s) antes do erro. ` : "") + error.message });
    ids.push(data as string);
  }
  if (ids.length) after(() => avisos.repasseFechado(ids));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(mes, { ok: ids.length ? `${ids.length} repasse${ids.length > 1 ? "s" : ""} fechado${ids.length > 1 ? "s" : ""}.` : "Nada a fechar." });
}

/** Desfaz um repasse fechado: as despesas voltam a ficar pendentes de desconto. */
export async function reabrirRepasse(form: FormData) {
  const { supabase, user } = await exigirAdmin();
  const id = String(form.get("id"));
  const { data: r } = await supabase.from("repasses").select("competencia").eq("id", id).single();
  const mes = String(r?.competencia ?? "").slice(0, 7);
  const { error } = await supabase.rpc("reabrir_repasse", { p_id: id, p_user: user.id });
  if (error) voltar(mes, { erro: error.message });
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(mes, { ok: "Repasse reaberto." });
}
