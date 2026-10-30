import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import type { Imovel } from "@/lib/types";

type ContratoLista = {
  id: string; imovel_id: string; inquilino: string; aluguel: number; fim: string; entrega_chaves_prevista: string | null;
  imoveis: { identificacao: string; status: Imovel["status"]; condominios: { nome: string } | null } | null;
};

export default async function AdminHome() {
  const { supabase } = await exigirAdmin();
  const [{ data: imoveis }, { count: nProp }, { count: nCond }, { data: contratos }] = await Promise.all([
    supabase.from("imoveis").select("status"),
    supabase.from("proprietarios").select("*", { count: "exact", head: true }),
    supabase.from("condominios").select("*", { count: "exact", head: true }),
    supabase.from("contratos")
      .select("id, imovel_id, inquilino, aluguel, fim, entrega_chaves_prevista, imoveis(identificacao, status, condominios(nome))")
      .eq("ativo", true).order("fim"),
  ]);
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
        <div className="sec-h"><h2>Contratos vencendo</h2><span className="count">{vencendo.length}</span><span className="rule" /></div>
        {vencendo.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Imóvel</th><th>Inquilino</th><th className="r">Aluguel</th><th>Fim</th><th className="r">Restam</th></tr></thead>
            <tbody>{vencendo.map((c) => (
              <tr key={c.id}><td><Link className="rowlink" href={`/admin/imoveis/${c.imovel_id}`}>{onde(c)}</Link></td><td>{c.inquilino}</td>
                <td className="r num">{BRL0(c.aluguel)}</td><td className="num">{data(c.fim)}</td>
                <td className="r num" style={{ color: "var(--warn)" }}>{diasAte(c.fim)} d</td></tr>
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
