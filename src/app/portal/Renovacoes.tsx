import { BRL, BRL0, data, diasAte } from "@/lib/format";
import { RENOVACAO_LABEL, type Renovacao } from "@/lib/types";
import { responderRenovacao } from "./actions";

export type ContratoRenovacao = { contratoId: string; imovel: string; aluguel: number; fim: string; inquilino: string | null; resposta: Renovacao | null };

/** Contratos perto do fim: o proprietário escolhe renovar pelo valor atual, propor novo valor ou não renovar. */
export function Renovacoes({ itens, voltar = "/portal" }: { itens: ContratoRenovacao[]; voltar?: string }) {
  return (
    <div className="pg">
      {itens.map((c) => <Item key={c.contratoId} c={c} voltar={voltar} />)}
    </div>
  );
}

function Item({ c, voltar }: { c: ContratoRenovacao; voltar: string }) {
  const r = c.resposta;
  const dias = diasAte(c.fim);
  return (
    <div className="pi">
      <div>
        <div className="pi-t">{c.imovel}</div>
        <div className="pi-m">
          {c.inquilino && <span>{c.inquilino}</span>}
          <span style={{ color: dias < 0 ? "var(--bad)" : "var(--warn)" }}>{dias < 0 ? `Venceu em ${data(c.fim)}` : `Vence em ${data(c.fim)} · ${dias} dias`}</span>
        </div>
      </div>
      <div className="pi-v"><span className="v">{BRL0(c.aluguel)}</span><small>aluguel atual</small></div>

      {!r ? (
        <form action={responderRenovacao} className="pi-a">
          <input type="hidden" name="contrato_id" value={c.contratoId} />
          <input type="hidden" name="voltar" value={voltar} />
          <button className="opt main" name="decisao" value="atual">Renovar pelo valor atual</button>
          <button className="opt" name="decisao" value="nao_renovar">Não renovar</button>
          <details style={{ flexBasis: "100%" }}><summary>Propor novo valor / comentário</summary>
            <div className="inline-form" style={{ marginTop: 8 }}>
              <div className="field" style={{ flex: "0 1 160px" }}><label className="label" htmlFor={`v-${c.contratoId}`}>Novo aluguel (R$)</label>
                <input id={`v-${c.contratoId}`} name="valor" inputMode="decimal" className="num" placeholder={String(c.aluguel)} /></div>
              <button className="opt" name="decisao" value="novo_valor">Propor novo valor</button>
            </div>
            <textarea name="comentario" placeholder="Ex.: reajustar pelo IGP-M, pedir vistoria antes" aria-label="Comentário" style={{ marginTop: 8 }} />
          </details>
        </form>
      ) : (
        <div className="pi-a">
          <span className={`pill renov-${r.decisao}`}>{RENOVACAO_LABEL[r.decisao]}{r.decisao === "novo_valor" && ` · ${BRL(r.valor_proposto)}`}</span>
          {r.comentario && <span className="small muted">“{r.comentario}”</span>}
          {r.concluida_em ? (
            <span className="small muted" style={{ marginLeft: "auto" }}>Registrado pela imobiliária em {data(r.concluida_em)}</span>
          ) : (
            <form action={responderRenovacao} style={{ marginLeft: "auto" }}>
              <input type="hidden" name="contrato_id" value={c.contratoId} />
              <input type="hidden" name="voltar" value={voltar} />
              <button className="btn ghost sm" name="decisao" value="">Alterar resposta</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
