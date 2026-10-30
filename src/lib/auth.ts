import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/types";

/** Usuário logado + papel; redireciona para /login se não houver sessão. */
export async function getSessao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase.from("profiles").select("papel, nome").eq("id", user.id).single();
  return { supabase, user, papel: (perfil?.papel ?? "proprietario") as Papel, nome: perfil?.nome as string | null };
}

export async function exigirAdmin() {
  const s = await getSessao();
  if (s.papel !== "admin") redirect("/portal");
  return s;
}
