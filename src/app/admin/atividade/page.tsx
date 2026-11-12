import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { BRL } from "@/lib/format";

type Ev = { id: number; quando: string; user_id: string | null; acao: string; ref_tipo: string | null; ref_id: string | null; valor: number | null; detalhe: string | null; proprietarios: { nome: string } | null };
const ACAO: Record<string, string> = {
  pagamento_confirmado: "Pagamento confirmado", pagamento_recusado: "Comprovante recusado", abono: "Diferença perdoada",
  cobranca_emitida: "Cobrança emitida", repasse_fechado: "Repasse fechado", repasse_reaberto: "Repasse reaberto", ajuste: "Ajuste lançado",
};
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const link = (e: Ev) => e.ref_tipo === "cobranca" ? `/admin/cobrancas/${e.ref_id}` : e.ref_tipo === "pagamento" ? `/admin/cobrancas/pagamento/${e.ref_id}` : e.ref_tipo === "repasse" && e.acao === "repasse_fechado" ? `/admin/repasses/${e.ref_id}` : null;

/** Registro de tudo que mexe com dinheiro: quem fez, quando e quanto. Não pode ser alterado nem apagado. */
export default async function Atividade() {
  const { supabase } = await exigirAdmin();
  const [{ data }, { data: perfis }] = await Promise.all([
    supabase.from("eventos").select("*, proprietarios(nome)").order("quando", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, nome").eq("papel", "admin"),
  ]);
  const nome = new Map((perfis ?? []).map((p) => [p.id as string, (p.nome as string) || "Imobiliária"]));
  const lista = (data ?? []) as unknown as Ev[];
  return (
    <>
      <section className="hero"><div className="label">Imobiliária</div><h1>Atividade</h1>
        <p className="muted">Registro das operações com dinheiro: quem fez, quando e quanto. Não pode ser alterado nem apagado.</p></section>
      {lista.length ? (
        <div className="box tbl-wrap"><table>
          <thead><tr><th>Quando</th><th>O quê</th><th>Proprietário</th><th className="r">Valor</th><th>Detalhe</th><th>Quem</th></tr></thead>
          <tbody>{lista.map((e) => (
            <tr key={e.id}>
              <td className="num muted">{quando(e.quando)}</td>
              <td>{link(e) ? <Link className="rowlink" href={link(e)!}>{ACAO[e.acao] ?? e.acao}</Link> : ACAO[e.acao] ?? e.acao}</td>
              <td>{e.proprietarios?.nome ?? "—"}</td>
              <td className="r num">{e.valor != null ? BRL(e.valor) : "—"}</td>
              <td className="muted" style={{ whiteSpace: "normal", minWidth: 200 }}>{e.detalhe ?? ""}</td>
              <td className="muted">{e.user_id ? nome.get(e.user_id) ?? "Imobiliária" : "Automático"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty">Nenhuma operação registrada ainda.</div>}
    </>
  );
}
