import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { BRL, BRL0, data, diasAte, RENOVACAO_DIAS, hojeSP } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { RENOVACAO_LABEL, type Imovel, type Renovacao } from "@/lib/types";

type ContratoLista = {
  id: string; imovel_id: string; inquilino: string; aluguel: number; fim: string; entrega_chaves_prevista: string | null;
  imoveis: { identificacao: string; status: Imovel["status"]; condominios: { nome: string } | null } | null;
};

export default async function AdminHome() {
  const { supabase } = await exigirAdmin();
  const hoje = hojeSP();
  const [{ data: imoveis }, { count: nProp }, { count: nCond }, { data: contratos }, { data: pags }, { data: rens }, { data: atrasadas }, { data: alAtras }, { count: rascunhos }] = await Promise.all([
    supabase.from("imoveis").select("status"),
    supabase.from("proprietarios").select("*", { count: "exact", head: true }),
    supabase.from("condominios").select("*", { count: "exact", head: true }),
    supabase.from("contratos")
      .select("id, imovel_id, inquilino, aluguel, fim, entrega_chaves_prevista, imoveis(identificacao, status, condominios(nome))")
      .eq("ativo", true).order("fim"),
    supabase.from("pagamentos").select("id, valor, created_at, proprietarios(nome)").eq("status", "informado").order("created_at"),
    supabase.from("renovacoes").select("contrato_id, decisao, valor_proposto").is("concluida_em", null),
    supabase.from("cobrancas").select("total, pago, abonado, descontado").eq("status", "aberta").lt("vencimento", hoje),
    supabase.from("alugueis").select("valor").is("recebido_em", null).lt("vencimento", hoje).gte("competencia", hoje.slice(0, 8) + "01"),
    supabase.from("despesas").select("*", { count: "exact", head: true }).eq("status", "rascunho").eq("valor_total", 0),
  ]);
  const respostas = (rens ?? []) as Pick<Renovacao, "contrato_id" | "decisao" | "valor_proposto">[];
  const resposta = (contratoId: string) => {
    const rs = respostas.filter((r) => r.contrato_id === contratoId);
    if (!rs.length) return <span className="pill aguardando">Aguardando</span>;
    return rs.map((r, i) => <span key={i} className={`pill renov-${r.decisao}`} style={{ marginRight: 4 }}>{RENOVACAO_LABEL[r.decisao]}{r.valor_proposto ? ` · ${BRL0(r.valor_proposto)}` : ""}</span>);
  };
  const comprovantes = (pags ?? []) as unknown as { id: string; valor: number; created_at: string; proprietarios: { nome: string } }[];
  const atrasado = (atrasadas ?? []).reduce((a, c) => a + Number(c.total) - Number(c.pago) - Number(c.abonado) - Number(c.descontado), 0);
  const tarefas = [
    ...comprovantes.map((p) => ({ k: p.id, ic: "coins", cls: "dev", t: `${p.proprietarios.nome} enviou comprovante`, s: `${BRL(p.valor)} · ${data(p.created_at)}`, href: `/admin/cobrancas/pagamento/${p.id}`, acao: "Conferir" })),
    ...((atrasadas ?? []).length ? [{ k: "cob", ic: "alert", cls: "bad", t: `${(atrasadas ?? []).length} cobrança(s) vencida(s)`, s: `${BRL(atrasado)} em aberto`, href: "/admin/cobrancas?ver=atrasadas", acao: "Ver" }] : []),
    ...((alAtras ?? []).length ? [{ k: "alu", ic: "bank", cls: "warn", t: `${(alAtras ?? []).length} aluguel(éis) atrasado(s) neste mês`, s: `${BRL((alAtras ?? []).reduce((a, x) => a + Number(x.valor), 0))} sem pagamento do inquilino`, href: "/admin/alugueis?ver=atrasado", acao: "Ver" }] : []),
    ...(rascunhos ? [{ k: "ras", ic: "repeat", cls: "warn", t: `${rascunhos} conta(s) mensal(is) esperando valor`, s: "água, luz e outras de valor variável", href: "/admin/despesas/recorrentes", acao: "Informar" }] : []),
  ];
  const cs = (contratos ?? []) as unknown as ContratoLista[];
  const cnt = (s: string) => (imoveis ?? []).filter((i) => i.status === s).length;
  const vencendo = cs.filter((c) => c.imoveis?.status === "locado" && diasAte(c.fim) <= RENOVACAO_DIAS);
  const devolucao = cs.filter((c) => c.imoveis?.status === "devolucao");
  const bruto = cs.filter((c) => c.imoveis?.status === "locado").reduce((a, c) => a + Number(c.aluguel), 0);
  const onde = (c: ContratoLista) => [c.imoveis?.condominios?.nome, c.imoveis?.identificacao].filter(Boolean).join(" · ");

  return (
    <>
      <section className="hero">
        <div className="label">Painel da imobiliária</div>
        <h1>Visão geral</h1>
        <div className="kpis">
          <div className="kpi"><span className="label">Imóveis</span><span className="v">{imoveis?.length ?? 0}</span>
            <small>{cnt("locado")} locados · {cnt("vazio")} vazios · {cnt("devolucao")} em devolução</small></div>
          <div className="kpi"><span className="label">Proprietários</span><span className="v">{nProp ?? 0}</span><small>{nCond ?? 0} condomínios</small></div>
          <div className="kpi"><span className="label">Aluguel mensal</span><span className="v">{BRL0(bruto)}</span><small>contratos ativos</small></div>
          <div className="kpi"><span className="label">Vencendo</span><span className={`v ${vencendo.length ? "attn" : ""}`}>{vencendo.length}</span><small>em até {RENOVACAO_DIAS} dias</small></div>
        </div>
      </section>

      {(imoveis ?? []).length === 0 && (
        <div className="empty"><b>Comece cadastrando a carteira.</b>Importe proprietários, condomínios, imóveis e contratos de uma planilha, ou cadastre um a um.
          <span className="actions"><Link className="btn primary" href="/admin/importar">Importar planilha</Link><Link className="btn" href="/admin/proprietarios/novo">Cadastrar proprietário</Link></span></div>
      )}

      <section className="sec">
        <div className="sec-h"><h2>Precisa de você</h2><span className="count">{tarefas.length}</span></div>
        {tarefas.length ? (
          <div className="box">{tarefas.map((x) => (
            <Link key={x.k} href={x.href} className="mv" style={{ textDecoration: "none" }}>
              <span className={`ic ${x.cls}`}><Icon name={x.ic} /></span>
              <span className="t"><b>{x.t}</b><small>{x.s}</small></span>
              <span className="btn sm">{x.acao}</span>
            </Link>
          ))}</div>
        ) : <div className="empty">Nada pendente. Tudo em dia.</div>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2>Contratos vencendo</h2><span className="count">{vencendo.length}</span><span className="rule" /></div>
        {vencendo.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Imóvel</th><th>Inquilino</th><th className="r">Aluguel</th><th>Fim</th><th className="r">Restam</th><th>Proprietário</th></tr></thead>
            <tbody>{vencendo.map((c) => (
              <tr key={c.id}><td><Link className="rowlink" href={`/admin/imoveis/${c.imovel_id}`}>{onde(c)}</Link></td><td>{c.inquilino}</td>
                <td className="r num">{BRL0(c.aluguel)}</td><td className="num">{data(c.fim)}</td>
                <td className="r num" style={{ color: "var(--warn)" }}>{diasAte(c.fim)} d</td><td>{resposta(c.id)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum contrato vence nos próximos {RENOVACAO_DIAS} dias.</div>}
      </section>

      <section className="sec">
        <div className="sec-h"><h2>Em devolução</h2><span className="count">{devolucao.length}</span><span className="rule" /></div>
        {devolucao.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Imóvel</th><th>Inquilino</th><th>Entrega das chaves</th></tr></thead>
            <tbody>{devolucao.map((c) => (
              <tr key={c.id}><td><Link className="rowlink" href={`/admin/imoveis/${c.imovel_id}`}>{onde(c)}</Link></td><td>{c.inquilino}</td>
                <td className="num" style={{ color: "var(--dev)" }}>{data(c.entrega_chaves_prevista)}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum imóvel em processo de devolução.</div>}
      </section>
    </>
  );
}
