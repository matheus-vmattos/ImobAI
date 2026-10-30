import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import type { Imovel, Proprietario } from "@/lib/types";
import { convidarProprietario, excluirProprietario } from "../../actions";
import { ProprietarioForm } from "../ProprietarioForm";

type Vinculo = { percentual: number; imoveis: Pick<Imovel, "id" | "identificacao" | "endereco" | "status"> & { condominios: { nome: string } | null } };

export default async function EditarProprietario({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: p }, { data: vinc }] = await Promise.all([
    supabase.from("proprietarios").select("*").eq("id", id).single<Proprietario>(),
    supabase.from("imovel_proprietarios").select("percentual, imoveis(id, identificacao, endereco, status, condominios(nome))").eq("proprietario_id", id),
  ]);
  if (!p) notFound();
  const imoveis = (vinc ?? []) as unknown as Vinculo[];

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/proprietarios">Proprietários</Link><span>/</span><span>{p.nome}</span></div>
        <h1>{p.nome}</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <div className="cols">
        <ProprietarioForm p={p} />
        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="sec-h"><h2>Acesso ao portal</h2><span className="rule" /></div>
            {p.user_id ? (
              <p className="small" style={{ margin: 0 }}><span className="pill acesso">Com acesso</span> &nbsp;Entra com {p.email}.</p>
            ) : (
              <form action={convidarProprietario} className="actions">
                <input type="hidden" name="id" value={p.id} />
                <span className="small muted" style={{ flex: "1 1 200px" }}>
                  {p.email ? `Envia um e-mail para ${p.email} criar a senha.` : "Cadastre um e-mail para poder convidar."}
                </span>
                <button className="btn" disabled={!p.email}>Enviar convite</button>
              </form>
            )}
          </div>
          <div className="panel">
            <div className="sec-h"><h2>Imóveis</h2><span className="count">{imoveis.length}</span><span className="rule" /></div>
            {imoveis.length ? (
              <div className="tbl-wrap"><table style={{ minWidth: 420 }}>
                <tbody>{imoveis.map((v) => (
                  <tr key={v.imoveis.id}>
                    <td><Link className="rowlink" href={`/admin/imoveis/${v.imoveis.id}`}>{v.imoveis.identificacao}</Link><br />
                      <span className="muted small">{v.imoveis.condominios?.nome ?? v.imoveis.endereco}</span></td>
                    <td><StatusPill status={v.imoveis.status} /></td>
                    <td className="r num">{Number(v.percentual)}%</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="muted small" style={{ margin: 0 }}>Nenhum imóvel vinculado. Vincule pelo cadastro do imóvel.</p>}
            <Link href={`/admin/imoveis/novo?proprietario=${p.id}`} className="btn sm" style={{ justifySelf: "start" }}>Novo imóvel deste proprietário</Link>
          </div>
          <form action={excluirProprietario}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn danger sm">Excluir proprietário</button>
          </form>
        </div>
      </div>
    </>
  );
}
