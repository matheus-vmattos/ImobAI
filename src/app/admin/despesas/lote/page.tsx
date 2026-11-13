import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { carregarCarteira } from "../dados";
import { LoteForm } from "./LoteForm";

export default async function Lote({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const { imoveis } = await carregarCarteira(supabase);
  const { data: ids } = await supabase.from("imoveis").select("id, identificacao");
  const ident = new Map((ids ?? []).map((i) => [i.id as string, i.identificacao as string]));
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/despesas">Despesas</Link><span>/</span><span>Vários PDFs</span></div>
        <h1>Lançar vários PDFs</h1>
        <p className="muted">Para os boletos do mês: escolha todos os arquivos, confira imóvel e valor de cada um e envie de uma vez.</p>
      </section>
      <Aviso erro={erro} />
      <LoteForm imoveis={imoveis.map((i) => ({ id: i.id, rotulo: [i.condominio, i.rotulo].filter(Boolean).join(" · "), identificacao: ident.get(i.id) ?? i.rotulo }))} />
    </>
  );
}
