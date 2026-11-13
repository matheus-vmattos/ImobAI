-- ImobAI · Conta corrente do proprietário (cobrança semanal), aluguéis recebidos,
-- despesas recorrentes, terceiros fora da carteira e vários logins por proprietário.

-- Novos tipos de conta (antes de qualquer uso: ALTER TYPE ... ADD VALUE)
alter type tipo_despesa add value if not exists 'condominio';
alter type tipo_despesa add value if not exists 'condominio_extra';

/* ---------- configuração da imobiliária (uma linha) ---------- */
create table config (
  id boolean primary key default true check (id),
  favorecido text,
  banco text,                         -- "Itaú · ag 0000 · cc 00000-0"
  pix text,
  abono_ate numeric(12, 2) not null default 5,       -- diferença abonada automaticamente
  cobranca_dia smallint not null default 1 check (cobranca_dia between 0 and 6),  -- 1 = segunda
  cobranca_prazo smallint not null default 7         -- dias para pagar
);
insert into config default values;

/* ---------- vários logins por proprietário e pagador do grupo ---------- */
create table proprietario_usuarios (
  proprietario_id uuid not null references proprietarios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (proprietario_id, user_id)
);
create index proprietario_usuarios_user_idx on proprietario_usuarios (user_id);
insert into proprietario_usuarios (proprietario_id, user_id)
  select id, user_id from proprietarios where user_id is not null;

-- e-mails extras com acesso ao mesmo cadastro (cônjuge, contador, sócio)
create table proprietario_acessos (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references proprietarios (id) on delete cascade,
  email text not null,
  nome text,
  created_at timestamptz not null default now()
);
create unique index proprietario_acessos_email_key on proprietario_acessos (proprietario_id, lower(email));

alter table proprietarios
  add column pagador_id uuid references proprietarios (id) on delete set null,   -- quem paga as cobranças deste proprietário
  add column forma_padrao text not null default 'cobranca' check (forma_padrao in ('cobranca', 'repasse')),
  add column aprova_ate numeric(12, 2) not null default 300,                      -- contas até este valor não pedem aprovação
  add column desconta_vencidas boolean not null default true,                     -- cobrança vencida sai do repasse
  add constraint pagador_nao_e_si_mesmo check (pagador_id is null or pagador_id <> id);

-- vincula logins aos cadastros pelo e-mail (principal ou extra)
create function vincular_usuario(p_user uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_email is null then return; end if;
  update proprietarios set user_id = p_user where user_id is null and lower(email) = lower(p_email);
  insert into proprietario_usuarios (proprietario_id, user_id)
    select id, p_user from proprietarios where lower(email) = lower(p_email)
    union
    select proprietario_id, p_user from proprietario_acessos where lower(email) = lower(p_email)
  on conflict do nothing;
end $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome) values (new.id, new.raw_user_meta_data ->> 'nome') on conflict (id) do nothing;
  perform vincular_usuario(new.id, new.email);
  return new;
end $$;

-- acesso extra cadastrado para alguém que já tem login: vincula na hora
create function acesso_vincular() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into proprietario_usuarios (proprietario_id, user_id)
    select new.proprietario_id, u.id from auth.users u where lower(u.email) = lower(new.email)
  on conflict do nothing;
  return new;
end $$;
create trigger proprietario_acessos_vincular after insert on proprietario_acessos for each row execute function acesso_vincular();

-- acesso extra removido: desfaz o vínculo do login com esse e-mail (exceto se for o e-mail principal)
create function acesso_desvincular() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from proprietario_usuarios pu
   using auth.users u
   where pu.proprietario_id = old.proprietario_id and pu.user_id = u.id and lower(u.email) = lower(old.email)
     and not exists (select 1 from proprietarios p where p.id = old.proprietario_id and lower(p.email) = lower(old.email));
  return old;
end $$;
create trigger proprietario_acessos_desvincular after delete on proprietario_acessos for each row execute function acesso_desvincular();

