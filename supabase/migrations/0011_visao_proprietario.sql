-- ImobAI · Visão do proprietário para a imobiliária + aluguel sem controle de pago/atrasado

-- Recebimento do aluguel fica no ERP da imobiliária: por padrão, o portal mostra só o valor do aluguel
-- e o repasse usa o valor do contrato. Ligando, volta o controle de pago/atrasado.
alter table config add column controla_alugueis boolean not null default false;

/* ---------- "ver como" ----------
   O servidor do portal manda o cabeçalho x-ver-como (id de um proprietário) quando um admin abre a visão do proprietário.
   Só vale para quem é admin de verdade. Enquanto isso, o admin perde os poderes de admin nas regras de acesso
   e enxerga exatamente o que aquele proprietário (e o grupo do login dele) enxerga. */
create function ver_como() returns uuid language plpgsql stable security definer set search_path = public as $$
declare h text;
begin
  h := nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-ver-como', '');
  if h is null then return null; end if;
  if not exists (select 1 from profiles where id = auth.uid() and papel = 'admin') then return null; end if;
  return h::uuid;
exception when others then return null;
end $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and papel = 'admin') and ver_como() is null;
$$;

-- cadastros do login: os vinculados ao usuário; na visão do proprietário, os do login daquele proprietário
create function meus_cadastros() returns setof uuid
language sql stable security definer set search_path = public as $$
  select proprietario_id from proprietario_usuarios where user_id = auth.uid() and ver_como() is null
  union
  select ver_como() where ver_como() is not null
  union
  select b.proprietario_id from proprietario_usuarios a join proprietario_usuarios b on b.user_id = a.user_id
   where ver_como() is not null and a.proprietario_id = ver_como();
$$;

create or replace function meus_proprietarios() returns setof uuid
language sql stable security definer set search_path = public as $$ select meus_cadastros(); $$;

create or replace function meus_pagadores() returns setof uuid
language sql stable security definer set search_path = public as $$ select meus_cadastros(); $$;

create or replace function meus_imoveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ip.imovel_id from imovel_proprietarios ip where ip.proprietario_id in (select meus_cadastros());
$$;

revoke all on function ver_como(), meus_cadastros() from public, anon;
grant execute on function ver_como(), meus_cadastros() to authenticated;
