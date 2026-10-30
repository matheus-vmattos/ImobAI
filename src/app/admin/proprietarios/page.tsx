import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";

export default async function Proprietarios({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; erro?: string }> }) {
  const { q = "", ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  let query = supabase.from("proprietarios").select("id, nome, email, telefone, user_id, imovel_proprietarios(count)").order("nome");
  const termo = q.replace(/[,()*%\\]/g, " ").trim(); // caracteres especiais da sintaxe de filtro do PostgREST
  if (termo) query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%,cpf_cnpj.ilike.%${termo}%`);
  const { data } = await query;
  const lista = (data ?? []) as unknown as { id: string; nome: string; email: string | null; telefone: string | null; user_id: string | null; imovel_proprietarios: { count: number }[] }[];

  return (
    <>
      <section className="hero">
        <div className="label">Cadastros</div>
        <h1>Proprietários</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <section className="sec">
        <div className="toolbar">
          <form className="search" action="/admin/proprietarios">
            <input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail ou CPF/CNPJ" aria-label="Buscar" />
          </form>
          <Link href="/admin/proprietarios/novo" className="btn primary">Novo proprietário</Link>
        </div>
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th className="r">Imóveis</th><th>Portal</th><th /></tr></thead>
            <tbody>{lista.map((p) => (
              <tr key={p.id}>
                <td><Link className="rowlink" href={`/admin/proprietarios/${p.id}`}>{p.nome}</Link></td>
                <td className="muted">{p.email ?? "—"}</td><td className="muted">{p.telefone ?? "—"}</td>
                <td className="r num">{p.imovel_proprietarios[0]?.count ?? 0}</td>
                <td>{p.user_id ? <span className="pill acesso">Com acesso</span> : <span className="pill sem-acesso">Sem acesso</span>}</td>
                <td className="go">›</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">{q ? "Nenhum proprietário encontrado." : "Nenhum proprietário cadastrado ainda."}</div>}
      </section>
    </>
  );
}
