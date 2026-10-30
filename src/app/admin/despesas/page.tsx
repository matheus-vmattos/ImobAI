import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { TIPO_LABEL, type Decisao, type StatusReembolso, type TipoDespesa } from "@/lib/types";

type Linha = {
  id: string; descricao: string; tipo: TipoDespesa; valor_total: number; status: "rascunho" | "enviada"; created_at: string; prazo: string | null;
  condominios: { nome: string } | null; imoveis: { identificacao: string; endereco: string | null } | null;
  despesa_itens: { proprietario_id: string; decisao: Decisao | null; reembolso: StatusReembolso | null }[];
};

export default async function Despesas({ searchParams }: { searchParams: Promise<{ f?: string; ok?: string; erro?: string }> }) {
  const { f = "", ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const { data: rows } = await supabase.from("despesas")
    .select("id, descricao, tipo, valor_total, status, created_at, prazo, condominios(nome), imoveis(identificacao, endereco), despesa_itens(proprietario_id, decisao, reembolso)")
    .order("created_at", { ascending: false });
  const todas = (rows ?? []) as unknown as Linha[];

  const resumo = (d: Linha) => {
    const donos = new Map<string, Linha["despesa_itens"][number]>();
    d.despesa_itens.forEach((i) => donos.set(i.proprietario_id, i));
    const lista = [...donos.values()];
    return {
      total: lista.length,
      respondidas: lista.filter((i) => i.decisao).length,
      aConfirmar: lista.filter((i) => i.reembolso === "informado").length,
    };
  };
  const filtradas = todas.filter((d) => {
    const r = resumo(d);
    if (f === "aguardando") return d.status === "enviada" && r.respondidas < r.total;
    if (f === "confirmar") return r.aConfirmar > 0;
    if (f === "rascunho") return d.status === "rascunho";
    return true;
  });
  const n = (k: string) => todas.filter((d) => {
    const r = resumo(d);
    return k === "aguardando" ? d.status === "enviada" && r.respondidas < r.total : k === "confirmar" ? r.aConfirmar > 0 : d.status === "rascunho";
  }).length;

  return (
    <>
      <section className="hero">
        <div className="label">Financeiro</div>
        <h1>Despesas</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <section className="sec">
        <div className="toolbar">
          <div className="filters" style={{ flex: 1 }}>
            <Link href="/admin/despesas" aria-pressed={!f}>Todas<span className="n">{todas.length}</span></Link>
            <Link href="?f=aguardando" aria-pressed={f === "aguardando"}>Aguardando resposta<span className="n">{n("aguardando")}</span></Link>
            <Link href="?f=confirmar" aria-pressed={f === "confirmar"}>Reembolsos a confirmar<span className="n">{n("confirmar")}</span></Link>
            <Link href="?f=rascunho" aria-pressed={f === "rascunho"}>Rascunhos<span className="n">{n("rascunho")}</span></Link>
          </div>
          <Link href="/admin/despesas/nova" className="btn primary">Lançar despesa</Link>
        </div>
        {filtradas.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Lançada</th><th>Despesa</th><th>Onde</th><th className="r">Total</th><th>Respostas</th><th>Prazo</th><th /></tr></thead>
            <tbody>{filtradas.map((d) => {
              const r = resumo(d);
              return (
                <tr key={d.id}>
                  <td className="num">{data(d.created_at)}</td>
                  <td><Link className="rowlink" href={`/admin/despesas/${d.id}`}>{d.descricao}</Link><br /><span className="muted small">{TIPO_LABEL[d.tipo]}</span></td>
                  <td className="muted">{d.condominios?.nome ?? [d.imoveis?.endereco, d.imoveis?.identificacao].filter(Boolean).join(" · ")}</td>
                  <td className="r num">{BRL(d.valor_total)}</td>
                  <td>{d.status === "rascunho" ? <span className="pill aguardando">Rascunho</span>
                    : <span className="num small">{r.respondidas} de {r.total}{r.aConfirmar > 0 && <span style={{ color: "var(--dev)" }}> · {r.aConfirmar} a confirmar</span>}</span>}</td>
                  <td className="num muted">{data(d.prazo)}</td>
                  <td className="go">›</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">{todas.length ? "Nenhuma despesa com esse filtro." : "Nenhuma despesa lançada ainda."}</div>}
      </section>
    </>
  );
}
