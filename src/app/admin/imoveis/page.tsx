import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import { BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { RENOVACAO_LABEL, STATUS_LABEL, STATUS_ORDEM, type DecisaoRenovacao, type Imovel, type StatusImovel } from "@/lib/types";

type Linha = Imovel & {
  condominios: { nome: string } | null;
  imovel_proprietarios: { proprietarios: { nome: string } }[];
  contratos: { inquilino: string; aluguel: number; fim: string; ativo: boolean; datas_a_conferir: boolean; renovacoes: { decisao: DecisaoRenovacao; valor_proposto: number | null; concluida_em: string | null }[] }[];
};

export default async function Imoveis({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; condominio?: string; conferir?: string; venc?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { q = "", status = "", condominio = "", conferir = "", venc = "", ok, erro } = sp;
  const { supabase } = await exigirAdmin();
  const [{ data: rows }, { data: condominios }] = await Promise.all([
    supabase.from("imoveis")
      .select("*, condominios(nome), imovel_proprietarios(proprietarios(nome)), contratos(inquilino, aluguel, fim, ativo, datas_a_conferir, renovacoes(decisao, valor_proposto, concluida_em))")
      .order("identificacao"),
    supabase.from("condominios").select("id, nome").order("nome"),
  ]);
  const todos = (rows ?? []) as unknown as Linha[];
  const ativo = (i: Linha) => i.contratos.find((c) => c.ativo);
  const termo = q.toLowerCase();
  // contratos vencidos ou que vencem em até 90 dias (imóvel alugado ou saindo)
  const prazo = (i: Linha) => { const c = ativo(i); return c && i.status !== "vazio" ? diasAte(c.fim) : null; };
  const vencido = (i: Linha) => { const d = prazo(i); return d != null && d < 0; };
  const vencendo = (i: Linha) => { const d = prazo(i); return d != null && d >= 0 && d <= RENOVACAO_DIAS; };
  const decisao = (i: Linha) => {
    const rs = (ativo(i)?.renovacoes ?? []).filter((r) => !r.concluida_em);
    if (!rs.length) return <span className="pill aguardando">Aguardando resposta</span>;
    return rs.map((r, k) => <span key={k} className={`pill renov-${r.decisao}`} style={{ marginRight: 4 }}>{RENOVACAO_LABEL[r.decisao]}{r.valor_proposto ? ` · ${BRL0(r.valor_proposto)}` : ""}</span>);
  };
  const porCondo = todos.filter((i) => !condominio || (condominio === "avulso" ? !i.condominio_id : i.condominio_id === condominio));
  const lista = porCondo.filter((i) =>
    (!status || i.status === status) && (!conferir || !!ativo(i)?.datas_a_conferir) &&
    (!venc || (venc === "vencidos" ? vencido(i) : vencendo(i))) &&
    (!termo || [i.identificacao, i.codigo_externo, i.endereco, i.condominios?.nome, ativo(i)?.inquilino, ...i.imovel_proprietarios.map((v) => v.proprietarios.nome)]
      .filter(Boolean).join(" ").toLowerCase().includes(termo)));

  const href = (p: Record<string, string>) => {
    const s = new URLSearchParams({ q, status, condominio, conferir, venc, ...p });
    [...s.keys()].forEach((k) => !s.get(k) && s.delete(k));
    return `/admin/imoveis${s.size ? "?" + s : ""}`;
  };

  return (
    <>
      <section className="hero">
        <div className="label">Cadastros</div>
        <h1>Imóveis</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <section className="sec">
        <form className="toolbar" action="/admin/imoveis">
          <label className="search"><input name="q" defaultValue={q} placeholder="Buscar unidade, endereço, proprietário ou inquilino" aria-label="Buscar" /></label>
          <select name="condominio" defaultValue={condominio} aria-label="Condomínio" className="btn" style={{ background: "var(--panel)" }}>
            <option value="">Todos os condomínios</option>
            <option value="avulso">Imóveis avulsos</option>
            {(condominios ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          {status && <input type="hidden" name="status" value={status} />}
          <button className="btn">Filtrar</button>
          <Link href="/admin/imoveis/novo" className="btn primary">Novo imóvel</Link>
        </form>
        <div className="filters">
          <Link href={href({ status: "", conferir: "", venc: "" })} aria-pressed={!status && !conferir && !venc}>Todos<span className="n">{porCondo.length}</span></Link>
          {STATUS_ORDEM.map((s: StatusImovel) => (
            <Link key={s} href={href({ status: s })} aria-pressed={status === s}>{STATUS_LABEL[s]}<span className="n">{porCondo.filter((i) => i.status === s).length}</span></Link>
          ))}
          <Link href={href({ status: "", venc: venc === "vencidos" ? "" : "vencidos" })} aria-pressed={venc === "vencidos"}>Contratos vencidos<span className="n">{porCondo.filter(vencido).length}</span></Link>
          <Link href={href({ status: "", venc: venc === "vencendo" ? "" : "vencendo" })} aria-pressed={venc === "vencendo"}>Vencem em até {RENOVACAO_DIAS} dias<span className="n">{porCondo.filter(vencendo).length}</span></Link>
          {porCondo.some((i) => ativo(i)?.datas_a_conferir) && (
            <Link href={href({ status: "", conferir: conferir ? "" : "1" })} aria-pressed={!!conferir}>Datas a conferir<span className="n">{porCondo.filter((i) => ativo(i)?.datas_a_conferir).length}</span></Link>
          )}
        </div>
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Imóvel</th><th>Proprietário</th><th>Status</th><th className="r">Aluguel</th><th>Contrato até</th><th>{venc ? "Decisão do proprietário" : "Inquilino"}</th><th /></tr></thead>
            <tbody>{lista.map((i) => {
              const c = ativo(i);
              const dias = c ? diasAte(c.fim) : null;
              return (
                <tr key={i.id}>
                  <td><Link className="rowlink" href={`/admin/imoveis/${i.id}`}>{i.identificacao}</Link><br />
                    <span className="muted small">{i.condominios?.nome ?? i.endereco ?? "Avulso"}</span></td>
                  <td className="muted">{i.imovel_proprietarios.map((v) => v.proprietarios.nome).join(", ") || "—"}</td>
                  <td><StatusPill status={i.status} /></td>
                  <td className="r num">{BRL0(c?.aluguel ?? i.aluguel_pedido)}</td>
                  <td className="num" style={{ color: dias != null && dias < 0 ? "var(--bad)" : dias != null && dias <= RENOVACAO_DIAS ? "var(--warn)" : undefined }}>{c ? data(c.fim) : "—"}
                    {dias != null && dias < 0 && <><br /><span className="small">venceu há {-dias} dias</span></>}</td>
                  <td className="muted">{venc ? decisao(i) : c?.inquilino ?? "—"}</td>
                  <td className="go">›</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">{todos.length ? "Nenhum imóvel com esse filtro." : "Nenhum imóvel cadastrado ainda."}</div>}
      </section>
    </>
  );
}
