/** Importação da carteira por planilha: lê as 4 abas, valida e devolve o que entra e o que tem erro.
 *  Sem dependências: recebe as linhas já lidas do Excel (texto, número ou data). */

export type Celula = string | number | boolean | Date | null | undefined;
export type Abas = Record<string, Celula[][]>;

export const MODELO = {
  "Proprietários": ["Nome", "CPF ou CNPJ", "E-mail", "Telefone", "Chave Pix", "Dados bancários", "Como paga (cobrança ou repasse)", "Quem paga as contas (nome de outro proprietário)"],
  "Condomínios": ["Nome", "Endereço", "Cidade", "Total de cotas", "Inscrição IPTU", "Nº cliente energia", "Nº cliente água"],
  "Imóveis": ["Condomínio (vazio = avulso)", "Identificação", "Endereço (obrigatório se avulso)", "Tipo", "Situação (alugado, vago, saindo ou indisponível)", "Cotas", "Taxa de adm. (%)", "Aluguel pedido", "Seguro incêndio mensal", "Boleto do condomínio pago por (imobiliária ou proprietário)", "Proprietário 1", "% 1", "Proprietário 2", "% 2", "Proprietário 3", "% 3"],
  "Contratos": ["Condomínio (vazio = avulso)", "Imóvel (identificação)", "Inquilino", "Contato do inquilino", "Aluguel", "Início", "Fim", "Dia do vencimento"],
} as const;
export type NomeAba = keyof typeof MODELO;

export type Proprietario = { nome: string; cpf_cnpj: string | null; email: string | null; telefone: string | null; pix: string | null; dados_bancarios: string | null; forma_padrao: "cobranca" | "repasse"; pagador: string | null };
export type Condominio = { nome: string; endereco: string | null; cidade: string | null; cotas_padrao: number | null; iptu_inscricao: string | null; energia_cliente: string | null; agua_cliente: string | null };
export type Imovel = { condominio: string | null; identificacao: string; endereco: string | null; tipo: string | null; status: "locado" | "vazio" | "devolucao" | "indisponivel"; cotas: number; taxa_adm_pct: number; aluguel_pedido: number | null; seguro: number | null; condominio_pago_por: "imobiliaria" | "proprietario"; donos: { nome: string; percentual: number }[] };
export type Contrato = { condominio: string | null; imovel: string; inquilino: string; contato: string | null; aluguel: number; inicio: string; fim: string; dia_vencimento: number | null };
export type Erro = { aba: NomeAba; linha: number; msg: string };
export type Resultado = { proprietarios: Proprietario[]; condominios: Condominio[]; imoveis: Imovel[]; contratos: Contrato[]; erros: Erro[]; avisos: Erro[] };

/** O que já existe no sistema (para não duplicar). */
export type Existente = { proprietarios: string[]; condominios: string[]; imoveis: string[] };

export const chave = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const chaveImovel = (condominio: string | null, identificacao: string) => `${chave(condominio)}|${chave(identificacao)}`;

const txt = (c: Celula) => { const s = c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim(); return s === "" ? null : s; };

/** "2.200,00", "2200.5", 2200 → número; vazio → null; texto inválido → NaN */
export function numero(c: Celula): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return c;
  const s = String(c).replace(/[R$%\s]/g, "");
  if (s === "") return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : NaN;
}

/** Data do Excel, "01/04/2024" ou "2024-04-01" → "2024-04-01"; vazio → null; inválida → "" */
export function dataISO(c: Celula): string | null {
  if (c == null || c === "") return null;
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? "" : c.toISOString().slice(0, 10);
  const s = String(c).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s);
  let y: number, mo: number, d: number;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else return "";
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : "";
}

const SITUACAO: Record<string, Imovel["status"]> = { alugado: "locado", locado: "locado", vago: "vazio", vazio: "vazio", saindo: "devolucao", devolucao: "devolucao", "em devolucao": "devolucao", indisponivel: "indisponivel" };

/** Linhas de dados de uma aba (sem o cabeçalho e sem linhas vazias), com o número da linha no Excel. */
function linhas(abas: Abas, nome: NomeAba) {
  const achada = Object.keys(abas).find((k) => chave(k) === chave(nome));
  const dados = achada ? abas[achada] : [];
  return dados.slice(1).map((cols, i) => ({ cols, n: i + 2 })).filter((l) => l.cols.some((c) => txt(c) !== null));
}

