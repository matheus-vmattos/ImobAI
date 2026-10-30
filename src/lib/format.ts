const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const BRL = (n: number | null | undefined) => (n == null ? "—" : brl.format(Number(n)));
export const BRL0 = (n: number | null | undefined) => (n == null ? "—" : brl0.format(Number(n)));

/** "2026-12-15" → "15/12/2026" */
export const data = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Dias de hoje até a data (negativo se já passou) */
export const diasAte = (iso: string) => {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - hoje.getTime()) / 864e5);
};

export const RENOVACAO_DIAS = 90;

/** Soma meses e dias a uma data ISO ("2026-12-15", 12, -1 → "2027-12-14"). Sem fuso: trabalha em UTC. */
export const somarData = (iso: string, meses: number, dias = 0) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + meses, d + dias)).toISOString().slice(0, 10);
};
