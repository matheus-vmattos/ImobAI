"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const ativo = (href: string) =>
    href === links[0]?.href ? path === href : path === href || path.startsWith(href + "/");
  return (
    <nav className="nav">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={ativo(l.href) ? "page" : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
