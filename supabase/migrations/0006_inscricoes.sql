-- ImobAI · Inscrição de IPTU e nº de cliente de energia e água.
-- Normalmente são do condomínio inteiro; o imóvel só preenche quando tem o próprio.

alter table condominios
  add column iptu_inscricao text,
  add column energia_cliente text,
  add column agua_cliente text;

alter table imoveis
  add column iptu_inscricao text,
  add column energia_cliente text,
  add column agua_cliente text;
