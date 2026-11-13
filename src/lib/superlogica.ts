/** Leitura dos relatórios em PDF da Superlógica ("Imóveis de …" e "Contratos em andamento").
 *  Recebe o texto já extraído (uma string por página) e devolve as mesmas 4 abas do modelo de planilha,
 *  para passar pela mesma conferência (`validar`). Sem dependências. */

import { chave, MODELO, type Abas, type Celula, type Erro } from "./importacao.ts";

export type Pagina = string[]; // linhas da página; colunas separadas por 4+ espaços

/** Imóvel como vem no relatório */
export type ImovelSL = {
  codigo: string; endereco: string; vazio: boolean; aluguel: number | null; taxa: number | null;
  iptu: string | null; agua: string | null; energia: string | null; observacao: string | null;
  donos: { nome: string; doc: string | null; percentual: number }[];
};
export type ContratoSL = { codigo: string; aluguel: number | null; termino: string | null; inquilino: string | null; endereco: string };

const num = (s: string | null | undefined) => { if (!s) return null; const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const codigo = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
const celulas = (l: string) => l.split(/\s{4,}/).map((c) => c.trim()).filter(Boolean);

/** Tira cabeçalho/rodapé repetidos de cada página (aparecem igual em metade das páginas, no topo ou no pé). */
export function limparPaginas(paginas: Pagina[]): string[] {
  const conta = new Map<string, number>();
  for (const p of paginas) for (const l of new Set([...p.slice(0, 3), ...p.slice(-5)])) conta.set(l, (conta.get(l) ?? 0) + 1);
  const minimo = paginas.length <= 2 ? 2 : Math.max(3, Math.ceil(paginas.length * 0.6));
  return paginas.flatMap((p) => p.filter((l, i) => {
    if (/^\s*\d+ de \d+\s*$/.test(l)) return false;
    const borda = i < 3 || i >= p.length - 5;
    return !(borda && paginas.length > 1 && (conta.get(l) ?? 0) >= minimo);
  })).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
}

export function tipoDeRelatorio(linhas: string[]): "imoveis" | "contratos" | null {
  const ini = linhas.slice(0, 40).join("\n");
  if (/Contrato\s+[A-Z]?\s?\d+\/\d+/.test(linhas.join("\n")) && /Contratos|Lista de contratos/i.test(ini)) return "contratos";
  if (linhas.some((l) => /^Im[óo]vel\s+[A-Z]?\s?\d+\s+-\s/.test(l.trim()))) return "imoveis";
  return null;
}

const ROTULOS = ["Código IPTU da garagem", "Código IPTU", "Código água", "Código energia", "Código gás", "Código sequencial", "Código de Contribuinte", "Código SPU",
  "Código bombeiro", "Código da taxa de lixo", "Aluguel", "Repasse", "Taxa de adm.", "Condomínio", "Administradora", "Cartório", "Matrícula", "Vagas de garagens",
  "Hobby Box", "Localização", "Metragem", "Data de captação", "Observação"];

export function lerImoveis(linhas: string[]): ImovelSL[] {
  const r: ImovelSL[] = [];
  let atual: ImovelSL | null = null, campo: "obs" | "donos" | null = null;
  for (const bruta of linhas) {
    const l = bruta.trim();
    const cab = /^Im[óo]vel\s+([A-Z]?\s?\d+)\s+-\s+(.+?)(?:\s{4,}(Im[óo]vel vazio|.+))?$/.exec(l);
    if (cab) {
      atual = { codigo: codigo(cab[1]), endereco: cab[2].trim(), vazio: /vazio/i.test(cab[3] ?? ""), aluguel: null, taxa: null, iptu: null, agua: null, energia: null, observacao: null, donos: [] };
      r.push(atual); campo = null; continue;
    }
    if (!atual) continue;
    if (/^Propriet[áa]rios$/.test(l)) { campo = "donos"; continue; }
    if (campo === "donos") {
      const cs = celulas(l);
      const doc = cs.find((c) => /^(CPF|CNPJ)\b/.test(c));
      const rep = cs.find((c) => /^Repasse\s/.test(c));
      if (rep || doc) {
        const nome = cs.filter((c) => c !== doc && c !== rep).join(" ");
        atual.donos.push({ nome, doc: doc?.replace(/^(CPF|CNPJ)\s*/, "") ?? null, percentual: num(/([\d.,]+)\s*%/.exec(rep ?? "")?.[1]) ?? 100 });
      } else if (atual.donos.length && cs.length === 1 && cs[0].length <= 40 && !/\d|^Listando|^Total/i.test(cs[0])) atual.donos[atual.donos.length - 1].nome += " " + cs[0];
      continue;
    }
    let novoCampo = false;
    for (const c of celulas(l)) {
      const rot = ROTULOS.find((x) => c === x || c.startsWith(x + " "));
      if (!rot) { if (campo === "obs") atual.observacao = `${atual.observacao ?? ""} ${c}`.trim(); continue; }
      novoCampo = true; campo = null;
      const v = c.slice(rot.length).trim() || null;
      if (rot === "Aluguel") atual.aluguel = num(v);
      else if (rot === "Taxa de adm.") atual.taxa = num(v?.replace("%", "").trim());
      else if (rot === "Código IPTU") atual.iptu = v;
      else if (rot === "Código água") atual.agua = v?.replace(/\s*-\s*/g, "-") ?? null;
      else if (rot === "Código energia") atual.energia = v;
      else if (rot === "Observação") { atual.observacao = v; campo = "obs"; }
    }
    if (!novoCampo && campo !== "obs") campo = null;
  }
  return r;
}

export function lerContratos(linhas: string[]): ContratoSL[] {
  const blocos: { c: ContratoSL; ls: string[] }[] = [];
  for (const l of linhas) {
    const m = /Contrato\s+([A-Z]?\s?\d+)\/\d+\s+(.*)$/.exec(l);
    if (m) { blocos.push({ c: { codigo: codigo(m[1]), aluguel: null, termino: null, inquilino: null, endereco: celulas(m[2])[0] ?? "" }, ls: [l] }); continue; }
    if (blocos.length) blocos[blocos.length - 1].ls.push(l);
  }
  const datas = blocos.map((b) => b.ls.flatMap((l) => [...l.matchAll(/(?<![\d/])(\d{2})\/(\d{4})(?![\d/])/g)].map((m) => `${m[2]}-${m[1]}`)));
  // mês de término que caiu no bloco vizinho (quebra de linha do PDF)
  datas.forEach((d, i) => { if (!d.length) { if (datas[i - 1]?.length > 1) d.push(datas[i - 1].pop()!); else if (datas[i + 1]?.length > 1) d.push(datas[i + 1].shift()!); } });
  const ruido = /Taxa de adm|Listando|Vencimento|Contrato\s|^\d{5}-\d{3}|CEP:|^R\$|Total da taxa|^\d{2}\/\d{4}$/;
  blocos.forEach(({ c, ls }, i) => {
    const valores = ls.flatMap((l) => [...l.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) => num(m[1])));
    c.aluguel = valores[0] ?? null;
    c.termino = datas[i][0] ?? null;
    const textos = ls.slice(1).flatMap(celulas).filter((t) => !ruido.test(t) && /[A-Za-zÀ-ú]{2}/.test(t) && !/\d{5}-\d{3}/.test(t));
    c.inquilino = textos.length >= 2 ? textos[textos.length - 1] : null; // o penúltimo é o proprietário
  });
  return blocos.map((b) => b.c);
}

