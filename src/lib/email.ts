import { createServiceClient } from "@/lib/supabase/server";

/**
 * Notificações por e-mail. Tudo passa pela tabela `notificacoes` (caixa de saída).
 * Com RESEND_API_KEY e EMAIL_FROM configurados, envia pelo Resend; sem eles, só registra (status sem_provedor).
 * Nunca lança erro: falha de e-mail não pode desfazer a ação de quem chamou.
 */

export type Mensagem = { evento: string; ref?: string | null; para: string; assunto: string; html: string };

const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const link = (path: string) => SITE() + path;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Corpo padrão: título, parágrafos (texto puro, escapado) e um botão opcional. */
export function modelo(titulo: string, paragrafos: string[], botao?: { texto: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#10161d">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="font:600 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.3em;color:#0b6f8a">◇ IMOBAI</div>
  <h1 style="font-size:20px;margin:18px 0 12px">${esc(titulo)}</h1>
  ${paragrafos.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 10px">${esc(p)}</p>`).join("")}
  ${botao ? `<p style="margin:20px 0"><a href="${esc(botao.href)}" style="background:#0b6f8a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-weight:600;font-size:14px">${esc(botao.texto)}</a></p>` : ""}
  <p style="font-size:12px;color:#7f8c97;margin-top:28px">Mensagem automática do portal da imobiliária.</p>
</div></body></html>`;
}

async function enviarResend(m: Mensagem): Promise<{ ok: true } | { ok: false; erro: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.para], subject: m.assunto, html: m.html }),
  });
  return res.ok ? { ok: true } : { ok: false, erro: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

export async function notificar(mensagens: Mensagem[]) {
  const validas = mensagens.filter((m) => m.para && m.para.includes("@"));
  if (!validas.length) return;
  try {
    const db = createServiceClient();
    const temProvedor = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    for (const m of validas) {
      let status = "sem_provedor", erro: string | null = null;
      if (temProvedor) {
        const r = await enviarResend(m).catch((e: unknown) => ({ ok: false as const, erro: String(e) }));
        status = r.ok ? "enviado" : "erro";
        erro = r.ok ? null : r.erro;
      }
      await db.from("notificacoes").insert({
        evento: m.evento, ref: m.ref ?? null, para: m.para, assunto: m.assunto, html: m.html,
        status, erro, enviado_em: status === "enviado" ? new Date().toISOString() : null,
      });
    }
  } catch (e) {
    console.error("Falha ao registrar notificação", e);
  }
}

/** E-mails cadastrados dos proprietários (id → e-mail). */
export async function emailsProprietarios(ids: string[]) {
  if (!ids.length) return new Map<string, { email: string; nome: string }>();
  const { data } = await createServiceClient().from("proprietarios").select("id, nome, email").in("id", ids);
  return new Map((data ?? []).filter((p) => p.email).map((p) => [p.id as string, { email: p.email as string, nome: p.nome as string }]));
}

/** Para onde vão os avisos à imobiliária: EMAIL_IMOBILIARIA (separado por vírgula) ou os logins admin. */
export async function emailsImobiliaria(): Promise<string[]> {
  const fixo = (process.env.EMAIL_IMOBILIARIA ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fixo.length) return fixo;
  const { data } = await createServiceClient().rpc("emails_admin");
  return (data ?? []) as string[];
}

export const primeiroNome = (nome: string) => nome.split(" ")[0];
