"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { processarPlanilha, type Relatorio } from "./actions";

export function Importador() {
  const [r, enviar, enviando] = useActionState<Relatorio, FormData>(processarPlanilha, {});
  // o formulário é limpo depois de cada envio: guardo o arquivo para o botão "Importar" usar o mesmo
  const arquivo = useRef<File | null>(null);
  const [nome, setNome] = useState("");
  const mandar = (fd: FormData) => {
    const f = fd.get("planilha");
    if (!(f instanceof File && f.size) && arquivo.current) fd.set("planilha", arquivo.current);
    return enviar(fd);
  };
  const c = r.contagem;
  const podeImportar = !!c && !r.erros?.length && !r.importado && (c.proprietarios + c.condominios + c.imoveis + c.contratos > 0);
  return (
    <form action={mandar} className="panel" style={{ maxWidth: 860 }}>
      <div className="drop" style={{ padding: 22 }}>
        <input type="file" name="planilha" accept=".xlsx" required={!nome} aria-label="Planilha"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { arquivo.current = f; setNome(f.name); } }} />
        <span>{nome ? <>Planilha: <b style={{ color: "var(--fg)" }}>{nome}</b></> : "Preencha o modelo e envie aqui. Primeiro só conferimos; nada é gravado até você mandar importar."}</span>
      </div>
      <div className="actions">
        <button className="btn" name="importar" value="0" disabled={enviando}>{enviando ? "Lendo…" : "Conferir planilha"}</button>
        {podeImportar && <button className="btn primary" name="importar" value="1" disabled={enviando}>Importar {c!.imoveis} imóveis e {c!.proprietarios} proprietários</button>}
      </div>

      {r.falha && <div className="alert erro" role="alert">{r.falha}</div>}
      {r.importado && (
        <div className="alert ok" role="status">Importado: {c!.proprietarios} proprietários, {c!.condominios} condomínios, {c!.imoveis} imóveis e {c!.contratos} contratos.
          {" "}<Link className="link" href="/admin/imoveis">Ver imóveis</Link> · <Link className="link" href="/admin/proprietarios">Convidar proprietários</Link></div>
      )}
      {c && !r.importado && (
        <div className="kpis">
          {([["Proprietários", c.proprietarios], ["Condomínios", c.condominios], ["Imóveis", c.imoveis], ["Contratos", c.contratos]] as const).map(([t, n]) => (
            <div className="kpi" key={t}><span className="label">{t}</span><span className="v num">{n}</span><small>novos na planilha</small></div>
          ))}
        </div>
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
        <details><summary className="small muted" style={{ cursor: "pointer" }}>{r.avisos.length} aviso(s): não impedem a importação</summary>
          <div className="box" style={{ marginTop: 8 }}>{r.avisos.slice(0, 60).map((e, i) => (
            <div key={i} className="mv"><span className="t"><b style={{ fontWeight: 400 }}>{e.msg}</b><small>Aba {e.aba}{e.linha ? ` · linha ${e.linha}` : ""}</small></span></div>
          ))}</div></details>
      )}
      {podeImportar && <p className="small muted" style={{ margin: 0 }}>Tudo certo. Ao importar, ou entra a planilha inteira ou nada.</p>}
    </form>
  );
}
