import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Icon } from "@/components/Icon";
import { getSessao } from "@/lib/auth";
import { BRL, data, nomeMes, hojeSP, diaSP } from "@/lib/format";
import { MARCA } from "@/lib/marca";
import { carregarConta, saldoCobranca } from "../conta";
import { DadosPagamento } from "../DadosPagamento";

type Mov = { data: string; tipo: string; descricao: string; valor: number; href?: string; sub: string };
const IC: Record<string, [string, string]> = { cobranca: ["warn", "receipt"], pagamento: ["", "check"], abono: ["", "check"], repasse: ["dev", "wallet"], recebimento: ["ok", "arrow"] };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default async function Extrato({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; ver?: string }> }) {
  const { ok, erro, ver } = await searchParams;
  const { supabase } = await getSessao();
  const [conta, { data: reps }] = await Promise.all([
    carregarConta(supabase),
    supabase.from("repasses").select("id, competencia, liquido, fechado_em, linhas").order("fechado_em", { ascending: false }).limit(60),
  ]);
  const filtro = ver === "recebi" || ver === "paguei" ? ver : "tudo";
  const hoje = hojeSP();

  // o que recebeu (repasses fechados) e o que pagou (contas da semana), num lugar só
  const movs: Mov[] = [
    ...((reps ?? []) as { id: string; competencia: string; liquido: number; fechado_em: string; linhas: { tipo: string }[] }[]).map((r) => ({
      data: diaSP(r.fechado_em), tipo: "recebimento", descricao: `Você recebeu os aluguéis de ${nomeMes(r.competencia.slice(0, 7)).split("/")[0]}`,
      valor: Number(r.liquido), href: `/portal/repasses/${r.id}`, sub: `${r.linhas.filter((l) => l.tipo === "aluguel").length} aluguéis · ver detalhes`,
    })),
    ...conta.extrato.movimentos.map((m) => ({
      data: diaSP(m.data), tipo: m.tipo, descricao: m.descricao, valor: m.valor,
      href: m.tipo === "cobranca" ? `/portal/cobrancas/${m.ref}` : undefined, sub: data(m.data),
    })),
  ].filter((m) => filtro === "tudo" || (filtro === "recebi" ? m.tipo === "recebimento" : m.tipo !== "recebimento"))
    .sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10)));
  const porMes = new Map<string, Mov[]>();
  movs.forEach((m) => { const k = m.data.slice(0, 7); porMes.set(k, [...(porMes.get(k) ?? []), m]); });

  return (
    <>
      <section className="hero" style={{ gap: 10 }}>
        <h1>Extrato</h1>
        <div className="seg" style={{ justifySelf: "stretch", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[["tudo", "Tudo"], ["recebi", "Recebi"], ["paguei", "Paguei"]].map(([k, t]) => (
            <Link key={k} href={k === "tudo" ? "/portal/extrato" : `/portal/extrato?ver=${k}`} aria-pressed={filtro === k}
              style={{ textAlign: "center", textDecoration: "none", padding: "7px 0", borderRadius: 7, fontSize: 13, fontWeight: 500, color: filtro === k ? "var(--fg)" : "var(--muted)", background: filtro === k ? "var(--surface-2)" : undefined }}>{t}</Link>
          ))}
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      {conta.recusados.map((p) => <div key={p.id} className="alert erro">Não conseguimos confirmar o comprovante de {BRL(p.valor)}: {p.motivo_recusa}</div>)}

      {filtro !== "recebi" && conta.abertas.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Para pagar</h2></div>
          <div className="box">
            {conta.abertas.map((c) => (
              <Link key={c.id} href={`/portal/cobrancas/${c.id}`} className="mv" style={{ textDecoration: "none" }}>
                <span className={`ic ${c.vencimento < hoje ? "bad" : "warn"}`}><Icon name="receipt" /></span>
                <span className="t"><b>Contas da semana {data(c.inicio).slice(0, 5)} a {data(c.fim).slice(0, 5)}</b>
                  <small style={{ color: c.vencimento < hoje ? "var(--bad)" : undefined }}>{c.linhas.length} contas · {c.vencimento < hoje ? "venceu" : "até"} {data(c.vencimento)}{Number(c.pago) > 0 ? ` · já pago ${BRL(c.pago)}` : ""}</small></span>
                <span className="v">{BRL(saldoCobranca(c))}</span><Icon name="chev" className="dim" />
              </Link>
            ))}
            {conta.emConferencia.map((p) => (
              <div key={p.id} className="mv"><span className="ic dev"><Icon name="refresh" /></span><span className="t"><b>Comprovante recebido</b><small>{data(p.created_at)} · a {MARCA} está conferindo</small></span><span className="v">{BRL(p.valor)}</span></div>
            ))}
          </div>
          {!conta.emConferencia.length && <><DadosPagamento pagar={conta.pagar} /><div className="actions"><Link className="btn light" href="/portal/pagar">Enviar comprovante</Link></div></>}
        </section>
      )}
      {filtro !== "recebi" && conta.extrato.saldo > 0 && <div className="alert ok">Você tem {BRL(conta.extrato.saldo)} de crédito para as próximas contas.</div>}

      {movs.length ? [...porMes].map(([mes, ms]) => (
        <section key={mes} className="sec" style={{ gap: 6 }}>
          <div className="wk" style={{ padding: "4px 2px" }}>{MESES[Number(mes.slice(5, 7)) - 1]} de {mes.slice(0, 4)}</div>
          <div className="box">{ms.map((m, i) => {
            const [cls, ic] = IC[m.tipo] ?? ["", "check"];
            const inner = (<><span className={`ic ${cls}`}><Icon name={ic} /></span><span className="t"><b>{m.descricao}</b><small>{m.sub}</small></span>
              <span className={`v ${m.tipo === "recebimento" ? "pos" : ""}`}>{m.tipo === "cobranca" ? "− " : m.tipo === "recebimento" ? "+ " : ""}{BRL(Math.abs(m.valor))}</span></>);
            return m.href ? <Link key={i} href={m.href} className="mv" style={{ textDecoration: "none" }}>{inner}</Link> : <div key={i} className="mv">{inner}</div>;
          })}</div>
        </section>
      )) : <div className="empty">{filtro === "recebi" ? "Nenhum recebimento ainda." : "Nada por aqui ainda."}</div>}
    </>
  );
}
