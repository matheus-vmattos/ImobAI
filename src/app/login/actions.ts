"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function entrar(form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("senha") ?? ""),
  });
  if (error) redirect("/login?erro=" + encodeURIComponent("E-mail ou senha incorretos."));
  redirect("/");
}

export async function esqueciSenha(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  if (!email) redirect("/login?modo=senha&erro=" + encodeURIComponent("Informe seu e-mail."));
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${site()}/auth/confirm?next=/definir-senha` });
  // mesma resposta exista ou não a conta, para não revelar e-mails cadastrados
  redirect("/login?ok=" + encodeURIComponent("Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha."));
}

export async function definirSenha(form: FormData) {
  const senha = String(form.get("senha") ?? "");
  if (senha.length < 8) redirect("/definir-senha?erro=" + encodeURIComponent("A senha precisa ter pelo menos 8 caracteres."));
  if (senha !== String(form.get("confirmacao") ?? "")) redirect("/definir-senha?erro=" + encodeURIComponent("As senhas não conferem."));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) redirect("/definir-senha?erro=" + encodeURIComponent("Não foi possível salvar a senha. Abra o link do e-mail de novo."));
  redirect("/");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
