import { NextResponse, type NextRequest } from "next/server";
import { emailsProprietarios, link, modelo, notificar, primeiroNome, type Mensagem } from "@/lib/email";
import { BRL0, data, diasAte, RENOVACAO_DIAS } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import { rotinaDiaria } from "@/lib/rotinas";

/**
 * Lembretes diários (Vercel Cron chama com Authorization: Bearer CRON_SECRET).
 * - renovação: contrato entrou nos últimos 90 dias e o proprietário ainda não respondeu (um aviso por contrato)
 * - despesa: prazo de resposta venceu e o proprietário não respondeu (um aviso por despesa)
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  const db = createServiceClient();
  const rotina = await rotinaDiaria(db);
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + RENOVACAO_DIAS * 864e5).toISOString().slice(0, 10);

  const [{ data: contratos }, { data: itens }, { data: jaAvisados }] = await Promise.all([
    db.from("contratos").select("id, imovel_id, aluguel, fim, imoveis!inner(identificacao, status, condominios(nome), imovel_proprietarios(proprietario_id)), renovacoes(proprietario_id)")
      .eq("ativo", true).eq("imoveis.status", "locado").lte("fim", limite),
    db.from("despesa_itens").select("despesa_id, proprietario_id, despesas!inner(descricao, prazo, status)")
      .is("decisao", null).eq("despesas.status", "enviada").lt("despesas.prazo", hoje),
    db.from("notificacoes").select("evento, ref, para").in("evento", ["lembrete_renovacao", "lembrete_despesa"]),
  ]);
  const avisado = new Set((jaAvisados ?? []).map((n) => `${n.evento}|${n.ref}|${n.para}`));

  type C = { id: string; imovel_id: string; aluguel: number; fim: string; renovacoes: { proprietario_id: string }[];
    imoveis: { identificacao: string; condominios: { nome: string } | null; imovel_proprietarios: { proprietario_id: string }[] } };
  type I = { despesa_id: string; proprietario_id: string; despesas: { descricao: string; prazo: string } };
  const cs = (contratos ?? []) as unknown as C[];
  const is = (itens ?? []) as unknown as I[];
  const emails = await emailsProprietarios([...new Set([
    ...cs.flatMap((c) => c.imoveis.imovel_proprietarios.map((x) => x.proprietario_id)), ...is.map((i) => i.proprietario_id),
  ])]);

  const msgs: Mensagem[] = [];
  for (const c of cs) {
    const onde = [c.imoveis.condominios?.nome, c.imoveis.identificacao].filter(Boolean).join(" · ");
    for (const { proprietario_id } of c.imoveis.imovel_proprietarios) {
      const p = emails.get(proprietario_id);
      if (!p || c.renovacoes.some((r) => r.proprietario_id === proprietario_id) || avisado.has(`lembrete_renovacao|${c.id}|${p.email}`)) continue;
      msgs.push({ evento: "lembrete_renovacao", ref: c.id, para: p.email, assunto: `Renovação: ${onde} vence em ${data(c.fim)}`,
        html: modelo(`Olá, ${primeiroNome(p.nome)}. Um contrato está perto do fim.`, [
          `${onde} — aluguel de ${BRL0(c.aluguel)}, vence em ${data(c.fim)} (${diasAte(c.fim)} dias).`,
          "Diga se quer renovar pelo valor atual, propor um novo valor ou não renovar.",
        ], { texto: "Responder", href: link(`/portal/imoveis/${c.imovel_id}#renovacoes`) }) });
    }
  }
  const porDespesa = new Map<string, I>();
  is.forEach((i) => porDespesa.set(`${i.despesa_id}|${i.proprietario_id}`, i));
  for (const i of porDespesa.values()) {
    const p = emails.get(i.proprietario_id);
    if (!p || avisado.has(`lembrete_despesa|${i.despesa_id}|${p.email}`)) continue;
    msgs.push({ evento: "lembrete_despesa", ref: i.despesa_id, para: p.email, assunto: `Despesa sem resposta: ${i.despesas.descricao}`,
      html: modelo(`Olá, ${primeiroNome(p.nome)}. Uma despesa ainda espera sua decisão.`, [
        `${i.despesas.descricao} — o prazo era ${data(i.despesas.prazo)}.`,
      ], { texto: "Responder", href: link("/portal#pendencias") }) });
  }
  await notificar(msgs);
  return NextResponse.json({ enviados: msgs.length, ...rotina });
}
