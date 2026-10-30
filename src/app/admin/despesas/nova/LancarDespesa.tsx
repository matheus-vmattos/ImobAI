"use client";

import { useMemo, useState } from "react";
import { BRL } from "@/lib/format";
import { calcularRateio, type Regra } from "@/lib/rateio";
import { TIPO_LABEL, type TipoDespesa } from "@/lib/types";
import { lancarDespesa } from "../actions";
import type { CondominioForm, UnidadeForm } from "../dados";

type ImovelOpcao = UnidadeForm & { condominio: string | null };
const parseBR = (s: string) => {
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};
const em7dias = () => new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

export function LancarDespesa({ condominios, imoveis }: { condominios: CondominioForm[]; imoveis: ImovelOpcao[] }) {
  const [destino, setDestino] = useState<"cond" | "avulso">(condominios.length ? "cond" : "avulso");
  const [condId, setCondId] = useState(condominios[0]?.id ?? "");
  const [imovelId, setImovelId] = useState(imoveis[0]?.id ?? "");
  const [totalTxt, setTotalTxt] = useState("");
  const [cobraTaxa, setCobraTaxa] = useState(false);
  const [regra, setRegra] = useState<Exclude<Regra, "integral">>("cotas");
  const cond = condominios.find((c) => c.id === condId);
  const [divisor, setDivisor] = useState(String(cond?.cotasPadrao ?? cond?.unidades.reduce((a, u) => a + u.cotas, 0) ?? ""));
  const padrao = (c?: CondominioForm, r: Regra = "cotas") =>
    Object.fromEntries((c?.unidades ?? []).map((u) => [u.id, { on: true, q: r === "cotas" ? String(u.cotas) : "" }]));
  const [qts, setQts] = useState<Record<string, { on: boolean; q: string }>>(() => padrao(cond));

  const trocarCondominio = (id: string) => {
    const c = condominios.find((x) => x.id === id);
    setCondId(id); setRegra("cotas"); setQts(padrao(c));
    setDivisor(String(c?.cotasPadrao ?? c?.unidades.reduce((a, u) => a + u.cotas, 0) ?? ""));
  };
  const trocarRegra = (r: Exclude<Regra, "integral">) => {
    setRegra(r);
    const n = cond?.unidades.length || 1;
    const total = parseBR(totalTxt);
    setQts(Object.fromEntries((cond?.unidades ?? []).map((u) => [u.id, {
      on: qts[u.id]?.on ?? true,
      q: r === "cotas" ? String(u.cotas) : r === "percentual" ? (100 / n).toFixed(2) : total ? (total / n).toFixed(2) : "",
    }])));
  };

  const total = parseBR(totalTxt);
  const imovel = imoveis.find((i) => i.id === imovelId);
  const taxaDe = (id: string) => imoveis.find((i) => i.id === id)?.taxa ?? 10;
  const r = useMemo(() => destino === "avulso"
    ? calcularRateio({ total, regra: "integral", unidades: imovel ? [{ imovelId: imovel.id, quantidade: 1, donos: imovel.donos }] : [], cobraTaxa, taxaPct: taxaDe })
    : calcularRateio({
        total, regra, divisor: parseBR(divisor), cobraTaxa, taxaPct: taxaDe,
        unidades: (cond?.unidades ?? []).filter((u) => qts[u.id]?.on).map((u) => ({ imovelId: u.id, quantidade: parseBR(qts[u.id]?.q ?? "0"), donos: u.donos })),
      }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [destino, total, regra, divisor, qts, cobraTaxa, imovelId, condId]);
  const valorUn = (id: string) => r.porUnidade.find((p) => p.imovelId === id)?.valor ?? 0;
  const taxaUn = (id: string) => r.itens.filter((i) => i.imovelId === id).reduce((a, i) => a + i.taxaAdm, 0);
  const unidadeTxt = regra === "cotas" ? "Cotas" : regra === "percentual" ? "%" : "R$";

  return (
    <form action={lancarDespesa} className="cols" encType="multipart/form-data">
      <input type="hidden" name="destino" value={destino} />
      <div className="panel">
        <div className="field"><span className="label">Lançar em</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={destino === "cond"} onClick={() => setDestino("cond")} disabled={!condominios.length}>Condomínio · rateio</button>
            <button type="button" aria-pressed={destino === "avulso"} onClick={() => setDestino("avulso")}>Imóvel avulso</button>
          </div></div>
        {destino === "cond" ? (
          <div className="field"><label className="label" htmlFor="condominio_id">Condomínio</label>
            <select id="condominio_id" name="condominio_id" value={condId} onChange={(e) => trocarCondominio(e.target.value)}>
              {condominios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        ) : (
          <div className="field"><label className="label" htmlFor="imovel_id">Imóvel</label>
            <select id="imovel_id" name="imovel_id" value={imovelId} onChange={(e) => setImovelId(e.target.value)}>
              {imoveis.map((i) => <option key={i.id} value={i.id}>{[i.condominio, i.rotulo].filter(Boolean).join(" · ")} — {i.donos.map((d) => d.nome).join(", ") || "sem dono"}</option>)}
            </select></div>
        )}
        <div className="row2">
          <div className="field"><label className="label" htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue="variavel">
              {(Object.keys(TIPO_LABEL) as TipoDespesa[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select></div>
          <div className="field"><label className="label" htmlFor="competencia">Competência</label>
            <input id="competencia" name="competencia" placeholder="Out/2026" /></div>
        </div>
        <div className="field"><label className="label" htmlFor="descricao">Descrição</label>
          <input id="descricao" name="descricao" required placeholder="Conta de água – área comum" /></div>
        <div className="row2">
          <div className="field"><label className="label" htmlFor="valor_total">Valor total (R$)</label>
            <input id="valor_total" name="valor_total" required inputMode="decimal" className="num" value={totalTxt} onChange={(e) => setTotalTxt(e.target.value)} placeholder="1.048,80" /></div>
          <div className="field"><label className="label" htmlFor="prazo">Prazo para resposta</label>
            <input id="prazo" name="prazo" type="date" defaultValue={em7dias()} /></div>
        </div>
        <label className="tog"><input type="checkbox" name="cobra_taxa" checked={cobraTaxa} onChange={(e) => setCobraTaxa(e.target.checked)} />
          <span>Cobrar taxa de administração sobre esta despesa<small>Usa a taxa de cada imóvel (padrão 10%), somada à parte do proprietário.</small></span></label>
        <div className="drop">
          <span>PDF da conta</span>
          <input type="file" name="pdf" accept="application/pdf" aria-label="PDF da conta" />
        </div>
      </div>

      <div className="panel">
        <div className="sec-h"><h2>{destino === "cond" ? "Rateio" : "Destino"}</h2><span className="rule" /></div>
        {destino === "cond" && cond ? (
          <>
            <div className="row2">
              <div className="field"><label className="label" htmlFor="divisor">Dividir em (cotas)</label>
                <input id="divisor" name="divisor" inputMode="decimal" className="num" value={divisor} onChange={(e) => setDivisor(e.target.value)} disabled={regra !== "cotas"} /></div>
              <div className="field"><span className="label">Regra</span>
                <input type="hidden" name="regra" value={regra} />
                <div className="opts">
                  {(["cotas", "percentual", "fixo"] as const).map((k) => (
                    <button type="button" key={k} aria-pressed={regra === k} onClick={() => trocarRegra(k)}>{k === "cotas" ? "Cotas" : k === "percentual" ? "%" : "Valor fixo"}</button>
                  ))}
                </div></div>
            </div>
            {cond.regraPadrao && <p className="small muted" style={{ margin: 0 }}>Padrão do condomínio: {cond.regraPadrao}.</p>}
            <div className="split" aria-hidden="true">
              {total > 0 && r.porUnidade.map((p) => <i key={p.imovelId} style={{ width: `${(p.valor / total) * 100}%` }} />)}
              {total > 0 && r.fora > 0 && <i className="ext" style={{ width: `${(r.fora / total) * 100}%` }} />}
            </div>
            <div className="units">
              <div className="u u-head"><span /><span>Unidade</span><span style={{ textAlign: "right" }}>{unidadeTxt}</span><span style={{ textAlign: "right" }}>{cobraTaxa ? "Valor + adm." : "Valor"}</span></div>
              {cond.unidades.map((u) => {
                const st = qts[u.id] ?? { on: false, q: "" };
                return (
                  <div className={`u ${st.on ? "" : "off"}`} key={u.id}>
                    <input type="checkbox" checked={st.on} aria-label={`Incluir ${u.rotulo}`} onChange={(e) => setQts({ ...qts, [u.id]: { ...st, on: e.target.checked } })} />
                    <span>{u.rotulo}<span className="sub">{u.donos.map((d) => d.nome + (d.percentual < 100 ? ` ${d.percentual}%` : "")).join(", ") || "sem proprietário"}</span></span>
                    {st.on && <input type="hidden" name="unidade_id" value={u.id} />}
                    <input type="number" step="any" min="0" name={st.on ? "quantidade" : undefined} value={st.q} disabled={!st.on} aria-label={`${unidadeTxt} de ${u.rotulo}`}
                      onChange={(e) => setQts({ ...qts, [u.id]: { ...st, q: e.target.value } })} />
                    <span className="val">{st.on ? BRL(valorUn(u.id) + taxaUn(u.id)) : "—"}</span>
                  </div>
                );
              })}
              <div className={`u ext ${r.fora > 0 ? "" : "off"}`}><span /><span>Fora da carteira<span className="sub">lojas, unidades de terceiros</span></span><span /><span className="val">{BRL(r.erro ? 0 : r.fora)}</span></div>
            </div>
            {!cond.unidades.length && <p className="small muted" style={{ margin: 0 }}>Este condomínio ainda não tem unidades cadastradas.</p>}
          </>
        ) : destino === "avulso" && imovel ? (
          <div style={{ display: "grid", gap: 6 }}>
            <b style={{ fontSize: 17, fontWeight: 600 }}>{imovel.rotulo}</b>
            <span className="muted small">{imovel.condominio ? imovel.condominio + " · " : ""}100% do valor</span>
            <div className="box">{r.itens.map((i) => (
              <div key={i.proprietarioId} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid var(--line)" }}>
                <span>{imovel.donos.find((d) => d.proprietarioId === i.proprietarioId)?.nome} {i.percentualDono < 100 && <span className="muted">({i.percentualDono}%)</span>}</span>
                <span className="num">{BRL(i.valor + i.taxaAdm)}</span>
              </div>
            ))}</div>
          </div>
        ) : <p className="muted">Cadastre um imóvel primeiro.</p>}

        <div className={`check ${r.erro ? "bad" : "ok"}`}>
          {r.erro ? <span>{total > 0 ? r.erro : "Informe o valor total para ver a divisão."}</span> : (
            <>
              <span>Carteira {BRL(r.carteira)}{r.fora > 0 ? ` + fora ${BRL(r.fora)}` : ""} = {BRL(r.carteira + r.fora)} ✓</span>
              {cobraTaxa && <span>Taxa adm.: {BRL(r.itens.reduce((a, i) => a + i.taxaAdm, 0))}</span>}
            </>
          )}
        </div>
        <div className="actions">
          <button className="btn primary" name="enviar" value="1" disabled={!!r.erro}>Enviar aos proprietários</button>
          <button className="btn ghost" name="enviar" value="0" disabled={!!r.erro}>Salvar rascunho</button>
        </div>
      </div>
    </form>
  );
}
