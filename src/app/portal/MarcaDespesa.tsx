import { BRL, data } from "@/lib/format";
import { questionarDespesa } from "./actions";
import type { DespesaPortal } from "./despesas";

/** Marca da despesa ("será rateada" / "do proprietário"), quanto volta pelos inquilinos e o espaço para questionar. */
export function MarcaDespesa({ d, voltar }: { d: DespesaPortal; voltar: string }) {
  return (
    <>
      {d.rateada !== null && (
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <span className={`pill ${d.rateada ? "ok" : "warn"}`}>{d.rateada ? "Despesa será rateada" : "Despesa do proprietário"}</span>
          <small className="muted">{d.rateada
            ? (d.volta > 0 ? `${BRL(d.volta)} voltam pelos inquilinos no repasse${d.total - d.volta > 0.005 ? ` · custo seu ${BRL(d.total - d.volta)} (unidades vagas)` : ""}` : "nenhuma unidade alugada: o custo fica com você")
            : "obra ou extra: fica com você"}</small>
        </span>
      )}
      {d.questionamentos.map((q) => (
        <small key={q.id} style={{ display: "block", marginTop: 6 }}>
          <span className="muted">Você perguntou em {data(q.created_at)}:</span> “{q.texto}”<br />
          {q.resposta ? <><b>Resposta da imobiliária:</b> {q.resposta}</> : <span style={{ color: "var(--warn)" }}>Aguardando resposta da imobiliária</span>}
        </small>
      ))}
      <details style={{ marginTop: 6 }}>
        <summary className="small muted" style={{ cursor: "pointer" }}>Questionar esta despesa</summary>
        <form action={questionarDespesa} style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <input type="hidden" name="despesa_id" value={d.id} /><input type="hidden" name="voltar" value={voltar} />
          <input name="texto" required maxLength={1000} placeholder="Ex.: por que esta conta não foi rateada?" style={{ flex: "1 1 240px" }} />
          <button className="btn sm">Enviar</button>
        </form>
      </details>
    </>
  );
}
