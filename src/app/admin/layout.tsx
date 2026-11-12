import { Shell } from "@/components/Topo";
import type { NavItem } from "@/components/NavLinks";
import { exigirAdmin } from "@/lib/auth";
import { MARCA } from "@/lib/marca";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome, user, supabase } = await exigirAdmin();
  const [{ count: conferir }] = await Promise.all([
    supabase.from("pagamentos").select("*", { count: "exact", head: true }).eq("status", "informado"),
  ]);
  const links: NavItem[] = [
    { href: "/admin", label: "Visão geral", icon: "grid" },
    { href: "/admin/imoveis", label: "Imóveis", icon: "home", grupo: "Carteira" },
    { href: "/admin/proprietarios", label: "Proprietários", icon: "users", grupo: "Carteira" },
    { href: "/admin/condominios", label: "Condomínios", icon: "building", grupo: "Carteira" },
    { href: "/admin/alugueis", label: "Aluguéis", icon: "bank", grupo: "Financeiro" },
    { href: "/admin/despesas", label: "Despesas", icon: "receipt", grupo: "Financeiro" },
    { href: "/admin/cobrancas", label: "Cobranças", icon: "coins", grupo: "Financeiro", badge: conferir ?? 0 },
    { href: "/admin/repasses", label: "Repasses", icon: "wallet", grupo: "Financeiro" },
    { href: "/admin/notificacoes", label: "E-mails", icon: "mail", grupo: "Imobiliária" },
    { href: "/admin/atividade", label: "Atividade", icon: "repeat", grupo: "Imobiliária" },
    { href: "/admin/configuracoes", label: "Configurações", icon: "file", grupo: "Imobiliária" },
  ];
  return <Shell links={links} nome={nome ?? user.email ?? "Imobiliária"} papel="Administrador" marca={MARCA}>{children}</Shell>;
}
