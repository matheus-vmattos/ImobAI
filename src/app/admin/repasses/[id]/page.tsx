import Link from "next/link";
import { notFound } from "next/navigation";
import { Imprimir } from "@/components/Imprimir";
import { RelatorioRepasse, SELECT_REPASSE, type RepasseFechado } from "@/components/RelatorioRepasse";
import { exigirAdmin } from "@/lib/auth";
import { nomeMes } from "@/lib/format";
import { reabrirRepasse } from "../actions";

export default async function RepasseAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("repasses").select(SELECT_REPASSE).eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as unknown as RepasseFechado;
  const mes = r.competencia.slice(0, 7);
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href={`/admin/repasses?mes=${mes}`}>Repasses</Link><span>/</span><span>{nomeMes(mes)}</span></div>
        <h1>{r.proprietarios.nome}</h1>
        <p className="muted" style={{ margin: 0 }}>Relatório de repasse · {nomeMes(mes)}</p>
      </section>
      <div className="actions">
        <Imprimir />
        <form action={reabrirRepasse} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={r.id} /><button className="btn danger sm">Reabrir repasse</button></form>
      </div>
      <RelatorioRepasse r={r} />
    </>
  );
}
