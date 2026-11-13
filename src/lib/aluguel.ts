/** Situação do aluguel do mês, do ponto de vista do proprietário. Sem dependências. */

export type AluguelMes = {
  situacao: "pago" | "parcial" | "a-receber" | "atrasado";
  vencimento: string; valor: number; recebido: number | null; recebidoEm: string | null; diasAtraso: number;
};

const dias = (de: string, ate: string) => Math.round((Date.parse(ate + "T12:00:00Z") - Date.parse(de + "T12:00:00Z")) / 864e5);

/** Vencimento do mês para um contrato ("2026-11", dia 31 → "2026-11-30"). */
export function vencimentoDoMes(mes: string, diaVencimento: number | null) {
  const [y, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(Math.min(diaVencimento ?? 10, ultimo)).padStart(2, "0")}`;
}

export function situacaoAluguel(a: { vencimento: string; valor: number; recebidoEm: string | null; valorRecebido: number | null }, hoje: string): AluguelMes {
  const base = { vencimento: a.vencimento, valor: a.valor, recebido: a.valorRecebido, recebidoEm: a.recebidoEm, diasAtraso: 0 };
  if (a.recebidoEm) return { ...base, situacao: Number(a.valorRecebido) < a.valor ? "parcial" : "pago" };
  if (a.vencimento < hoje) return { ...base, situacao: "atrasado", diasAtraso: dias(a.vencimento, hoje) };
  return { ...base, situacao: "a-receber" };
}

export const ALUGUEL_TXT = (a: AluguelMes) => {
  const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  return a.situacao === "pago" ? `Aluguel pago em ${dm(a.recebidoEm!)}`
    : a.situacao === "parcial" ? `Aluguel pago em parte em ${dm(a.recebidoEm!)}`
    : a.situacao === "atrasado" ? `Aluguel atrasado há ${a.diasAtraso} ${a.diasAtraso === 1 ? "dia" : "dias"}`
    : `Aluguel vence em ${dm(a.vencimento)}`;
};
