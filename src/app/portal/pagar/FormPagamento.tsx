"use client";

import { useState } from "react";
import { BRL, hojeSP } from "@/lib/format";
import { informarPagamento } from "../actions";

const parse = (s: string) => { const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };

export function FormPagamento({ pagadores, devido, cobrancaId }: { pagadores: { id: string; nome: string; devido: number }[]; devido: number; cobrancaId?: string }) {
  const [pagador, setPagador] = useState(pagadores[0]?.id ?? "");
  const total = pagadores.length > 1 ? pagadores.find((p) => p.id === pagador)?.devido ?? 0 : devido;
  const [valor, setValor] = useState(total ? total.toFixed(2).replace(".", ",") : "");
  const [forma, setForma] = useState("deposito");
  const [arquivos, setArquivos] = useState(0);
  const dif = Math.round((total - parse(valor)) * 100) / 100;
  return (
    <form action={informarPagamento} className="panel" encType="multipart/form-data" style={{ maxWidth: 560 }}>
      <input type="hidden" name="cobranca_id" value={cobrancaId ?? ""} />
      {pagadores.length > 1 ? (
        <div className="field"><label className="label" htmlFor="pagador_id">Cadastro</label>
          <select id="pagador_id" name="pagador_id" value={pagador} onChange={(e) => setPagador(e.target.value)}>{pagadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>
      ) : <input type="hidden" name="pagador_id" value={pagador} />}
      <div className="field"><span className="label">Comprovantes</span>
        <div className="drop"><input type="file" name="comprovantes" multiple accept="image/*,application/pdf" required onChange={(e) => setArquivos(e.target.files?.length ?? 0)} />
          <span>{arquivos ? `${arquivos} arquivo(s)` : "Foto do depósito, print do Pix ou PDF. Se pagou em mais de uma vez, mande todos."}</span></div></div>
      <div className="field"><span className="label">Forma</span>
        <input type="hidden" name="forma" value={forma} />
        <div className="seg">{[["deposito", "Depósito"], ["pix", "Pix"], ["transferencia", "Transferência"]].map(([k, t]) => (
          <button key={k} type="button" aria-pressed={forma === k} onClick={() => setForma(k)}>{t}</button>
        ))}</div></div>
      <div className="row2">
        <div className="field"><label className="label" htmlFor="valor">Valor pago (soma dos comprovantes)</label>
          <input id="valor" name="valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required /></div>
        <div className="field"><label className="label" htmlFor="data">Data</label><input id="data" name="data" type="date" defaultValue={hojeSP()} /></div>
      </div>
      {total > 0 && (
        <div className="bankbox">
          <div><span>Em aberto</span><span className="num">{BRL(total)}</span></div>
          <div><span>Pago</span><span className="num">{BRL(parse(valor))}</span></div>
          {dif !== 0 && <div><span>Diferença</span><span className="num" style={{ color: dif > 0 ? "var(--warn)" : "var(--ok)" }}>{dif > 0 ? BRL(dif) : `${BRL(-dif)} a mais (vira crédito)`}</span></div>}
        </div>
      )}
      <div className="field"><label className="label" htmlFor="observacao">Mensagem (opcional)</label>
        <textarea id="observacao" name="observacao" placeholder="Segue comprovante referente às contas da semana." /></div>
      <button className="btn light" style={{ height: 44 }}>Enviar para a imobiliária</button>
    </form>
  );
}
