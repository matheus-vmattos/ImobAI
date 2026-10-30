-- Dados de exemplo (opcional). Rode no SQL Editor do Supabase depois da migração.
-- Para dar acesso ao Carlos, crie o login dele com o e-mail carlos@exemplo.com: o vínculo é automático.

insert into proprietarios (id, nome, email, telefone, pix) values
  ('a0000000-0000-0000-0000-000000000001', 'Carlos Menezes', 'carlos@exemplo.com', '(51) 99999-0001', 'carlos@exemplo.com'),
  ('a0000000-0000-0000-0000-000000000002', 'Ana Ribeiro', 'ana@exemplo.com', '(51) 99999-0002', null);

insert into condominios (id, nome, endereco, cidade, cotas_padrao, regra_padrao) values
  ('c0000000-0000-0000-0000-000000000001', 'Cond. Manoel de Souza 48', 'Rua Manoel de Souza, 48', 'Porto Alegre', 12, '10 aptos + 2 lojas que não são da carteira'),
  ('c0000000-0000-0000-0000-000000000002', 'Residencial Jardins', 'Rua das Acácias, 310', 'Porto Alegre', 16, '16 casas, cotas iguais');

insert into imoveis (id, condominio_id, identificacao, endereco, tipo, status, aluguel_pedido, seguro_incendio_mensal, motivo_indisponivel) values
  ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Apto 102', null, 'Apartamento', 'locado', 2200, 19.90, null),
  ('b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Apto 302', null, 'Apartamento', 'locado', 2350, 19.90, null),
  ('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Apto 401', null, 'Apartamento', 'devolucao', 2300, 19.90, null),
  ('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Apto 402', null, 'Apartamento', 'vazio', 2300, 19.90, null),
  ('b0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Casa 03', null, 'Casa', 'locado', 2750, 22, null),
  ('b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Casa 05', null, 'Casa', 'indisponivel', 2800, 22, 'Em reforma até jan/2027'),
  ('b0000000-0000-0000-0000-000000000007', null, 'Casa', 'Rua Padre Chagas, 215', 'Casa', 'vazio', 2900, 32, null),
  ('b0000000-0000-0000-0000-000000000008', null, 'Loja', 'Av. Nilópolis, 455', 'Loja', 'locado', 6500, 54, null);

insert into imovel_proprietarios (imovel_id, proprietario_id, percentual) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 100),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 50),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 50);

insert into contratos (imovel_id, inquilino, aluguel, inicio, fim, dia_vencimento, aviso_saida_em, entrega_chaves_prevista) values
  ('b0000000-0000-0000-0000-000000000001', 'Juliana Prates', 2200, '2024-04-01', '2027-03-31', 5, null, null),
  ('b0000000-0000-0000-0000-000000000002', 'Beatriz Lemos', 2350, '2024-12-16', '2026-12-15', 10, null, null),
  ('b0000000-0000-0000-0000-000000000003', 'Otávio Reis', 2300, '2024-06-01', '2027-05-31', 5, '2026-10-21', '2026-11-20'),
  ('b0000000-0000-0000-0000-000000000005', 'Gustavo Rocha', 2750, '2024-02-01', '2027-01-31', 10, null, null),
  ('b0000000-0000-0000-0000-000000000008', 'Farmácia Bem Viver', 6500, '2023-01-01', '2027-12-31', 5, null, null);
