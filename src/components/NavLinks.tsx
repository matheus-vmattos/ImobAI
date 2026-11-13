"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; icon: string; badge?: number; grupo?: string };

const ativoEm = (path: string, href: string, raiz: string) => (href === raiz ? path === href : path === href || path.startsWith(href + "/"));

/** Itens do menu lateral, agrupados, com o item atual marcado. */
export function NavLinks({ links }: { links: NavItem[] }) {
  const path = usePathname();
  const raiz = links[0]?.href ?? "/";
  let grupo: string | undefined;
  return (
    <nav className="nav">
      {links.map((l) => {
        const titulo = l.grupo && l.grupo !== grupo ? l.grupo : null;
        grupo = l.grupo ?? grupo;
        return (
          <span key={l.href} style={{ display: "contents" }}>
            {titulo && <span className="nav-g">{titulo}</span>}
            <Link href={l.href} className="nav-i" aria-current={ativoEm(path, l.href, raiz) ? "page" : undefined}>
              <Icon name={l.icon} />{l.label}{l.badge ? <span className="n">{l.badge}</span> : null}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

/** Abas fixas no rodapé (celular). */
export function Abas({ links }: { links: NavItem[] }) {
  const path = usePathname();
  const raiz = links[0]?.href ?? "/";
  return (
    <nav className="abas">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="aba" aria-current={ativoEm(path, l.href, raiz) ? "page" : undefined}>
          <Icon name={l.icon} size={20} />{l.label}{l.badge ? <span className="n">{l.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
