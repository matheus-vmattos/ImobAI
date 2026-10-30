import Link from "next/link";
import { sair } from "@/app/login/actions";
import { NavLinks } from "./NavLinks";

export function Topo({ links, nome }: { links: { href: string; label: string }[]; nome: string }) {
  return (
    <header className="top">
      <div className="top-in">
        <Link href="/" className="brand"><i />ImobAI</Link>
        <NavLinks links={links} />
        <div className="who">
          <span>{nome}</span>
          <form action={sair}><button className="btn ghost sm">Sair</button></form>
        </div>
      </div>
    </header>
  );
}
