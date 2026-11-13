import Link from "next/link";
import { sair } from "@/app/login/actions";
import { Suspense } from "react";
import { Enviando } from "./Enviando";
import { Icon } from "./Icon";
import { Abas, NavLinks, type NavItem } from "./NavLinks";

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/**
 * Esqueleto das páginas logadas: menu lateral no computador; no celular, barra no topo
 * (com menu) e, no portal, abas no rodapé.
 */
export function Shell({ links, abas, nome, papel, marca, faixa, soLeitura, children }: {
  links: NavItem[]; abas?: NavItem[]; nome: string; papel: string; marca: string; faixa?: React.ReactNode; soLeitura?: boolean; children: React.ReactNode;
}) {
  const conta = (
    <div className="me">
      <span className="av">{iniciais(nome)}</span>
      <span className="me-t"><b>{nome}</b><small>{papel}</small></span>
      {!soLeitura && <form action={sair}><button className="btn ghost sm" title="Sair" aria-label="Sair"><Icon name="logout" /></button></form>}
    </div>
  );
  return (
    <div className={`app ${abas ? "com-abas" : ""} ${soLeitura ? "so-leitura" : ""}`}>
      <aside className="side">
        <Link href={links[0]?.href ?? "/"} className="org"><span className="logo"><Icon name="logo" /></span><span><b>{marca}</b><small>{papel === "Administrador" ? "Imobiliária" : "Portal do proprietário"}</small></span></Link>
        <NavLinks links={links} />
        {conta}
      </aside>
      <header className="mtop">
        <Link href={links[0]?.href ?? "/"} className="org"><span className="logo"><Icon name="logo" /></span><b>{marca}</b></Link>
        <details className="mmenu">
          <summary aria-label="Menu"><span className="av">{iniciais(nome)}</span></summary>
          <div className="mmenu-p">{!abas && <NavLinks links={links} />}{conta}</div>
        </details>
      </header>
      <main className="page">{faixa}{children}</main>
      <Suspense><Enviando /></Suspense>
      {abas && <Abas links={abas} />}
    </div>
  );
}
