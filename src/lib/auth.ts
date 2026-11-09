import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Papel } from "@/lib/types";

/** Usuário logado + papel; redireciona para /login se não houver sessão.
 *  cache(): layout e página da mesma requisição consultam o Supabase uma vez só. */
export const getSessao = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: perfil }, { data: vinc }] = await Promise.all([
    supabase.from("profiles").select("papel, nome").eq("id", user.id).single(),
    supabase.from("proprietario_usuarios").select("proprietario_id, proprietarios(nome)").eq("user_id", user.id),
  ]);
  const cadastros = ((vinc ?? []) as unknown as { proprietario_id: string; proprietarios: { nome: string } | null }[])
    .map((v) => ({ id: v.proprietario_id, nome: v.proprietarios?.nome ?? "" }));
  return {
    supabase, user, papel: (perfil?.papel ?? "proprietario") as Papel, nome: perfil?.nome as string | null,
    /** cadastros de proprietário a que este login tem acesso (o próprio, de sócio, de cônjuge...) */
    cadastros, proprietarioIds: cadastros.map((c) => c.id),
  };
});

export async function exigirAdmin() {
  const s = await getSessao();
  if (s.papel !== "admin") redirect("/portal");
  return s;
}
