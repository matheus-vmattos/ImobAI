import { cache } from "react";
import { cookies } from "next/headers";
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

export const VER_COMO = "ver_como";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sessão para as páginas do portal. Se um admin abriu a "visão do proprietário", devolve um cliente
 *  que o banco trata como aquele proprietário (só leitura: o admin perde os poderes de admin nas regras). */
export const getSessaoPortal = cache(async () => {
  const s = await getSessao();
  if (s.papel !== "admin") return { ...s, vendoComo: null as null | { id: string; nome: string } };
  const id = (await cookies()).get(VER_COMO)?.value ?? "";
  if (!UUID.test(id)) redirect("/admin");
  // o grupo do login daquele proprietário (ex.: ele e a holding), lido ainda como admin
  const { data: prop } = await s.supabase.from("proprietarios").select("id, nome").eq("id", id).maybeSingle();
  if (!prop) redirect("/admin/visao");
  const { data: usuarios } = await s.supabase.from("proprietario_usuarios").select("user_id").eq("proprietario_id", id);
  const { data: vinc } = usuarios?.length
    ? await s.supabase.from("proprietario_usuarios").select("proprietario_id, proprietarios(nome)").in("user_id", usuarios.map((u) => u.user_id))
    : { data: [] };
  const grupo = new Map<string, string>([[prop.id as string, prop.nome as string]]);
  for (const v of (vinc ?? []) as unknown as { proprietario_id: string; proprietarios: { nome: string } | null }[]) grupo.set(v.proprietario_id, v.proprietarios?.nome ?? "");
  const cadastros = [...grupo].map(([id, nome]) => ({ id, nome }));
  return {
    ...s, supabase: await createClient({ "x-ver-como": id }), cadastros, proprietarioIds: cadastros.map((c) => c.id),
    vendoComo: { id: prop.id as string, nome: prop.nome as string },
  };
});
