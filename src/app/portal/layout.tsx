import { redirect } from "next/navigation";
import { Topo } from "@/components/Topo";
import { getSessao } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, papel } = await getSessao();
  if (papel === "admin") redirect("/admin");
  const { data: p } = await supabase.from("proprietarios").select("nome").eq("user_id", user.id).maybeSingle();
  return (
    <>
      <Topo links={[{ href: "/portal", label: "Meus imóveis" }]} nome={p?.nome ?? user.email ?? ""} />
      <main className="wrap">{children}</main>
    </>
  );
}
