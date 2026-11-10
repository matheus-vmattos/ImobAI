import { redirect } from "next/navigation";
import { Shell } from "@/components/Topo";
import type { NavItem } from "@/components/NavLinks";
import { getSessao } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, papel, cadastros, supabase } = await getSessao();
  if (papel === "admin") redirect("/admin");
  const p = cadastros[0];
  const { count: abertas } = await supabase.from("cobrancas").select("*", { count: "exact", head: true }).eq("status", "aberta");
  const links: NavItem[] = [
    { href: "/portal", label: "Início", icon: "grid" },
    { href: "/portal/imoveis", label: "Imóveis", icon: "home" },
    { href: "/portal/extrato", label: "Extrato", icon: "receipt", badge: abertas ?? 0 },
  ];
  return <Shell links={links} abas={links} nome={p?.nome ?? user.email ?? ""} papel="Proprietário" marca={MARCA}>{children}</Shell>;
}
