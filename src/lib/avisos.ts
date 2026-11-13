import { createServiceClient } from "@/lib/supabase/server";
import { emailsImobiliaria, emailsProprietarios, link, modelo, notificar, primeiroNome, type Mensagem } from "@/lib/email";
import { BRL, data, nomeMes } from "@/lib/format";
import { RENOVACAO_LABEL, SITUACAO_LABEL, situacao, type DecisaoRenovacao } from "@/lib/types";

/** Avisos por e-mail de cada evento. Chamados com after() depois que a ação já deu certo. */

const db = () => createServiceClient();
const cadastroDo = async (userId: string) => {
  const { data } = await db().from("proprietario_usuarios").select("proprietarios(id, nome)").eq("user_id", userId).limit(1).maybeSingle();
  return (data as unknown as { proprietarios: { id: string; nome: string } } | null)?.proprietarios ?? null;
};

/** Despesa que precisa de resposta (orçamento ou acima do limite): avisa só quem precisa decidir.
 *  O resto chega junto, no e-mail da cobrança semanal. */
export async function despesaEnviada(despesaId: string, proprietarios: string[]) {
  const { data: d } = await db().from("despesas").select("descricao, prazo, despesa_itens(proprietario_id, valor, taxa_adm)").eq("id", despesaId).single();
  if (!d) return;
  const total = new Map<string, number>();
  (d.despesa_itens as { proprietario_id: string; valor: number; taxa_adm: number }[])
    .filter((i) => proprietarios.includes(i.proprietario_id))
    .forEach((i) => total.set(i.proprietario_id, (total.get(i.proprietario_id) ?? 0) + Number(i.valor) + Number(i.taxa_adm)));
  const emails = await emailsProprietarios([...total.keys()]);
  await notificar([...total].flatMap(([pid, v]): Mensagem[] => {
    const p = emails.get(pid);
    return p ? [{
      evento: "despesa_enviada", ref: despesaId, para: p.email,
      assunto: `Nova despesa para aprovar: ${d.descricao}`,
      html: modelo(`Olá, ${primeiroNome(p.nome)}. Há uma despesa aguardando sua decisão.`, [
        `${d.descricao} — sua parte: ${BRL(v)}.`,
        d.prazo ? `Responda até ${data(d.prazo)}: descontar no repasse, reembolso ou eu mesmo pago.` : "Escolha: descontar no repasse, reembolso ou eu mesmo pago.",
      ], { texto: "Ver e responder", href: link("/portal/decidir") }),
    }] : [];
  }));
}

export async function reembolsoConfirmado(despesaId: string, proprietarioId: string) {
  const { data: d } = await db().from("despesas").select("descricao").eq("id", despesaId).single();
  const p = (await emailsProprietarios([proprietarioId])).get(proprietarioId);
  if (!d || !p) return;
  await notificar([{
    evento: "reembolso_confirmado", ref: despesaId, para: p.email,
    assunto: `Reembolso recebido: ${d.descricao}`,
    html: modelo(`Olá, ${primeiroNome(p.nome)}. Recebemos seu reembolso.`, [`A imobiliária confirmou o recebimento do reembolso de “${d.descricao}”. Nada mais a fazer.`]),
  }]);
}

/** Proprietário respondeu uma despesa ou informou reembolso: avisa a imobiliária. */
export async function respostaDespesa(despesaIds: string[], userId: string) {
  const p = await cadastroDo(userId);
  if (!p) return;
  const { data: itens } = await db().from("despesa_itens").select("despesa_id, decisao, reembolso, comentario, despesas(descricao)")
    .in("despesa_id", despesaIds).eq("proprietario_id", p.id);
  const vistos = new Set<string>();
  const linhas = ((itens ?? []) as unknown as { despesa_id: string; decisao: never; reembolso: never; comentario: string | null; despesas: { descricao: string } }[])
    .filter((i) => !vistos.has(i.despesa_id) && vistos.add(i.despesa_id))
    .map((i) => `${i.despesas.descricao}: ${SITUACAO_LABEL[situacao(i)]}${i.comentario ? ` — “${i.comentario}”` : ""}`);
  if (!linhas.length) return;
  const para = await emailsImobiliaria();
  await notificar(para.map((email) => ({
    evento: "resposta_despesa", ref: despesaIds.length === 1 ? despesaIds[0] : null, para: email,
    assunto: `${p.nome} respondeu ${linhas.length > 1 ? `${linhas.length} despesas` : "uma despesa"}`,
    html: modelo(`${p.nome} respondeu no portal.`, linhas, { texto: "Abrir despesas", href: link(despesaIds.length === 1 ? `/admin/despesas/${despesaIds[0]}` : "/admin/despesas") }),
  })));
}

