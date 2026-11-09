import { redirect } from "next/navigation";
import { Shell } from "@/components/Topo";
import type { NavItem } from "@/components/NavLinks";
import { getSessao } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, papel } = await getSessao();
  if (papel === "admin") redirect("/admin");
  const { data: p } = await supabase.from("proprietarios").select("nome").eq("user_id", user.id).maybeSingle();
  const links: NavItem[] = [
    { href: "/portal", label: "Início", icon: "grid" },
    { href: "/portal/repasses", label: "Repasses", icon: "wallet" },
  ];
  return <Shell links={links} abas={links} nome={p?.nome ?? user.email ?? ""} papel="Proprietário" marca={MARCA}>{children}</Shell>;
}
