import { BRL, data } from "@/lib/format";
import { SITUACAO_LABEL } from "@/lib/types";
import { descontarTodas, informarReembolso, responderDespesa } from "./actions";
import type { CondominioPortal } from "./dados";
import type { DespesaPortal } from "./despesas";

/** "Para aprovar": despesas sem resposta ou com reembolso em andamento, agrupadas por condomínio. */
export function Pendencias({ pendentes, condominios }: { pendentes: DespesaPortal[]; condominios: CondominioPortal[] }) {
  const grupos = condominios
    .map((c) => ({ c, itens: pendentes.filter((d) => d.condominioId === c.id) }))
    .filter((g) => g.itens.length);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {grupos.map(({ c, itens }) => {
        const abertas = itens.filter((d) => d.situacao === "aguardando");
        return (
          <div className="pg" key={c.id ?? "avulso"}>
            <div className="pg-h">
              <b>{c.nome}</b>
              <span className="muted small">{abertas.length ? `${abertas.length} sem resposta · ${BRL(abertas.reduce((a, d) => a + d.total, 0))}` : "reembolsos em andamento"}</span>
              <span className="sp" />
              {abertas.length > 1 && (
                <form action={descontarTodas}>
                  {abertas.map((d) => <input key={d.id} type="hidden" name="despesa_id" value={d.id} />)}
                  <button className="btn sm">Descontar todas ({abertas.length})</button>
                </form>
              )}
            </div>
            {itens.map((d) => <Item key={d.id} d={d} />)}
          </div>
        );
      })}
    </div>
  );
}

function Item({ d }: { d: DespesaPortal }) {
  const aguardando = d.situacao === "aguardando";
  return (
    <div className="pi" id={d.id}>
      <div>
        <div className="pi-t">{d.descricao}</div>
        <div className="pi-m">
          <span>{d.unidades.length > 1 ? `${d.unidades.length} unidades suas` : d.unidades[0]?.nome}</span>
          {d.enviadaEm && <span>Lançada {data(d.enviadaEm)}</span>}
          {aguardando && d.prazo && <span style={{ color: "var(--warn)" }}>Responder até {data(d.prazo)}</span>}
          {d.temPdf && <a className="link" href={`/despesas/${d.id}/pdf`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>PDF da conta</a>}
        </div>
      </div>
      <div className="pi-v"><span className="v">{BRL(d.total)}</span><small>{d.regraTxt} · conta {BRL(d.valorTotal)}</small></div>
      {d.unidades.length > 1 && <div className="chips">{d.unidades.slice(0, 6).map((u) => <span className="chip" key={u.imovelId}>{u.nome} · {BRL(u.valor)}</span>)}
        {d.unidades.length > 6 && <span className="chip">+{d.unidades.length - 6}</span>}</div>}

      {aguardando ? (
        <form action={responderDespesa} className="pi-a">
          <input type="hidden" name="despesa_id" value={d.id} />
          <button className="opt main" name="decisao" value="desconto">Descontar no repasse</button>
          <button className="opt" name="decisao" value="reembolso" title="Entra na cobrança da semana; você paga tudo de uma vez">Cobrança semanal</button>
          <button className="opt" name="decisao" value="proprio" title="Você paga direto ao fornecedor">Eu mesmo pago</button>
          <details><summary>Adicionar comentário</summary>
            <textarea name="comentario" placeholder="Ex.: pedir 2º orçamento, enviar comprovante" aria-label="Comentário" /></details>
        </form>
      ) : (
        <div className="pi-a">
          <span className={`pill ${d.situacao}`}>{SITUACAO_LABEL[d.situacao]}</span>
          <form action={informarReembolso} className="opts">
            <input type="hidden" name="despesa_id" value={d.id} />
            <button name="concluido" value="0" aria-pressed={d.situacao === "reembolso"}>Não concluído</button>
            <button name="concluido" value="1" aria-pressed={d.situacao === "reembolso-informado"}>Concluído</button>
          </form>
          {d.situacao === "reembolso-informado" && <span className="note small muted">A imobiliária vai confirmar o recebimento.</span>}
          {d.comentario && <span className="small muted">“{d.comentario}”</span>}
          <form action={responderDespesa} style={{ marginLeft: "auto" }}>
            <input type="hidden" name="despesa_id" value={d.id} />
            <button className="btn ghost sm" name="decisao" value="">Alterar resposta</button>
          </form>
        </div>
      )}
    </div>
  );
}
