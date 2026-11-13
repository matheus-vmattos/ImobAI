"use client";

import { useState } from "react";
import { TIPO_LABEL, type TipoDespesa } from "@/lib/types";
import { lancarLote } from "../actions";

type Imovel = { id: string; rotulo: string; identificacao: string };
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Adivinha o imóvel pelo nome do arquivo (ex.: "Boleto S-306.pdf" → unidade S-306).
 *  Vale a identificação mais específica: "Casa 01" ganha de "Casa"; empate continua em branco. */
const adivinhar = (arquivo: string, imoveis: Imovel[]) => {
  const n = ` ${normal(arquivo)} `;
  const achados = imoveis.filter((i) => normal(i.identificacao) && n.includes(` ${normal(i.identificacao)} `));
  const maior = Math.max(0, ...achados.map((i) => normal(i.identificacao).length));
  const melhores = achados.filter((i) => normal(i.identificacao).length === maior);
  return melhores.length === 1 ? melhores[0].id : "";
};

export function LoteForm({ imoveis }: { imoveis: Imovel[] }) {
  const [arquivos, setArquivos] = useState<string[]>([]);
  return (
    <form action={lancarLote} className="panel" encType="multipart/form-data">
      <div className="drop" style={{ justifyContent: "center", padding: 24 }}>
        <input type="file" name="pdf" multiple accept="application/pdf" required onChange={(e) => setArquivos([...(e.target.files ?? [])].map((f) => f.name))} />
        <span>{arquivos.length ? `${arquivos.length} PDFs` : "Escolha todos os PDFs de uma vez (ex.: boletos de condomínio de cada unidade)."}</span>
      </div>
      <div className="row3">
        <div className="field"><label className="label" htmlFor="competencia">Competência</label><input id="competencia" name="competencia" placeholder="Nov/2026" /></div>
        <div className="field"><label className="label" htmlFor="prazo">Prazo para resposta</label><input id="prazo" name="prazo" type="date" /></div>
      </div>
      {arquivos.length > 0 && (
        <div className="box tbl-wrap"><table>
          <thead><tr><th>Arquivo</th><th>Imóvel</th><th>Descrição</th><th>Tipo</th><th className="r">Valor (R$)</th></tr></thead>
          <tbody>{arquivos.map((a, i) => (
            <tr key={a + i}>
              <td className="muted small" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{a}</td>
              <td><select name="imovel_id" defaultValue={adivinhar(a, imoveis)} required className="inp" style={{ minWidth: 220 }}>
                <option value="">Escolha…</option>{imoveis.map((im) => <option key={im.id} value={im.id}>{im.rotulo}</option>)}</select></td>
              <td><input name="descricao" className="inp" defaultValue={a.replace(/\.pdf$/i, "")} style={{ minWidth: 200 }} /></td>
              <td><select name="tipo" className="inp" defaultValue="condominio">{(Object.keys(TIPO_LABEL) as TipoDespesa[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}</select></td>
              <td className="r"><input name="valor" className="inp num" inputMode="decimal" required style={{ width: 110, textAlign: "right" }} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="small muted" style={{ margin: 0 }}>Cada linha vira uma despesa do imóvel, enviada na hora. Condomínio de imóvel locado fica com o inquilino; o que for do proprietário entra na cobrança da semana.</p>
      <div className="actions"><button className="btn primary" disabled={!arquivos.length}>Lançar {arquivos.length || ""} despesas</button></div>
    </form>
  );
}
