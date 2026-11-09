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

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "2026-11" → "novembro/2026" */
export const nomeMes = (competencia: string) => {
  const [y, m] = competencia.split("-").map(Number);
  return `${MESES[m - 1]}/${y}`;
};

/** "2026-11", +1 → "2026-12" */
export const mesRelativo = (mes: string, d: number) => {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7);
};

/** "2026-11" do mês atual, ou o informado se for válido. */
export const mesOu = (mes?: string) => (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : new Date().toISOString().slice(0, 7));
