import Link from "next/link";
import { mesRelativo, nomeMes } from "@/lib/format";
import { Icon } from "./Icon";

/** ‹ mês anterior · [mês] · próximo › */
export function SeletorMes({ mes, base }: { mes: string; base: string }) {
  const href = (m: string) => `${base}?mes=${m}`;
  return (
    <div className="actions">
      <Link className="btn sm" href={href(mesRelativo(mes, -1))} aria-label="Mês anterior"><Icon name="chev" className="flip" /></Link>
      <form className="inline-form" style={{ alignItems: "center" }}><input className="inp" type="month" name="mes" defaultValue={mes} aria-label="Mês" style={{ width: 170, height: 30 }} /><button className="btn sm">Ir</button></form>
      <Link className="btn sm" href={href(mesRelativo(mes, 1))} aria-label="Próximo mês"><Icon name="chev" /></Link>
      <span className="muted small">{nomeMes(mes)}</span>
    </div>
  );
}
