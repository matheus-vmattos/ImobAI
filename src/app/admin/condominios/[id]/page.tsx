import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import type { Condominio, Imovel } from "@/lib/types";
import { excluirCondominio, excluirTerceiro, salvarCondominio, salvarTerceiro } from "../../actions";

type Unidade = Pick<Imovel, "id" | "identificacao" | "status" | "cotas"> & { imovel_proprietarios: { proprietarios: { nome: string } }[] };

export default async function EditarCondominio({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: c }, { data: un }, { data: ter }] = await Promise.all([
    supabase.from("condominios").select("*").eq("id", id).single<Condominio>(),
    supabase.from("imoveis").select("id, identificacao, status, cotas, imovel_proprietarios(proprietarios(nome))").eq("condominio_id", id).order("identificacao"),
    supabase.from("terceiros").select("id, nome, contato, cotas").eq("condominio_id", id).order("nome"),
  ]);
  if (!c) notFound();
  const unidades = (un ?? []) as unknown as Unidade[];
  const cotasCarteira = unidades.reduce((a, u) => a + Number(u.cotas), 0);
  const fora = c.cotas_padrao != null ? Number(c.cotas_padrao) - cotasCarteira : null;

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/condominios">Condomínios</Link><span>/</span><span>{c.nome}</span></div>
        <h1>{c.nome}</h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <div className="cols">
        <form action={salvarCondominio} className="panel">
          <input type="hidden" name="id" value={c.id} />
          <div className="field"><label className="label" htmlFor="nome">Nome</label><input id="nome" name="nome" required defaultValue={c.nome} /></div>
          <div className="row2">
            <div className="field"><label className="label" htmlFor="endereco">Endereço</label><input id="endereco" name="endereco" defaultValue={c.endereco ?? ""} /></div>
            <div className="field"><label className="label" htmlFor="cidade">Cidade</label><input id="cidade" name="cidade" defaultValue={c.cidade ?? ""} /></div>
          </div>
          <div className="row2">
            <div className="field"><label className="label" htmlFor="cotas_padrao">Rateio padrão (cotas)</label>
              <input id="cotas_padrao" name="cotas_padrao" inputMode="decimal" defaultValue={c.cotas_padrao ?? ""} />
              <small>Total de cotas do condomínio, mesmo as que não são da carteira.</small></div>
            <div className="field"><label className="label" htmlFor="regra_padrao">Descrição da regra</label>
              <input id="regra_padrao" name="regra_padrao" placeholder="10 aptos + 2 lojas de terceiros" defaultValue={c.regra_padrao ?? ""} /></div>
          </div>
      <div className="row3">
        <div className="field"><label className="label" htmlFor="iptu_inscricao">Inscrição do IPTU</label>
          <input id="iptu_inscricao" name="iptu_inscricao" defaultValue={c?.iptu_inscricao ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="energia_cliente">Nº cliente energia</label>
          <input id="energia_cliente" name="energia_cliente" defaultValue={c?.energia_cliente ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="agua_cliente">Nº cliente água</label>
          <input id="agua_cliente" name="agua_cliente" defaultValue={c?.agua_cliente ?? ""} /></div>
      </div>
      <small className="muted" style={{ marginTop: -8 }}>Valem para todas as unidades. O proprietário vê no portal, em cada imóvel.</small>
          <div className="field"><label className="label" htmlFor="observacoes">Observações</label><textarea id="observacoes" name="observacoes" defaultValue={c.observacoes ?? ""} /></div>
          <div className="actions"><button className="btn primary">Salvar</button></div>
        </form>

        <div style={{ display: "grid", gap: 16 }}>
          <div className="panel">
            <div className="sec-h"><h2>Unidades na carteira</h2><span className="count">{unidades.length}</span><span className="rule" /></div>
            {fora != null && (
              <p className="small muted" style={{ margin: 0 }}>
                Carteira: {cotasCarteira} cotas · fora da carteira: {fora} · total: {Number(c.cotas_padrao)}
                {fora < 0 && <span style={{ color: "var(--bad)" }}> (as unidades somam mais cotas que o total)</span>}
              </p>
            )}
            {unidades.length ? (
              <div className="tbl-wrap"><table style={{ minWidth: 460 }}>
                <thead><tr><th>Unidade</th><th>Proprietário</th><th>Status</th><th className="r">Cotas</th></tr></thead>
                <tbody>{unidades.map((u) => (
                  <tr key={u.id}>
                    <td><Link className="rowlink" href={`/admin/imoveis/${u.id}`}>{u.identificacao}</Link></td>
                    <td className="muted">{u.imovel_proprietarios.map((v) => v.proprietarios.nome).join(", ") || "—"}</td>
                    <td><StatusPill status={u.status} /></td>
                    <td className="r num">{Number(u.cotas)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <p className="muted small" style={{ margin: 0 }}>Nenhuma unidade cadastrada.</p>}
            <Link href={`/admin/imoveis/novo?condominio=${c.id}`} className="btn sm" style={{ justifySelf: "start" }}>Nova unidade neste condomínio</Link>
          </div>
          <div className="panel">
            <div className="sec-h"><h2>Unidades de terceiros</h2><span className="count">{(ter ?? []).length}</span></div>
            <p className="small muted" style={{ margin: 0 }}>Lojas e unidades que não são da carteira. A parte delas nas contas rateadas fica registrada como “a receber”.</p>
            {(ter ?? []).map((t) => (
              <form key={t.id} action={excluirTerceiro} className="actions">
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="condominio_id" value={c.id} />
                <span style={{ flex: 1 }}>{t.nome}{t.contato && <span className="muted small"> · {t.contato}</span>}</span>
                <span className="num muted small">{Number(t.cotas)} cota(s)</span><button className="btn ghost sm">Remover</button>
              </form>
            ))}
            <form action={salvarTerceiro} className="inline-form">
              <input type="hidden" name="condominio_id" value={c.id} />
              <div className="field"><label className="label" htmlFor="t_nome">Nome</label><input id="t_nome" name="nome" required placeholder="Loja 1 · Farmácia" /></div>
              <div className="field" style={{ flex: "0 1 110px" }}><label className="label" htmlFor="t_cotas">Cotas</label><input id="t_cotas" name="cotas" inputMode="decimal" defaultValue={1} /></div>
              <div className="field"><label className="label" htmlFor="t_contato">Contato</label><input id="t_contato" name="contato" /></div>
              <button className="btn sm" style={{ height: 38 }}>Adicionar</button>
            </form>
          </div>
          <form action={excluirCondominio}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn danger sm">Excluir condomínio</button>
          </form>
        </div>
      </div>
    </>
  );
}
