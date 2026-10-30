-- ImobAI · Fase 4: relatório de repasse e notificações por e-mail

-- Repasse mensal fechado pela imobiliária, um por proprietário e mês.
-- As linhas ficam congeladas em `linhas` para o relatório não mudar se o cadastro mudar depois.
create table repasses (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references proprietarios (id) on delete restrict,
  competencia date not null check (extract(day from competencia) = 1),   -- primeiro dia do mês
  aluguel numeric(12, 2) not null default 0,
  taxa_adm numeric(12, 2) not null default 0,
  seguro numeric(12, 2) not null default 0,
  despesas numeric(12, 2) not null default 0,
  liquido numeric(12, 2) not null,
  linhas jsonb not null default '[]',
  observacoes text,
  fechado_em timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (proprietario_id, competencia)
);

-- despesa marcada "descontar no repasse" aponta para o repasse em que entrou
alter table despesa_itens add column repasse_id uuid references repasses (id) on delete set null;
create index despesa_itens_repasse_idx on despesa_itens (repasse_id);

alter table repasses enable row level security;
create policy admin_all on repasses for all using (is_admin()) with check (is_admin());
create policy meus_repasses on repasses for select using (proprietario_id in (select meus_proprietarios()));

-- Caixa de saída de e-mails (registro de tudo que foi enviado ou tentado)
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  evento text not null,             -- despesa_enviada, reembolso_confirmado, repasse_fechado, lembrete_renovacao...
  ref uuid,                         -- despesa, contrato ou repasse relacionado
  para text not null,
  assunto text not null,
  html text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro', 'sem_provedor')),
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index notificacoes_ref_idx on notificacoes (evento, ref);

alter table notificacoes enable row level security;
create policy admin_all on notificacoes for all using (is_admin()) with check (is_admin());

-- E-mails dos logins da imobiliária (só o servidor, com a service role, chama)
create function emails_admin() returns setof text
language sql stable security definer set search_path = public as $$
  select u.email::text from auth.users u join profiles p on p.id = u.id where p.papel = 'admin' and u.email is not null;
$$;
revoke all on function emails_admin() from public, anon, authenticated;
grant execute on function emails_admin() to service_role;
