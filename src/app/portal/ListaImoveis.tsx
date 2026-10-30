"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { STATUS_LABEL, STATUS_ORDEM, type StatusImovel } from "@/lib/types";
import type { CondominioPortal, ImovelPortal } from "./dados";

const COR: Record<StatusImovel, string> = { locado: "var(--ok)", devolucao: "var(--dev)", vazio: "var(--warn)", indisponivel: "var(--dim)" };
type Filtro = "todos" | StatusImovel | "vencendo";

const vence = (i: ImovelPortal) => i.status === "locado" && !!i.fim && diasAte(i.fim) <= RENOVACAO_DIAS;

export function ListaImoveis({ imoveis, condominios }: { imoveis: ImovelPortal[]; condominios: CondominioPortal[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [modo, setModo] = useState<"grupo" | "lista">("grupo");
  const nomeCondo = (id: string | null) => condominios.find((c) => c.id === id)?.nome ?? "";

  const visiveis = useMemo(() => imoveis.filter((i) =>
    (filtro === "todos" || (filtro === "vencendo" ? vence(i) : i.status === filtro)) &&
    (!q || [i.nome, nomeCondo(i.condominioId), i.inquilino ?? ""].join(" ").toLowerCase().includes(q.toLowerCase()))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [imoveis, filtro, q]);

  const conta = (f: Filtro) => f === "todos" ? imoveis.length : f === "vencendo" ? imoveis.filter(vence).length : imoveis.filter((i) => i.status === f).length;
  const filtrando = filtro !== "todos" || q !== "";

  const tabela = (lista: ImovelPortal[], comCondo: boolean) => (
    <div className="tbl-wrap"><table>
      <thead><tr><th>Unidade{comCondo ? " · condomínio" : ""}</th><th>Status</th><th className="r">Aluguel</th><th>Contrato até</th><th className="r">Restam</th><th>Inquilino</th><th /></tr></thead>
      <tbody>{lista.map((i) => {
        const dias = i.status === "locado" && i.fim ? diasAte(i.fim) : null;
        return (
          <tr key={i.id}>
            <td><Link className="rowlink" href={`/portal/imoveis/${i.id}`}>{i.nome}</Link>
              {comCondo && i.condominioId && <><br /><span className="muted small">{nomeCondo(i.condominioId)}</span></>}
              {i.percentual < 100 && <span className="muted small"> · {i.percentual}%</span>}</td>
            <td><StatusPill status={i.status} /></td>
            <td className="r num">{i.status === "indisponivel" ? "—" : BRL0(i.aluguel)}</td>
            <td className="num">{i.status === "devolucao" ? <span style={{ color: "var(--dev)" }}>Chaves {data(i.entregaChaves)}</span> : i.status === "locado" ? data(i.fim) : i.motivo ? <span className="muted">{i.motivo}</span> : "—"}</td>
            <td className="r num" style={{ color: dias != null && dias <= RENOVACAO_DIAS ? "var(--warn)" : undefined }}>{dias != null ? `${dias} d` : "—"}</td>
            <td className="muted">{i.inquilino ?? "—"}</td>
            <td className="go">›</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );

  return (
    <>
      <div className="toolbar">
        <label className="search"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar unidade, endereço ou inquilino" aria-label="Buscar" /></label>
        <div className="filters">
          <button aria-pressed={modo === "grupo"} onClick={() => setModo("grupo")}>Por condomínio</button>
          <button aria-pressed={modo === "lista"} onClick={() => setModo("lista")}>Lista</button>
        </div>
      </div>
      <div className="filters">
        {(["todos", ...STATUS_ORDEM, "vencendo"] as Filtro[]).map((f) => (
          <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
            {f === "todos" ? "Todos" : f === "vencendo" ? "Vencendo" : STATUS_LABEL[f]}<span className="n">{conta(f)}</span>
          </button>
        ))}
      </div>

      {!visiveis.length ? <div className="empty">Nenhum imóvel com esse filtro.</div>
        : modo === "lista" ? <div className="box">{tabela(visiveis, true)}</div>
        : (
          <div className="groups">
            {condominios.map((c, idx) => {
              const todos = imoveis.filter((i) => i.condominioId === c.id);
              const vis = visiveis.filter((i) => i.condominioId === c.id);
              if (!vis.length) return null;
              const n = (s: StatusImovel) => todos.filter((i) => i.status === s).length;
              const bruto = todos.filter((i) => i.status === "locado").reduce((a, i) => a + (i.aluguel ?? 0) * i.percentual / 100, 0);
              const venc = todos.filter(vence).length;
              return (
                <details className="cg" key={c.id ?? "avulso"} open={filtrando || idx === 0}>
                  <summary>
                    <span className="chev" />
                    <div className="cg-n"><b>{c.nome}</b><span>{c.endereco} · {todos.length} unidade{todos.length > 1 ? "s" : ""}</span></div>
                    <div className="mix">
                      <div className="mixbar">{STATUS_ORDEM.map((s) => n(s) ? <i key={s} style={{ flex: n(s), background: COR[s] }} /> : null)}</div>
                      <div className="mixleg">{STATUS_ORDEM.map((s) => n(s) ? <span key={s} style={{ ["--c" as string]: COR[s] }}>{n(s)} {STATUS_LABEL[s].toLowerCase()}</span> : null)}</div>
                    </div>
                    <div className="cg-r"><span className="v">{BRL0(bruto)}<span className="muted" style={{ fontSize: 11 }}>/mês</span></span>
                      <small className={venc ? "attn" : ""}>{venc ? `${venc} vencendo` : "em dia"}</small></div>
                  </summary>
                  {tabela(vis, false)}
                </details>
              );
            })}
          </div>
        )}
    </>
  );
}
