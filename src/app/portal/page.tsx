import { Aviso } from "@/components/Aviso";
import { getSessao } from "@/lib/auth";
import { BRL, BRL0, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { carregarPortal } from "./dados";
import { carregarDespesas } from "./despesas";
import { Historico } from "./Historico";
import { ListaImoveis } from "./ListaImoveis";
import { Pendencias } from "./Pendencias";
import { Renovacoes, type ContratoRenovacao } from "./Renovacoes";
import type { Renovacao } from "@/lib/types";

export default async function Portal({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, proprietarioIds, cadastros } = await getSessao();
  const [{ imoveis, condominios }, { pendentes, historico }, { data: p }, { data: rens }] = await Promise.all([
    carregarPortal(supabase, proprietarioIds),
    carregarDespesas(supabase),
    Promise.resolve({ data: cadastros[0] ?? null }),
    supabase.from("renovacoes").select("*"),
  ]);
  const primeiroNome = (p?.nome ?? "").split(" ")[0];
  const cnt = (s: string) => imoveis.filter((i) => i.status === s).length;
  const locados = imoveis.filter((i) => i.status === "locado");
  const bruto = locados.reduce((a, i) => a + (i.aluguel ?? 0) * i.percentual / 100, 0);
  const vencendo = locados.filter((i) => i.fim && diasAte(i.fim) <= RENOVACAO_DIAS).length;
  const semResposta = pendentes.filter((d) => d.situacao === "aguardando");
  const respostas = (rens ?? []) as Renovacao[];
  const renovacoes: ContratoRenovacao[] = locados
    .filter((i) => i.contratoId && i.fim && diasAte(i.fim) <= RENOVACAO_DIAS)
    .sort((a, b) => a.fim!.localeCompare(b.fim!))
    .map((i) => ({ contratoId: i.contratoId!, imovel: [condominios.find((c) => c.id && c.id === i.condominioId)?.nome, i.nome].filter(Boolean).join(" · "),
      aluguel: i.aluguel ?? 0, fim: i.fim!, inquilino: i.inquilino, resposta: respostas.find((r) => r.contrato_id === i.contratoId) ?? null }));

  if (!imoveis.length) {
    return (
      <section className="hero">
        <div className="label">Portal do proprietário</div>
        <h1>Olá{primeiroNome ? `, ${primeiroNome}` : ""}.</h1>
        <div className="empty">Ainda não há imóveis vinculados ao seu cadastro. Fale com a imobiliária.</div>
      </section>
    );
  }

  const frases = [
    semResposta.length ? <><b>{semResposta.length} despesa{semResposta.length > 1 ? "s" : ""}</b> aguarda{semResposta.length > 1 ? "m" : ""} sua decisão</> : null,
    vencendo ? <><b>{vencendo} contrato{vencendo > 1 ? "s" : ""}</b> vence{vencendo > 1 ? "m" : ""} em até {RENOVACAO_DIAS} dias</> : null,
  ].filter(Boolean);

  return (
    <>
      <section className="hero">
        <div className="label">Portal do proprietário</div>
        <h1>
          Olá{primeiroNome ? `, ${primeiroNome}` : ""}.{" "}
          {frases.length ? <>{frases[0]}{frases[1] && <> e {frases[1]}</>}.</> : "Tudo em dia."}
        </h1>
        <div className="kpis">
          <div className="kpi"><span className="label">Para aprovar</span><span className={`v ${semResposta.length ? "attn" : ""}`}>{semResposta.length}</span>
            <small>{semResposta.length ? `${BRL(semResposta.reduce((a, d) => a + d.total, 0))} no total` : "nenhuma pendência"}</small></div>
          <div className="kpi"><span className="label">Imóveis</span><span className="v">{imoveis.length}</span>
            <small>{cnt("locado")} locados · {cnt("vazio")} vazios · {cnt("devolucao")} em devolução</small></div>
          <div className="kpi"><span className="label">Aluguel bruto</span><span className="v">{BRL0(bruto)}</span><small>sua parte, por mês</small></div>
          <div className="kpi"><span className="label">Vencendo</span><span className={`v ${vencendo ? "attn" : ""}`}>{vencendo}</span><small>contratos em até {RENOVACAO_DIAS} dias</small></div>
        </div>
      </section>

      <Aviso ok={ok} erro={erro} />

      <section className="sec" id="pendencias">
        <div className="sec-h"><h2>Para aprovar</h2><span className="count">{pendentes.length ? `${pendentes.length} em aberto` : "tudo em dia"}</span><span className="rule" /></div>
        {pendentes.length ? <Pendencias pendentes={pendentes} condominios={condominios} /> : <div className="empty">Nenhuma despesa aguardando você.</div>}
      </section>

      {renovacoes.length > 0 && (
        <section className="sec" id="renovacoes">
          <div className="sec-h"><h2>Renovações</h2><span className="count">{renovacoes.filter((r) => !r.resposta).length} sem resposta</span><span className="rule" /></div>
          <Renovacoes itens={renovacoes} />
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><h2>Meus imóveis</h2><span className="count">{imoveis.length}</span><span className="rule" /></div>
        <ListaImoveis imoveis={imoveis} condominios={condominios} />
      </section>

      <section className="sec">
        <div className="sec-h"><h2>Histórico de despesas</h2><span className="rule" /></div>
        <Historico despesas={historico} />
      </section>
    </>
  );
}
