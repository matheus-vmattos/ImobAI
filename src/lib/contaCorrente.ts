/** Conta corrente do proprietário: quem paga cada conta, decisão automática, cobrança semanal,
 *  alocação de pagamentos, abono e extrato. Sem dependências: usado no servidor e nos testes. */

const centavos = (n: number) => Math.round(n * 100) / 100;

/* ---------- quem paga ---------- */
export type Responsavel = "proprietario" | "inquilino" | "direto";

/** Condomínio ordinário e IPTU de imóvel locado são do inquilino; condomínio que o dono paga direto
 *  fica só registrado; o resto (extra, manutenção, contas da área comum) é do proprietário. */
export function responsavelPor(tipo: string, statusImovel: string, condominioPagoPor: "imobiliaria" | "proprietario", inquilinoReembolsa = false): Responsavel {
  const ehCondominio = tipo === "condominio" || tipo === "condominio_extra";
  if (ehCondominio && condominioPagoPor === "proprietario") return "direto";
  // prédio em que o proprietário paga tudo e o inquilino devolve a parte dele no repasse
  if (inquilinoReembolsa) return "proprietario";
  if ((tipo === "condominio" || tipo === "iptu") && (statusImovel === "locado" || statusImovel === "devolucao")) return "inquilino";
  return "proprietario";
}

/** Obras e extras ficam com o proprietário; o resto, num prédio em que o inquilino reembolsa, é rateado com os inquilinos. */
export const TIPOS_DO_PROPRIETARIO = ["extra", "condominio_extra"];
export const rateadaPadrao = (tipo: string, inquilinoReembolsa: boolean) => inquilinoReembolsa && !TIPOS_DO_PROPRIETARIO.includes(tipo);
/** A parte desta unidade volta pelo inquilino? Só se a despesa é rateada e a unidade está alugada. */
export const voltaPeloInquilino = (rateada: boolean, statusImovel: string) => rateada && (statusImovel === "locado" || statusImovel === "devolucao");

/* ---------- decisão automática ---------- */
export type Decisao = "desconto" | "reembolso" | "proprio";

/** Tipos que são conta fixa (o proprietário não tem o que aprovar): entram direto, sem olhar o limite. */
export const TIPOS_FIXOS = ["fixa", "condominio", "condominio_extra", "iptu", "seguro_incendio"];

/** Conta que não precisa de aprovação já entra decidida pela forma padrão do proprietário:
 *  cobrança semanal ("reembolso") ou desconto no repasse. Devolve null quando precisa de resposta.
 *  `recorrente` vale para conta mensal e para os tipos fixos. */
export function decisaoAutomatica(o: {
  responsavel: Responsavel; requerAprovacao: boolean; valorDoProprietario: number;
  aprovaAte: number; formaPadrao: "cobranca" | "repasse"; recorrente: boolean;
}): Decisao | null {
  if (o.responsavel !== "proprietario") return null;
  if (o.requerAprovacao) return null;
  if (!o.recorrente && o.valorDoProprietario > o.aprovaAte) return null;
  return o.formaPadrao === "repasse" ? "desconto" : "reembolso";
}

/* ---------- cobrança ---------- */
export type LinhaCobranca = {
  tipo: "despesa" | "ajuste"; ref: string; descricao: string; onde: string; proprietario: string;
  valor: number; despesaId?: string; temPdf?: boolean;
};

export function totalCobranca(linhas: LinhaCobranca[]) {
  return centavos(linhas.reduce((a, l) => a + l.valor, 0));
}

/** Semana anterior ao dia de emissão: [segunda, domingo] que termina na véspera. */
export function periodoDaSemana(emissaoISO: string) {
  const d = new Date(emissaoISO.slice(0, 10) + "T12:00:00Z");
  const fim = new Date(d.getTime() - 864e5);
  const ini = new Date(fim.getTime() - 6 * 864e5);
  return { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

/* ---------- pagamentos ---------- */
export type CobrancaAberta = { id: string; vencimento: string; emitidaEm: string; saldo: number };

/** Distribui um valor entre as cobranças em aberto, da mais antiga para a mais nova. */
export function alocar(cobrancas: CobrancaAberta[], disponivel: number) {
  let resta = centavos(disponivel);
  const alocacoes: { cobrancaId: string; valor: number }[] = [];
  for (const c of [...cobrancas].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.emitidaEm.localeCompare(b.emitidaEm))) {
    if (resta <= 0) break;
    const v = centavos(Math.min(resta, c.saldo));
    if (v > 0) { alocacoes.push({ cobrancaId: c.id, valor: v }); resta = centavos(resta - v); }
  }
  return { alocacoes, sobra: resta };
}

/** Depois do pagamento: a diferença pequena (até o limite) é abonada se a imobiliária quiser (padrão). */
export function fechamento(saldoRestante: number, abonoAte: number, abonar: boolean) {
  const r = centavos(saldoRestante);
  if (r <= 0) return { abono: 0, quitada: true };
  if (abonar && r <= abonoAte) return { abono: r, quitada: true };
  return { abono: 0, quitada: false };
}

/* ---------- extrato ---------- */
export type Movimento = { data: string; tipo: "cobranca" | "pagamento" | "abono" | "repasse"; descricao: string; valor: number; ref: string };

/** Débitos (cobranças) negativos, créditos positivos; saldo < 0 = proprietário deve. */
export function extrato(o: {
  cobrancas: { id: string; emitidaEm: string; inicio: string; fim: string; total: number; abonado: number; descontado: number; quitadaEm: string | null; qtd: number }[];
  pagamentos: { id: string; data: string; valor: number; forma: string }[];
}) {
  const m: Movimento[] = [];
  const dm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
  for (const c of o.cobrancas) {
    m.push({ data: c.emitidaEm, tipo: "cobranca", descricao: `Contas da semana ${dm(c.inicio)} a ${dm(c.fim)} · ${c.qtd} ${c.qtd === 1 ? "conta" : "contas"}`, valor: -c.total, ref: c.id });
    if (c.abonado > 0) m.push({ data: c.quitadaEm ?? c.emitidaEm, tipo: "abono", descricao: "Diferença perdoada", valor: c.abonado, ref: c.id });
    if (c.descontado > 0) m.push({ data: c.quitadaEm ?? c.emitidaEm, tipo: "repasse", descricao: "Descontado do que você recebe", valor: c.descontado, ref: c.id });
  }
  const FORMA: Record<string, string> = { deposito: "depósito", pix: "Pix", transferencia: "transferência", outro: "pagamento" };
  for (const p of o.pagamentos) m.push({ data: p.data, tipo: "pagamento", descricao: `Você pagou · ${FORMA[p.forma] ?? "pagamento"}`, valor: p.valor, ref: p.id });
  // mais recente primeiro; no mesmo dia: abono/repasse, depois pagamento, depois a cobrança
  const ordem = { cobranca: 0, pagamento: 1, abono: 2, repasse: 2 };
  m.sort((a, b) => b.data.slice(0, 10).localeCompare(a.data.slice(0, 10)) || ordem[b.tipo] - ordem[a.tipo]);
  const saldo = centavos(m.reduce((a, x) => a + x.valor, 0));
  return { movimentos: m, saldo };
}
