import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { SITUACAO_LABEL, situacao, TIPO_LABEL, type Decisao, type StatusReembolso, type TipoDespesa } from "@/lib/types";
import { confirmarReembolso, enviarDespesa, excluirDespesa } from "../actions";

type Despesa = {
  id: string; descricao: string; tipo: TipoDespesa; competencia: string | null; valor_total: number; regra: string; divisor: number | null;
  valor_fora: number; cobra_taxa_adm: boolean; pdf_path: string | null; prazo: string | null; status: "rascunho" | "enviada"; enviada_em: string | null;
  condominios: { nome: string } | null; imoveis: { identificacao: string; endereco: string | null } | null;
};
type Item = {
  id: string; proprietario_id: string; cotas: number | null; percentual_dono: number; valor: number; taxa_adm: number;
  decisao: Decisao | null; comentario: string | null; reembolso: StatusReembolso | null;
  imoveis: { identificacao: string }; proprietarios: { nome: string };
};

const REGRA: Record<string, string> = { cotas: "cotas", percentual: "%", fixo: "valor fixo", integral: "imóvel inteiro" };

export default async function DespesaAdmin({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: d }, { data: it }] = await Promise.all([
    supabase.from("despesas").select("*, condominios(nome), imoveis(identificacao, endereco)").eq("id", id).maybeSingle<Despesa>(),
    supabase.from("despesa_itens").select("*, imoveis(identificacao), proprietarios(nome)").eq("despesa_id", id),
  ]);
  if (!d) notFound();
  const itens = ((it ?? []) as Item[]).sort((a, b) => a.proprietarios.nome.localeCompare(b.proprietarios.nome) || a.imoveis.identificacao.localeCompare(b.imoveis.identificacao));
  const onde = d.condominios?.nome ?? [d.imoveis?.endereco, d.imoveis?.identificacao].filter(Boolean).join(" · ");
  const carteira = itens.reduce((a, i) => a + Number(i.valor), 0);
  const taxas = itens.reduce((a, i) => a + Number(i.taxa_adm), 0);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/despesas">Despesas</Link><span>/</span><span>{d.descricao}</span></div>
        <h1>{d.descricao}</h1>
        <p className="muted" style={{ margin: 0 }}>{onde} · {TIPO_LABEL[d.tipo]}{d.competencia ? ` · ${d.competencia}` : ""}</p>
      </section>
      <Aviso ok={ok} erro={erro} />

      <div className="kpis">
        <div className="kpi"><span className="label">Total da conta</span><span className="v">{BRL(d.valor_total)}</span>
          <small>{d.regra === "cotas" ? `${Number(d.divisor)} cotas` : REGRA[d.regra]}</small></div>
        <div className="kpi"><span className="label">Carteira</span><span className="v">{BRL(carteira)}</span><small>fora: {BRL(d.valor_fora)}</small></div>
        <div className="kpi"><span className="label">Taxa adm.</span><span className="v">{BRL(taxas)}</span><small>{d.cobra_taxa_adm ? "cobrada" : "não cobrada"}</small></div>
        <div className="kpi"><span className="label">Status</span><span className="v" style={{ fontSize: 18 }}>{d.status === "rascunho" ? "Rascunho" : "Enviada"}</span>
          <small>{d.enviada_em ? `em ${data(d.enviada_em)}` : "não visível ao proprietário"}{d.prazo ? ` · prazo ${data(d.prazo)}` : ""}</small></div>
      </div>

      <div className="actions">
        {d.pdf_path ? <a className="btn" href={`/despesas/${d.id}/pdf`} target="_blank" rel="noreferrer">Ver PDF</a> : <span className="muted small">Sem PDF anexado</span>}
        {d.status === "rascunho" && (
          <form action={enviarDespesa}><input type="hidden" name="id" value={d.id} /><button className="btn primary">Enviar aos proprietários</button></form>
        )}
        <form action={excluirDespesa} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={d.id} /><button className="btn danger sm">Excluir despesa</button></form>
      </div>

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
    </>
  );
}