create or replace function meus_proprietarios() returns setof uuid
language sql stable security definer set search_path = public as $$
  select proprietario_id from proprietario_usuarios where user_id = auth.uid();
$$;

create or replace function meus_imoveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ip.imovel_id from imovel_proprietarios ip
   where ip.proprietario_id in (select proprietario_id from proprietario_usuarios where user_id = auth.uid());
$$;

-- grupos que o login paga: o próprio cadastro e os que apontam para ele como pagador
create function meus_pagadores() returns setof uuid
language sql stable security definer set search_path = public as $$
  select proprietario_id from proprietario_usuarios where user_id = auth.uid();
$$;

drop policy proprio_cadastro on proprietarios;
create policy proprio_cadastro on proprietarios for select
  using (id in (select meus_proprietarios()) or pagador_id in (select meus_proprietarios()));

/* ---------- quem paga cada conta ---------- */
alter table imoveis
  add column condominio_pago_por text not null default 'imobiliaria' check (condominio_pago_por in ('imobiliaria', 'proprietario'));

alter table despesas
  add column requer_aprovacao boolean not null default false,   -- orçamento: o proprietário aprova antes
  add column unidades jsonb,                                      -- quantidades usadas no rateio (para completar rascunhos)
  add column recorrente_id uuid,
  add column competencia_mes date;                                -- mês da conta recorrente
alter table despesas drop constraint despesas_valor_total_check;
alter table despesas add constraint despesas_valor_total_check check (valor_total > 0 or status = 'rascunho');

alter table despesa_itens
  add column responsavel text not null default 'proprietario' check (responsavel in ('proprietario', 'inquilino', 'direto')),
  add column decidido_auto boolean not null default false,
  add column cobranca_id uuid;

/* ---------- aluguel recebido do inquilino ---------- */
create table alugueis (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  vencimento date not null,
  valor numeric(12, 2) not null,
  recebido_em date,
  valor_recebido numeric(12, 2) check (valor_recebido >= 0),
  observacao text,
  unique (contrato_id, competencia)
);

/* ---------- cobrança semanal e pagamentos ---------- */
create table ajustes (
  id uuid primary key default gen_random_uuid(),
  pagador_id uuid not null references proprietarios (id) on delete cascade,
  descricao text not null,
  valor numeric(12, 2) not null check (valor <> 0),   -- positivo: proprietário deve; negativo: crédito
  despesa_item_id uuid references despesa_itens (id) on delete set null,
  cobranca_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table cobrancas (
  id uuid primary key default gen_random_uuid(),
  pagador_id uuid not null references proprietarios (id) on delete restrict,
  emitida_em timestamptz not null default now(),
  inicio date not null,
  fim date not null,
  vencimento date not null,
  total numeric(12, 2) not null,
  linhas jsonb not null,            -- foto fixa do que foi cobrado
  pago numeric(12, 2) not null default 0,
  abonado numeric(12, 2) not null default 0,
  descontado numeric(12, 2) not null default 0,  -- saiu do repasse
  repasse_id uuid references repasses (id) on delete set null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  quitada_em timestamptz
);
create index cobrancas_pagador_idx on cobrancas (pagador_id, status);
alter table despesa_itens add constraint despesa_itens_cobranca_fk foreign key (cobranca_id) references cobrancas (id) on delete set null;
alter table ajustes add constraint ajustes_cobranca_fk foreign key (cobranca_id) references cobrancas (id) on delete set null;

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  pagador_id uuid not null references proprietarios (id) on delete restrict,
  valor numeric(12, 2) not null check (valor > 0),          -- informado
  data date not null,
  forma text not null check (forma in ('deposito', 'pix', 'transferencia', 'outro')),
  comprovantes text[] not null default '{}',
  observacao text,
  informado_por text not null check (informado_por in ('proprietario', 'imobiliaria')),
  status text not null default 'informado' check (status in ('informado', 'confirmado', 'recusado')),
  valor_confirmado numeric(12, 2),
  confirmado_em timestamptz,
  motivo_recusa text,
  created_at timestamptz not null default now()
);
create index pagamentos_pagador_idx on pagamentos (pagador_id, status);