/* ---------- endereço → condomínio + unidade ---------- */

const PREFIXO = /^(Rua|R\.|Avenida|Av\.?|Travessa|Tv\.?|Estrada|Estr\.?|Alameda|Al\.?|Praça|Rodovia|Rod\.?)\s+/i;

export function quebrarEndereco(end: string) {
  const cep = /CEP:?\s*(\d{5}-?\d{3})/.exec(end)?.[1] ?? null;
  const partes = end.replace(/,?\s*CEP:?\s*\d{5}-?\d{3}/, "").split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  const m = /^(.*?)\s*(?:n[º°o.]\s*)+(?:n[º°o.]\s*)*(\d+)\s*$/i.exec(partes[0] ?? "") ?? /^(.*?\D)\s+(\d+)$/.exec(partes[0] ?? "");
  const rua = (m ? m[1] : partes[0] ?? "").trim(), numero = m ? m[2] : null;
  const cidade = partes.length > 1 ? partes[partes.length - 1] : null;
  const bairro = partes.length > 2 ? partes[partes.length - 2] : null;
  const complemento = partes.slice(1, Math.max(1, partes.length - 2)).join(", ");
  return { rua, numero, bairro, cidade, cep, complemento };
}

const UNIDADE = /\b(Apto|Apt[oº.]?|Ap\.?|Casa|Sala|Loja|Kitnet|Quarto)\s*[ºo°.]?\s*(\d+[A-Z]?)\b/i;
const TIPO: Record<string, string> = { ap: "Apartamento", casa: "Casa", sala: "Sala", loja: "Loja", kitnet: "Kitnet", quarto: "Quarto" };

