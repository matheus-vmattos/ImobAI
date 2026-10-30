import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { BRL, BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { confirmarReembolso } from "./despesas/actions";
import { RENOVACAO_LABEL, type Imovel, type Renovacao } from "@/lib/types";

type ContratoLista = {
  id: string; imovel_id: string; inquilino: string; aluguel: number; fim: string; entrega_chaves_prevista: string | null;
  imoveis: { identificacao: string; status: Imovel["status"]; condominios: { nome: string } | null } | null;
};

export default async function AdminHome() {
  const { supabase } = await exigirAdmin();
  const [{ data: imoveis }, { count: nProp }, { count: nCond }, { data: contratos }, { data: reemb }, { data: rens }] = await Promise.all([
    supabase.from("imoveis").select("status"),
    supabase.from("proprietarios").select("*", { count: "exact", head: true }),
    supabase.from("condominios").select("*", { count: "exact", head: true }),
    supabase.from("contratos")
      .select("id, imovel_id, inquilino, aluguel, fim, entrega_chaves_prevista, imoveis(identificacao, status, condominios(nome))")
      .eq("ativo", true).order("fim"),
    supabase.from("despesa_itens").select("despesa_id, proprietario_id, valor, taxa_adm, reembolso_informado_em, despesas(descricao), proprietarios(nome)")
      .eq("reembolso", "informado").order("reembolso_informado_em"),
    supabase.from("renovacoes").select("contrato_id, decisao, valor_proposto").is("concluida_em", null),
  ]);
  const respostas = (rens ?? []) as Pick<Renovacao, "contrato_id" | "decisao" | "valor_proposto">[];
  const resposta = (contratoId: string) => {
    const rs = respostas.filter((r) => r.contrato_id === contratoId);
    if (!rs.length) return <span className="pill aguardando">Aguardando</span>;
    return rs.map((r, i) => <span key={i} className={`pill renov-${r.decisao}`} style={{ marginRight: 4 }}>{RENOVACAO_LABEL[r.decisao]}{r.valor_proposto ? ` · ${BRL0(r.valor_proposto)}` : ""}</span>);
  };
  // reembolsos informados pelo proprietário, um por (despesa, proprietário)
  const aConfirmar = new Map<string, { despesa_id: string; proprietario_id: string; descricao: string; nome: string; total: number; em: string | null }>();
  ((reemb ?? []) as unknown as { despesa_id: string; proprietario_id: string; valor: number; taxa_adm: number; reembolso_informado_em: string | null; despesas: { descricao: string }; proprietarios: { nome: string } }[])
    .forEach((r) => {
      const k = r.despesa_id + r.proprietario_id;
      const atual = aConfirmar.get(k);
      aConfirmar.set(k, { despesa_id: r.despesa_id, proprietario_id: r.proprietario_id, descricao: r.despesas.descricao, nome: r.proprietarios.nome,
        total: (atual?.total ?? 0) + Number(r.valor) + Number(r.taxa_adm), em: r.reembolso_informado_em });
    });
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

      <section className="sec">
        <div className="sec-h"><h2>Reembolsos para confirmar</h2><span className="count">{aConfirmar.size}</span><span className="rule" /></div>
        {aConfirmar.size ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Despesa</th><th>Proprietário</th><th className="r">Valor</th><th>Informado em</th><th /></tr></thead>
            <tbody>{[...aConfirmar.values()].map((r) => (
              <tr key={r.despesa_id + r.proprietario_id}>
                <td><Link className="rowlink" href={`/admin/despesas/${r.despesa_id}`}>{r.descricao}</Link></td><td>{r.nome}</td>
                <td className="r num">{BRL(r.total)}</td><td className="num muted">{data(r.em)}</td>
                <td><form action={confirmarReembolso}>
                  <input type="hidden" name="despesa_id" value={r.despesa_id} /><input type="hidden" name="proprietario_id" value={r.proprietario_id} />
                  <input type="hidden" name="voltar" value="/admin" />
                  <button className="btn sm primary">Confirmar recebimento</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum reembolso aguardando confirmação.</div>}
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