/** Proprietário respondeu a renovação: avisa a imobiliária. */
export async function respostaRenovacao(contratoId: string, userId: string) {
  const p = await cadastroDo(userId);
  const { data: c } = await db().from("contratos").select("imovel_id, fim, imoveis(identificacao, condominios(nome))").eq("id", contratoId).single();
  if (!p || !c) return;
  const { data: r } = await db().from("renovacoes").select("decisao, valor_proposto, comentario").eq("contrato_id", contratoId).eq("proprietario_id", p.id).maybeSingle();
  const im = c.imoveis as unknown as { identificacao: string; condominios: { nome: string } | null };
  const onde = [im.condominios?.nome, im.identificacao].filter(Boolean).join(" · ");
  const resposta = r ? RENOVACAO_LABEL[r.decisao as DecisaoRenovacao] + (r.valor_proposto ? `: ${BRL(r.valor_proposto)}` : "") : "Resposta desfeita";
  const para = await emailsImobiliaria();
  await notificar(para.map((email) => ({
    evento: "resposta_renovacao", ref: contratoId, para: email,
    assunto: `Renovação · ${onde}: ${resposta}`,
    html: modelo(`${p.nome} respondeu sobre a renovação.`, [`${onde} — contrato até ${data(c.fim)}.`, resposta + (r?.comentario ? ` — “${r.comentario}”` : "")],
      { texto: "Abrir imóvel", href: link(`/admin/imoveis/${c.imovel_id}#renovacao`) }),
  })));
}

/** Imobiliária registrou a renovação (ou a não renovação): avisa os donos do imóvel. */
export async function renovacaoRegistrada(imovelId: string, texto: string) {
  const { data: im } = await db().from("imoveis").select("identificacao, condominios(nome), imovel_proprietarios(proprietario_id)").eq("id", imovelId).single();
  if (!im) return;
  const onde = [(im.condominios as unknown as { nome: string } | null)?.nome, im.identificacao].filter(Boolean).join(" · ");
  const emails = await emailsProprietarios((im.imovel_proprietarios as { proprietario_id: string }[]).map((x) => x.proprietario_id));
  await notificar([...emails.values()].map((p) => ({
    evento: "renovacao_registrada", ref: imovelId, para: p.email,
    assunto: `Contrato · ${onde}`,
    html: modelo(`Olá, ${primeiroNome(p.nome)}.`, [`${onde}: ${texto}`], { texto: "Ver imóvel", href: link(`/portal/imoveis/${imovelId}`) }),
  })));
}

export async function repasseFechado(repasseIds: string[]) {
  const { data: rs } = await db().from("repasses").select("id, proprietario_id, competencia, liquido").in("id", repasseIds);
  const emails = await emailsProprietarios((rs ?? []).map((r) => r.proprietario_id));
  await notificar((rs ?? []).flatMap((r): Mensagem[] => {
    const p = emails.get(r.proprietario_id);
    if (!p) return [];
    const mes = nomeMes(String(r.competencia).slice(0, 7));
    const liq = Number(r.liquido);
    return [{
      evento: "repasse_fechado", ref: r.id, para: p.email,
      assunto: `Repasse de ${mes}: ${BRL(liq)}`,
      html: modelo(`Olá, ${primeiroNome(p.nome)}. Seu repasse de ${mes} foi fechado.`, [
        liq >= 0 ? `Valor líquido a receber: ${BRL(liq)}.` : `O mês fechou negativo: ${BRL(-liq)} a pagar à imobiliária.`,
        "O relatório tem aluguel, taxa de administração, seguro e as despesas descontadas, imóvel por imóvel.",
      ], { texto: "Ver relatório", href: link(`/portal/repasses/${r.id}`) }),
    }];
  }));
}

/* ---------- cobrança semanal ---------- */

type CobrancaEmail = { id: string; pagador_id: string; total: number; vencimento: string; inicio: string; fim: string; linhas: { descricao: string; onde: string; valor: number }[] };

