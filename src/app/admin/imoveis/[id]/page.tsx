import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { StatusPill } from "@/components/StatusPill";
import { exigirAdmin } from "@/lib/auth";
import { BRL0, data, diasAte } from "@/lib/format";
import type { Contrato, Imovel } from "@/lib/types";
import { encerrarContrato, excluirImovel, salvarContrato } from "../../actions";
import { ImovelForm } from "../ImovelForm";

export default async function EditarImovel({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams]);
  const { supabase } = await exigirAdmin();
  const [{ data: imovel }, { data: donos }, { data: contratos }, { data: condominios }, { data: proprietarios }] = await Promise.all([
    supabase.from("imoveis").select("*, condominios(nome)").eq("id", id).single<Imovel & { condominios: { nome: string } | null }>(),
    supabase.from("imovel_proprietarios").select("proprietario_id, percentual").eq("imovel_id", id),
    supabase.from("contratos").select("*").eq("imovel_id", id).order("inicio", { ascending: false }),
    supabase.from("condominios").select("id, nome").order("nome"),
    supabase.from("proprietarios").select("id, nome").order("nome"),
  ]);
  if (!imovel) notFound();
  const lista = (contratos ?? []) as Contrato[];
  const ativo = lista.find((c) => c.ativo);
  const antigos = lista.filter((c) => !c.ativo);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/imoveis">Imóveis</Link><span>/</span>
          {imovel.condominio_id && <><Link href={`/admin/condominios/${imovel.condominio_id}`}>{imovel.condominios?.nome}</Link><span>/</span></>}
          <span>{imovel.identificacao}</span></div>
        <h1>{imovel.identificacao} <StatusPill status={imovel.status} /></h1>
      </section>
      <Aviso ok={ok} erro={erro} />
      <div className="cols">
        <ImovelForm
          imovel={imovel}
          condominios={condominios ?? []}
          proprietarios={proprietarios ?? []}
          donos={(donos ?? []).map((d) => ({ proprietario_id: d.proprietario_id, percentual: String(Number(d.percentual)) }))}
        />

        <div style={{ display: "grid", gap: 16 }}>
          <form action={salvarContrato} className="panel" key={ativo?.id ?? "novo"}>
            <div className="sec-h"><h2>{ativo ? "Contrato ativo" : "Novo contrato"}</h2><span className="rule" /></div>
            {ativo && <p className="small muted" style={{ margin: 0 }}>Termina em {data(ativo.fim)} · faltam {diasAte(ativo.fim)} dias</p>}
            <input type="hidden" name="imovel_id" value={imovel.id} />
            {ativo && <input type="hidden" name="id" value={ativo.id} />}
            <div className="row2">
              <div className="field"><label className="label" htmlFor="inquilino">Inquilino</label><input id="inquilino" name="inquilino" required defaultValue={ativo?.inquilino} /></div>
              <div className="field"><label className="label" htmlFor="inquilino_contato">Contato</label><input id="inquilino_contato" name="inquilino_contato" defaultValue={ativo?.inquilino_contato ?? ""} /></div>
            </div>
            <div className="row3">
              <div className="field"><label className="label" htmlFor="aluguel">Aluguel (R$)</label><input id="aluguel" name="aluguel" required inputMode="decimal" defaultValue={ativo?.aluguel ?? imovel.aluguel_pedido ?? ""} /></div>
              <div className="field"><label className="label" htmlFor="inicio">Início</label><input id="inicio" name="inicio" type="date" required defaultValue={ativo?.inicio} /></div>
              <div className="field"><label className="label" htmlFor="fim">Fim</label><input id="fim" name="fim" type="date" required defaultValue={ativo?.fim} /></div>
            </div>
            <div className="field" style={{ maxWidth: 160 }}><label className="label" htmlFor="dia_vencimento">Dia do vencimento</label><input id="dia_vencimento" name="dia_vencimento" inputMode="numeric" defaultValue={ativo?.dia_vencimento ?? ""} /></div>
            {ativo && (
              <>
                <span className="label" style={{ color: "var(--dev)" }}>Devolução</span>
                <div className="row2">
                  <div className="field"><label className="label" htmlFor="aviso_saida_em">Aviso de saída em</label><input id="aviso_saida_em" name="aviso_saida_em" type="date" defaultValue={ativo.aviso_saida_em ?? ""} /></div>
                  <div className="field"><label className="label" htmlFor="entrega_chaves_prevista">Entrega das chaves</label><input id="entrega_chaves_prevista" name="entrega_chaves_prevista" type="date" defaultValue={ativo.entrega_chaves_prevista ?? ""} /></div>
                </div>
                <small className="muted">Preencher uma dessas datas marca o imóvel como “Em devolução”.</small>
              </>
            )}
            <div className="field"><label className="label" htmlFor="c_obs">Observações</label><textarea id="c_obs" name="observacoes" defaultValue={ativo?.observacoes ?? ""} /></div>
            <div className="actions"><button className="btn primary">{ativo ? "Salvar contrato" : "Registrar contrato"}</button></div>
          </form>

          {ativo && (
            <form action={encerrarContrato} className="actions">
              <input type="hidden" name="imovel_id" value={imovel.id} />
              <input type="hidden" name="id" value={ativo.id} />
              <span className="small muted" style={{ flex: "1 1 200px" }}>Chaves entregues? Encerre o contrato para o imóvel voltar a “Vazio”.</span>
              <button className="btn sm">Encerrar contrato</button>
            </form>
          )}

          {antigos.length > 0 && (
            <div className="panel">
              <div className="sec-h"><h2>Contratos anteriores</h2><span className="rule" /></div>
              <div className="tbl-wrap"><table style={{ minWidth: 420 }}>
                <tbody>{antigos.map((c) => (
                  <tr key={c.id}><td>{c.inquilino}</td><td className="num muted">{data(c.inicio)} – {data(c.fim)}</td><td className="r num">{BRL0(c.aluguel)}</td></tr>
                ))}</tbody>
              </table></div>
            </div>
          )}

          <form action={excluirImovel}>
            <input type="hidden" name="id" value={imovel.id} />
            <button className="btn danger sm">Excluir imóvel</button>
          </form>
        </div>
      </div>
    </>
  );
}
