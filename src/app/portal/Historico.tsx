import { BRL, data } from "@/lib/format";
import { SITUACAO_LABEL } from "@/lib/types";
import { responderDespesa } from "./actions";
import type { DespesaPortal } from "./despesas";

/** Despesas já respondidas, em cartões (lê bem no celular). */
export function Historico({ despesas }: { despesas: DespesaPortal[] }) {
  if (!despesas.length) return <div className="empty">Nenhuma despesa respondida ainda.</div>;
  return (
    <div className="box">{despesas.map((d) => (
      <div key={d.id} className="mv" style={{ alignItems: "flex-start" }}>
        <span className="t">
          <b>{d.temPdf ? <a className="rowlink" href={`/despesas/${d.id}/pdf`} target="_blank" rel="noreferrer">{d.descricao}</a> : d.descricao}</b>
          <small>{d.onde} · {data(d.enviadaEm)}</small>
          <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <span className={`pill ${d.situacao}`}>{SITUACAO_LABEL[d.situacao]}</span>
            {["desconto", "reembolso", "proprio"].includes(d.situacao) && !d.travada && (
              <form action={responderDespesa}><input type="hidden" name="despesa_id" value={d.id} /><button className="btn ghost sm" name="decisao" value="">Alterar</button></form>
            )}
          </span>
        </span>
        <span className="v">{BRL(d.total)}</span>
      </div>
    ))}</div>
  );
}
