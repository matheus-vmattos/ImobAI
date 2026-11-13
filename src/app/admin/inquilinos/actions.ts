"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { hojeSP } from "@/lib/format";

/** Marca (ou desmarca) as partes de um inquilino como lançadas no boleto dele. */
export async function marcarLancado(form: FormData) {
  const { supabase } = await exigirAdmin();
  const ids = String(form.get("itens") ?? "").split(",").filter(Boolean);
  const lancado = form.get("lancado") === "1";
  const voltar = String(form.get("voltar") ?? "/admin/inquilinos");
  const { error } = await supabase.from("despesa_itens").update({ inquilino_lancado_em: lancado ? hojeSP() : null }).in("id", ids).eq("volta_inquilino", true);
  if (error) redirect(`${voltar}${voltar.includes("?") ? "&" : "?"}erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin", "layout");
  redirect(voltar);
}
