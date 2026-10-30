import { Topo } from "@/components/Topo";
import { exigirAdmin } from "@/lib/auth";

const LINKS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/proprietarios", label: "Proprietários" },
  { href: "/admin/condominios", label: "Condomínios" },
  { href: "/admin/imoveis", label: "Imóveis" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { nome, user } = await exigirAdmin();
  return (
    <>
      <Topo links={LINKS} nome={nome ?? user.email ?? "Imobiliária"} />
      <main className="wrap">{children}</main>
    </>
  );
}
