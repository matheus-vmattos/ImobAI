-- ImobAI · Fase 1: cadastros, login e permissões
-- Proprietários → imóveis (com percentual de cada dono) → condomínio opcional.
-- Imobiliária (papel admin) vê e edita tudo; proprietário só lê o que é dele.

create extension if not exists pgcrypto;

create type papel as enum ('admin', 'proprietario');
create type status_imovel as enum ('locado', 'vazio', 'devolucao', 'indisponivel');

-- Perfil de cada login
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  papel papel not null default 'proprietario',
  nome text,
  created_at timestamptz not null default now()
);

create table proprietarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  nome text not null,
  cpf_cnpj text,
  email text,
  telefone text,
  pix text,
  dados_bancarios text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index proprietarios_email_key on proprietarios (lower(email)) where email is not null;

create table condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  cidade text,
  -- regra padrão do rateio: em quantas cotas a conta é dividida (pode ser maior que as unidades da carteira)
  cotas_padrao numeric(10, 2),
  regra_padrao text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table imoveis (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid references condominios (id) on delete set null,
  identificacao text not null,            -- "Apto 302", "Casa", "Sala 804"
  endereco text,                          -- obrigatório na prática para imóvel avulso
  tipo text,                              -- apartamento, casa, sala, loja...
  status status_imovel not null default 'vazio',
  cotas numeric(10, 2) not null default 1, -- cotas desta unidade no rateio padrão do condomínio
  aluguel_pedido numeric(12, 2),
  seguro_incendio_mensal numeric(10, 2),
  taxa_adm_pct numeric(5, 2) not null default 10,
  motivo_indisponivel text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index imoveis_condominio_idx on imoveis (condominio_id);

create table imovel_proprietarios (
  imovel_id uuid not null references imoveis (id) on delete cascade,
  proprietario_id uuid not null references proprietarios (id) on delete cascade,
  percentual numeric(5, 2) not null default 100 check (percentual > 0 and percentual <= 100),
  primary key (imovel_id, proprietario_id)
);
create index imovel_proprietarios_prop_idx on imovel_proprietarios (proprietario_id);

create table contratos (
  id uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis (id) on delete cascade,
  inquilino text not null,
  inquilino_contato text,
  aluguel numeric(12, 2) not null,
  inicio date not null,
  fim date not null,
  dia_vencimento smallint check (dia_vencimento between 1 and 31),
  ativo boolean not null default true,
  -- processo de devolução
  aviso_saida_em date,
  entrega_chaves_prevista date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim >= inicio)
);
create unique index contratos_um_ativo_por_imovel on contratos (imovel_id) where ativo;

-- updated_at automático
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger proprietarios_upd before update on proprietarios for each row execute function set_updated_at();
create trigger condominios_upd before update on condominios for each row execute function set_updated_at();
create trigger imoveis_upd before update on imoveis for each row execute function set_updated_at();
create trigger contratos_upd before update on contratos for each row execute function set_updated_at();

-- Novo login: cria o perfil e vincula ao proprietário com o mesmo e-mail
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nome) values (new.id, new.raw_user_meta_data ->> 'nome')
  on conflict (id) do nothing;
  update proprietarios set user_id = new.id
   where user_id is null and email is not null and lower(email) = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Helpers de permissão (security definer para não recursar nas políticas)
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'admin');
$$;

create function meus_imoveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ip.imovel_id
    from imovel_proprietarios ip
    join proprietarios p on p.id = ip.proprietario_id
   where p.user_id = auth.uid();
$$;

-- RLS
alter table profiles enable row level security;
alter table proprietarios enable row level security;
alter table condominios enable row level security;
alter table imoveis enable row level security;
alter table imovel_proprietarios enable row level security;
alter table contratos enable row level security;

create policy admin_all on profiles for all using (is_admin()) with check (is_admin());
create policy admin_all on proprietarios for all using (is_admin()) with check (is_admin());
create policy admin_all on condominios for all using (is_admin()) with check (is_admin());
create policy admin_all on imoveis for all using (is_admin()) with check (is_admin());
create policy admin_all on imovel_proprietarios for all using (is_admin()) with check (is_admin());
create policy admin_all on contratos for all using (is_admin()) with check (is_admin());

create policy proprio_perfil on profiles for select using (id = auth.uid());
create policy proprio_cadastro on proprietarios for select using (user_id = auth.uid());
create policy meus_vinculos on imovel_proprietarios for select using (imovel_id in (select meus_imoveis()));
create policy meus_imoveis on imoveis for select using (id in (select meus_imoveis()));
create policy meus_condominios on condominios for select
  using (id in (select condominio_id from imoveis where id in (select meus_imoveis())));
create policy meus_contratos on contratos for select using (imovel_id in (select meus_imoveis()));
