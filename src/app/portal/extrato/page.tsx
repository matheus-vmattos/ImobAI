import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Icon } from "@/components/Icon";
import { getSessao } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { carregarConta, saldoCobranca } from "../conta";
import { DadosPagamento } from "../DadosPagamento";

const IC: Record<string, [string, string]> = { cobranca: ["warn", "receipt"], pagamento: ["ok", "check"], abono: ["", "check"], repasse: ["dev", "wallet"] };

export default async function Extrato({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await getSessao();
  const conta = await carregarConta(supabase);
  const hoje = new Date().toISOString().slice(0, 10);
  const { saldo, movimentos } = conta.extrato;

  return (
    <>
      <section className="hero">
        <h1>Extrato</h1>
        <p className="muted">Tudo o que foi cobrado e pago, semana a semana.</p>
      </section>
      <Aviso ok={ok} erro={erro} />

      <div className="saldo">
        <span className="label">{conta.devido > 0 ? "Em aberto com a imobiliária" : "Situação"}</span>
        <span className="v" style={{ color: conta.devido > 0 ? "var(--warn)" : "var(--ok)" }}>{conta.devido > 0 ? BRL(conta.devido) : "Em dia"}</span>
        <span className="muted small">{saldo > 0 ? `Crédito de ${BRL(saldo)} para as próximas cobranças.` : conta.emConferencia.length ? `${conta.emConferencia.length} comprovante(s) em conferência.` : " "}</span>
        {conta.devido > 0 && <div className="actions" style={{ marginTop: 6 }}><Link className="btn light" href="/portal/pagar">Enviar comprovante</Link></div>}
      </div>

      {conta.recusados.map((p) => <div key={p.id} className="alert erro">Comprovante de {BRL(p.valor)} não confirmado: {p.motivo_recusa}</div>)}

      {conta.abertas.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Em aberto</h2><span className="count">{conta.abertas.length}</span></div>
          <div className="box">
            {conta.abertas.map((c) => (
              <Link key={c.id} href={`/portal/cobrancas/${c.id}`} className="mv" style={{ textDecoration: "none" }}>
                <span className={`ic ${c.vencimento < hoje ? "warn" : ""}`}><Icon name="receipt" /></span>
                <span className="t"><b>Cobrança {data(c.inicio).slice(0, 5)} a {data(c.fim).slice(0, 5)}</b>
                  <small style={{ color: c.vencimento < hoje ? "var(--bad)" : undefined }}>{c.linhas.length} contas · vence {data(c.vencimento)}{Number(c.pago) > 0 ? ` · pago ${BRL(c.pago)}` : ""}</small></span>
                <span className="v">{BRL(saldoCobranca(c))}</span><Icon name="chev" className="dim" />
              </Link>
            ))}
          </div>
          <DadosPagamento pagar={conta.pagar} />
        </section>
      )}

      {conta.emConferencia.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Em conferência</h2></div>
          <div className="box">{conta.emConferencia.map((p) => (
            <div key={p.id} className="mv"><span className="ic dev"><Icon name="refresh" /></span><span className="t"><b>Comprovante enviado</b><small>{data(p.created_at)} · a imobiliária vai conferir</small></span><span className="v">{BRL(p.valor)}</span></div>
          ))}</div>
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><h2>Movimentos</h2></div>
        {movimentos.length ? (
          <div className="box">{movimentos.map((m, i) => {
            const [cls, ic] = IC[m.tipo];
            const inner = (<><span className={`ic ${cls}`}><Icon name={ic} /></span><span className="t"><b>{m.descricao}</b><small>{data(m.data)}</small></span>
              <span className={`v ${m.valor > 0 ? "pos" : ""}`}>{m.valor > 0 ? "+ " : "− "}{BRL(Math.abs(m.valor))}</span></>);
            return m.tipo === "cobranca"
              ? <Link key={i} href={`/portal/cobrancas/${m.ref}`} className="mv" style={{ textDecoration: "none" }}>{inner}</Link>
              : <div key={i} className="mv">{inner}</div>;
          })}</div>
        ) : <div className="empty">Nenhuma cobrança ainda. Quando a imobiliária pagar contas suas, elas aparecem aqui toda semana.</div>}
      </section>
    </>
  );
}
