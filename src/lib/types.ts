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
};

export type Condominio = {
  id: string;
  nome: string;
  endereco: string | null;
  cidade: string | null;
  cotas_padrao: number | null;
  regra_padrao: string | null;
  observacoes: string | null;
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
};

export type ImovelProprietario = { imovel_id: string; proprietario_id: string; percentual: number };
