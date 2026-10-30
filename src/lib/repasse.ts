/** Cálculo do repasse mensal ao proprietário. Sem dependências: usado na prévia, no fechamento e nos testes. */

export type ContratoRepasse = { id: string; aluguel: number; inicio: string; fim: string; inquilino: string };
export type ImovelRepasse = {
  id: string;
  nome: string;
  taxaPct: number;
  seguro: number | null;
  donos: { proprietarioId: string; percentual: number }[];
  contratos: ContratoRepasse[];
};
/** Item de despesa que o proprietário mandou descontar e ainda não entrou em repasse. */
export type DescontoRepasse = { itemId: string; proprietarioId: string; imovelId: string; descricao: string; valor: number; taxaAdm: number };

export type LinhaRepasse = { imovelId: string; imovel: string; tipo: "aluguel" | "taxa" | "seguro" | "despesa"; descricao: string; valor: number };
export type RepasseCalculado = {
  proprietarioId: string;
  linhas: LinhaRepasse[];
  aluguel: number; taxa: number; seguro: number; despesas: number; liquido: number;
  itens: string[];   // ids de despesa_itens que entram neste repasse
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** "2026-11" → { ini: "2026-11-01", fim: "2026-11-30" } */
export function mesDe(competencia: string) {
  const [y, m] = competencia.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { ini: `${y}-${mm}-01`, fim: `${y}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

/** Contrato que vale no mês: o que cobre parte do mês e começou por último (renovação no meio do mês fica com o novo). */
export function contratoDoMes(contratos: ContratoRepasse[], competencia: string) {
  const { ini, fim } = mesDe(competencia);
  return contratos
    .filter((c) => c.inicio <= fim && c.fim >= ini)
    .sort((a, b) => b.inicio.localeCompare(a.inicio))[0] ?? null;
}

export function calcularRepasses(competencia: string, imoveis: ImovelRepasse[], descontos: DescontoRepasse[]): RepasseCalculado[] {
  const porDono = new Map<string, RepasseCalculado>();
  const de = (id: string) => {
    if (!porDono.has(id)) porDono.set(id, { proprietarioId: id, linhas: [], aluguel: 0, taxa: 0, seguro: 0, despesas: 0, liquido: 0, itens: [] });
    return porDono.get(id)!;
  };

  for (const im of imoveis) {
    const c = contratoDoMes(im.contratos, competencia);
    for (const d of im.donos) {
      const r = de(d.proprietarioId);
      const parte = d.percentual < 100 ? ` (sua parte, ${d.percentual}%)` : "";
      if (c) {
        const aluguel = centavos((Number(c.aluguel) * d.percentual) / 100);
        const taxa = centavos((aluguel * im.taxaPct) / 100);
        r.linhas.push({ imovelId: im.id, imovel: im.nome, tipo: "aluguel", descricao: `Aluguel · ${c.inquilino}${parte}`, valor: aluguel });
        r.linhas.push({ imovelId: im.id, imovel: im.nome, tipo: "taxa", descricao: `Taxa de administração (${im.taxaPct}%)`, valor: -taxa });
        r.aluguel += aluguel; r.taxa += taxa;
      }
      if (im.seguro) {
        const seguro = centavos((Number(im.seguro) * d.percentual) / 100);
        r.linhas.push({ imovelId: im.id, imovel: im.nome, tipo: "seguro", descricao: `Seguro incêndio${parte}`, valor: -seguro });
        r.seguro += seguro;
      }
    }
  }

  const nomes = new Map(imoveis.map((i) => [i.id, i.nome]));
  for (const x of descontos) {
    const r = de(x.proprietarioId);
    const v = centavos(Number(x.valor) + Number(x.taxaAdm));
    r.linhas.push({ imovelId: x.imovelId, imovel: nomes.get(x.imovelId) ?? "", tipo: "despesa", descricao: x.descricao + (Number(x.taxaAdm) > 0 ? " (+ taxa adm.)" : ""), valor: -v });
    r.despesas += v;
    r.itens.push(x.itemId);
  }

  const ordem = { aluguel: 0, taxa: 1, seguro: 2, despesa: 3 };
  return [...porDono.values()]
    .filter((r) => r.linhas.length)
    .map((r) => ({
      ...r,
      linhas: r.linhas.sort((a, b) => a.imovel.localeCompare(b.imovel) || ordem[a.tipo] - ordem[b.tipo]),
      aluguel: centavos(r.aluguel), taxa: centavos(r.taxa), seguro: centavos(r.seguro), despesas: centavos(r.despesas),
      liquido: centavos(r.aluguel - r.taxa - r.seguro - r.despesas),
    }));
}
