import { BRL, data } from "@/lib/format";
import { SITUACAO_LABEL } from "@/lib/types";
import { responderDespesa } from "./actions";
import type { DespesaPortal } from "./despesas";

export function Historico({ despesas }: { despesas: DespesaPortal[] }) {
  if (!despesas.length) return <div className="empty">Nenhuma despesa respondida ainda.</div>;
  return (
    <div className="box tbl-wrap"><table>
      <thead><tr><th>Lançada</th><th>Despesa</th><th>Onde</th><th>Rateio</th><th className="r">Sua parte</th><th>Decisão</th><th /></tr></thead>
      <tbody>{despesas.map((d) => (
        <tr key={d.id}>
          <td className="num">{data(d.enviadaEm)}</td>
          <td>{d.temPdf ? <a className="rowlink" href={`/despesas/${d.id}/pdf`} target="_blank" rel="noreferrer">{d.descricao}</a> : d.descricao}</td>
          <td className="muted">{d.onde}</td>
          <td className="muted small">{d.regraTxt}</td>
          <td className="r num">{BRL(d.total)}</td>
          <td><span className={`pill ${d.situacao}`}>{SITUACAO_LABEL[d.situacao]}</span></td>
          <td>{["desconto", "reembolso", "proprio"].includes(d.situacao) && (
            <form action={responderDespesa}><input type="hidden" name="despesa_id" value={d.id} /><button className="btn ghost sm" name="decisao" value="">Alterar</button></form>
          )}</td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}
