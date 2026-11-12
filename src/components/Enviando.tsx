"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Evita clique duplo e mostra que o pedido foi recebido: ao enviar qualquer formulário, o botão usado
 * fica "enviando" (sem aceitar outro clique) até a página mudar. Vale para todos os formulários do app.
 */
export function Enviando() {
  const path = usePathname();
  const busca = useSearchParams().toString();
  useEffect(() => {
    const limpar = () => document.querySelectorAll(".enviando").forEach((b) => b.classList.remove("enviando"));
    limpar();
    let t: ReturnType<typeof setTimeout>;
    const aoEnviar = (e: SubmitEvent) => {
      const b = e.submitter as HTMLElement | null;
      if (!b || (e.target as HTMLFormElement).method === "get") return;
      // depois que o formulário leu o botão (nome e valor), ele para de aceitar cliques
      setTimeout(() => b.classList.add("enviando"), 0);
      clearTimeout(t); t = setTimeout(limpar, 12000);
    };
    document.addEventListener("submit", aoEnviar);
    return () => { document.removeEventListener("submit", aoEnviar); clearTimeout(t); };
  }, [path, busca]);
  return null;
}
