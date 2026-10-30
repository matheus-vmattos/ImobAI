import { getSessao } from "@/lib/auth";
import { BRL0, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { carregarPortal } from "./dados";
import { ListaImoveis } from "./ListaImoveis";

export default async function Portal() {
  const { supabase, user } = await getSessao();
  const [{ imoveis, condominios }, { data: p }] = await Promise.all([
    carregarPortal(supabase, user.id),
    supabase.from("proprietarios").select("nome").eq("user_id", user.id).maybeSingle(),
  ]);
  const primeiroNome = (p?.nome ?? "").split(" ")[0];
  const cnt = (s: string) => imoveis.filter((i) => i.status === s).length;
  const locados = imoveis.filter((i) => i.status === "locado");
  const bruto = locados.reduce((a, i) => a + (i.aluguel ?? 0) * i.percentual / 100, 0);
  const vencendo = locados.filter((i) => i.fim && diasAte(i.fim) <= RENOVACAO_DIAS).length;

  if (!imoveis.length) {
    return (
      <section className="hero">
        <div className="label">Portal do proprietário</div>
        <h1>Olá{primeiroNome ? `, ${primeiroNome}` : ""}.</h1>
        <div className="empty">Ainda não há imóveis vinculados ao seu cadastro. Fale com a imobiliária.</div>
      </section>
    );
  }

  return (
    <>
      <section className="hero">
        <div className="label">Portal do proprietário</div>
        <h1>
          Olá{primeiroNome ? `, ${primeiroNome}` : ""}.{" "}
          {vencendo ? <><b>{vencendo} contrato{vencendo > 1 ? "s" : ""}</b> vence{vencendo > 1 ? "m" : ""} em até {RENOVACAO_DIAS} dias.</> : "Seus imóveis estão em dia."}
        </h1>
        <div className="kpis">
          <div className="kpi"><span className="label">Imóveis</span><span className="v">{imoveis.length}</span>
            <small>{cnt("locado")} locados · {cnt("vazio")} vazios · {cnt("devolucao")} em devolução</small></div>
          <div className="kpi"><span className="label">Aluguel bruto</span><span className="v">{BRL0(bruto)}</span><small>sua parte, por mês</small></div>
          <div className="kpi"><span className="label">Vencendo</span><span className={`v ${vencendo ? "attn" : ""}`}>{vencendo}</span><small>em até {RENOVACAO_DIAS} dias</small></div>
          <div className="kpi"><span className="label">Indisponíveis</span><span className="v">{cnt("indisponivel")}</span><small>reforma ou regularização</small></div>
        </div>
      </section>
      <section className="sec">
        <div className="sec-h"><h2>Meus imóveis</h2><span className="count">{imoveis.length}</span><span className="rule" /></div>
        <ListaImoveis imoveis={imoveis} condominios={condominios} />
      </section>
    </>
  );
}
