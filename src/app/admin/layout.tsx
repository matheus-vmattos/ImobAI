import { Shell } from "@/components/Topo";
import type { NavItem } from "@/components/NavLinks";
import { exigirAdmin } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome, user } = await exigirAdmin();
  const links: NavItem[] = [
    { href: "/admin", label: "Visão geral", icon: "grid" },
    { href: "/admin/imoveis", label: "Imóveis", icon: "home", grupo: "Carteira" },
    { href: "/admin/proprietarios", label: "Proprietários", icon: "users", grupo: "Carteira" },
    { href: "/admin/condominios", label: "Condomínios", icon: "building", grupo: "Carteira" },
    { href: "/admin/despesas", label: "Despesas", icon: "receipt", grupo: "Financeiro" },
    { href: "/admin/repasses", label: "Repasses", icon: "wallet", grupo: "Financeiro" },
    { href: "/admin/notificacoes", label: "E-mails", icon: "mail", grupo: "Financeiro" },
  ];
  return <Shell links={links} nome={nome ?? user.email ?? "Imobiliária"} papel="Administrador" marca={MARCA}>{children}</Shell>;
}
