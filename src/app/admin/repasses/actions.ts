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
    const { data, error } = await supabase.from("repasses").insert({
      proprietario_id: r.proprietarioId, competencia: `${mes}-01`,
      aluguel: r.aluguel, taxa_adm: r.taxa, seguro: r.seguro, despesas: r.despesas, liquido: r.liquido,
      linhas: r.linhas, created_by: user.id,
    }).select("id").single();
    if (error) voltar(mes, { erro: error.message });
    ids.push(data!.id);
    // cobranças vencidas que saíram do repasse ficam quitadas por ele
    for (const c of r.cobrancas) {
      const { data: atual } = await supabase.from("cobrancas").select("descontado").eq("id", c.id).single();
      await supabase.from("cobrancas").update({
        descontado: Math.round((Number(atual?.descontado ?? 0) + c.saldo) * 100) / 100, status: "paga", quitada_em: new Date().toISOString(), repasse_id: data!.id,
      }).eq("id", c.id);
    }
    if (r.itens.length) {
      const { error: e2 } = await supabase.from("despesa_itens")
        .update({ repasse_id: data!.id, repassado_em: new Date().toISOString() }).in("id", r.itens).is("repasse_id", null);
      if (e2) voltar(mes, { erro: e2.message });
    }
  }
  if (ids.length) after(() => avisos.repasseFechado(ids));
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(mes, { ok: ids.length ? `${ids.length} repasse${ids.length > 1 ? "s" : ""} fechado${ids.length > 1 ? "s" : ""}.` : "Nada a fechar." });
}

/** Desfaz um repasse fechado: as despesas voltam a ficar pendentes de desconto. */
export async function reabrirRepasse(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("id"));
  const { data: r } = await supabase.from("repasses").select("competencia").eq("id", id).single();
  const mes = String(r?.competencia ?? "").slice(0, 7);
  const { error } = await supabase.from("despesa_itens").update({ repasse_id: null, repassado_em: null }).eq("repasse_id", id);
  // cobranças que este repasse quitou voltam a ficar em aberto
  await supabase.from("cobrancas").update({ descontado: 0, status: "aberta", quitada_em: null, repasse_id: null }).eq("repasse_id", id);
  if (error) voltar(mes, { erro: error.message });
  const { error: e2 } = await supabase.from("repasses").delete().eq("id", id);
  if (e2) voltar(mes, { erro: e2.message });
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(mes, { ok: "Repasse reaberto." });
}
