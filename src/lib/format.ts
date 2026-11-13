const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const BRL = (n: number | null | undefined) => (n == null ? "—" : brl.format(Number(n)));
export const BRL0 = (n: number | null | undefined) => (n == null ? "—" : brl0.format(Number(n)));

/** "2026-12-15" → "15/12/2026" */
export const data = (iso: string | null | undefined) => {
  if (!iso) return "—";
  // data com hora (gravada em UTC) é mostrada no dia de São Paulo
  const [y, m, d] = diaSP(iso).split("-");
  return `${d}/${m}/${y}`;
};

/** Dias de hoje até a data (negativo se já passou) */
export const diasAte = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const [hy, hm, hd] = hojeSP().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 864e5);
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
export const mesOu = (mes?: string) => (mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : mesSP());

/** Hoje em São Paulo ("2026-11-12"). O servidor roda em UTC: depois das 21h, a data UTC já é a de amanhã. */
export const hojeSP = (agora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
/** Dia de São Paulo de uma data: "2026-11-12T01:30:00Z" → "2026-11-11"; data sem hora fica como está. */
export const diaSP = (iso: string) => (iso.length > 10 ? hojeSP(new Date(iso)) : iso);
/** Mês atual em São Paulo ("2026-11"). */
export const mesSP = (agora = new Date()) => hojeSP(agora).slice(0, 7);

/** "vence em 17 dias", "vence hoje", "venceu há 13 dias" */
export const prazoTxt = (fim: string) => { const d = diasAte(fim); return d < 0 ? `venceu há ${-d} ${d === -1 ? "dia" : "dias"}` : d === 0 ? "vence hoje" : `vence em ${d} ${d === 1 ? "dia" : "dias"}`; };
/** "vago há 40 dias"; no dia da mudança (ou recém-cadastrado), só "vago" */
export const haTxt = (rotulo: string, dias: number) => dias >= 1 ? `${rotulo} há ${dias} ${dias === 1 ? "dia" : "dias"}` : rotulo;