export function unidade(complemento: string) {
  const m = UNIDADE.exec(complemento);
  if (!m) return { identificacao: complemento || null, tipo: null as string | null };
  const k = chave(m[1]).startsWith("ap") ? "ap" : chave(m[1]).replace(/\W/g, "");
  let id = `${k === "ap" ? "Apto" : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()} ${m[2].padStart(2, "0")}`;
  if (k !== "casa") {
    const lado = /\b(Frente|Fundos)\b/i.exec(complemento)?.[1];
    const bloco = /\bBloco\s+([A-Z0-9]{1,3})\b/i.exec(complemento)?.[1];
    if (lado) id += ` ${lado[0].toUpperCase()}${lado.slice(1).toLowerCase()}`;
    else if (bloco) id += ` Bloco ${bloco.toUpperCase()}`;
  }
  return { identificacao: id, tipo: TIPO[k] ?? null };
}

/* ---------- montagem das abas ---------- */

/** Imóveis já cadastrados por código do sistema anterior → como estão no ImobAI (para reimportar sem duplicar). */
export type JaCadastrado = Record<string, { condominio: string | null; identificacao: string }>;

export type Conversao = { abas: Abas; avisos: Erro[]; ignorados: number };

const ultimoDia = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const somarMeses = (iso: string, n: number) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1 + n, 1)); return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), Math.min(d, new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate()))).toISOString().slice(0, 10); };

/** Contrato sem datas no relatório: término no fim do mês informado, início 30 meses antes, vencimento dia 10. */
export function estimarDatas(termino: string, hoje?: string) {
  const fim = ultimoDia(termino);
  let inicio = somarMeses(`${termino}-01`, -29);
  if (hoje && inicio > hoje) inicio = `${hoje.slice(0, 7)}-01`; // nunca começa no futuro
  return { inicio, fim, dia: 10 };
}

