import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { salvarCondominio } from "../actions";

export default async function Condominios({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("condominios").select("id, nome, endereco, cidade, cotas_padrao, imoveis(count)").order("nome");
  const lista = (data ?? []) as unknown as { id: string; nome: string; endereco: string | null; cidade: string | null; cotas_padrao: number | null; imoveis: { count: number }[] }[];

  return (
    <>
      <section className="hero">
        <div className="label">Cadastros</div>
        <h1>Condomínios</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <form action={salvarCondominio} className="panel">
        <span className="label">Novo condomínio</span>
        <div className="inline-form">
          <div className="field"><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" required placeholder="Cond. Manoel de Souza 48" /></div>
          <div className="field"><label className="label" htmlFor="endereco">Endereço</label><input id="endereco" name="endereco" /></div>
          <div className="field" style={{ flex: "0 1 140px" }}><label className="label" htmlFor="cotas_padrao">Cotas no rateio</label><input id="cotas_padrao" name="cotas_padrao" inputMode="decimal" placeholder="12" /></div>
          <button className="btn primary">Adicionar</button>
        </div>
      </form>
      <section className="sec">
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Nome</th><th>Endereço</th><th className="r">Unidades na carteira</th><th className="r">Cotas padrão</th><th /></tr></thead>
            <tbody>{lista.map((c) => (
              <tr key={c.id}>
                <td><Link className="rowlink" href={`/admin/condominios/${c.id}`}>{c.nome}</Link></td>
                <td className="muted">{[c.endereco, c.cidade].filter(Boolean).join(" · ") || "—"}</td>
                <td className="r num">{c.imoveis[0]?.count ?? 0}</td>
                <td className="r num">{c.cotas_padrao != null ? Number(c.cotas_padrao) : "—"}</td>
                <td className="go">›</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum condomínio cadastrado ainda.</div>}
      </section>
    </>
  );
}
