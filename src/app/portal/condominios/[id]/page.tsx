import Link from "next/link";
import { notFound } from "next/navigation";
import { Copiar } from "@/components/Copiar";
import { getSessao } from "@/lib/auth";
import { BRL, BRL0, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import type { StatusImovel } from "@/lib/types";
import { carregarPortal } from "../../dados";
import { carregarDespesas } from "../../despesas";
import { COR_IMOVEL, predios, SITUACAO_IMOVEL } from "../../resumo";

const mmaa = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default async function PredioPortal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ver?: string }> }) {
  const [{ id }, { ver }] = await Promise.all([params, searchParams]);
  const condId = id === "avulsos" ? null : id;
  const { supabase, proprietarioIds } = await getSessao();
  const [{ imoveis, condominios }, { despesas }, { data: cond }] = await Promise.all([
    carregarPortal(supabase, proprietarioIds),
    carregarDespesas(supabase),
    condId ? supabase.from("condominios").select("nome, endereco, iptu_inscricao, energia_cliente, agua_cliente").eq("id", condId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = predios(imoveis, condominios).find((x) => x.id === condId);
  if (!p) notFound();
  const unidades = imoveis.filter((i) => i.condominioId === condId);
  const filtro = (ver ?? "todas") as "todas" | StatusImovel;
  const vis = filtro === "todas" ? unidades : unidades.filter((u) => u.status === filtro);
  const mes = new Date().toISOString().slice(0, 7);
  const contas = despesas.filter((d) => d.condominioId === condId && (d.enviadaEm ?? "").startsWith(mes) && d.total > 0);
  const totalContas = contas.reduce((a, d) => a + d.total, 0);
  const href = (v: string) => `/portal/condominios/${id}${v === "todas" ? "" : `?ver=${v}`}`;

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/portal/imoveis">Seus imóveis</Link><span>/</span><span>{p.nome}</span></div>
        <h1>{p.nome}</h1>
        <p className="muted">{[cond?.endereco ?? (condId ? p.endereco : ""), `${p.unidades} ${p.unidades === 1 ? "unidade sua" : "unidades suas"}`].filter(Boolean).join(" · ")}</p>
      </section>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="kpi saldo" style={{ padding: 16 }}><span className="label">Aluguéis por mês</span><span className="v" style={{ fontSize: 24 }}>{BRL0(p.aluguelMes)}</span>
          <small>{p.porStatus.locado} {p.porStatus.locado === 1 ? "alugada" : "alugadas"}{p.porStatus.vazio ? ` · ${p.porStatus.vazio} ${p.porStatus.vazio === 1 ? "vaga" : "vagas"}` : ""}{p.porStatus.devolucao ? ` · ${p.porStatus.devolucao} saindo` : ""}</small></div>
        <div className="kpi"><span className="label">Contas do prédio</span><span className="v">{BRL0(totalContas)}</span><small>sua parte neste mês · {contas.length} {contas.length === 1 ? "conta" : "contas"}</small></div>
      </div>

      {cond && (cond.iptu_inscricao || cond.energia_cliente || cond.agua_cliente) && (
        <div className="box">
          {([["IPTU", cond.iptu_inscricao], ["Energia", cond.energia_cliente], ["Água", cond.agua_cliente]] as const).filter(([, v]) => v).map(([t, v]) => (
            <div key={t} className="mv"><span className="t"><b>{t}</b><small>{t === "IPTU" ? "inscrição" : "nº do cliente"} · do prédio todo</small></span>
              <span className="mono" style={{ overflowWrap: "anywhere" }}>{v}</span><Copiar texto={v!} /></div>
          ))}
        </div>
      )}

      <section className="sec">
        <div className="toolbar">
          <h2 style={{ margin: 0, fontSize: 15 }}>Unidades</h2><span style={{ flex: 1 }} />
          <div className="filters">
            {(["todas", "locado", "vazio", "devolucao"] as const).filter((k) => k === "todas" || p.porStatus[k]).map((k) => (
              <Link key={k} href={href(k)} aria-pressed={filtro === k}>{k === "todas" ? "Todas" : SITUACAO_IMOVEL[k] + (k === "locado" ? "s" : k === "vazio" ? "s" : "")} <span className="n">{k === "todas" ? unidades.length : p.porStatus[k]}</span></Link>
            ))}
          </div>
        </div>
        <div className="cartoes">
          {vis.map((u) => {
            const vence = u.status === "locado" && u.fim && diasAte(u.fim) <= RENOVACAO_DIAS;
            return (
              <Link key={u.id} href={`/portal/imoveis/${u.id}`} className="cartao">
                <b>{u.nome}</b>
                <small style={{ color: vence ? "var(--warn)" : undefined }}>
                  {vence ? `vence em ${diasAte(u.fim!)} dias` : u.status === "locado" && u.fim ? `até ${mmaa(u.fim)}` : u.status === "vazio" ? "pronto para alugar" : u.status === "devolucao" ? "inquilino saindo" : u.motivo ?? "indisponível"}
                  {u.percentual < 100 ? ` · sua parte ${u.percentual}%` : ""}
                </small>
                <span className="s"><i className="dot" style={{ background: COR_IMOVEL[u.status] }} />{SITUACAO_IMOVEL[u.status]}{u.aluguel && u.status !== "vazio" && u.status !== "indisponivel" ? ` · ${BRL0(u.aluguel * u.percentual / 100)}` : ""}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {contas.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>Contas deste mês</h2></div>
          <div className="box">{contas.map((d) => (
            <div key={d.id} className="mv"><span className="t"><b>{d.descricao}</b><small>{d.unidades.length > 1 ? `sua parte de ${d.unidades.length} unidades` : d.unidades[0]?.nome}</small></span><span className="v">{BRL(d.total)}</span></div>
          ))}</div>
        </section>
      )}
    </>
  );
}
