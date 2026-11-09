import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessao } from "@/lib/auth";
import type { LinhaCobranca } from "@/lib/contaCorrente";
import { BRL, data } from "@/lib/format";
import { saldoCobranca, type CobrancaPortal } from "../../conta";
import { DadosPagamento } from "../../DadosPagamento";

export default async function CobrancaPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await getSessao();
  const [{ data: c }, { data: cfg }] = await Promise.all([
    supabase.from("cobrancas").select("*").eq("id", id).maybeSingle<CobrancaPortal>(),
    supabase.from("config").select("favorecido, banco, pix").maybeSingle(),
  ]);
  if (!c) notFound();
  const grupos = new Map<string, LinhaCobranca[]>();
  c.linhas.forEach((l) => { const k = l.onde.split(" · ")[0] || "Outros"; grupos.set(k, [...(grupos.get(k) ?? []), l]); });
  const saldo = saldoCobranca(c);
  const hoje = new Date().toISOString().slice(0, 10);
  const pill = c.status === "paga" ? ["paga", "Paga"] : c.vencimento < hoje ? ["bad", "Vencida"] : ["warn", "A pagar"];

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/portal/extrato">Extrato</Link><span>/</span><span>Cobrança</span></div>
        <h1>Cobrança · {data(c.inicio).slice(0, 5)} a {data(c.fim).slice(0, 5)} <span className={`pill ${pill[0]}`} style={{ verticalAlign: "middle" }}>{pill[1]}</span></h1>
        <p className="muted">Vence em {data(c.vencimento)}</p>
      </section>

      <div className="box">
        {[...grupos].map(([g, ls]) => (
          <div key={g}>
            <div className="wk">{g}</div>
            {ls.map((l, i) => (
              <div key={i} className="mv">
                <span className="t"><b>{l.descricao}</b><small>{[l.onde.split(" · ").slice(1).join(" · "), l.proprietario].filter(Boolean).join(" · ")}</small></span>
                {l.temPdf && l.despesaId && <a className="pill bad" style={{ textDecoration: "none" }} href={`/despesas/${l.despesaId}/pdf`} target="_blank" rel="noreferrer">PDF</a>}
                <span className="v">{l.valor < 0 ? "− " : ""}{BRL(Math.abs(l.valor))}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="mv" style={{ background: "var(--surface-2)" }}><span className="t"><b>Total</b></span><span className="v" style={{ fontSize: 17 }}>{BRL(c.total)}</span></div>
        {Number(c.pago) + Number(c.abonado) + Number(c.descontado) > 0 && (
          <div className="mv"><span className="t"><b>Já pago</b><small>{Number(c.abonado) > 0 ? `inclui ${BRL(c.abonado)} abonados` : Number(c.descontado) > 0 ? "descontado no repasse" : " "}</small></span>
            <span className="v pos">{BRL(Number(c.pago) + Number(c.abonado) + Number(c.descontado))}</span></div>
        )}
      </div>

      {c.status === "aberta" && (
        <>
          <DadosPagamento pagar={cfg} />
          <div className="actions"><Link className="btn light" href={`/portal/pagar?cobranca=${c.id}`}>Enviar comprovante · {BRL(saldo)}</Link></div>
        </>
      )}
    </>
  );
}
