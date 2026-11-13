import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { Icon } from "@/components/Icon";
import { getSessaoPortal } from "@/lib/auth";
import { BRL, BRL0, data, diasAte, prazoTxt, RENOVACAO_DIAS } from "@/lib/format";
import { MARCA } from "@/lib/marca";
import type { Renovacao } from "@/lib/types";
import { carregarConta } from "./conta";
import { carregarPortal } from "./dados";
import { carregarDespesas } from "./despesas";
import { Predios } from "./Predios";
import { predios, proximoRecebimento } from "./resumo";

const saudacao = () => {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

export default async function Portal({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase, proprietarioIds, cadastros } = await getSessaoPortal();
  const [{ imoveis, condominios }, { pendentes }, { data: rens }, conta, recebe] = await Promise.all([
    carregarPortal(supabase, proprietarioIds),
    carregarDespesas(supabase),
    supabase.from("renovacoes").select("contrato_id"),
    carregarConta(supabase),
    proximoRecebimento(supabase, proprietarioIds),
  ]);
  const nome = (cadastros[0]?.nome ?? "").split(" ")[0];
  const respondidas = new Set(((rens ?? []) as Pick<Renovacao, "contrato_id">[]).map((r) => r.contrato_id));
  const renovar = imoveis.filter((i) => i.status === "locado" && i.contratoId && i.fim && diasAte(i.fim) <= RENOVACAO_DIAS && !respondidas.has(i.contratoId));
  const nomeCondo = (id: string | null) => condominios.find((c) => c.id && c.id === id)?.nome;
  const emConferencia = conta.emConferencia.length > 0;

  const tarefas = [
    ...(conta.abertas.length && !emConferencia ? [{
      k: "pagar", ic: "wallet", cls: "warn", t: conta.abertas.length === 1 ? "Pagar as contas da semana" : `Pagar ${conta.abertas.length} semanas de contas`,
      s: `${conta.abertas.reduce((a, c) => a + c.linhas.length, 0)} contas · até ${data(conta.abertas[0].vencimento)}`, v: BRL(conta.devido),
      href: conta.abertas.length === 1 ? `/portal/cobrancas/${conta.abertas[0].id}` : "/portal/extrato",
    }] : []),
    ...pendentes.map((d) => ({ k: d.id, ic: "check", cls: "accent", t: "Aprovar despesa", s: `${d.descricao} · ${d.onde}`, v: BRL(d.total), href: `/portal/decidir#${d.id}` })),
    ...renovar.map((i) => ({ k: i.id, ic: "refresh", cls: "dev", t: "Renovar contrato?", s: `${[nomeCondo(i.condominioId), i.nome].filter(Boolean).join(" · ")} · ${prazoTxt(i.fim!)}`, v: "", href: `/portal/imoveis/${i.id}#renovacoes` })),
  ];
  const lista = predios(imoveis, condominios);
  const atrasados = imoveis.filter((i) => i.aluguelMes?.situacao === "atrasado");
  const vagos = imoveis.filter((i) => i.status === "vazio");
  const { data: pagadores } = await supabase.rpc("meus_pagadores_nomes");
  const pagoPor = ((pagadores ?? []) as { pagador: string }[])[0]?.pagador;

  return (
    <>
      <section className="hero" style={{ gap: 4 }}>
        <h1>{saudacao()}{nome ? `, ${nome}` : ""}</h1>
        <p className="muted">{MARCA} · seu atendimento</p>
      </section>
      <Aviso ok={ok} erro={erro} />

      {!imoveis.length ? (
        <div className="empty"><b>Seus imóveis vão aparecer aqui.</b>A {MARCA} está preparando seu cadastro.</div>
      ) : (
        <>
          <section className="box">
            <div className="wk">Para você</div>
            {tarefas.length ? tarefas.map((x) => (
              <Link key={x.k} href={x.href} className="mv" style={{ textDecoration: "none" }}>
                <span className={`ic ${x.cls}`}><Icon name={x.ic} /></span>
                <span className="t"><b>{x.t}</b><small>{x.s}</small></span>
                {x.v && <span className="v">{x.v}</span>}<Icon name="chev" className="dim" />
              </Link>
            )) : (
              <div className="mv"><span className="ic ok"><Icon name="check" /></span><span className="t"><b>Está tudo em dia</b><small>Nada precisa de você agora.</small></span></div>
            )}
            {emConferencia && (
              <div className="mv"><span className="ic dev"><Icon name="refresh" /></span><span className="t"><b>Comprovante recebido</b><small>A {MARCA} está conferindo seu pagamento.</small></span></div>
            )}
          </section>

          <div className="kpis" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <Link href={recebe.repasseId ? `/portal/repasses/${recebe.repasseId}` : "/portal/extrato?ver=recebi"} className="kpi saldo" style={{ textDecoration: "none", padding: 16 }}>
              <span className="label">Você recebe</span>
              <span className="v" style={{ color: recebe.valor > 0 ? "var(--ok)" : undefined, fontSize: 24 }}>{BRL0(Math.max(0, recebe.valor))}</span>
              <small>{recebe.fechado ? "fechado" : "previsto"} para {recebe.dia}{recebe.total ? ` · ${recebe.pagos} de ${recebe.total} aluguéis já pagos` : ""}
                {recebe.valor < 0 ? ` · até agora as contas e o seguro superam os aluguéis pagos em ${BRL0(-recebe.valor)}` : ""}</small>
            </Link>
            <Link href="/portal/extrato?ver=paguei" className="kpi" style={{ textDecoration: "none" }}>
              <span className="label">Você paga</span>
              <span className="v">{conta.devido > 0 ? BRL0(conta.devido) : "Nada"}</span>
              <small>{conta.devido > 0 ? `contas da semana · até ${data(conta.abertas[0].vencimento)}` : pagoPor ? `suas contas entram na cobrança de ${pagoPor}` : "nenhuma conta em aberto"}</small>
            </Link>
          </div>

          {(atrasados.length > 0 || vagos.length > 0) && (
            <section className="box">
              <div className="wk">Para você saber</div>
              {atrasados.length > 0 && (
                <Link href="/portal/imoveis?ver=atrasados" className="mv" style={{ textDecoration: "none" }}>
                  <span className="ic bad"><Icon name="alert" /></span>
                  <span className="t"><b>{atrasados.length} {atrasados.length === 1 ? "aluguel atrasado" : "aluguéis atrasados"}</b><small>A {MARCA} já está cobrando {atrasados.length === 1 ? "o inquilino" : "os inquilinos"}. Só entra no que você recebe depois de pago.</small></span>
                  <span className="v">{BRL0(atrasados.reduce((a, i) => a + (i.aluguel ?? 0) * i.percentual / 100, 0))}</span><Icon name="chev" className="dim" />
                </Link>
              )}
              {vagos.length > 0 && (
                <Link href="/portal/imoveis?ver=vagos" className="mv" style={{ textDecoration: "none" }}>
                  <span className="ic warn"><Icon name="home" /></span>
                  <span className="t"><b>{vagos.length} {vagos.length === 1 ? "imóvel vago" : "imóveis vagos"}</b><small>{Math.max(...vagos.map((v) => v.diasNaSituacao)) >= 1 ? `o mais antigo há ${Math.max(...vagos.map((v) => v.diasNaSituacao))} dias` : "veja quais"}</small></span>
                  <Icon name="chev" className="dim" />
                </Link>
              )}
            </section>
          )}

          <section className="sec">
            <div className="sec-h"><h2>Seus imóveis</h2><span className="rule" /><span className="muted small">{imoveis.length} · {lista.length} {lista.length === 1 ? "prédio" : "prédios"}</span></div>
            <Predios lista={lista} />
          </section>
        </>
      )}
    </>
  );
}
