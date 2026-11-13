import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { SITUACAO_LABEL, situacao, TIPO_LABEL, type Decisao, type StatusReembolso, type TipoDespesa } from "@/lib/types";
import { alterarRateio, completarDespesa, confirmarReembolso, enviarDespesa, excluirDespesa, responderQuestionamento, terceiroRecebido } from "../actions";

type Despesa = {
  id: string; descricao: string; tipo: TipoDespesa; competencia: string | null; valor_total: number; regra: string; divisor: number | null;
  valor_fora: number; cobra_taxa_adm: boolean; pdf_path: string | null; prazo: string | null; status: "rascunho" | "enviada"; enviada_em: string | null;
  condominios: { nome: string; inquilino_reembolsa: boolean } | null; imoveis: { identificacao: string; endereco: string | null; condominios: { inquilino_reembolsa: boolean } | null } | null;
  rateada_inquilinos: boolean;
};
type Questionamento = { id: string; texto: string; created_at: string; resposta: string | null; respondido_em: string | null; proprietarios: { nome: string } };
type Item = {
  id: string; proprietario_id: string; cotas: number | null; percentual_dono: number; valor: number; taxa_adm: number;
  decisao: Decisao | null; comentario: string | null; reembolso: StatusReembolso | null; volta_inquilino: boolean; inquilino_lancado_em: string | null;
  imoveis: { identificacao: string }; proprietarios: { nome: string };
};

const REGRA: Record<string, string> = { cotas: "cotas", percentual: "%", fixo: "valor fixo", integral: "imóvel inteiro" };

