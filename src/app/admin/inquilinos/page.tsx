import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data, mesSP, nomeMes } from "@/lib/format";
import { marcarLancado } from "./actions";

type Row = {
  id: string; valor: number; taxa_adm: number; inquilino_lancado_em: string | null; imovel_id: string;
  imoveis: { identificacao: string; endereco: string | null; condominios: { nome: string } | null; contratos: { inquilino: string; ativo: boolean }[] };
  despesas: { id: string; descricao: string; enviada_em: string | null; competencia_mes: string | null; status: string };
};

/** Contas a receber dos inquilinos: a parte de cada unidade alugada nas contas rateadas, para lançar no boleto. */
export default async function Inquilinos({ searchParams }: { searchParams: Promise<{ ver?: string; ok?: string; erro?: string }> }) {
  const { ver = "pendentes", ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  let q = supabase.from("despesa_itens")
    .select("id, valor, taxa_adm, inquilino_lancado_em, imovel_id, imoveis(identificacao, endereco, condominios(nome), contratos(inquilino, ativo)), despesas!inner(id, descricao, enviada_em, competencia_mes, status)")
    .eq("volta_inquilino", true).eq("despesas.status", "enviada");
  q = ver === "lancados" ? q.not("inquilino_lancado_em", "is", null) : q.is("inquilino_lancado_em", null);
  const { data: rows } = await q.limit(2000);
  const itens = (rows ?? []) as unknown as Row[];
  // por mês (da conta) e por unidade/inquilino
  const mesDe = (r: Row) => (r.despesas.competencia_mes ?? r.despesas.enviada_em ?? "").slice(0, 7) || mesSP();
  const grupos = new Map<string, Map<string, Row[]>>();
  for (const r of itens) {
    const m = mesDe(r);
    const g = grupos.get(m) ?? new Map<string, Row[]>();
    g.set(r.imovel_id, [...(g.get(r.imovel_id) ?? []), r]);
    grupos.set(m, g);
  }
  const meses = [...grupos.keys()].sort().reverse();
  const valor = (r: Row) => Number(r.valor) + Number(r.taxa_adm);
  const voltar = `/admin/inquilinos${ver === "lancados" ? "?ver=lancados" : ""}`;
  return (
    <>
      <section className="hero">
        <div className="label">Financeiro</div>
        <h1>A cobrar dos inquilinos</h1>
        <p className="muted">A parte de cada unidade alugada nas contas rateadas. Lance no boleto do inquilino e marque aqui.</p>
      </section>
      <Aviso ok={ok} erro={erro} />
      <div className="filters">
        <Link href="/admin/inquilinos" aria-pressed={ver !== "lancados"}>A lançar</Link>
        <Link href="/admin/inquilinos?ver=lancados" aria-pressed={ver === "lancados"}>Já lançados</Link>
      </div>
      {!meses.length && <div className="empty">{ver === "lancados" ? "Nada lançado ainda." : "Nada a lançar. As contas rateadas com os inquilinos aparecem aqui."}</div>}
      {meses.map((m) => {
        const unidades = [...grupos.get(m)!.values()].sort((a, b) => (a[0].imoveis.condominios?.nome ?? "").localeCompare(b[0].imoveis.condominios?.nome ?? "") || a[0].imoveis.identificacao.localeCompare(b[0].imoveis.identificacao, "pt-BR", { numeric: true }));
        const total = unidades.flat().reduce((a, r) => a + valor(r), 0);
        return (
          <section className="sec" key={m}>
            <div className="sec-h"><h2>{nomeMes(m)}</h2><span className="count">{unidades.length}</span><span className="rule" /><span className="muted small">{BRL(total)}</span></div>
            <div className="box tbl-wrap"><table>
              <thead><tr><th>Unidade</th><th>Inquilino</th><th>Contas</th><th className="r">Total</th><th /></tr></thead>
              <tbody>{unidades.map((rs) => {
                const im = rs[0].imoveis;
                return (
                  <tr key={rs[0].imovel_id}>
                    <td>{im.identificacao}<br /><span className="muted small">{im.condominios?.nome ?? im.endereco}</span></td>
                    <td>{im.contratos.find((c) => c.ativo)?.inquilino ?? <span className="muted">sem contrato ativo</span>}</td>
                    <td className="small">{rs.map((r) => <div key={r.id}><Link className="rowlink" href={`/admin/despesas/${r.despesas.id}`}>{r.despesas.descricao}</Link> · {BRL(valor(r))}</div>)}</td>
                    <td className="r num">{BRL(rs.reduce((a, r) => a + valor(r), 0))}</td>
                    <td>
                      <form action={marcarLancado}>
                        <input type="hidden" name="itens" value={rs.map((r) => r.id).join(",")} />
                        <input type="hidden" name="lancado" value={ver === "lancados" ? "0" : "1"} /><input type="hidden" name="voltar" value={voltar} />
                        {ver === "lancados" ? <><span className="small muted">em {data(rs[0].inquilino_lancado_em)} </span><button className="btn ghost sm">Desfazer</button></> : <button className="btn sm">Lançado no boleto</button>}
                      </form>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </section>
        );
      })}
    </>
  );
}
