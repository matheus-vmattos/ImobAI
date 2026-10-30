import { exigirAdmin } from "@/lib/auth";

type N = { id: string; evento: string; para: string; assunto: string; html: string; status: string; erro: string | null; criado_em: string };
const STATUS: Record<string, [string, string]> = {
  enviado: ["Enviado", "locado"], erro: ["Erro", "reembolso"], sem_provedor: ["Não enviado", "aguardando"], pendente: ["Pendente", "aguardando"],
};
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function Notificacoes() {
  const { supabase } = await exigirAdmin();
  const { data } = await supabase.from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(100);
  const lista = (data ?? []) as N[];
  const semProvedor = !(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  return (
    <>
      <section className="hero">
        <div className="label">Comunicação</div>
        <h1>E-mails</h1>
        <p className="muted" style={{ margin: 0 }}>Últimos 100 avisos enviados aos proprietários e à imobiliária.</p>
      </section>
      {semProvedor && <div className="alert" style={{ color: "var(--warn)" }}>Envio desligado: configure RESEND_API_KEY e EMAIL_FROM. Até lá, os avisos ficam só registrados aqui.</div>}
      <section className="sec">
        {lista.length ? (
          <div className="box tbl-wrap"><table>
            <thead><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Situação</th></tr></thead>
            <tbody>{lista.map((n) => {
              const [rot, cls] = STATUS[n.status] ?? [n.status, "aguardando"];
              return (
                <tr key={n.id}>
                  <td className="num muted">{quando(n.criado_em)}</td>
                  <td>{n.para}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 260 }}>
                    <details><summary>{n.assunto}</summary>
                      <iframe title={n.assunto} srcDoc={n.html} sandbox="" style={{ width: "100%", height: 320, border: "1px solid var(--line)", background: "#fff", marginTop: 8 }} />
                    </details>
                  </td>
                  <td><span className={`pill ${cls}`} title={n.erro ?? undefined}>{rot}</span></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <div className="empty">Nenhum e-mail ainda.</div>}
      </section>
    </>
  );
}
