"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { processarPlanilha, type Relatorio } from "./actions";

export function Importador() {
  const [r, enviar, enviando] = useActionState<Relatorio, FormData>(processarPlanilha, {});
  // o formulário é limpo depois de cada envio: guardo o arquivo para o botão "Importar" usar o mesmo
  const arquivos = useRef<File[]>([]);
  const [nomes, setNomes] = useState<string[]>([]);
  const mandar = (fd: FormData) => {
    if (!fd.getAll("arquivos").some((f) => f instanceof File && f.size)) { fd.delete("arquivos"); arquivos.current.forEach((f) => fd.append("arquivos", f)); }
    return enviar(fd);
  };
  const c = r.contagem;
  const podeImportar = !!c && !r.erros?.length && !r.importado && (c.proprietarios + c.condominios + c.imoveis + c.imoveisAtualizados + c.contratos > 0);
  return (
    <form action={mandar} className="panel" style={{ maxWidth: 860 }}>
      <div className="drop" style={{ padding: 22 }}>
        <input type="file" name="arquivos" accept=".xlsx,.pdf" multiple required={!nomes.length} aria-label="Arquivos"
          onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) { arquivos.current = fs; setNomes(fs.map((f) => f.name)); } }} />
        <span>{nomes.length ? <>Arquivos: <b style={{ color: "var(--fg)" }}>{nomes.join(", ")}</b></> : "Escolha os 2 PDFs da Superlógica (pode selecionar os dois juntos) ou a planilha. Primeiro só conferimos; nada é gravado até você mandar importar."}</span>
      </div>
      <div className="actions">
        <button className="btn" name="importar" value="0" disabled={enviando}>{enviando ? "Lendo…" : "Conferir"}</button>
        {podeImportar && <button className="btn primary" name="importar" value="1" disabled={enviando}>Importar {c!.imoveis + c!.imoveisAtualizados} imóveis e {c!.contratos} contratos</button>}
      </div>

      {r.falha && <div className="alert erro" role="alert">{r.falha}</div>}
      {r.importado && (
        <div className="alert ok" role="status">Importado: {c!.proprietarios} proprietários, {c!.condominios} condomínios, {c!.imoveis} imóveis novos{c!.imoveisAtualizados ? `, ${c!.imoveisAtualizados} atualizados` : ""} e {c!.contratos} contratos.
          {c!.aConferir > 0 && <> {c!.aConferir} contrato(s) com datas a conferir.</>}
          {" "}<Link className="link" href="/admin/imoveis">Ver imóveis</Link> · <Link className="link" href="/admin/proprietarios">Convidar proprietários</Link></div>
      )}
      {c && !r.importado && (
        <>
          {r.origem && <p className="small muted" style={{ margin: 0 }}>{r.origem}</p>}
          <div className="kpis">
            {([["Proprietários", c.proprietarios, "novos"], ["Condomínios", c.condominios, "novos"],
              ["Imóveis", c.imoveis + c.imoveisAtualizados, `${c.imoveis} novos · ${c.imoveisAtualizados} atualizados · ${c.vagos} vagos`],
              ["Contratos", c.contratos, c.aConferir ? `${c.aConferir} com datas a conferir` : "alugados"]] as const).map(([t, n, s]) => (
              <div className="kpi" key={t}><span className="label">{t}</span><span className="v num">{n}</span><small>{s}</small></div>
            ))}
          </div>
        </>
      )}
      {!!r.erros?.length && (
        <div className="sec">
          <div className="sec-h"><h2>Corrija na planilha e envie de novo</h2><span className="count">{r.erros.length}</span></div>
          <div className="box">{r.erros.slice(0, 60).map((e, i) => (
            <div key={i} className="mv"><span className="ic bad">!</span><span className="t"><b>{e.msg}</b><small>Aba {e.aba}{e.linha ? ` · linha ${e.linha}` : ""}</small></span></div>
          ))}</div>
          {r.erros.length > 60 && <p className="small muted" style={{ margin: 0 }}>… e mais {r.erros.length - 60}.</p>}
        </div>
      )}
      {!!r.avisos?.length && !r.importado && (
        <details open={r.avisos.length <= 12}><summary className="small muted" style={{ cursor: "pointer" }}>{r.avisos.length} aviso(s): não impedem a importação</summary>
          <div className="box" style={{ marginTop: 8 }}>{r.avisos.slice(0, 60).map((e, i) => (
            <div key={i} className="mv"><span className="t"><b style={{ fontWeight: 400 }}>{e.msg}</b><small>Aba {e.aba}{e.linha ? ` · linha ${e.linha}` : ""}</small></span></div>
          ))}</div></details>
      )}
      {podeImportar && <p className="small muted" style={{ margin: 0 }}>Tudo certo. Ao importar, ou entra tudo ou nada.</p>}
    </form>
  );
}