export function montarAbas(imoveisSL: ImovelSL[], contratosSL: ContratoSL[], ja: JaCadastrado = {}, hoje = new Date().toISOString().slice(0, 10)): Conversao {
  const avisos: Erro[] = [];
  const av = (aba: Erro["aba"], msg: string) => avisos.push({ aba, linha: 0, msg });
  const rateio = (i: ImovelSL) => /rateio/i.test(i.endereco);
  const ignorados = imoveisSL.filter(rateio).length;
  const doContrato = new Map(contratosSL.map((c) => [c.codigo, c]));

  // 1. cada imóvel: rua, número e unidade
  type Item = ImovelSL & { e: ReturnType<typeof quebrarEndereco>; u: ReturnType<typeof unidade> };
  type Rua = { rua: string; numeros: Map<string, number>; rateio: boolean; cidade: string | null; bairro: string | null; cep: string | null; locais: Map<string, number> };
  const ruas = new Map<string, Rua>();
  const itens: Item[] = [];
  for (const i of imoveisSL) {
    const e = quebrarEndereco(i.endereco);
    const kr = chave(e.rua);
    const g = ruas.get(kr) ?? { rua: e.rua, numeros: new Map(), rateio: false, cidade: e.cidade, bairro: e.bairro, cep: e.cep, locais: new Map() };
    ruas.set(kr, g);
    if (rateio(i)) { g.rateio = true; continue; }
    // bairro/CEP do prédio: o que mais aparece nas unidades (o do "Rateio" costuma estar errado)
    const local = JSON.stringify([e.bairro, e.cep, e.cidade]);
    g.locais.set(local, (g.locais.get(local) ?? 0) + 1);
    [g.bairro, g.cep, g.cidade] = JSON.parse([...g.locais].sort((a, b) => b[1] - a[1])[0][0]);
    if (e.numero) g.numeros.set(e.numero, (g.numeros.get(e.numero) ?? 0) + 1);
    itens.push({ ...i, e, u: unidade(e.complemento) });
  }
  // 2. condomínio = mesma rua (e número); número que aparece só uma vez entra no maior grupo da rua
  const condDe = (it: Item): { nome: string; endereco: string; cidade: string | null } | null => {
    const g = ruas.get(chave(it.e.rua))!;
    const grupos = [...g.numeros].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    const total = [...g.numeros.values()].reduce((a, b) => a + b, 0);
    if (!g.rateio && total < 2) return null;
    const numero = it.e.numero && grupos.some(([n]) => n === it.e.numero) ? it.e.numero : grupos[0]?.[0] ?? it.e.numero;
    const base = g.rua.replace(PREFIXO, "");
    return { nome: numero ? `${base} ${numero}` : base, endereco: `${g.rua}${numero ? `, ${numero}` : ""}${g.bairro ? ` · ${g.bairro}` : ""}${g.cep ? ` · CEP ${g.cep}` : ""}`, cidade: g.cidade };
  };

  type Linha = { it: Item; cond: string | null; id: string };
  const linhas: Linha[] = [];
  const conds = new Map<string, { nome: string; endereco: string; cidade: string | null }>();
  for (const it of itens) {
    const salvo = ja[it.codigo];
    const c = salvo ? (salvo.condominio ? { nome: salvo.condominio, endereco: "", cidade: null } : null) : condDe(it);
    if (c && !salvo) conds.set(chave(c.nome), conds.get(chave(c.nome)) ?? c);
    linhas.push({ it, cond: c?.nome ?? null, id: salvo?.identificacao ?? it.u.identificacao ?? `Imóvel ${it.codigo}` });
  }

  // 3. duplicados (mesmo condomínio e unidade): fica o que tem contrato; senão o de código mais novo
  const porChave = new Map<string, Linha[]>();
  for (const l of linhas) { const k = `${chave(l.cond)}|${chave(l.id)}`; porChave.set(k, [...(porChave.get(k) ?? []), l]); }
  const ficam: Linha[] = [];
  for (const grupo of porChave.values()) {
    // prioridade: tem contrato > código com "I" (o ativo, que carrega o contrato) > alugado > código mais novo
    const ordem = [...grupo].sort((a, b) => Number(doContrato.has(b.it.codigo)) - Number(doContrato.has(a.it.codigo))
      || Number(/^[A-Z]/.test(b.it.codigo)) - Number(/^[A-Z]/.test(a.it.codigo)) || Number(!b.it.vazio) - Number(!a.it.vazio)
      || Number(b.it.codigo.replace(/\D/g, "")) - Number(a.it.codigo.replace(/\D/g, "")));
    ficam.push(ordem[0]);
    for (const d of ordem.slice(1)) av("Imóveis", `Código ${d.it.codigo} (${d.id}${d.cond ? `, ${d.cond}` : ""}) parece repetido do ${ordem[0].it.codigo}: ficou de fora.`);
  }

  // 4. IPTU igual em todas as unidades = IPTU do prédio
  const iptuDoCond = new Map<string, string>();
  const limpaIptu = (l: Linha) => { const v = l.it.iptu; return v && v.replace(/\D/g, "") !== (l.it.e.cep ?? "").replace(/\D/g, "") ? v : null; };
  for (const [k] of conds) {
    const vs = ficam.filter((l) => chave(l.cond) === k).map(limpaIptu);
    if (vs.length >= 2 && vs.every((v) => v && v === vs[0])) iptuDoCond.set(k, vs[0]!);
  }

  // 5. abas
  const props = new Map<string, Celula[]>();
  const abaImoveis: Celula[][] = [], abaContratos: Celula[][] = [];
  for (const l of ficam.sort((a, b) => chave(a.cond).localeCompare(chave(b.cond)) || a.id.localeCompare(b.id, "pt-BR", { numeric: true }))) {
    const i = l.it, k = chave(l.cond);
    for (const d of i.donos) if (!props.has(chave(d.nome))) props.set(chave(d.nome), [d.nome, d.doc]);
    const donos = i.donos.slice(0, 3).flatMap((d) => [d.nome, d.percentual]);
    if (i.donos.length > 3) av("Imóveis", `${l.id}: tem mais de 3 proprietários; só os 3 primeiros entraram.`);
    const contrato = doContrato.get(i.codigo);
    abaImoveis.push([l.cond, l.id, l.cond ? null : i.endereco.replace(/,?\s*CEP:.*/, ""), l.it.u.tipo, contrato || !i.vazio ? "alugado" : "vago", 1, i.taxa ?? 10,
      i.aluguel || null, null, null, ...donos, ...Array(6 - donos.length).fill(null),
      i.codigo, iptuDoCond.has(k) ? null : limpaIptu(l), i.energia, i.agua, i.observacao]);
    if (contrato) {
      if (!contrato.termino || !contrato.aluguel || !contrato.inquilino) { av("Contratos", `Contrato do ${i.codigo} (${l.id}): não consegui ler ${!contrato.inquilino ? "o inquilino" : !contrato.aluguel ? "o aluguel" : "o término"}; ficou de fora.`); continue; }
      const d = estimarDatas(contrato.termino, hoje);
      if (d.fim < hoje) av("Contratos", `${l.id}${l.cond ? ` (${l.cond})` : ""}: o contrato terminou em ${d.fim.split("-").reverse().join("/")} e ainda consta em andamento. Renove ou encerre depois de importar.`);
      abaContratos.push([l.cond, l.id, contrato.inquilino, null, contrato.aluguel, d.inicio, d.fim, d.dia, "sim"]);
    }
  }
  for (const c of contratosSL) if (!ficam.some((l) => l.it.codigo === c.codigo) && !imoveisSL.some((i) => i.codigo === c.codigo)) {
    const s = ja[c.codigo];
    if (s && c.termino && c.aluguel && c.inquilino) { const d = estimarDatas(c.termino, hoje); abaContratos.push([s.condominio, s.identificacao, c.inquilino, null, c.aluguel, d.inicio, d.fim, d.dia, "sim"]); }
    else av("Contratos", `Contrato do imóvel ${c.codigo} (${c.endereco}): o imóvel não está no relatório de imóveis nem cadastrado. Envie também o relatório de imóveis.`);
  }
  if (abaContratos.length) av("Contratos", `${abaContratos.length} contrato(s) sem data de início e dia de vencimento no relatório: estimei início 30 meses antes do término e vencimento dia 10, marcados "datas a conferir".`);
  if (ignorados) av("Imóveis", `${ignorados} imóvel(is) de "Rateio" ficaram de fora (são só o cadastro do condomínio).`);

  const abaConds = [...conds].map(([k, c]) => [c.nome, c.endereco, c.cidade, null, iptuDoCond.get(k) ?? null, null, null] as Celula[]);
  const cab = (n: keyof typeof MODELO) => [...MODELO[n]] as Celula[];
  return {
    abas: {
      "Proprietários": [cab("Proprietários"), ...[...props.values()].map((p) => [p[0], p[1], null, null, null, null, "cobrança", null])],
      "Condomínios": [cab("Condomínios"), ...abaConds],
      "Imóveis": [cab("Imóveis"), ...abaImoveis],
      "Contratos": [cab("Contratos"), ...abaContratos],
    },
    avisos, ignorados,
  };
}
