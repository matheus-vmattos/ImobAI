import Link from "next/link";
import { Icon } from "@/components/Icon";
import { BRL0 } from "@/lib/format";
import { COR_IMOVEL, resumoPredio, type Predio } from "./resumo";

/** Prédios do proprietário: unidades, quantas alugadas e o aluguel do mês (a parte dele). */
export function Predios({ lista }: { lista: Predio[] }) {
  return (
    <div className="box">{lista.map((p) => (
      <Link key={p.id ?? "avulsos"} href={`/portal/condominios/${p.id ?? "avulsos"}`} className="mv" style={{ textDecoration: "none", alignItems: "center" }}>
        <span className="t"><b>{p.nome}</b><small>{resumoPredio(p)}{p.vencendo ? ` · ${p.vencendo} vencendo` : ""}</small>
          <span className="mixbar" style={{ marginTop: 7 }}>{(["locado", "devolucao", "vazio", "indisponivel"] as const).map((s) => p.porStatus[s] ? <i key={s} style={{ flex: p.porStatus[s], background: COR_IMOVEL[s] }} /> : null)}</span></span>
        <span className="v" style={{ textAlign: "right" }}>{BRL0(p.aluguelMes)}<small className="muted" style={{ display: "block", fontWeight: 400, fontSize: 11.5 }}>por mês</small></span>
        <Icon name="chev" className="dim" />
      </Link>
    ))}</div>
  );
}
