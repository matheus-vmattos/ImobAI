import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { SeletorMes } from "@/components/SeletorMes";
import { exigirAdmin } from "@/lib/auth";
import { BRL, data, mesOu, nomeMes, hojeSP } from "@/lib/format";
import { desfazerRecebimento, registrarRecebimento } from "./actions";
import { carregarAlugueis } from "./dados";

export default async function Alugueis({ searchParams }: { searchParams: Promise<{ mes?: string; ok?: string; erro?: string; ver?: string }> }) {
  const { mes: m, ok, erro, ver } = await searchParams;
  const mes = mesOu(m);
  const { supabase } = await exigirAdmin();
  const linhas = await carregarAlugueis(supabase, mes);
  const hoje = hojeSP();
  const situ = (l: (typeof linhas)[number]) =>
    l.recebido_em ? (Number(l.valor_recebido) < Number(l.valor) ? "parcial" : "recebido") : l.vencimento < hoje ? "atrasado" : "a-receber";
  const filtro = ver ?? "todos";
  const vis = linhas.filter((l) => filtro === "todos" || (filtro === "pendentes" ? !l.recebido_em : situ(l) === filtro));
  const recebido = linhas.reduce((a, l) => a + Number(l.valor_recebido ?? 0), 0);
  const previsto = linhas.reduce((a, l) => a + Number(l.valor), 0);
  const atrasados = linhas.filter((l) => situ(l) === "atrasado");
  const onde = (l: (typeof linhas)[number]) => { const i = l.contratos.imoveis; return [i.condominios?.nome ?? i.endereco, i.identificacao].filter(Boolean).join(" · "); };
  const PILL: Record<string, [string, string]> = { recebido: ["ok", "Recebido"], parcial: ["warn", "Parcial"], atrasado: ["bad", "Atrasado"], "a-receber": ["aguardando", "A receber"] };
  const link = (v: string) => `/admin/alugueis?mes=${mes}&ver=${v}`;

  return (
    <>
      <section className="hero">
        <div className="label">Financeiro</div>
        <h1>Aluguéis · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} base="/admin/alugueis" />
        <div className="kpis">
          <div className="kpi"><span className="label">Recebido</span><span className="v num">{BRL(recebido)}</span><small>de {BRL(previsto)} previstos</small></div>
          <div className="kpi"><span className="label">Contratos</span><span className="v num">{linhas.filter((l) => l.recebido_em).length} / {linhas.length}</span><small>pagos no mês</small></div>
          <div className="kpi"><span className="label">Atrasados</span><span className={`v num ${atrasados.length ? "attn" : ""}`}>{atrasados.length}</span><small>{BRL(atrasados.reduce((a, l) => a + Number(l.valor), 0))}</small></div>
          <div className="kpi"><span className="label">A receber</span><span className="v num">{BRL(previsto - linhas.filter((l) => l.recebido_em).reduce((a, l) => a + Number(l.valor), 0))}</span><small>só o recebido entra no repasse</small></div>
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      <section className="sec">
        <div className="toolbar">
          <div className="filters">
            {[["todos", "Todos", linhas.length], ["pendentes", "Pendentes", linhas.filter((l) => !l.recebido_em).length], ["atrasado", "Atrasados", atrasados.length], ["recebido", "Recebidos", linhas.filter((l) => situ(l) === "recebido").length]].map(([k, t, n]) => (
              <Link key={k} href={link(String(k))} aria-pressed={filtro === k}>{t} <span className="n">{n}</span></Link>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <form id="lote" action={registrarRecebimento} className="actions">
            <input type="hidden" name="mes" value={mes} />
            <input className="inp" type="date" name="recebido_em" defaultValue={hoje} aria-label="Data do recebimento" style={{ width: 160 }} />
            <button className="btn primary sm">Marcar selecionados como recebidos</button>
          </form>
        </div>
        {vis.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th style={{ width: 36 }} /><th>Imóvel</th><th>Inquilino</th><th>Vencimento</th><th className="r">Aluguel</th><th>Situação</th><th>Recebido</th><th /></tr></thead>
            <tbody>{vis.map((l) => {
              const s = situ(l); const [cls, rot] = PILL[s];
              return (
                <tr key={l.id}>
                  <td>{!l.recebido_em && <input type="checkbox" name="id" value={l.id} form="lote" aria-label={`Selecionar ${onde(l)}`} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />}</td>
                  <td><Link className="rowlink" href={`/admin/imoveis/${l.contratos.imovel_id}`}>{onde(l)}</Link></td>
                  <td className="muted">{l.contratos.inquilino}</td>
                  <td className="num">{data(l.vencimento)}</td>
                  <td className="r num">{BRL(l.valor)}</td>
                  <td><span className={`pill ${cls}`}>{rot}</span></td>
                  <td className="num muted">{l.recebido_em ? `${BRL(l.valor_recebido)} · ${data(l.recebido_em)}` : "—"}</td>
                  <td className="r">
                    {l.recebido_em ? (
                      <form action={desfazerRecebimento}><input type="hidden" name="mes" value={mes} /><input type="hidden" name="id" value={l.id} /><button className="btn ghost sm">Desfazer</button></form>
                    ) : (
                      <details><summary className="btn ghost sm">Outro valor</summary>
                        <form action={registrarRecebimento} className="inline-form" style={{ marginTop: 8 }}>
                          <input type="hidden" name="mes" value={mes} /><input type="hidden" name="id" value={l.id} />
                          <input className="inp" name="valor_recebido" inputMode="decimal" placeholder="Valor" style={{ width: 110 }} required />
                          <input className="inp" type="date" name="recebido_em" defaultValue={hoje} style={{ width: 150 }} />
                          <button className="btn sm">Salvar</button>
                        </form></details>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum aluguel {filtro === "todos" ? "neste mês" : "neste filtro"}.</div>}
      </section>
    </>
  );
}
