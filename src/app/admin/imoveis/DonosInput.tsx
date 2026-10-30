"use client";

import { useState } from "react";

type Linha = { proprietario_id: string; percentual: string };

/** Lista editável de proprietários do imóvel com o percentual de cada um. */
export function DonosInput({ opcoes, inicial }: { opcoes: { id: string; nome: string }[]; inicial: Linha[] }) {
  const [linhas, setLinhas] = useState<Linha[]>(inicial.length ? inicial : [{ proprietario_id: "", percentual: "100" }]);
  const soma = linhas.reduce((a, l) => a + (Number(l.percentual.replace(",", ".")) || 0), 0);
  const set = (i: number, campo: keyof Linha, v: string) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));

  return (
    <div className="field">
      <span className="label">Proprietários</span>
      {linhas.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px auto", gap: 8 }}>
          <select name="proprietario_id" value={l.proprietario_id} onChange={(e) => set(i, "proprietario_id", e.target.value)} aria-label="Proprietário" required>
            <option value="">Escolha…</option>
            {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
          <input name="percentual" value={l.percentual} onChange={(e) => set(i, "percentual", e.target.value)} inputMode="decimal" aria-label="Percentual" className="num" style={{ textAlign: "right" }} />
          <button type="button" className="btn ghost sm" onClick={() => setLinhas(linhas.filter((_, j) => j !== i))} disabled={linhas.length === 1} aria-label="Remover">✕</button>
        </div>
      ))}
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn sm" onClick={() => setLinhas([...linhas, { proprietario_id: "", percentual: "" }])}>Adicionar coproprietário</button>
        <span className="num small" style={{ color: Math.abs(soma - 100) < 0.01 ? "var(--ok)" : "var(--bad)" }}>Soma {soma.toLocaleString("pt-BR")}%</span>
      </div>
    </div>
  );
}
