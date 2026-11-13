import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { Icon } from "@/components/Icon";
import { exigirAdmin } from "@/lib/auth";
import { cobrancasAbertas, lerConfig } from "@/lib/cobrancas";
import type { LinhaCobranca } from "@/lib/contaCorrente";
import { BRL, data } from "@/lib/format";
import { conferirPagamento, recusarPagamento } from "../../actions";

const FORMA: Record<string, string> = { deposito: "Depósito", pix: "Pix", transferencia: "Transferência", outro: "Outro" };

export default async function ConferirPagamento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const [{ id }, { erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const { data: p } = await supabase.from("pagamentos").select("*, proprietarios(nome)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [abertas, cfg] = await Promise.all([cobrancasAbertas(supabase, p.pagador_id), lerConfig(supabase)]);
  const { data: detalhes } = await supabase.from("cobrancas").select("id, inicio, fim, linhas").in("id", abertas.map((c) => c.id));
  const linhasDe = new Map((detalhes ?? []).map((d) => [d.id as string, d as { inicio: string; fim: string; linhas: LinhaCobranca[] }]));
  const devido = abertas.reduce((a, c) => a + c.saldo, 0);
  const dif = Math.round((devido - Number(p.valor)) * 100) / 100;
  const nome = (p.proprietarios as { nome: string }).nome;
  const conferido = p.status !== "informado";

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/cobrancas">Cobranças</Link><span>/</span><span>Conferir pagamento</span></div>
        <h1>Conferir pagamento</h1>
        <p className="muted">{nome} enviou {p.comprovantes.length} {p.comprovantes.length === 1 ? "comprovante" : "comprovantes"} em {data(p.created_at)} · {FORMA[p.forma]} de {data(p.data)}</p>
      </section>
      <Aviso erro={erro} />
      {conferido && <div className="alert">Este pagamento já foi {p.status === "confirmado" ? `confirmado (${BRL(p.valor_confirmado)})` : `recusado: ${p.motivo_recusa}`}.</div>}

      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 360px) minmax(0, 1fr)" }}>
        <div className="panel">
          <div className="sec-h"><h2>Comprovantes</h2><span className="count">{p.comprovantes.length}</span></div>
          <div className="thumbs">
            {p.comprovantes.map((c: string, n: number) => (
              <a key={c} href={`/comprovantes/${p.id}/${n}`} target="_blank" rel="noreferrer">
                {c.endsWith(".pdf") ? "PDF" : <img src={`/comprovantes/${p.id}/${n}`} alt={`Comprovante ${n + 1}`} />}
              </a>
            ))}
            {!p.comprovantes.length && <span className="muted small">Sem arquivo.</span>}
          </div>
          <div className="kv small" style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex" }}><span className="muted">Informado</span><span className="num" style={{ marginLeft: "auto" }}>{BRL(p.valor)}</span></div>
          </div>
          {p.observacao && <div className="alert small">“{p.observacao}”</div>}
        </div>

        <div className="panel">
          <div className="sec-h"><h2>Em aberto de {nome}</h2><span className="count">{abertas.length}</span></div>
          {abertas.length ? (
            <div className="box tbl-wrap"><table style={{ minWidth: 480 }}>
              <thead><tr><th>Conta</th><th>Onde</th><th className="r">Valor</th></tr></thead>
              <tbody>{abertas.map((c) => {
                const d = linhasDe.get(c.id);
                return [
                  <tr key={c.id}><td colSpan={2}><b>Cobrança {data(d?.inicio).slice(0, 5)} a {data(d?.fim).slice(0, 5)}</b> <span className="muted small">· vence {data(c.vencimento)}</span></td>
                    <td className="r num"><b>{BRL(c.saldo)}</b>{c.saldo !== Number(c.total) && <span className="muted small"> de {BRL(c.total)}</span>}</td></tr>,
                  ...(d?.linhas ?? []).map((l, i) => (
                    <tr key={c.id + i}><td style={{ paddingLeft: 28 }}>{l.descricao}</td><td className="muted">{l.onde}</td><td className="r num muted">{BRL(l.valor)}</td></tr>
                  )),
                ];
              })}</tbody>
            </table></div>
          ) : <div className="empty">Nada em aberto. O valor fica de crédito para a próxima cobrança.</div>}

          {!conferido && (
            <form action={conferirPagamento} style={{ display: "grid", gap: 12 }}>
              <input type="hidden" name="id" value={p.id} />
              <div className="row2" style={{ alignItems: "end" }}>
                <div className="field"><span className="label">Total em aberto</span><span className="num" style={{ fontSize: 18, fontWeight: 600 }}>{BRL(devido)}</span></div>
                <div className="field"><label className="label" htmlFor="valor">Valor que caiu na conta (R$)</label>
                  <input id="valor" name="valor" inputMode="decimal" defaultValue={String(p.valor).replace(".", ",")} required /></div>
              </div>
              {dif > 0 && (
                <div className="row2">
                  <label className="radio"><input type="radio" name="abonar" value="sim" defaultChecked={dif <= Number(cfg.abono_ate)} />
                    <span><b>Abonar a diferença</b><small>Até {BRL(cfg.abono_ate)} (configuração). Fica registrado no extrato.</small></span></label>
                  <label className="radio"><input type="radio" name="abonar" value="nao" defaultChecked={dif > Number(cfg.abono_ate)} />
                    <span><b>Deixar em aberto</b><small>{BRL(dif)} continua devido.</small></span></label>
                </div>
              )}
              {dif < 0 && <p className="small muted" style={{ margin: 0 }}>Pagou {BRL(-dif)} a mais: fica de crédito para a próxima cobrança.</p>}
              <div className="actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn primary"><Icon name="check" />Confirmar pagamento</button>
              </div>
            </form>
          )}
          {!conferido && (
            <details><summary className="btn ghost sm">Recusar comprovante</summary>
              <form action={recusarPagamento} className="inline-form" style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={p.id} />
                <div className="field"><label className="label" htmlFor="motivo">Motivo</label><input id="motivo" name="motivo" placeholder="Não encontramos o valor no extrato" /></div>
                <button className="btn danger sm" style={{ height: 38 }}>Recusar</button>
              </form></details>
          )}
        </div>
      </div>
    </>
  );
}
