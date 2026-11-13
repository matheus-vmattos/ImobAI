import Link from "next/link";
import { getSessaoPortal } from "@/lib/auth";
import { BRL, data, nomeMes } from "@/lib/format";

export default async function MeusRepasses() {
  const { supabase } = await getSessaoPortal();
  const { data: rs } = await supabase.from("repasses").select("id, competencia, aluguel, taxa_adm, seguro, despesas, liquido, fechado_em").order("competencia", { ascending: false });
  const lista = (rs ?? []) as { id: string; competencia: string; aluguel: number; taxa_adm: number; seguro: number; despesas: number; liquido: number; fechado_em: string }[];
  return (
    <>
      <section className="hero">
        <div className="label">Portal do proprietário</div>
        <h1>Repasses</h1>
      </section>
      <section className="sec">
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Mês</th><th className="r">Aluguel</th><th className="r">Taxa, seguro e despesas</th><th className="r">Líquido</th><th>Fechado em</th><th /></tr></thead>
            <tbody className="click">{lista.map((r) => (
              <tr key={r.id}>
                <td><Link className="rowlink" href={`/portal/repasses/${r.id}`}>{nomeMes(r.competencia.slice(0, 7))}</Link></td>
                <td className="r num">{BRL(r.aluguel)}</td>
                <td className="r num muted">− {BRL(Number(r.taxa_adm) + Number(r.seguro) + Number(r.despesas))}</td>
                <td className="r num">{BRL(r.liquido)}</td>
                <td className="num muted">{data(r.fechado_em)}</td>
                <td className="go">›</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum repasse fechado ainda.</div>}
      </section>
    </>
  );
}
