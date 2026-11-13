"use server";

import { revalidatePath } from "next/cache";
import readExcelFile from "read-excel-file/node";
import { exigirAdmin } from "@/lib/auth";
import { chaveImovel, validar, type Abas, type Erro } from "@/lib/importacao";
import { hojeSP } from "@/lib/format";
import { paginasDoPdf } from "@/lib/pdfTexto";
import { lerContratos, lerImoveis, limparPaginas, montarAbas, tipoDeRelatorio, type ContratoSL, type ImovelSL, type JaCadastrado } from "@/lib/superlogica";

export type Relatorio = {
  falha?: string;
  contagem?: { proprietarios: number; condominios: number; imoveis: number; contratos: number; imoveisAtualizados: number; vagos: number; aConferir: number };
  erros?: Erro[]; avisos?: Erro[];
  importado?: boolean;
  origem?: string;
};

const MB = 1024 * 1024;

/** Lê a planilha do modelo ou os relatórios em PDF da Superlógica, confere e, se `importar` e não houver erro,
 *  grava tudo numa transação só (o que já existe é atualizado). */
export async function processarPlanilha(_anterior: Relatorio, form: FormData): Promise<Relatorio> {
  const { supabase, user } = await exigirAdmin();
  const arquivos = form.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!arquivos.length) return { falha: "Escolha a planilha (.xlsx) ou os relatórios em PDF." };
  if (arquivos.some((f) => f.size > 10 * MB)) return { falha: "Arquivo maior que 10 MB." };

  const [{ data: ps }, { data: cs }, { data: is }] = await Promise.all([
    supabase.from("proprietarios").select("nome"),
    supabase.from("condominios").select("nome"),
    supabase.from("imoveis").select("identificacao, codigo_externo, condominios(nome)"),
  ]);
  const imoveis = (is ?? []) as unknown as { identificacao: string; codigo_externo: string | null; condominios: { nome: string } | null }[];

  let abas: Abas, extras: Erro[] = [], origem: string;
  const pdfs = arquivos.filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (pdfs.length) {
    const lidos: { imoveis: ImovelSL[]; contratos: ContratoSL[] } = { imoveis: [], contratos: [] };
    for (const f of pdfs) {
      let linhas: string[];
      try { linhas = limparPaginas(await paginasDoPdf(new Uint8Array(await f.arrayBuffer()))); }
      catch { return { falha: `Não consegui ler o PDF "${f.name}".` }; }
      const tipo = tipoDeRelatorio(linhas);
      if (tipo === "imoveis") lidos.imoveis.push(...lerImoveis(linhas));
      else if (tipo === "contratos") lidos.contratos.push(...lerContratos(linhas));
      else return { falha: `"${f.name}" não parece um relatório de imóveis nem de contratos da Superlógica.` };
    }
    const ja: JaCadastrado = Object.fromEntries(imoveis.filter((i) => i.codigo_externo).map((i) => [i.codigo_externo!, { condominio: i.condominios?.nome ?? null, identificacao: i.identificacao }]));
    const c = montarAbas(lidos.imoveis, lidos.contratos, ja, hojeSP());
    abas = c.abas; extras = c.avisos;
    origem = `Superlógica: ${lidos.imoveis.length} imóveis e ${lidos.contratos.length} contratos lidos`;
  } else {
    try {
      const lidas = await readExcelFile(Buffer.from(await arquivos[0].arrayBuffer()));
      abas = Object.fromEntries(lidas.map((s) => [s.sheet, s.data as Abas[string]]));
      origem = `Planilha ${arquivos[0].name}`;
    } catch {
      return { falha: "Não consegui ler o arquivo. Use o modelo em Excel (.xlsx) ou os relatórios em PDF da Superlógica." };
    }
  }

  const r = validar(abas, {
    proprietarios: (ps ?? []).map((p) => p.nome as string),
    condominios: (cs ?? []).map((c) => c.nome as string),
    imoveis: imoveis.map((i) => chaveImovel(i.condominios?.nome ?? null, i.identificacao)),
  });
  const novos = r.imoveis.filter((i) => !i.existe);
  const contagem = {
    proprietarios: r.proprietarios.length, condominios: r.condominios.length, imoveis: novos.length, contratos: r.contratos.length,
    imoveisAtualizados: r.imoveis.length - novos.length, vagos: r.imoveis.filter((i) => i.status === "vazio").length, aConferir: r.contratos.filter((c) => c.a_conferir).length,
  };
  // avisos de "já cadastrado" por linha viram um só
  const jaCad = r.avisos.filter((a) => a.msg.includes("já está cadastrado: atualiza"));
  const avisos = [...extras, ...r.avisos.filter((a) => !jaCad.includes(a)), ...(jaCad.length ? [{ aba: "Imóveis" as const, linha: 0, msg: `${jaCad.length} imóvel(is) já cadastrado(s): atualiza aluguel pedido, taxa, códigos e contrato (os proprietários não mudam).` }] : [])];
  const base = { contagem, erros: r.erros, avisos, origem };
  if (!r.proprietarios.length && !r.condominios.length && !r.imoveis.length && !r.contratos.length && !r.erros.length)
    return { ...base, falha: "Não encontrei dados. As abas precisam ter os nomes do modelo: Proprietários, Condomínios, Imóveis e Contratos." };
  if (form.get("importar") !== "1" || r.erros.length) return base;

  const { error } = await supabase.rpc("importar_carteira", {
    p: { proprietarios: r.proprietarios, condominios: r.condominios, imoveis: r.imoveis, contratos: r.contratos }, p_user: user.id,
  });
  if (error) return { ...base, falha: `Nada foi importado. ${error.message}` };
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
  return { ...base, importado: true };
}
