import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Icon } from "@/components/Icon";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { gerarAgora, registrarPagamento } from "./actions";

type Cob = { id: string; pagador_id: string; emitida_em: string; inicio: string; fim: string; vencimento: string; total: number; pago: number; abonado: number; descontado: number; status: string; linhas: unknown[]; proprietarios: { nome: string } };
type Pag = { id: string; pagador_id: string; valor: number; data: string; forma: string; created_at: string; comprovantes: string[]; proprietarios: { nome: string } };

const FORMA: Record<string, string> = { deposito: "Depósito", pix: "Pix", transferencia: "Transferência", outro: "Outro" };
const saldo = (c: Cob) => Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado);

export default async function Cobrancas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; ver?: string }> }) {
  const { ok, erro, ver } = await searchParams;
  const { supabase } = await exigirAdmin();
  const desde = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
  const [{ data: cs }, { data: ps }, { data: props }, { data: pend }, { data: ter }] = await Promise.all([
    supabase.from("cobrancas").select("id, pagador_id, emitida_em, inicio, fim, vencimento, total, pago, abonado, descontado, status, linhas, proprietarios(nome)")
      .or(`status.eq.aberta,emitida_em.gte.${desde}`).order("emitida_em", { ascending: false }),
    supabase.from("pagamentos").select("id, pagador_id, valor, data, forma, created_at, comprovantes, proprietarios(nome)").eq("status", "informado").order("created_at"),
    supabase.from("proprietarios").select("id, nome").is("pagador_id", null).order("nome"),
    supabase.from("despesa_itens").select("valor, taxa_adm, despesas!inner(status)", { count: "exact" })
      .eq("decisao", "reembolso").eq("responsavel", "proprietario").is("cobranca_id", null).eq("despesas.status", "enviada"),
    supabase.from("despesa_terceiros").select("id, nome, valor, despesas!inner(id, descricao, status, condominios(nome))").is("recebido_em", null).eq("despesas.status", "enviada"),
  ]);
  const terceiros = (ter ?? []) as unknown as { id: string; nome: string; valor: number; despesas: { id: string; descricao: string; condominios: { nome: string } | null } }[];
  const cobrancas = (cs ?? []) as unknown as Cob[];
  const pagamentos = (ps ?? []) as unknown as Pag[];
  const hoje = new Date().toISOString().slice(0, 10);
  const abertas = cobrancas.filter((c) => c.status === "aberta");
  const atrasadas = abertas.filter((c) => c.vencimento < hoje);
  const aReceber = abertas.reduce((a, c) => a + saldo(c), 0);
  const proxima = (pend ?? []).reduce((a, i) => a + Number(i.valor) + Number(i.taxa_adm), 0);
  const filtro = ver ?? "abertas";
  const vis = filtro === "abertas" ? abertas : filtro === "atrasadas" ? atrasadas : cobrancas;
  const situ = (c: Cob) => c.status === "paga" ? ["paga", "Paga"] : c.status === "cancelada" ? ["aguardando", "Cancelada"]
    : c.vencimento < hoje ? ["bad", `Atrasada · ${Math.round((Date.parse(hoje) - Date.parse(c.vencimento)) / 864e5)} dias`] : Number(c.pago) > 0 ? ["warn", "Parcial"] : ["aberta", "Aguardando"];

  return (
    <>
      <section className="hero">
        <div className="label">Financeiro</div>
        <h1>Cobranças</h1>
        <p className="muted">Toda semana as contas que os proprietários pagam por depósito ou Pix viram uma cobrança só. O e-mail sai junto.</p>
        <div className="kpis">
          <div className="kpi"><span className="label">Para conferir</span><span className={`v num ${pagamentos.length ? "attn" : ""}`}>{pagamentos.length}</span><small>comprovantes enviados</small></div>
          <div className="kpi"><span className="label">A receber</span><span className="v num">{BRL(aReceber)}</span><small>{abertas.length} cobranças em aberto</small></div>
          <div className="kpi"><span className="label">Atrasadas</span><span className={`v num ${atrasadas.length ? "attn" : ""}`}>{atrasadas.length}</span><small>{BRL(atrasadas.reduce((a, c) => a + saldo(c), 0))}</small></div>
          <div className="kpi"><span className="label">Próxima cobrança</span><span className="v num">{BRL(proxima)}</span><small>{(pend ?? []).length} contas já decididas</small></div>
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      <div className="actions">
        <form action={gerarAgora}><button className="btn primary" disabled={!(pend ?? []).length}><Icon name="receipt" />Gerar cobranças agora</button></form>
        <details><summary className="btn"><Icon name="plus" />Registrar pagamento recebido</summary>
          <form action={registrarPagamento} className="panel" style={{ marginTop: 10, maxWidth: 640 }} encType="multipart/form-data">
            <p className="small muted" style={{ margin: 0 }}>Para depósito que você viu no banco sem o proprietário mandar comprovante. Entra já conferido.</p>
            <div className="row2">
              <div className="field"><label className="label" htmlFor="pagador_id">Proprietário</label>
                <select id="pagador_id" name="pagador_id" required defaultValue=""><option value="" disabled>Escolha…</option>{(props ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="valor">Valor que caiu (R$)</label><input id="valor" name="valor" inputMode="decimal" required /></div>
            </div>
            <div className="row3">
              <div className="field"><label className="label" htmlFor="data">Data</label><input id="data" name="data" type="date" defaultValue={hoje} /></div>
              <div className="field"><label className="label" htmlFor="forma">Forma</label>
                <select id="forma" name="forma">{Object.entries(FORMA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div className="field"><label className="label" htmlFor="abonar">Diferença pequena</label>
                <select id="abonar" name="abonar"><option value="sim">Abonar</option><option value="nao">Deixar em aberto</option></select></div>
            </div>
            <div className="drop"><span>Comprovante (opcional)</span><input type="file" name="comprovantes" multiple accept="image/*,application/pdf" /></div>
            <div className="actions"><button className="btn primary">Registrar e dar baixa</button></div>
          </form>
        </details>
      </div>

      {pagamentos.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Comprovantes para conferir</h2><span className="count">{pagamentos.length}</span></div>
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Proprietário</th><th>Enviado</th><th>Forma</th><th className="r">Valor informado</th><th>Comprovantes</th><th /></tr></thead>
            <tbody>{pagamentos.map((p) => (
              <tr key={p.id}>
                <td>{p.proprietarios.nome}</td><td className="muted">{data(p.created_at)}</td><td className="muted">{FORMA[p.forma]}</td>
                <td className="r num">{BRL(p.valor)}</td><td className="muted">{p.comprovantes.length}</td>
                <td className="r"><Link className="btn primary sm" href={`/admin/cobrancas/pagamento/${p.id}`}>Conferir</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <section className="sec">
        <div className="toolbar">
          <div className="filters">
            {[["abertas", "Em aberto", abertas.length], ["atrasadas", "Atrasadas", atrasadas.length], ["todas", "Últimos 45 dias", cobrancas.length]].map(([k, t, n]) => (
              <Link key={k} href={`/admin/cobrancas?ver=${k}`} aria-pressed={filtro === k}>{t} <span className="n">{n}</span></Link>
            ))}
          </div>
        </div>
        {vis.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Proprietário</th><th>Semana</th><th className="r">Contas</th><th className="r">Total</th><th className="r">Em aberto</th><th>Vence</th><th>Situação</th><th /></tr></thead>
            <tbody>{vis.map((c) => {
              const [cls, rot] = situ(c);
              return (
                <tr key={c.id}>
                  <td><Link className="rowlink" href={`/admin/cobrancas/${c.id}`}>{c.proprietarios.nome}</Link></td>
                  <td className="muted num">{data(c.inicio).slice(0, 5)} a {data(c.fim).slice(0, 5)}</td>
                  <td className="r">{c.linhas.length}</td>
                  <td className="r num">{BRL(c.total)}</td>
                  <td className="r num">{c.status === "aberta" ? BRL(saldo(c)) : "—"}</td>
                  <td className="num">{data(c.vencimento)}</td>
                  <td><span className={`pill ${cls}`}>{rot}</span></td>
                  <td className="go">›</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">{filtro === "abertas" ? "Nenhuma cobrança em aberto." : "Nenhuma cobrança neste filtro."}</div>}
      </section>
      {terceiros.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>A receber de terceiros</h2><span className="count">{BRL(terceiros.reduce((a, t) => a + Number(t.valor), 0))}</span></div>
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Terceiro</th><th>Conta</th><th>Condomínio</th><th className="r">Parte</th><th /></tr></thead>
            <tbody>{terceiros.map((t) => (
              <tr key={t.id}><td>{t.nome}</td><td><Link className="rowlink" href={`/admin/despesas/${t.despesas.id}`}>{t.despesas.descricao}</Link></td>
                <td className="muted">{t.despesas.condominios?.nome}</td><td className="r num">{BRL(t.valor)}</td><td className="go">›</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}
