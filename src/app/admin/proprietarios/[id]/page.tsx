import { verComo } from "@/app/admin/visao/actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import type { Imovel, Proprietario } from "@/lib/types";
import { adicionarAcesso, convidarProprietario, excluirProprietario, removerAcesso } from "../../actions";
import { ProprietarioForm } from "../ProprietarioForm";

type Vinculo = { percentual: number; imoveis: Pick<Imovel, "id" | "identificacao" | "endereco" | "status"> & { condominios: { nome: string } | null } };

export default async function EditarProprietario({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: p }, { data: vinc }, { data: outros }, { data: acessos }, { data: logins }] = await Promise.all([
    supabase.from("proprietarios").select("*").eq("id", id).single<Proprietario>(),
    supabase.from("imovel_proprietarios").select("percentual, imoveis(id, identificacao, endereco, status, condominios(nome))").eq("proprietario_id", id),
    supabase.from("proprietarios").select("id, nome").order("nome"),
    supabase.from("proprietario_acessos").select("id, email, nome").eq("proprietario_id", id).order("email"),
    supabase.from("proprietario_usuarios").select("user_id").eq("proprietario_id", id),
  ]);
  if (!p) notFound();
  const imoveis = (vinc ?? []) as unknown as Vinculo[];

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/proprietarios">Proprietários</Link><span>/</span><span>{p.nome}</span></div>
        <h1>{p.nome}</h1>
        <form action={verComo} className="actions"><input type="hidden" name="proprietario_id" value={p.id} /><button className="btn">Ver o portal como ele vê</button></form>
      </section>
      <Aviso ok={ok} erro={erro} />
      <div className="cols">
        <ProprietarioForm p={p} outros={outros ?? []} />
        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="sec-h"><h2>Acesso ao portal</h2><span className="rule" /></div>
            <p className="small muted" style={{ margin: 0 }}>{(logins ?? []).length} {(logins ?? []).length === 1 ? "login vinculado" : "logins vinculados"} a este cadastro.</p>
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
            <div className="sec-h" style={{ marginTop: 6 }}><h2 style={{ fontSize: 13.5 }}>Outros acessos</h2><span className="count">{(acessos ?? []).length}</span></div>
            <p className="small muted" style={{ margin: 0 }}>Cônjuge, sócio ou contador veem este cadastro com o próprio login.</p>
            {(acessos ?? []).map((a) => (
              <form key={a.id} action={removerAcesso} className="actions">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="proprietario_id" value={p.id} />
                <span className="small" style={{ flex: 1 }}>{a.nome ? `${a.nome} · ` : ""}{a.email}</span>
                <button className="btn ghost sm">Remover</button>
              </form>
            ))}
            <form action={adicionarAcesso} className="inline-form">
              <input type="hidden" name="proprietario_id" value={p.id} />
              <div className="field"><label className="label" htmlFor="acesso_email">E-mail</label><input id="acesso_email" name="email" type="email" required /></div>
              <div className="field"><label className="label" htmlFor="acesso_nome">Nome</label><input id="acesso_nome" name="nome" /></div>
              <button className="btn sm" style={{ height: 38 }}>Dar acesso</button>
            </form>
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
