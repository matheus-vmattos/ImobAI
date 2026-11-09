"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Os e-mails padrão do Supabase (convite, redefinir senha) voltam com a sessão no fragmento da URL
 * (#access_token=…&refresh_token=…), que o servidor não recebe. Aqui o navegador lê o fragmento,
 * grava a sessão nos cookies e segue para a página pedida.
 */
export default function Sessao() {
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = new URLSearchParams(window.location.search).get("next");
    const destino = next?.startsWith("/") && !next.startsWith("//") ? next : "/definir-senha";
    const access_token = hash.get("access_token"), refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) { setErro(true); return; }
    createClient().auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) setErro(true);
      else window.location.replace(destino);
    });
  }, []);
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><span className="logo"><Icon name="logo" /></span>ImobAI</div>
        <div className="panel">
          {erro
            ? <><span className="label">Link expirado ou inválido</span><a className="link" href="/login?modo=senha">Pedir um novo link</a></>
            : <span className="label">Entrando…</span>}
        </div>
      </div>
    </div>
  );
}