create table alocacoes (
  pagamento_id uuid not null references pagamentos (id) on delete cascade,
  cobranca_id uuid not null references cobrancas (id) on delete cascade,
  valor numeric(12, 2) not null check (valor > 0),
  primary key (pagamento_id, cobranca_id)
);

/* ---------- despesas recorrentes ---------- */
create table recorrentes (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid references condominios (id) on delete cascade,
  imovel_id uuid references imoveis (id) on delete cascade,
  tipo tipo_despesa not null default 'fixa',
  descricao text not null,
  valor numeric(12, 2) check (valor > 0),       -- vazio: valor muda todo mês (entra como rascunho)
  regra regra_rateio not null default 'cotas',
  divisor numeric(10, 2),
  unidades jsonb,                                -- [{ "imovelId": "...", "quantidade": 1 }]
  cobra_taxa_adm boolean not null default false,
  dia smallint not null default 5 check (dia between 1 and 28),
  ativo boolean not null default true,
  ultimo_mes date,
  created_at timestamptz not null default now(),
  check ((condominio_id is null) <> (imovel_id is null))
);
alter table despesas add constraint despesas_recorrente_fk foreign key (recorrente_id) references recorrentes (id) on delete set null;

/* ---------- terceiros (unidades fora da carteira) ---------- */
create table terceiros (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references condominios (id) on delete cascade,
  nome text not null,
  contato text,
  cotas numeric(10, 2) not null default 1 check (cotas > 0)
);
create table despesa_terceiros (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references despesas (id) on delete cascade,
  terceiro_id uuid references terceiros (id) on delete set null,
  nome text not null,
  valor numeric(12, 2) not null,
  recebido_em date
);

/* ---------- RLS ---------- */
alter table config enable row level security;
alter table proprietario_usuarios enable row level security;
alter table proprietario_acessos enable row level security;
alter table alugueis enable row level security;
alter table ajustes enable row level security;
alter table cobrancas enable row level security;
alter table pagamentos enable row level security;
alter table alocacoes enable row level security;
alter table recorrentes enable row level security;
alter table terceiros enable row level security;
alter table despesa_terceiros enable row level security;

create policy admin_all on config for all using (is_admin()) with check (is_admin());
create policy ler_config on config for select using (auth.uid() is not null);
create policy admin_all on proprietario_usuarios for all using (is_admin()) with check (is_admin());
create policy meus_vinculos on proprietario_usuarios for select using (user_id = auth.uid());
create policy admin_all on proprietario_acessos for all using (is_admin()) with check (is_admin());
create policy admin_all on alugueis for all using (is_admin()) with check (is_admin());
create policy meus_alugueis on alugueis for select
  using (contrato_id in (select id from contratos where imovel_id in (select meus_imoveis())));
create policy admin_all on ajustes for all using (is_admin()) with check (is_admin());
create policy meus_ajustes on ajustes for select using (pagador_id in (select meus_pagadores()));
create policy admin_all on cobrancas for all using (is_admin()) with check (is_admin());
create policy minhas_cobrancas on cobrancas for select using (pagador_id in (select meus_pagadores()));
create policy admin_all on pagamentos for all using (is_admin()) with check (is_admin());
create policy meus_pagamentos on pagamentos for select using (pagador_id in (select meus_pagadores()));
create policy admin_all on alocacoes for all using (is_admin()) with check (is_admin());
create policy minhas_alocacoes on alocacoes for select
  using (pagamento_id in (select id from pagamentos where pagador_id in (select meus_pagadores())));
create policy admin_all on recorrentes for all using (is_admin()) with check (is_admin());
create policy admin_all on terceiros for all using (is_admin()) with check (is_admin());
create policy admin_all on despesa_terceiros for all using (is_admin()) with check (is_admin());

-- bucket privado para comprovantes de pagamento
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false) on conflict (id) do nothing;
  end if;
end $$;
