import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data } from "@/lib/format";
import { TIPO_LABEL, type TipoDespesa } from "@/lib/types";
import { alternarRecorrente, excluirRecorrente, lancarAgora, salvarRecorrente } from "./actions";

type Rec = { id: string; descricao: string; tipo: TipoDespesa; valor: number | null; dia: number; ativo: boolean; ultimo_mes: string | null; cobra_taxa_adm: boolean;
  condominios: { nome: string } | null; imoveis: { identificacao: string; endereco: string | null } | null };

export default async function Recorrentes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const { supabase } = await exigirAdmin();
  const [{ data: rs }, { data: cs }, { data: is }, { data: rasc }] = await Promise.all([
    supabase.from("recorrentes").select("*, condominios(nome), imoveis(identificacao, endereco)").order("dia"),
    supabase.from("condominios").select("id, nome").order("nome"),
    supabase.from("imoveis").select("id, identificacao, endereco, condominios(nome)").order("identificacao"),
    supabase.from("despesas").select("id, descricao, competencia").eq("status", "rascunho").eq("valor_total", 0).not("recorrente_id", "is", null),
  ]);
  const lista = (rs ?? []) as unknown as Rec[];
  const imoveis = (is ?? []) as unknown as { id: string; identificacao: string; endereco: string | null; condominios: { nome: string } | null }[];
  const fixas = lista.filter((r) => r.ativo && r.valor).reduce((a, r) => a + Number(r.valor), 0);

  return (
    <>
      <section className="hero">
        <div className="crumbs"><Link href="/admin/despesas">Despesas</Link><span>/</span><span>Contas mensais</span></div>
        <h1>Contas mensais</h1>
        <p className="muted">Salário do zelador, lixo, água e luz da área comum: cadastre uma vez e a conta entra sozinha todo mês. Sem valor fixo, ela entra como rascunho esperando o valor e o PDF.</p>
        <div className="kpis">
          <div className="kpi"><span className="label">Ativas</span><span className="v num">{lista.filter((r) => r.ativo).length}</span><small>{lista.length} cadastradas</small></div>
          <div className="kpi"><span className="label">Valor fixo por mês</span><span className="v num">{BRL(fixas)}</span><small>sem as de valor variável</small></div>
          <div className="kpi"><span className="label">Esperando valor</span><span className={`v num ${rasc?.length ? "attn" : ""}`}>{rasc?.length ?? 0}</span><small>rascunhos deste mês</small></div>
          <div className="kpi"><span className="label">Lançamento</span><span className="v" style={{ fontSize: 16 }}>automático</span><small>todo dia, a partir do dia da conta</small></div>
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      {!!rasc?.length && (
        <section className="sec">
          <div className="sec-h"><h2>Esperando valor</h2><span className="count">{rasc.length}</span></div>
          <div className="box tbl-wrap"><table>
            <tbody>{rasc.map((d) => (
              <tr key={d.id}><td>{d.descricao}</td><td className="muted">{d.competencia}</td>
                <td className="r"><Link className="btn primary sm" href={`/admin/despesas/${d.id}`}>Informar valor e enviar</Link></td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <section className="sec">
        <div className="sec-h"><h2>Cadastradas</h2></div>
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Conta</th><th>Onde</th><th>Tipo</th><th className="r">Valor</th><th>Dia</th><th>Último mês</th><th>Situação</th><th /></tr></thead>
            <tbody>{lista.map((r) => (
              <tr key={r.id}>
                <td>{r.descricao}{r.cobra_taxa_adm && <span className="muted small"> + taxa adm.</span>}</td>
                <td className="muted">{r.condominios?.nome ?? [r.imoveis?.endereco, r.imoveis?.identificacao].filter(Boolean).join(" · ")}</td>
                <td className="muted">{TIPO_LABEL[r.tipo]}</td>
                <td className="r num">{r.valor ? BRL(r.valor) : <span className="pill warn">variável</span>}</td>
                <td className="num">dia {r.dia}</td>
                <td className="muted num">{r.ultimo_mes ? data(r.ultimo_mes).slice(3) : "—"}</td>
                <td><span className={`pill ${r.ativo ? "ok" : "aguardando"}`}>{r.ativo ? "Ativa" : "Pausada"}</span></td>
                <td className="r"><div className="actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                  {r.ativo && <form action={lancarAgora}><input type="hidden" name="id" value={r.id} /><button className="btn sm">Lançar este mês</button></form>}
                  <form action={alternarRecorrente}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="ativo" value={r.ativo ? "0" : "1"} /><button className="btn ghost sm">{r.ativo ? "Pausar" : "Reativar"}</button></form>
                  <form action={excluirRecorrente}><input type="hidden" name="id" value={r.id} /><button className="btn ghost sm" style={{ color: "var(--bad)" }}>Excluir</button></form>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="empty">Nenhuma conta mensal ainda.</div>}
      </section>

      <form action={salvarRecorrente} className="panel" style={{ maxWidth: 820 }}>
        <div className="sec-h"><h2>Nova conta mensal</h2></div>
        <div className="row2">
          <div className="field"><label className="label" htmlFor="descricao">Descrição</label><input id="descricao" name="descricao" required placeholder="Salário zelador · Cabral" /></div>
          <div className="field"><label className="label" htmlFor="onde">Onde</label>
            <select id="onde" name="onde" required defaultValue="">
              <option value="" disabled>Escolha…</option>
              <optgroup label="Condomínio (rateio pelas cotas)">{(cs ?? []).map((c) => <option key={c.id} value={`c:${c.id}`}>{c.nome}</option>)}</optgroup>
              <optgroup label="Imóvel (valor inteiro)">{imoveis.map((i) => <option key={i.id} value={`i:${i.id}`}>{[i.condominios?.nome ?? i.endereco, i.identificacao].filter(Boolean).join(" · ")}</option>)}</optgroup>
            </select></div>
        </div>
        <div className="row3">
          <div className="field"><label className="label" htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" defaultValue="fixa">{(Object.keys(TIPO_LABEL) as TipoDespesa[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="valor">Valor (R$)</label><input id="valor" name="valor" inputMode="decimal" placeholder="vazio = muda todo mês" /></div>
          <div className="field"><label className="label" htmlFor="dia">Dia do mês</label><input id="dia" name="dia" inputMode="numeric" defaultValue={5} /><small>De 1 a 28.</small></div>
        </div>
        <label className="tog"><input type="checkbox" name="cobra_taxa" /><span>Cobrar taxa de administração</span></label>
        <div className="actions"><button className="btn primary">Cadastrar</button></div>
      </form>
    </>
  );
}
