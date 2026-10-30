/** Cálculo do rateio de uma despesa. Sem dependências: usado no formulário (prévia) e na server action (gravação). */

export type Regra = "cotas" | "percentual" | "fixo" | "integral";

export type UnidadeRateio = {
  imovelId: string;
  /** cotas, percentual ou valor fixo, conforme a regra */
  quantidade: number;
  donos: { proprietarioId: string; percentual: number }[];
};

export type ItemRateio = {
  imovelId: string;
  proprietarioId: string;
  quantidade: number;
  percentualDono: number;
  valor: number;
  taxaAdm: number;
};

export type ResultadoRateio = {
  porUnidade: { imovelId: string; valor: number }[];
  itens: ItemRateio[];
  carteira: number;
  fora: number;
  erro: string | null;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Distribui `total` entre pesos, em centavos, sem perder nem sobrar centavo (maior resto). */
export function distribuir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, p) => a + p, 0);
  const alvo = Math.round(total * 100);
  if (soma <= 0) return pesos.map(() => 0);
  const brutos = pesos.map((p) => (alvo * p) / soma);
  const base = brutos.map(Math.floor);
  let resto = alvo - base.reduce((a, b) => a + b, 0);
  brutos
    .map((b, i) => ({ i, frac: b - Math.floor(b) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (resto-- > 0) base[i]++; });
  return base.map((c) => c / 100);
}

export function calcularRateio(opts: {
  total: number;
  regra: Regra;
  divisor?: number | null;
  unidades: UnidadeRateio[];
  cobraTaxa: boolean;
  taxaPct: (imovelId: string) => number;
}): ResultadoRateio {
  const { total, regra, unidades, cobraTaxa, taxaPct } = opts;
  const vazio = (erro: string): ResultadoRateio => ({ porUnidade: [], itens: [], carteira: 0, fora: 0, erro });
  if (!(total > 0)) return vazio("Informe o valor total.");
  const ativas = unidades.filter((u) => u.quantidade > 0);
  if (!ativas.length) return vazio("Inclua pelo menos uma unidade.");
  const soma = ativas.reduce((a, u) => a + u.quantidade, 0);

  let capacidade: number;          // cotas, 100% ou valor total
  let parteCarteira: number;       // valor que cabe às unidades da carteira
  if (regra === "integral") {
    if (ativas.length !== 1) return vazio("Lançamento avulso é para um imóvel só.");
    capacidade = soma; parteCarteira = total;
  } else if (regra === "cotas") {
    const div = Number(opts.divisor);
    if (!(div > 0)) return vazio("Informe em quantas cotas a conta é dividida.");
    capacidade = div; parteCarteira = (total * soma) / div;
  } else if (regra === "percentual") {
    capacidade = 100; parteCarteira = (total * soma) / 100;
  } else {
    capacidade = total; parteCarteira = soma;
  }
  if (soma - capacidade > 1e-9) {
    const un = regra === "cotas" ? `${soma} cotas, acima de ${capacidade}` : regra === "percentual" ? `${soma}%, acima de 100%` : `${soma.toFixed(2)}, acima do total`;
    return vazio(`As unidades somam ${un}.`);
  }

  const carteira = centavos(parteCarteira);
  const valoresUnidade = regra === "fixo" ? ativas.map((u) => centavos(u.quantidade)) : distribuir(carteira, ativas.map((u) => u.quantidade));

  const itens: ItemRateio[] = [];
  ativas.forEach((u, idx) => {
    const somaDonos = u.donos.reduce((a, d) => a + d.percentual, 0);
    if (!u.donos.length || Math.abs(somaDonos - 100) > 0.01) return;
    distribuir(valoresUnidade[idx], u.donos.map((d) => d.percentual)).forEach((valor, j) => {
      itens.push({
        imovelId: u.imovelId,
        proprietarioId: u.donos[j].proprietarioId,
        quantidade: u.quantidade,
        percentualDono: u.donos[j].percentual,
        valor,
        taxaAdm: cobraTaxa ? centavos((valor * taxaPct(u.imovelId)) / 100) : 0,
      });
    });
  });
  const semDono = ativas.filter((u) => !u.donos.length || Math.abs(u.donos.reduce((a, d) => a + d.percentual, 0) - 100) > 0.01);
  if (semDono.length) return vazio("Há unidade sem proprietário ou com percentuais que não somam 100%. Corrija o cadastro do imóvel.");

  return {
    porUnidade: ativas.map((u, i) => ({ imovelId: u.imovelId, valor: valoresUnidade[i] })),
    itens,
    carteira,
    fora: centavos(total - carteira),
    erro: null,
  };
}