export default async function DespesaAdmin({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: d }, { data: it }, { data: ter }, { data: qs }] = await Promise.all([
    supabase.from("despesas").select("*, condominios(nome, inquilino_reembolsa), imoveis(identificacao, endereco, condominios(inquilino_reembolsa))").eq("id", id).maybeSingle<Despesa>(),
    supabase.from("despesa_itens").select("*, imoveis(identificacao), proprietarios(nome)").eq("despesa_id", id),
    supabase.from("despesa_terceiros").select("id, nome, valor, recebido_em").eq("despesa_id", id).order("nome"),
    supabase.from("despesa_questionamentos").select("id, texto, created_at, resposta, respondido_em, proprietarios(nome)").eq("despesa_id", id).order("created_at"),
  ]);
  const questionamentos = (qs ?? []) as unknown as Questionamento[];
  if (!d) notFound();
  const itens = ((it ?? []) as Item[]).sort((a, b) => a.proprietarios.nome.localeCompare(b.proprietarios.nome) || a.imoveis.identificacao.localeCompare(b.imoveis.identificacao));
  const onde = d.condominios?.nome ?? [d.imoveis?.endereco, d.imoveis?.identificacao].filter(Boolean).join(" · ");
  const carteira = itens.reduce((a, i) => a + Number(i.valor), 0);
  const taxas = itens.reduce((a, i) => a + Number(i.taxa_adm), 0);
  const reembolsa = !!(d.condominios?.inquilino_reembolsa ?? d.imoveis?.condominios?.inquilino_reembolsa);
  const volta = itens.filter((i) => i.volta_inquilino).reduce((a, i) => a + Number(i.valor) + Number(i.taxa_adm), 0);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/despesas">Despesas</Link><span>/</span><span>{d.descricao}</span></div>
        <h1>{d.descricao}</h1>
        <p className="muted" style={{ margin: 0 }}>{onde} · {TIPO_LABEL[d.tipo]}{d.competencia ? ` · ${d.competencia}` : ""}</p>
        {reembolsa && (
          <form action={alterarRateio} className="actions" style={{ alignItems: "center" }}>
            <input type="hidden" name="id" value={d.id} /><input type="hidden" name="rateada" value={d.rateada_inquilinos ? "0" : "1"} />
            <span className={`pill ${d.rateada_inquilinos ? "ok" : "warn"}`}>{d.rateada_inquilinos ? "Despesa será rateada com os inquilinos" : "Despesa do proprietário"}</span>
            <button className="btn ghost sm">{d.rateada_inquilinos ? "Mudar para despesa do proprietário" : "Mudar para rateada com os inquilinos"}</button>
          </form>
        )}
      </section>
      <Aviso ok={ok} erro={erro} />

      <div className="kpis">
        <div className="kpi"><span className="label">Total da conta</span><span className="v">{BRL(d.valor_total)}</span>
          <small>{d.regra === "cotas" ? `${Number(d.divisor)} cotas` : REGRA[d.regra]}</small></div>
        <div className="kpi"><span className="label">Carteira</span><span className="v">{BRL(carteira)}</span><small>fora: {BRL(d.valor_fora)}</small></div>
        {reembolsa && <div className="kpi"><span className="label">Volta pelos inquilinos</span><span className="v">{BRL(volta)}</span><small>{itens.filter((i) => i.volta_inquilino).length} unidade(s) alugada(s)</small></div>}
        <div className="kpi"><span className="label">Taxa adm.</span><span className="v">{BRL(taxas)}</span><small>{d.cobra_taxa_adm ? "cobrada" : "não cobrada"}</small></div>
        <div className="kpi"><span className="label">Status</span><span className="v" style={{ fontSize: 18 }}>{d.status === "rascunho" ? "Rascunho" : "Enviada"}</span>
          <small>{d.enviada_em ? `em ${data(d.enviada_em)}` : "não visível ao proprietário"}{d.prazo ? ` · prazo ${data(d.prazo)}` : ""}</small></div>
      </div>

      <div className="actions">
        {d.pdf_path ? <a className="btn" href={`/despesas/${d.id}/pdf`} target="_blank" rel="noreferrer">Ver PDF</a> : <span className="muted small">Sem PDF anexado</span>}
        {d.status === "rascunho" && Number(d.valor_total) > 0 && (
          <form action={enviarDespesa}><input type="hidden" name="id" value={d.id} /><button className="btn primary">Enviar aos proprietários</button></form>
        )}
        <form action={excluirDespesa} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={d.id} /><button className="btn danger sm">Excluir despesa</button></form>
      </div>

      {d.status === "rascunho" && Number(d.valor_total) === 0 && (
        <form action={completarDespesa} className="panel" encType="multipart/form-data" style={{ maxWidth: 640 }}>
          <div className="sec-h"><h2>Conta mensal esperando valor</h2></div>
          <p className="small muted" style={{ margin: 0 }}>Informe o valor deste mês e anexe a conta. O rateio usa as cotas atuais e a conta é enviada aos proprietários.</p>
          <input type="hidden" name="id" value={d.id} />
          <div className="row2">
            <div className="field"><label className="label" htmlFor="valor">Valor (R$)</label><input id="valor" name="valor" inputMode="decimal" required /></div>
            <div className="field"><label className="label" htmlFor="prazo">Prazo para resposta</label><input id="prazo" name="prazo" type="date" /></div>
          </div>
          <div className="drop"><span>PDF da conta</span><input type="file" name="pdf" accept="application/pdf" /></div>
          <div className="actions"><button className="btn primary">Informar valor e enviar</button></div>
        </form>
      )}

      <section className="sec">
        <div className="sec-h"><h2>Proprietários</h2><span className="count">{itens.length} linhas</span><span className="rule" /></div>
        <div className="box tbl-wrap"><table>
          <thead><tr><th>Proprietário</th><th>Unidade</th><th className="r">Rateio</th><th className="r">Valor</th><th>Situação</th><th>Comentário</th></tr></thead>
          <tbody>{itens.map((i, idx) => {
            const s = situacao(i);
            const primeiroDoDono = itens.findIndex((x) => x.proprietario_id === i.proprietario_id) === idx;
            return (
              <tr key={i.id}>
                <td>{i.proprietarios.nome}{Number(i.percentual_dono) < 100 && <span className="muted small"> ({Number(i.percentual_dono)}%)</span>}</td>
                <td>{i.imoveis.identificacao}</td>
                <td className="r num muted">{d.regra === "integral" ? "—" : d.regra === "cotas" ? `${Number(i.cotas)}/${Number(d.divisor)}` : d.regra === "percentual" ? `${Number(i.cotas)}%` : BRL(i.cotas)}</td>
                <td className="r num">{BRL(Number(i.valor) + Number(i.taxa_adm))}</td>
                <td>
                  <span className={`pill ${s}`}>{SITUACAO_LABEL[s]}</span>
                  {primeiroDoDono && (s === "reembolso-informado" || s === "reembolso") && (
                    <form action={confirmarReembolso} style={{ display: "inline" }}>
                      <input type="hidden" name="despesa_id" value={d.id} /><input type="hidden" name="proprietario_id" value={i.proprietario_id} />
                      <button className={`btn sm ${s === "reembolso-informado" ? "primary" : ""}`} style={{ marginLeft: 8 }}>Confirmar recebimento</button>
                    </form>
                  )}
                </td>
                <td className="muted" style={{ whiteSpace: "normal", minWidth: 180 }}>{i.comentario ?? "—"}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
      {(ter ?? []).length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Unidades de terceiros</h2><span className="count">{(ter ?? []).length}</span></div>
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Terceiro</th><th className="r">Parte</th><th>Situação</th><th /></tr></thead>
            <tbody>{(ter ?? []).map((t) => (
              <tr key={t.id}>
                <td>{t.nome}</td><td className="r num">{BRL(t.valor)}</td>
                <td>{t.recebido_em ? <span className="pill ok">Recebido {data(t.recebido_em)}</span> : <span className="pill warn">A receber</span>}</td>
                <td className="r"><form action={terceiroRecebido}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="voltar" value={`/admin/despesas/${d.id}`} />
                  <input type="hidden" name="recebido" value={t.recebido_em ? "0" : "1"} /><button className="btn ghost sm">{t.recebido_em ? "Desfazer" : "Marcar recebido"}</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}
          {questionamentos.length > 0 && (
        <section className="sec" id="questionamentos">
          <div className="sec-h"><h2>Questionamentos do proprietário</h2><span className="count">{questionamentos.length}</span></div>
          <div className="box">{questionamentos.map((q) => (
            <div key={q.id} className="mv" style={{ alignItems: "flex-start" }}>
              <span className="t"><b style={{ fontWeight: 500 }}>“{q.texto}”</b><small>{q.proprietarios.nome} · {data(q.created_at)}</small>
                {q.resposta ? <small style={{ color: "var(--fg)", marginTop: 4 }}>Resposta ({data(q.respondido_em)}): {q.resposta}</small> : (
                  <form action={responderQuestionamento} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={q.id} /><input type="hidden" name="despesa_id" value={d.id} />
                    <input name="resposta" placeholder="Responder ao proprietário" style={{ flex: "1 1 260px" }} required />
                    <button className="btn sm primary">Responder</button>
                  </form>
                )}
              </span>
              {!q.resposta && <span className="pill warn">Aguardando resposta</span>}
            </div>
          ))}</div>
        </section>
      )}
</>
  );
}
