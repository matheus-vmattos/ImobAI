"use server";

import { revalidatePath } from "next/cache";
import readExcelFile from "read-excel-file/node";
import { exigirAdmin } from "@/lib/auth";
import { chaveImovel, validar, type Abas, type Erro } from "@/lib/importacao";

export type Relatorio = {
  falha?: string;
  contagem?: { proprietarios: number; condominios: number; imoveis: number; contratos: number };
  erros?: Erro[]; avisos?: Erro[];
  importado?: boolean;
};

/** Lê a planilha, confere e, se `importar` e não houver erro, grava tudo numa transação só. */
export async function processarPlanilha(_anterior: Relatorio, form: FormData): Promise<Relatorio> {
  const { supabase, user } = await exigirAdmin();
  const arquivo = form.get("planilha");
  if (!(arquivo instanceof File) || !arquivo.size) return { falha: "Escolha a planilha (.xlsx)." };
  if (arquivo.size > 5 * 1024 * 1024) return { falha: "Planilha maior que 5 MB." };
  let abas: Abas;
  try {
    const lidas = await readExcelFile(Buffer.from(await arquivo.arrayBuffer()));
    abas = Object.fromEntries(lidas.map((s) => [s.sheet, s.data as Abas[string]]));
  } catch {
    return { falha: "Não consegui ler o arquivo. Use o modelo em Excel (.xlsx)." };
  }
  const [{ data: ps }, { data: cs }, { data: is }] = await Promise.all([
    supabase.from("proprietarios").select("nome"),
    supabase.from("condominios").select("nome"),
    supabase.from("imoveis").select("identificacao, condominios(nome)"),
  ]);
  const r = validar(abas, {
    proprietarios: (ps ?? []).map((p) => p.nome as string),
    condominios: (cs ?? []).map((c) => c.nome as string),
    imoveis: ((is ?? []) as unknown as { identificacao: string; condominios: { nome: string } | null }[]).map((i) => chaveImovel(i.condominios?.nome ?? null, i.identificacao)),
  });
  const contagem = { proprietarios: r.proprietarios.length, condominios: r.condominios.length, imoveis: r.imoveis.length, contratos: r.contratos.length };
  const base = { contagem, erros: r.erros, avisos: r.avisos };
  if (!contagem.proprietarios && !contagem.condominios && !contagem.imoveis && !r.erros.length) return { ...base, falha: r.avisos.length ? "Tudo o que está na planilha já está cadastrado. Nada novo para importar." : "Não encontrei dados. As abas precisam ter os nomes do modelo: Proprietários, Condomínios, Imóveis e Contratos." };
  if (form.get("importar") !== "1" || r.erros.length) return base;

  const { error } = await supabase.rpc("importar_carteira", {
    p: { proprietarios: r.proprietarios, condominios: r.condominios, imoveis: r.imoveis, contratos: r.contratos }, p_user: user.id,
  });
  if (error) return { ...base, falha: `Nada foi importado. ${error.message}` };
  revalidatePath("/admin", "layout");
  return { ...base, importado: true };
}
