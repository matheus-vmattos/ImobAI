import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { exigirAdmin } from "@/lib/auth";
import { BRL, nomeMes } from "@/lib/format";
import { fecharRepasse } from "./actions";
import { calcularPrevia, competenciaOu } from "./dados";

type Fechado = { id: string; proprietario_id: string; aluguel: number; taxa_adm: number; seguro: number; despesas: number; liquido: number };

const outroMes = (mes: string, d: number) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
};

export default async function Repasses({ searchParams }: { searchParams: Promise<{ mes?: string; ok?: string; erro?: string }> }) {
  const { mes: m, ok, erro } = await searchParams;
  const mes = competenciaOu(m);
  const { supabase } = await exigirAdmin();
  const [previa, { data: fech }, { data: props }] = await Promise.all([
    calcularPrevia(supabase, mes),
    supabase.from("repasses").select("id, proprietario_id, aluguel, taxa_adm, seguro, despesas, liquido").eq("competencia", `${mes}-01`),
    supabase.from("proprietarios").select("id, nome").order("nome"),
  ]);
  const fechados = new Map(((fech ?? []) as Fechado[]).map((f) => [f.proprietario_id, f]));
  const abertos = previa.filter((r) => !fechados.has(r.proprietarioId));
  const nome = new Map((props ?? []).map((p) => [p.id as string, p.nome as string]));
  const linhas = [
    ...abertos.map((r) => ({ pid: r.proprietarioId, aberto: r, fechado: null as Fechado | null })),
    ...[...fechados.values()].map((f) => ({ pid: f.proprietario_id, aberto: null, fechado: f })),
  ].sort((a, b) => (nome.get(a.pid) ?? "").localeCompare(nome.get(b.pid) ?? ""));
  const tot = (k: "aluguel" | "liquido") => linhas.reduce((a, l) => a + Number(l.fechado ? l.fechado[k] : l.aberto![k]), 0);

  return (
    <>
      <section className="hero">
        <div className="label">Financeiro</div>
        <h1>Repasses · {nomeMes(mes)}</h1>
        <div className="actions">
          <Link className="btn sm" href={`/admin/repasses?mes=${outroMes(mes, -1)}`}>‹ {nomeMes(outroMes(mes, -1))}</Link>
          <form className="inline-form"><input type="month" name="mes" defaultValue={mes} aria-label="Mês" /><button className="btn sm">Ir</button></form>
          <Link className="btn sm" href={`/admin/repasses?mes=${outroMes(mes, 1)}`}>{nomeMes(outroMes(mes, 1))} ›</Link>
        </div>
        <div className="kpis">
          <div className="kpi"><span className="label">Proprietários</span><span className="v">{linhas.length}</span><small>{fechados.size} fechados · {abertos.length} em aberto</small></div>
          <div className="kpi"><span className="label">Aluguel</span><span className="v">{BRL(tot("aluguel"))}</span><small>parte dos proprietários</small></div>
          <div className="kpi"><span className="label">Líquido a repassar</span><span className="v">{BRL(tot("liquido"))}</span><small>depois de taxa, seguro e despesas</small></div>
        </div>
      </section>
      <Aviso ok={ok} erro={erro} />

      <form action={fecharRepasse}>
        <input type="hidden" name="mes" value={mes} />
        <section className="sec">
          <div className="sec-h"><h2>Por proprietário</h2><span className="rule" /></div>
          {linhas.length ? (
            <div className="box tbl-wrap"><table>
              <thead><tr><th /><th>Proprietário</th><th className="r">Aluguel</th><th className="r">Taxa adm.</th><th className="r">Seguro</th><th className="r">Despesas</th><th className="r">Líquido</th><th>Situação</th></tr></thead>
              <tbody>{linhas.map(({ pid, aberto, fechado }) => {
                const v = fechado ? { ...fechado, taxa: fechado.taxa_adm } : aberto!;
                return (
                  <tr key={pid}>
                    <td>{aberto && <input type="checkbox" name="proprietario_id" value={pid} defaultChecked aria-label={`Fechar ${nome.get(pid)}`} />}</td>
                    <td>{fechado ? <Link className="rowlink" href={`/admin/repasses/${fechado.id}`}>{nome.get(pid)}</Link> : (
                      <details><summary>{nome.get(pid)}</summary>
                        <div className="small muted" style={{ display: "grid", gap: 2, marginTop: 6 }}>
                          {aberto!.linhas.map((l, i) => <span key={i}>{l.imovel} · {l.descricao}: {l.valor < 0 ? "− " : ""}{BRL(Math.abs(l.valor))}</span>)}
                        </div></details>
                    )}</td>
                    <td className="r num">{BRL(v.aluguel)}</td>
                    <td className="r num muted">{BRL(v.taxa)}</td>
                    <td className="r num muted">{BRL(v.seguro)}</td>
                    <td className="r num muted">{BRL(v.despesas)}</td>
                    <td className="r num" style={{ color: Number(v.liquido) < 0 ? "var(--bad)" : undefined }}>{BRL(v.liquido)}</td>
                    <td>{fechado ? <span className="pill locado">Fechado</span> : <span className="pill aguardando">Prévia</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          ) : <div className="empty">Nada a repassar neste mês.</div>}
        </section>
        {abertos.length > 0 && (
          <div className="actions">
            <span className="small muted" style={{ flex: "1 1 260px" }}>Fechar congela o relatório, marca as despesas como descontadas e envia o relatório por e-mail a cada proprietário.</span>
            <button className="btn primary">Fechar repasse dos marcados</button>
          </div>
        )}
      </form>
    </>
  );
}
