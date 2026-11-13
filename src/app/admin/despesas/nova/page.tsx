import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { carregarCarteira } from "../dados";
import { LancarDespesa } from "./LancarDespesa";

export default async function NovaDespesa({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const { condominios, imoveis } = await carregarCarteira(supabase);
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/despesas">Despesas</Link><span>/</span><span>Lançar</span></div>
        <h1>Lançar despesa</h1>
      </section>
      <Aviso erro={erro} />
      <LancarDespesa condominios={condominios} imoveis={imoveis} />
    </>
  );
}
