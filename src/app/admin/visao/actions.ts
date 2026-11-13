"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exigirAdmin, VER_COMO } from "@/lib/auth";

/** Abre o portal como um proprietário (só leitura). */
export async function verComo(form: FormData) {
  const { supabase } = await exigirAdmin();
  const id = String(form.get("proprietario_id") ?? "");
  const { data } = await supabase.from("proprietarios").select("id").eq("id", id).maybeSingle();
  if (!data) redirect("/admin/visao");
  (await cookies()).set(VER_COMO, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 });
  redirect("/portal");
}

export async function sairDaVisao() {
  const jar = await cookies();
  const id = jar.get(VER_COMO)?.value;
  jar.delete(VER_COMO);
  redirect(id ? `/admin/proprietarios/${id}` : "/admin");
}
