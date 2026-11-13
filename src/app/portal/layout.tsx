import Link from "next/link";
import { Shell } from "@/components/Topo";
import type { NavItem } from "@/components/NavLinks";
import { getSessaoPortal } from "@/lib/auth";
import { MARCA } from "@/lib/marca";
import { sairDaVisao } from "@/app/admin/visao/actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, cadastros, supabase, proprietarioIds, vendoComo } = await getSessaoPortal();
  const p = cadastros[0];
  const { count: abertas } = await supabase.from("cobrancas").select("*", { count: "exact", head: true }).eq("status", "aberta").in("pagador_id", proprietarioIds);
  const links: NavItem[] = [
    { href: "/portal", label: "Início", icon: "grid" },
    { href: "/portal/imoveis", label: "Imóveis", icon: "home" },
    { href: "/portal/extrato", label: "Extrato", icon: "receipt", badge: abertas ?? 0 },
  ];
  const faixa = vendoComo && (
    <div className="faixa-visao" role="status">
      <span>Você está vendo o portal como <b>{vendoComo.nome}</b> · só leitura</span>
      <span className="faixa-acoes">
        <Link href="/admin/visao" className="btn sm">Trocar</Link>
        <form action={sairDaVisao}><button className="btn sm primary">Voltar ao admin</button></form>
      </span>
    </div>
  );
  return <Shell links={links} abas={links} nome={vendoComo?.nome ?? p?.nome ?? user.email ?? ""} papel="Proprietário" marca={MARCA} faixa={faixa} soLeitura={!!vendoComo}>{children}</Shell>;
}