export function validar(abas: Abas, existente: Existente = { proprietarios: [], condominios: [], imoveis: [] }): Resultado {
  const r: Resultado = { proprietarios: [], condominios: [], imoveis: [], contratos: [], erros: [], avisos: [] };
  const erro = (aba: NomeAba, linha: number, msg: string) => r.erros.push({ aba, linha, msg });
  const aviso = (aba: NomeAba, linha: number, msg: string) => r.avisos.push({ aba, linha, msg });
  const num = (aba: NomeAba, n: number, c: Celula, rotulo: string) => { const v = numero(c); if (Number.isNaN(v)) { erro(aba, n, `${rotulo}: "${String(c)}" não é um número.`); return null; } return v; };
  const jaProp = new Set(existente.proprietarios.map(chave)), jaCond = new Set(existente.condominios.map(chave)), jaIm = new Set(existente.imoveis);

  /* proprietários */
  const props = new Map<string, Proprietario>();
  for (const { cols, n } of linhas(abas, "Proprietários")) {
    const nome = txt(cols[0]);
    if (!nome) { erro("Proprietários", n, "Falta o nome."); continue; }
    const k = chave(nome);
    if (props.has(k)) { erro("Proprietários", n, `"${nome}" está repetido na planilha.`); continue; }
    if (jaProp.has(k)) { aviso("Proprietários", n, `"${nome}" já está cadastrado e não será alterado.`); continue; }
    const email = txt(cols[2])?.toLowerCase() ?? null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erro("Proprietários", n, `E-mail "${email}" parece inválido.`);
    const forma = chave(txt(cols[6]));
    if (forma && !["cobranca", "repasse", "cobranca semanal", "desconto no repasse"].includes(forma)) erro("Proprietários", n, `Como paga: use "cobrança" ou "repasse".`);
    props.set(k, { nome, cpf_cnpj: txt(cols[1]), email, telefone: txt(cols[3]), pix: txt(cols[4]), dados_bancarios: txt(cols[5]), forma_padrao: forma.includes("repasse") ? "repasse" : "cobranca", pagador: txt(cols[7]) });
  }
  const emails = new Map<string, string>();
  for (const p of props.values()) if (p.email) { if (emails.has(p.email)) erro("Proprietários", 0, `O e-mail ${p.email} está em "${emails.get(p.email)}" e em "${p.nome}". Cada login precisa de um e-mail diferente.`); emails.set(p.email, p.nome); }
  const existeProp = (nome: string) => props.has(chave(nome)) || jaProp.has(chave(nome));
  for (const p of props.values()) {
    if (p.pagador && !existeProp(p.pagador)) erro("Proprietários", 0, `"${p.nome}": quem paga as contas ("${p.pagador}") não está na aba Proprietários.`);
    if (p.pagador && chave(p.pagador) === chave(p.nome)) p.pagador = null;
  }
  r.proprietarios = [...props.values()];

  /* condomínios */
  const conds = new Map<string, Condominio>();
  for (const { cols, n } of linhas(abas, "Condomínios")) {
    const nome = txt(cols[0]);
    if (!nome) { erro("Condomínios", n, "Falta o nome."); continue; }
    const k = chave(nome);
    if (conds.has(k)) { erro("Condomínios", n, `"${nome}" está repetido na planilha.`); continue; }
    if (jaCond.has(k)) { aviso("Condomínios", n, `"${nome}" já está cadastrado e não será alterado.`); continue; }
    conds.set(k, { nome, endereco: txt(cols[1]), cidade: txt(cols[2]), cotas_padrao: num("Condomínios", n, cols[3], "Total de cotas"), iptu_inscricao: txt(cols[4]), energia_cliente: txt(cols[5]), agua_cliente: txt(cols[6]) });
  }
  r.condominios = [...conds.values()];
  const existeCond = (nome: string) => conds.has(chave(nome)) || jaCond.has(chave(nome));

  /* imóveis */
  const ims = new Map<string, Imovel>();
  for (const { cols, n } of linhas(abas, "Imóveis")) {
    const condominio = txt(cols[0]), identificacao = txt(cols[1]), endereco = txt(cols[2]);
    if (!identificacao) { erro("Imóveis", n, "Falta a identificação (ex.: Apto 302)."); continue; }
    if (condominio && !existeCond(condominio)) { erro("Imóveis", n, `Condomínio "${condominio}" não está na aba Condomínios.`); continue; }
    if (!condominio && !endereco) { erro("Imóveis", n, `"${identificacao}": imóvel avulso precisa de endereço.`); continue; }
    const k = chaveImovel(condominio, identificacao);
    if (ims.has(k)) { erro("Imóveis", n, `"${identificacao}" está repetido${condominio ? ` em ${condominio}` : ""}.`); continue; }
    if (jaIm.has(k)) { aviso("Imóveis", n, `"${identificacao}" já está cadastrado e não será alterado.`); continue; }
    const sit = chave(txt(cols[4]));
    if (sit && !SITUACAO[sit]) erro("Imóveis", n, `Situação "${txt(cols[4])}": use alugado, vago, saindo ou indisponível.`);
    const donos: Imovel["donos"] = [];
    for (const i of [10, 12, 14]) {
      const nome = txt(cols[i]);
      if (!nome) continue;
      if (!existeProp(nome)) { erro("Imóveis", n, `Proprietário "${nome}" não está na aba Proprietários.`); continue; }
      donos.push({ nome, percentual: num("Imóveis", n, cols[i + 1], "Percentual") ?? 0 });
    }
    if (!donos.length) { erro("Imóveis", n, `"${identificacao}": falta o proprietário.`); continue; }
    if (donos.length === 1 && !donos[0].percentual) donos[0].percentual = 100;
    const soma = donos.reduce((a, d) => a + d.percentual, 0);
    if (Math.abs(soma - 100) > 0.01) erro("Imóveis", n, `"${identificacao}": os percentuais somam ${soma}%, precisam somar 100%.`);
    if (new Set(donos.map((d) => chave(d.nome))).size !== donos.length) erro("Imóveis", n, `"${identificacao}": proprietário repetido.`);
    ims.set(k, {
      condominio, identificacao, endereco, tipo: txt(cols[3]), status: SITUACAO[sit] ?? "vazio",
      cotas: num("Imóveis", n, cols[5], "Cotas") ?? 1, taxa_adm_pct: num("Imóveis", n, cols[6], "Taxa de adm.") ?? 10,
      aluguel_pedido: num("Imóveis", n, cols[7], "Aluguel pedido"), seguro: num("Imóveis", n, cols[8], "Seguro incêndio"),
      condominio_pago_por: chave(txt(cols[9])).startsWith("propriet") ? "proprietario" : "imobiliaria", donos,
    });
  }
  r.imoveis = [...ims.values()];

  /* contratos */
  const comContrato = new Set<string>();
  for (const { cols, n } of linhas(abas, "Contratos")) {
    const condominio = txt(cols[0]), imovel = txt(cols[1]), inquilino = txt(cols[2]);
    if (!imovel) { erro("Contratos", n, "Falta o imóvel."); continue; }
    const k = chaveImovel(condominio, imovel);
    if (!ims.has(k) && jaIm.has(k)) { aviso("Contratos", n, `"${imovel}" já estava cadastrado: o contrato dele não é alterado pela planilha.`); continue; }
    if (!ims.has(k)) { erro("Contratos", n, `Imóvel "${imovel}"${condominio ? ` em ${condominio}` : ""} não está na aba Imóveis.`); continue; }
    if (comContrato.has(k)) { erro("Contratos", n, `"${imovel}" tem mais de um contrato na planilha.`); continue; }
    if (!inquilino) { erro("Contratos", n, `"${imovel}": falta o inquilino.`); continue; }
    const aluguel = num("Contratos", n, cols[4], "Aluguel"), inicio = dataISO(cols[5]), fim = dataISO(cols[6]);
    if (!aluguel || aluguel <= 0) { erro("Contratos", n, `"${imovel}": falta o valor do aluguel.`); continue; }
    if (!inicio || !fim) { erro("Contratos", n, `"${imovel}": data de início ou de fim ${inicio === "" || fim === "" ? "inválida (use dia/mês/ano)" : "faltando"}.`); continue; }
    if (fim < inicio) { erro("Contratos", n, `"${imovel}": o fim é antes do início.`); continue; }
    const dia = num("Contratos", n, cols[7], "Dia do vencimento");
    if (dia != null && (dia < 1 || dia > 31)) { erro("Contratos", n, `"${imovel}": dia do vencimento deve ser de 1 a 31.`); continue; }
    comContrato.add(k);
    const im = ims.get(k)!;
    if (im.status === "vazio" || im.status === "indisponivel") { aviso("Contratos", n, `"${imovel}" estava como ${im.status === "vazio" ? "vago" : "indisponível"} mas tem contrato: entra como alugado.`); im.status = "locado"; }
    r.contratos.push({ condominio, imovel, inquilino, contato: txt(cols[3]), aluguel, inicio, fim, dia_vencimento: dia });
  }
  for (const [k, im] of ims) if ((im.status === "locado" || im.status === "devolucao") && !comContrato.has(k)) {
    aviso("Imóveis", 0, `"${im.identificacao}" está como ${im.status === "locado" ? "alugado" : "saindo"} mas não tem contrato na planilha: entra como vago.`);
    im.status = "vazio";
  }
  return r;
}
