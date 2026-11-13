export type Papel = "admin" | "proprietario";
export type StatusImovel = "locado" | "vazio" | "devolucao" | "indisponivel";

export const STATUS_LABEL: Record<StatusImovel, string> = {
  locado: "Locado",
  vazio: "Vazio",
  devolucao: "Em devolução",
  indisponivel: "Indisponível",
};
export const STATUS_ORDEM: StatusImovel[] = ["locado", "devolucao", "vazio", "indisponivel"];

export type Proprietario = {
  id: string;
  user_id: string | null;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  pix: string | null;
  dados_bancarios: string | null;
  observacoes: string | null;
  pagador_id: string | null;
  forma_padrao: "cobranca" | "repasse";
  aprova_ate: number;
  desconta_vencidas: boolean;
};

export type Condominio = {
  id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  cotas_padrao: number | null;
  regra_padrao: string | null;
  observacoes: string | null;
  iptu_inscricao: string | null;
  energia_cliente: string | null;
  agua_cliente: string | null;
};

export type Imovel = {
  id: string;
  condominio_id: string | null;
  identificacao: string;
  endereco: string | null;
  tipo: string | null;
  status: StatusImovel;
  cotas: number;
  aluguel_pedido: number | null;
  seguro_incendio_mensal: number | null;
  taxa_adm_pct: number;
  motivo_indisponivel: string | null;
  observacoes: string | null;
  condominio_pago_por: "imobiliaria" | "proprietario";
  iptu_inscricao: string | null;
  energia_cliente: string | null;
  agua_cliente: string | null;
  codigo_externo: string | null;
};

export type Contrato = {
  id: string;
  imovel_id: string;
  inquilino: string;
  inquilino_contato: string | null;
  aluguel: number;
  inicio: string;
  fim: string;
  dia_vencimento: number | null;
  ativo: boolean;
  aviso_saida_em: string | null;
  entrega_chaves_prevista: string | null;
  observacoes: string | null;
  datas_a_conferir: boolean;
};

export type ImovelProprietario = { imovel_id: string; proprietario_id: string; percentual: number };

/* ---------- fase 2: despesas ---------- */
export type TipoDespesa = "fixa" | "variavel" | "iptu" | "seguro_incendio" | "manutencao" | "extra" | "condominio" | "condominio_extra";
export const TIPO_LABEL: Record<TipoDespesa, string> = {
  fixa: "Fixa", variavel: "Variável", iptu: "IPTU", seguro_incendio: "Seguro incêndio", manutencao: "Manutenção", extra: "Extra",
  condominio: "Condomínio (ordinário)", condominio_extra: "Condomínio (extraordinário)",
};
export type Decisao = "desconto" | "reembolso" | "proprio";
export type StatusReembolso = "pendente" | "informado" | "confirmado";

/** Situação de um item para exibição (pílula). */
export type Situacao = "aguardando" | "desconto" | "reembolso" | "reembolso-informado" | "reembolso-confirmado" | "proprio" | "cobrada" | "paga" | "inquilino" | "direto";
export const SITUACAO_LABEL: Record<Situacao, string> = {
  aguardando: "Aguardando resposta",
  desconto: "Descontar no repasse",
  reembolso: "Entra na cobrança semanal",
  cobrada: "Na cobrança semanal",
  paga: "Paga",
  inquilino: "Do inquilino",
  direto: "Pago direto pelo proprietário",
  "reembolso-informado": "Reembolso · aguardando confirmação",
  "reembolso-confirmado": "Reembolso · confirmado",
  proprio: "Eu mesmo pago",
};
export const situacao = (i: {
  decisao: Decisao | null; reembolso: StatusReembolso | null; responsavel?: string;
  cobranca_id?: string | null; cobrancas?: { status: string } | null;
}): Situacao =>
  i.responsavel === "inquilino" ? "inquilino"
    : i.responsavel === "direto" ? "direto"
    : !i.decisao ? "aguardando"
    : i.decisao === "reembolso" && i.cobranca_id ? (i.cobrancas?.status === "paga" ? "paga" : "cobrada")
    : i.decisao !== "reembolso" ? i.decisao
    : i.reembolso === "confirmado" ? "reembolso-confirmado"
    : i.reembolso === "informado" ? "reembolso-informado" : "reembolso";

/* ---------- fase 3: renovação ---------- */
export type DecisaoRenovacao = "atual" | "novo_valor" | "nao_renovar";
export const RENOVACAO_LABEL: Record<DecisaoRenovacao, string> = {
  atual: "Renovar pelo valor atual",
  novo_valor: "Novo valor proposto",
  nao_renovar: "Não renovar",
};
export type Renovacao = {
  contrato_id: string;
  proprietario_id: string;
  decisao: DecisaoRenovacao;
  valor_proposto: number | null;
  comentario: string | null;
  respondido_em: string;
  concluida_em: string | null;
};
