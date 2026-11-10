import Link from "next/link";
import { notFound } from "next/navigation";
import { Copiar } from "@/components/Copiar";
import { StatusPill } from "@/components/StatusPill";
import { getSessao } from "@/lib/auth";
import { BRL, BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import type { Contrato, Imovel } from "@/lib/types";
import { carregarDespesas } from "../../despesas";
import { Renovacoes } from "../../Renovacoes";
import type { Renovacao } from "@/lib/types";

export default async function ImovelPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proprietarioIds } = await getSessao();
  const { data: i } = await supabase.from("imoveis")
    .select("*, condominios(nome, endereco, iptu_inscricao, energia_cliente, agua_cliente), contratos(*), imovel_proprietarios(percentual, proprietario_id)")
    .eq("id", id).maybeSingle();
  if (!i) notFound();
  const im = i as unknown as Imovel & {
    condominios: { nome: string; endereco: string | null; iptu_inscricao: string | null; energia_cliente: string | null; agua_cliente: string | null } | null; contratos: Contrato[];
    imovel_proprietarios: { percentual: number; proprietario_id: string }[];
  };
  const c = im.contratos.find((x) => x.ativo);
  const pct = im.imovel_proprietarios.filter((v) => proprietarioIds.includes(v.proprietario_id)).reduce((a, v) => a + Number(v.percentual), 0) || 100;
  const dias = c ? diasAte(c.fim) : null;
  const { data: resposta } = c ? await supabase.from("renovacoes").select("*").eq("contrato_id", c.id).limit(1).maybeSingle<Renovacao>() : { data: null };

  // estimativa do próximo repasse: aluguel, taxa, seguro e despesas marcadas para desconto
  const linhas: [string, number][] = [];
  if (im.status === "locado" && c) {
    const aluguel = Number(c.aluguel) * pct / 100;
    linhas.push([pct < 100 ? `Aluguel (sua parte, ${pct}%)` : "Aluguel", aluguel]);
    linhas.push([`Taxa de administração (${Number(im.taxa_adm_pct)}%)`, -aluguel * Number(im.taxa_adm_pct) / 100]);
  }
  if (im.seguro_incendio_mensal) linhas.push(["Seguro incêndio (mensal)", -Number(im.seguro_incendio_mensal) * pct / 100]);
  const { descontosPorImovel } = await carregarDespesas(supabase);
  descontosPorImovel(im.id).forEach((d) => linhas.push([d.descricao, -d.valor]));
  const liquido = linhas.reduce((a, l) => a + l[1], 0);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/portal">Meus imóveis</Link><span>/</span><span>{im.identificacao}</span></div>
        <h1>{im.identificacao} <StatusPill status={im.status} /></h1>
        <p className="muted" style={{ margin: 0 }}>{im.condominios ? `${im.condominios.nome} · ${im.condominios.endereco ?? ""}` : im.endereco}</p>
      </section>

      <div className="cols">
        <div className="panel">
          <div className="sec-h"><h2>{im.status === "devolucao" ? "Devolução" : "Contrato"}</h2><span className="rule" /></div>
          {c ? (
            <>
              <div className="kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                <div className="kpi"><span className="label">Aluguel</span><span className="v" style={{ fontSize: 18 }}>{BRL0(c.aluguel)}</span></div>
                <div className="kpi"><span className="label">{im.status === "devolucao" ? "Chaves" : "Até"}</span><span className="v" style={{ fontSize: 18 }}>{data(im.status === "devolucao" ? c.entrega_chaves_prevista : c.fim)}</span></div>
                <div className="kpi"><span className="label">Restam</span>
                  <span className="v" style={{ fontSize: 18, color: im.status === "devolucao" ? "var(--dev)" : dias! <= RENOVACAO_DIAS ? "var(--warn)" : undefined }}>
                    {im.status === "devolucao" && c.entrega_chaves_prevista ? diasAte(c.entrega_chaves_prevista) : dias} dias</span></div>
              </div>
              <p className="small muted" style={{ margin: 0 }}>Inquilino: {c.inquilino} · início {data(c.inicio)}
                {c.aviso_saida_em && <> · aviso de saída em {data(c.aviso_saida_em)}</>}</p>
              {im.status === "locado" && dias! <= RENOVACAO_DIAS && (
                <div id="renovacoes" style={{ display: "grid", gap: 6 }}>
                  <span className="label">Renovação · decisão necessária</span>
                  <Renovacoes voltar={`/portal/imoveis/${im.id}`} itens={[{ contratoId: c.id, imovel: im.identificacao, aluguel: Number(c.aluguel), fim: c.fim, inquilino: c.inquilino, resposta: resposta ?? null }]} />
                </div>
              )}
            </>
          ) : im.status === "indisponivel" ? (
            <p className="muted" style={{ margin: 0 }}>{im.motivo_indisponivel ?? "Imóvel indisponível no momento."}</p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Disponível para locação{im.aluguel_pedido ? ` por ${BRL0(im.aluguel_pedido)}` : ""}.</p>
          )}
        </div>

        <div className="panel">
          <div className="sec-h"><h2>Repasse estimado</h2><span className="rule" /></div>
          {linhas.length ? (
            <div className="box">
              {linhas.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid var(--line)" }}>
                  <span>{k}</span><span className="num" style={{ color: v < 0 ? "var(--muted)" : undefined }}>{v < 0 ? "− " : ""}{BRL(Math.abs(v))}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "var(--panel-2)", fontWeight: 600 }}>
                <span>{liquido >= 0 ? "Líquido a receber" : "A pagar à imobiliária"}</span><span className="num" style={{ color: "var(--accent)" }}>{BRL(Math.abs(liquido))}</span>
              </div>
            </div>
          ) : <p className="muted small" style={{ margin: 0 }}>Sem valores para este mês.</p>}
          <small className="muted">Estimativa do próximo repasse. Inclui as despesas que você marcou para descontar.</small>
        </div>
      </div>
      <section className="sec">
        <div className="sec-h"><h2>IPTU e contas de consumo</h2></div>
        <div className="box">
          {([["IPTU", "Inscrição", "iptu_inscricao"], ["Energia", "Nº do cliente", "energia_cliente"], ["Água", "Nº do cliente", "agua_cliente"]] as const).map(([t, rot, k]) => {
            const doImovel = im[k], doCond = im.condominios?.[k];
            const v = doImovel ?? doCond;
            return (
              <div key={k} className="mv">
                <span className="t"><b>{t}</b><small>{rot}{!doImovel && doCond ? " · do condomínio inteiro" : ""}</small></span>
                {v ? <><span className="mono" style={{ overflowWrap: "anywhere", textAlign: "right" }}>{v}</span><Copiar texto={v} /></> : <span className="muted small">não informado</span>}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