/** Resumo semanal: uma mensagem por cobrança, com todas as contas, o total e os dados para pagar. */
export async function cobrancasEmitidas(ids: string[]) {
  const [{ data: cs }, { data: cfg }] = await Promise.all([
    db().from("cobrancas").select("id, pagador_id, total, vencimento, inicio, fim, linhas").in("id", ids).eq("status", "aberta"),
    db().from("config").select("favorecido, banco, pix").maybeSingle(),
  ]);
  const lista = (cs ?? []) as CobrancaEmail[];
  const emails = await emailsProprietarios(lista.map((c) => c.pagador_id));
  const pagar = [cfg?.favorecido && `Favorecido: ${cfg.favorecido}`, cfg?.banco && `Conta: ${cfg.banco}`, cfg?.pix && `Pix: ${cfg.pix}`].filter(Boolean).join(" · ");
  await notificar(lista.flatMap((c): Mensagem[] => {
    const p = emails.get(c.pagador_id);
    if (!p) return [];
    return [{
      evento: "cobranca_emitida", ref: c.id, para: p.email,
      assunto: `Contas da semana ${data(c.inicio).slice(0, 5)} a ${data(c.fim).slice(0, 5)}: ${BRL(c.total)}`,
      html: modelo(`Olá, ${primeiroNome(p.nome)}. Estas são as contas da semana.`, [
        ...c.linhas.slice(0, 40).map((l) => `• ${l.descricao}${l.onde ? ` (${l.onde})` : ""}: ${BRL(l.valor)}`),
        c.linhas.length > 40 ? `… e mais ${c.linhas.length - 40} contas no portal.` : "",
        `Total: ${BRL(c.total)} · vence em ${data(c.vencimento)}.`,
        pagar ? `Para pagar: ${pagar}. Depois, envie o comprovante pelo portal.` : "Depois de pagar, envie o comprovante pelo portal.",
      ].filter(Boolean), { texto: "Ver cobrança e enviar comprovante", href: link(`/portal/cobrancas/${c.id}`) }),
    }];
  }));
}

/** Proprietário enviou comprovante: avisa a imobiliária para conferir. */
export async function pagamentoInformado(pagamentoId: string) {
  const { data: p } = await db().from("pagamentos").select("valor, forma, proprietarios(nome)").eq("id", pagamentoId).single();
  if (!p) return;
  const nome = (p.proprietarios as unknown as { nome: string }).nome;
  const para = await emailsImobiliaria();
  await notificar(para.map((email) => ({
    evento: "pagamento_informado", ref: pagamentoId, para: email,
    assunto: `${nome} enviou comprovante de ${BRL(p.valor)}`,
    html: modelo(`${nome} informou um pagamento.`, [`Valor informado: ${BRL(p.valor)}. Confira no extrato do banco e confirme.`],
      { texto: "Conferir pagamento", href: link(`/admin/cobrancas/pagamento/${pagamentoId}`) }),
  })));
}

export async function pagamentoConfirmado(pagamentoId: string) {
  const { data: p } = await db().from("pagamentos").select("pagador_id, valor_confirmado, informado_por").eq("id", pagamentoId).single();
  if (!p || p.informado_por !== "proprietario") return;
  const pr = (await emailsProprietarios([p.pagador_id])).get(p.pagador_id);
  if (!pr) return;
  await notificar([{
    evento: "pagamento_confirmado", ref: pagamentoId, para: pr.email,
    assunto: `Pagamento recebido: ${BRL(p.valor_confirmado)}`,
    html: modelo(`Olá, ${primeiroNome(pr.nome)}. Recebemos seu pagamento.`, [`Valor: ${BRL(p.valor_confirmado)}. O extrato já está atualizado.`],
      { texto: "Ver extrato", href: link("/portal/extrato") }),
  }]);
}

export async function pagamentoRecusado(pagamentoId: string) {
  const { data: p } = await db().from("pagamentos").select("pagador_id, valor, motivo_recusa").eq("id", pagamentoId).single();
  if (!p) return;
  const pr = (await emailsProprietarios([p.pagador_id])).get(p.pagador_id);
  if (!pr) return;
  await notificar([{
    evento: "pagamento_recusado", ref: pagamentoId, para: pr.email,
    assunto: "Não conseguimos confirmar seu pagamento",
    html: modelo(`Olá, ${primeiroNome(pr.nome)}.`, [`O comprovante de ${BRL(p.valor)} não pôde ser confirmado: ${p.motivo_recusa ?? "não encontramos o valor no extrato"}.`, "Se já pagou, envie outro comprovante pelo portal."],
      { texto: "Abrir o portal", href: link("/portal/extrato") }),
  }]);
}
