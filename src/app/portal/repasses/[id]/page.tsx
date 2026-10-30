import Link from "next/link";
import { notFound } from "next/navigation";
import { Imprimir } from "@/components/Imprimir";
import { RelatorioRepasse, SELECT_REPASSE, type RepasseFechado } from "@/components/RelatorioRepasse";
import { getSessao } from "@/lib/auth";
import { nomeMes } from "@/lib/format";

export default async function RepassePortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSessao();
  const { data } = await supabase.from("repasses").select(SELECT_REPASSE).eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as unknown as RepasseFechado;
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/portal/repasses">Repasses</Link><span>/</span><span>{nomeMes(r.competencia.slice(0, 7))}</span></div>
        <h1>Repasse de {nomeMes(r.competencia.slice(0, 7))}</h1>
      </section>
      <div className="actions"><Imprimir /></div>
      <RelatorioRepasse r={r} />
    </>
  );
}
