"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { numero, texto } from "@/lib/form";

const voltar = (mes: string, params: Record<string, string>): never => redirect(`/admin/alugueis?${new URLSearchParams({ mes, ...params })}`);
const hoje = () => new Date().toISOString().slice(0, 10);

/** Marca como recebidos os aluguéis selecionados (pelo valor cheio) ou um só com valor e data informados. */
export async function registrarRecebimento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const mes = String(form.get("mes"));
  const ids = form.getAll("id").map(String);
  if (!ids.length) voltar(mes, { erro: "Marque ao menos um aluguel." });
  const valor = numero(form, "valor_recebido");
  const data = texto(form, "recebido_em") ?? hoje();
  if (ids.length === 1 && valor != null) {
    const { error } = await supabase.from("alugueis").update({ valor_recebido: valor, recebido_em: data }).eq("id", ids[0]);
    if (error) voltar(mes, { erro: error.message });
  } else {
    const { data: linhas } = await supabase.from("alugueis").select("id, valor").in("id", ids).is("recebido_em", null);
    for (const l of linhas ?? []) {
      const { error } = await supabase.from("alugueis").update({ valor_recebido: l.valor, recebido_em: data }).eq("id", l.id);
      if (error) voltar(mes, { erro: error.message });
    }
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  voltar(mes, { ok: ids.length > 1 ? `${ids.length} aluguéis marcados como recebidos.` : "Recebimento registrado." });
}

export async function desfazerRecebimento(form: FormData) {
  const { supabase } = await exigirAdmin();
  const mes = String(form.get("mes"));
  const { error } = await supabase.from("alugueis").update({ valor_recebido: null, recebido_em: null }).eq("id", String(form.get("id")));
  if (error) voltar(mes, { erro: error.message });
  revalidatePath("/admin", "layout");
  voltar(mes, { ok: "Recebimento desfeito." });
}
