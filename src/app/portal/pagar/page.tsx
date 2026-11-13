import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { getSessaoPortal } from "@/lib/auth";
import { carregarConta, saldoCobranca } from "../conta";
import { DadosPagamento } from "../DadosPagamento";
import { FormPagamento } from "./FormPagamento";

export default async function Pagar({ searchParams }: { searchParams: Promise<{ cobranca?: string; erro?: string }> }) {
  const { cobranca, erro } = await searchParams;
  const { supabase, cadastros } = await getSessaoPortal();
  const conta = await carregarConta(supabase);
  const pagadores = cadastros.map((c) => ({ ...c, devido: conta.abertas.filter((a) => a.pagador_id === c.id).reduce((s, a) => s + saldoCobranca(a), 0) }))
    .sort((a, b) => b.devido - a.devido);
  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/portal/extrato">Extrato</Link><span>/</span><span>Enviar comprovante</span></div>
        <h1>Enviar comprovante</h1>
      </section>
      <Aviso erro={erro} />
      <DadosPagamento pagar={conta.pagar} />
      <FormPagamento pagadores={pagadores} devido={conta.devido} cobrancaId={cobranca} />
    </>
  );
}
