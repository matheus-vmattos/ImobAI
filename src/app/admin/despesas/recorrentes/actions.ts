"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { numero, obrigatorio, texto } from "@/lib/form";
import { lancarRecorrentes } from "@/lib/recorrentes";

const voltar = (params: Record<string, string>): never => redirect(`/admin/despesas/recorrentes?${new URLSearchParams(params)}`);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado.");

export async function salvarRecorrente(form: FormData) {
  const { supabase } = await exigirAdmin();
  try {
    const onde = obrigatorio(form, "onde", "Onde");
    const [tipoOnde, idOnde] = onde.split(":");
    const dia = Math.min(28, Math.max(1, numero(form, "dia") ?? 5));
    const { error } = await supabase.from("recorrentes").insert({
      condominio_id: tipoOnde === "c" ? idOnde : null, imovel_id: tipoOnde === "i" ? idOnde : null,
      tipo: String(form.get("tipo") ?? "fixa"), descricao: obrigatorio(form, "descricao", "Descrição"),
      valor: numero(form, "valor"), dia, cobra_taxa_adm: form.get("cobra_taxa") === "on",
      regra: tipoOnde === "i" ? "integral" : "cotas",
    });
    if (error) throw new Error(error.message);
  } catch (e) { voltar({ erro: msg(e) }); }
  revalidatePath("/admin", "layout");
  voltar({ ok: "Conta mensal cadastrada. Entra sozinha todo mês no dia escolhido." });
}

export async function alternarRecorrente(form: FormData) {
  const { supabase } = await exigirAdmin();
  const { error } = await supabase.from("recorrentes").update({ ativo: form.get("ativo") === "1" }).eq("id", String(form.get("id")));
  if (error) voltar({ erro: error.message });
  revalidatePath("/admin", "layout");
  voltar({ ok: form.get("ativo") === "1" ? "Conta reativada." : "Conta pausada." });
}

export async function excluirRecorrente(form: FormData) {
  const { supabase } = await exigirAdmin();
  const { error } = await supabase.from("recorrentes").delete().eq("id", String(form.get("id")));
  if (error) voltar({ erro: error.message });
  revalidatePath("/admin", "layout");
  voltar({ ok: "Conta mensal excluída. As despesas já lançadas continuam." });
}

/** Lança agora a conta deste mês (sem esperar o dia). */
export async function lancarAgora(form: FormData) {
  const { supabase } = await exigirAdmin();
  let r = { lancadas: 0, rascunhos: 0 };
  try {
    r = await lancarRecorrentes(supabase, new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), texto(form, "id") ?? undefined);
  } catch (e) { voltar({ erro: msg(e) }); }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar({ ok: r.lancadas + r.rascunhos ? `${r.lancadas} lançada(s) e ${r.rascunhos} rascunho(s) esperando valor.` : "Esta conta já foi lançada neste mês." });
}
