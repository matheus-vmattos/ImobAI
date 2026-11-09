import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import type { LinhaCobranca } from "@/lib/contaCorrente";
import { BRL, data } from "@/lib/format";
import { ajusteManual, estornarLinha } from "../actions";

const FORMA: Record<string, string> = { deposito: "Depósito", pix: "Pix", transferencia: "Transferência", outro: "Outro" };

export default async function CobrancaAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const { data: c } = await supabase.from("cobrancas").select("*, proprietarios(nome), alocacoes(valor, pagamentos(id, data, forma, valor_confirmado))").eq("id", id).maybeSingle();
  if (!c) notFound();
  const linhas = c.linhas as LinhaCobranca[];
  const alocs = (c.alocacoes ?? []) as { valor: number; pagamentos: { id: string; data: string; forma: string; valor_confirmado: number } }[];
  const saldo = Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado);
  const back = `/admin/cobrancas/${id}`;
  const nome = (c.proprietarios as { nome: string }).nome;

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/cobrancas">Cobranças</Link><span>/</span><span>{nome}</span></div>
        <h1>{nome} · {data(c.inicio).slice(0, 5)} a {data(c.fim).slice(0, 5)}</h1>
        <div className="kpis">
          <div className="kpi"><span className="label">Total</span><span className="v num">{BRL(c.total)}</span><small>{linhas.length} linhas · emitida {data(c.emitida_em)}</small></div>
          <div className="kpi"><span className="label">Pago</span><span className="v num">{BRL(c.pago)}</span><small>{alocs.length} pagamento(s)</small></div>
          <div className="kpi"><span className="label">Abonado / repasse</span><span className="v num">{BRL(Number(c.abonado) + Number(c.descontado))}</span><small>abono {BRL(c.abonado)} · repasse {BRL(c.descontado)}</small></div>
          <div className="kpi"><span className="label">Em aberto</span><span className={`v num ${saldo > 0 ? "attn" : ""}`}>{BRL(Math.max(0, saldo))}</span><small>vence {data(c.vencimento)}</small></div>
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      <section className="sec">
        <div className="sec-h"><h2>Contas</h2><span className="count">{linhas.length}</span></div>
        <div className="box tbl-wrap"><table>
          <thead><tr><th>Conta</th><th>Onde</th><th>Proprietário</th><th className="r">Valor</th><th /></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>{l.despesaId ? <Link className="rowlink" href={`/admin/despesas/${l.despesaId}`}>{l.descricao}</Link> : l.descricao}</td>
                <td className="muted">{l.onde}</td><td className="muted">{l.proprietario}</td>
                <td className="r num">{l.valor < 0 ? "− " : ""}{BRL(Math.abs(l.valor))}</td>
                <td className="r">{l.tipo === "despesa" && (
                  <details><summary className="btn ghost sm">Estornar</summary>
                    <form action={estornarLinha} className="inline-form" style={{ marginTop: 8, justifyContent: "flex-end" }}>
                      <input type="hidden" name="item_id" value={l.ref} /><input type="hidden" name="voltar" value={back} />
                      <input className="inp" name="motivo" placeholder="Motivo" style={{ width: 180 }} /><button className="btn sm">Lançar crédito</button>
                    </form></details>
                )}</td>
              </tr>
            ))}
            <tr className="total"><td colSpan={3}>Total</td><td className="r num">{BRL(c.total)}</td><td /></tr>
          </tbody>
        </table></div>
        <p className="small muted" style={{ margin: 0 }}>A cobrança é uma foto fixa do que foi enviado. Correções entram como ajuste na próxima.</p>
      </section>

      <div className="cols">
        <section className="panel">
          <div className="sec-h"><h2>Pagamentos usados</h2></div>
          {alocs.length ? alocs.map((a) => (
            <div key={a.pagamentos.id} className="actions"><span style={{ flex: 1 }}>{FORMA[a.pagamentos.forma]} de {data(a.pagamentos.data)}</span><span className="num">{BRL(a.valor)}</span></div>
          )) : <p className="muted small" style={{ margin: 0 }}>Nenhum pagamento ainda.</p>}
        </section>
        <form action={ajusteManual} className="panel">
          <div className="sec-h"><h2>Ajuste para a próxima cobrança</h2></div>
          <input type="hidden" name="pagador_id" value={c.pagador_id} /><input type="hidden" name="voltar" value={back} />
          <div className="field"><label className="label" htmlFor="descricao">Descrição</label><input id="descricao" name="descricao" required placeholder="Ex.: juros do boleto pago com atraso" /></div>
          <div className="row2">
            <div className="field"><label className="label" htmlFor="valor">Valor (R$)</label><input id="valor" name="valor" inputMode="decimal" required /></div>
            <div className="field"><label className="label" htmlFor="sinal">Tipo</label>
              <select id="sinal" name="sinal"><option value="debito">Cobrar do proprietário</option><option value="credito">Crédito ao proprietário</option></select></div>
          </div>
          <div className="actions"><button className="btn">Lançar ajuste</button></div>
        </form>
      </div>
    </>
  );
}
