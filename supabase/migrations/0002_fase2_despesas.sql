-- ImobAI · Fase 2: despesas, rateio e aprovação pelo proprietário
-- Uma despesa (conta) é lançada num condomínio (rateio) ou num imóvel avulso.
-- Cada proprietário atingido recebe um item com a parte dele e decide:
-- descontar no repasse, reembolso (que a imobiliária confirma) ou eu mesmo pago.

create type tipo_despesa as enum ('fixa', 'variavel', 'iptu', 'seguro_incendio', 'manutencao', 'extra');
create type regra_rateio as enum ('cotas', 'percentual', 'fixo', 'integral');
create type status_despesa as enum ('rascunho', 'enviada');
create type decisao_despesa as enum ('desconto', 'reembolso', 'proprio');
create type status_reembolso as enum ('pendente', 'informado', 'confirmado');

create table despesas (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid references condominios (id) on delete restrict,
  imovel_id uuid references imoveis (id) on delete restrict,       -- lançamento avulso
  tipo tipo_despesa not null default 'variavel',
  descricao text not null,
  competencia text,                                                  -- "Out/2026"
  valor_total numeric(12, 2) not null check (valor_total > 0),
  regra regra_rateio not null,
  divisor numeric(10, 2),                                            -- total de cotas (regra cotas)
  valor_fora numeric(12, 2) not null default 0,                      -- parte de unidades fora da carteira
  cobra_taxa_adm boolean not null default false,
  pdf_path text,
  prazo date,
  status status_despesa not null default 'rascunho',
  enviada_em timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((condominio_id is null) <> (imovel_id is null))
);
create index despesas_condominio_idx on despesas (condominio_id);

create table despesa_itens (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references despesas (id) on delete cascade,
  imovel_id uuid not null references imoveis (id) on delete restrict,
  proprietario_id uuid not null references proprietarios (id) on delete restrict,
  cotas numeric(12, 4),             -- o que foi informado para a unidade (cotas, % ou valor fixo)
  percentual_dono numeric(5, 2) not null default 100,
  valor numeric(12, 2) not null,    -- parte do proprietário, sem taxa
  taxa_adm numeric(12, 2) not null default 0,
  decisao decisao_despesa,
  comentario text,
  respondido_em timestamptz,
  reembolso status_reembolso,
  reembolso_informado_em timestamptz,
  reembolso_confirmado_em timestamptz,
  repassado_em timestamptz,         -- preenchido quando o desconto entrar num repasse (fase 4)
  unique (despesa_id, imovel_id, proprietario_id)
);
create index despesa_itens_prop_idx on despesa_itens (proprietario_id);

-- RLS
alter table despesas enable row level security;
alter table despesa_itens enable row level security;

create policy admin_all on despesas for all using (is_admin()) with check (is_admin());
create policy admin_all on despesa_itens for all using (is_admin()) with check (is_admin());

create function meus_proprietarios() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from proprietarios where user_id = auth.uid();
$$;

-- despesas enviadas em que o proprietário logado tem item (security definer evita recursão entre as políticas)
create function minhas_despesas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct i.despesa_id
    from despesa_itens i join despesas d on d.id = i.despesa_id
   where d.status = 'enviada' and i.proprietario_id in (select meus_proprietarios());
$$;

create policy meus_itens on despesa_itens for select
  using (proprietario_id in (select meus_proprietarios()) and despesa_id in (select minhas_despesas()));
create policy minhas_despesas on despesas for select using (id in (select minhas_despesas()));

-- Ações do proprietário: só por estas funções, que conferem dono e estado.

/** Decide (ou desfaz, com p_decisao nulo) todos os itens do proprietário numa despesa. */
create function responder_despesa(p_despesa uuid, p_decisao decisao_despesa, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from despesa_itens
              where despesa_id = p_despesa and proprietario_id in (select meus_proprietarios())
                and reembolso = 'confirmado') then
    raise exception 'Reembolso já confirmado pela imobiliária; a resposta não pode mais ser alterada.';
  end if;
  update despesa_itens i
     set decisao = p_decisao,
         comentario = coalesce(nullif(trim(p_comentario), ''), case when p_decisao is null then null else i.comentario end),
         respondido_em = case when p_decisao is null then null else now() end,
         reembolso = case when p_decisao = 'reembolso' then 'pendente'::status_reembolso end,
         reembolso_informado_em = null
   where i.despesa_id = p_despesa
     and i.proprietario_id in (select meus_proprietarios())
     and exists (select 1 from despesas d where d.id = p_despesa and d.status = 'enviada');
  if not found then raise exception 'Despesa não encontrada.'; end if;
end $$;

/** Proprietário informa que fez (ou não) o reembolso. */
create function informar_reembolso(p_despesa uuid, p_concluido boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update despesa_itens
     set reembolso = case when p_concluido then 'informado' else 'pendente' end::status_reembolso,
         reembolso_informado_em = case when p_concluido then now() end
   where despesa_id = p_despesa
     and proprietario_id in (select meus_proprietarios())
     and decisao = 'reembolso'
     and reembolso in ('pendente', 'informado');
  if not found then raise exception 'Nada a atualizar nesta despesa.'; end if;
end $$;

revoke all on function responder_despesa(uuid, decisao_despesa, text) from public;
revoke all on function informar_reembolso(uuid, boolean) from public;
grant execute on function responder_despesa(uuid, decisao_despesa, text) to authenticated;
grant execute on function informar_reembolso(uuid, boolean) to authenticated;

-- Bucket privado para os PDFs (no Supabase; ignorado onde não há Storage)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('despesas', 'despesas', false)
    on conflict (id) do nothing;
  end if;
end $$;
