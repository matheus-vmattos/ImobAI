import { Aviso } from "@/components/Aviso";
import { getSessao } from "@/lib/auth";
import { diasAte, RENOVACAO_DIAS } from "@/lib/format";
import type { Renovacao } from "@/lib/types";
import { carregarPortal } from "../dados";
import { carregarDespesas } from "../despesas";
import { Historico } from "../Historico";
import { Pendencias } from "../Pendencias";
import { Renovacoes, type ContratoRenovacao } from "../Renovacoes";

export default async function Decidir({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, proprietarioIds } = await getSessao();
  const [{ imoveis, condominios }, { pendentes, historico }, { data: rens }] = await Promise.all([
    carregarPortal(supabase, proprietarioIds), carregarDespesas(supabase), supabase.from("renovacoes").select("*"),
  ]);
  const respostas = (rens ?? []) as Renovacao[];
  const renovacoes: ContratoRenovacao[] = imoveis
    .filter((i) => i.status === "locado" && i.contratoId && i.fim && diasAte(i.fim) <= RENOVACAO_DIAS)
    .sort((a, b) => a.fim!.localeCompare(b.fim!))
    .map((i) => ({ contratoId: i.contratoId!, imovel: [condominios.find((c) => c.id && c.id === i.condominioId)?.nome, i.nome].filter(Boolean).join(" · "),
      aluguel: i.aluguel ?? 0, fim: i.fim!, inquilino: i.inquilino, resposta: respostas.find((r) => r.contrato_id === i.contratoId) ?? null }));

  return (
    <>
      <section className="hero"><h1>Para responder</h1><p className="muted">Despesas que precisam da sua aprovação e contratos perto do fim.</p></section>
      <Aviso ok={ok} erro={erro} />
      <section className="sec" id="pendencias">
        <div className="sec-h"><h2>Despesas</h2><span className="count">{pendentes.length}</span></div>
        {pendentes.length ? <Pendencias pendentes={pendentes} condominios={condominios} /> : <div className="empty">Nenhuma despesa esperando você.</div>}
      </section>
      {renovacoes.length > 0 && (
        <section className="sec" id="renovacoes">
          <div className="sec-h"><h2>Renovações</h2><span className="count">{renovacoes.filter((r) => !r.resposta).length} sem resposta</span></div>
          <Renovacoes itens={renovacoes} voltar="/portal/decidir" />
        </section>
      )}
      <section className="sec">
        <div className="sec-h"><h2>Já respondidas</h2></div>
        <Historico despesas={historico.slice(0, 30)} />
      </section>
    </>
  );
}
