import Link from "next/link";
import { notFound } from "next/navigation";
import { Copiar } from "@/components/Copiar";
import { Icon } from "@/components/Icon";
import { ALUGUEL_TXT, situacaoAluguel } from "@/lib/aluguel";
import { controlaAlugueis } from "@/lib/cobrancas";
import { SITUACAO_LABEL } from "@/lib/types";
import { StatusPill } from "@/components/StatusPill";
import { getSessaoPortal } from "@/lib/auth";
import { BRL, BRL0, data, diasAte, haTxt, RENOVACAO_DIAS, hojeSP, mesSP, diaSP, nomeMes } from "@/lib/format";
import type { Contrato, Imovel } from "@/lib/types";
import { carregarDespesas } from "../../despesas";
import { Renovacoes } from "../../Renovacoes";
import type { Renovacao } from "@/lib/types";

export default async function ImovelPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proprietarioIds } = await getSessaoPortal();
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
  const [{ descontosPorImovel, despesas }, { data: als }] = await Promise.all([
    carregarDespesas(supabase),
    (await controlaAlugueis(supabase)) ? supabase.from("alugueis").select("competencia, vencimento, valor, recebido_em, valor_recebido, contratos!inner(imovel_id, inquilino)")
      .eq("contratos.imovel_id", id).order("competencia", { ascending: false }).limit(12) : Promise.resolve({ data: null }),
  ]);
  const hoje = hojeSP();
  const alugueis = ((als ?? []) as unknown as { competencia: string; vencimento: string; valor: number; recebido_em: string | null; valor_recebido: number | null; contratos: { inquilino: string } }[])
    .map((a) => ({ ...a, s: situacaoAluguel({ vencimento: a.vencimento, valor: Number(a.valor), recebidoEm: a.recebido_em, valorRecebido: a.valor_recebido == null ? null : Number(a.valor_recebido) }, hoje) }));
  const doMes = alugueis.find((a) => a.competencia.slice(0, 7) === mesSP());
  // histórico da unidade: aluguéis e contas, do mais recente para o mais antigo
  const historico = [
    ...alugueis.map((a) => ({
      quando: a.recebido_em ?? a.vencimento, titulo: `Aluguel de ${nomeMes(a.competencia.slice(0, 7)).split("/")[0]}`, sub: ALUGUEL_TXT(a.s).replace(/^Aluguel /, ""),
      valor: (a.s.recebido ?? a.s.valor) * pct / 100, cor: a.s.situacao === "atrasado" ? "bad" : a.s.situacao === "pago" ? "ok" : "warn", sinal: a.s.recebidoEm ? "+" : "",
    })),
    ...despesas.filter((d) => d.unidades.some((u) => u.imovelId === im.id)).map((d) => ({
      quando: diaSP(d.enviadaEm ?? hoje), titulo: d.descricao, sub: SITUACAO_LABEL[d.situacao],
      valor: d.unidades.find((u) => u.imovelId === im.id)!.valor, cor: "", sinal: d.situacao === "inquilino" || d.situacao === "direto" ? "" : "−",
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 24);
  descontosPorImovel(im.id).forEach((d) => linhas.push([d.descricao, -d.valor]));
  const liquido = linhas.reduce((a, l) => a + l[1], 0);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href={im.condominio_id ? `/portal/condominios/${im.condominio_id}` : "/portal/imoveis"}>{im.condominios?.nome ?? "Seus imóveis"}</Link><span>/</span><span>{im.identificacao}</span></div>
        <h1>{im.identificacao} <StatusPill status={im.status} /></h1>
        <p className="muted" style={{ margin: 0 }}>{im.condominios ? `${im.condominios.nome} · ${im.condominios.endereco ?? ""}` : im.endereco}</p>
      </section>

      <div className="cols">
        <div className="panel">
          <div className="sec-h"><h2>{im.status === "devolucao" ? "Devolução" : "Contrato"}</h2><span className="rule" /></div>
          {c ? (
            <>
              <div className="kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                <div className="kpi"><span className="label">Aluguel</span><span className="v" style={{ fontSize: 16 }}>{BRL0(c.aluguel)}</span></div>
                <div className="kpi"><span className="label">{im.status === "devolucao" ? "Chaves" : "Até"}</span><span className="v" style={{ fontSize: 16 }}>{data(im.status === "devolucao" ? c.entrega_chaves_prevista : c.fim).replace(/\/20(\d\d)$/, "/$1")}</span></div>
                <div className="kpi"><span className="label">{(im.status === "devolucao" && c.entrega_chaves_prevista ? diasAte(c.entrega_chaves_prevista) : dias!) < 0 ? "Venceu há" : "Restam"}</span>
                  <span className="v" style={{ fontSize: 16, color: im.status === "devolucao" ? "var(--dev)" : dias! <= RENOVACAO_DIAS ? "var(--warn)" : undefined }}>
                    {Math.abs(im.status === "devolucao" && c.entrega_chaves_prevista ? diasAte(c.entrega_chaves_prevista) : dias!)} dias</span></div>
              </div>
              {doMes && (
                <div className="mv" style={{ border: "1px solid var(--line)", borderRadius: 9 }}>
                  <span className={`ic ${doMes.s.situacao === "atrasado" ? "bad" : doMes.s.situacao === "pago" ? "ok" : "warn"}`}><Icon name={doMes.s.situacao === "pago" ? "check" : doMes.s.situacao === "atrasado" ? "alert" : "bank"} /></span>
                  <span className="t"><b>{ALUGUEL_TXT(doMes.s)}</b><small>{doMes.s.situacao === "atrasado" ? "A imobiliária já está cobrando o inquilino." : doMes.s.situacao === "pago" ? "Entra no que você recebe neste mês." : "Ainda dentro do prazo."}</small></span>
                </div>
              )}
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
            <p className="muted" style={{ margin: 0 }}>{haTxt("Vago", Math.max(0, -diasAte((im as unknown as { status_desde: string }).status_desde)))}. Disponível para locação{im.aluguel_pedido ? ` por ${BRL0(im.aluguel_pedido)}` : ""}.</p>
          )}
        </div>

        <div className="panel">
          <div className="sec-h"><h2>Você recebe por este imóvel</h2><span className="rule" /></div>
          {linhas.length ? (
            <div className="box">
              {linhas.map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid var(--line)" }}>
                  <span>{k}</span><span className="num" style={{ color: v < 0 ? "var(--muted)" : undefined }}>{v < 0 ? "− " : ""}{BRL(Math.abs(v))}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "var(--panel-2)", fontWeight: 600 }}>
                <span>{liquido >= 0 ? "Você recebe" : "Você paga"}</span><span className="num" style={{ color: "var(--accent)" }}>{BRL(Math.abs(liquido))}</span>
              </div>
            </div>
          ) : <p className="muted small" style={{ margin: 0 }}>Sem valores para este mês.</p>}
          <small className="muted">Estimativa do mês: aluguel menos a taxa da imobiliária, o seguro e as contas que você escolheu descontar. O valor final vem no repasse.
            {doMes && !doMes.s.recebidoEm ? " O aluguel só entra depois que o inquilino pagar." : ""}</small>
        </div>
      </div>
      <section className="sec">
        <div className="sec-h"><h2>Histórico desta unidade</h2></div>
        {historico.length ? (
          <div className="box">{historico.map((h, k) => (
            <div key={k} className="mv">
              <span className="t"><b>{h.titulo}</b><small style={{ color: h.cor === "bad" ? "var(--bad)" : undefined }}>{h.sub} · {data(h.quando)}</small></span>
              <span className={`v ${h.sinal === "+" && h.cor === "ok" ? "pos" : ""}`} style={{ color: h.sinal ? undefined : "var(--muted)", fontWeight: h.sinal ? undefined : 400 }}>{h.sinal} {BRL(h.valor)}</span>
            </div>
          ))}</div>
        ) : <div className="empty">Ainda sem aluguéis ou contas registrados nesta unidade.</div>}
      </section>

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
