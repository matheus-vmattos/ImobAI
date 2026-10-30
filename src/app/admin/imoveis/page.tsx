import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import { BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { STATUS_LABEL, STATUS_ORDEM, type Imovel, type StatusImovel } from "@/lib/types";

type Linha = Imovel & {
  condominios: { nome: string } | null;
  imovel_proprietarios: { proprietarios: { nome: string } }[];
  contratos: { inquilino: string; aluguel: number; fim: string; ativo: boolean }[];
};

export default async function Imoveis({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; condominio?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const { q = "", status = "", condominio = "", ok, erro } = sp;
  const { supabase } = await exigirAdmin();
  const [{ data: rows }, { data: condominios }] = await Promise.all([
    supabase.from("imoveis")
      .select("*, condominios(nome), imovel_proprietarios(proprietarios(nome)), contratos(inquilino, aluguel, fim, ativo)")
      .order("identificacao"),
    supabase.from("condominios").select("id, nome").order("nome"),
  ]);
  const todos = (rows ?? []) as unknown as Linha[];
  const ativo = (i: Linha) => i.contratos.find((c) => c.ativo);
  const termo = q.toLowerCase();
  const porCondo = todos.filter((i) => !condominio || (condominio === "avulso" ? !i.condominio_id : i.condominio_id === condominio));
  const lista = porCondo.filter((i) =>
    (!status || i.status === status) &&
    (!termo || [i.identificacao, i.endereco, i.condominios?.nome, ativo(i)?.inquilino, ...i.imovel_proprietarios.map((v) => v.proprietarios.nome)]
      .filter(Boolean).join(" ").toLowerCase().includes(termo)));

  const href = (p: Record<string, string>) => {
    const s = new URLSearchParams({ q, status, condominio, ...p });
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
          <Link href={href({ status: "" })} aria-pressed={!status}>Todos<span className="n">{porCondo.length}</span></Link>
          {STATUS_ORDEM.map((s: StatusImovel) => (
            <Link key={s} href={href({ status: s })} aria-pressed={status === s}>{STATUS_LABEL[s]}<span className="n">{porCondo.filter((i) => i.status === s).length}</span></Link>
          ))}
        </div>
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Imóvel</th><th>Proprietário</th><th>Status</th><th className="r">Aluguel</th><th>Contrato até</th><th>Inquilino</th><th /></tr></thead>
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
                  <td className="num" style={{ color: dias != null && dias <= RENOVACAO_DIAS ? "var(--warn)" : undefined }}>{c ? data(c.fim) : "—"}</td>
                  <td className="muted">{c?.inquilino ?? "—"}</td>
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
