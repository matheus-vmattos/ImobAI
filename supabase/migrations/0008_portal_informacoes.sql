-- ImobAI · Informações que faltavam ao proprietário

-- Desde quando o imóvel está na situação atual (para "vago há N dias")
alter table imoveis add column status_desde date not null default hoje_sp();
update imoveis set status_desde = created_at::date;

create function marcar_status_desde() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then new.status_desde := hoje_sp(); end if;
  return new;
end $$;
create trigger imoveis_status_desde before update on imoveis for each row execute function marcar_status_desde();

-- Sócio cujas contas são pagas por outro cadastro: ele não vê a cobrança (é do pagador),
-- mas precisa saber se a parte dele foi paga e por quem.
create function minhas_contas_cobradas()
returns table (cobranca_id uuid, status text, quitada_em timestamptz, pagador text, eh_meu boolean)
language sql stable security definer set search_path = public as $$
  select distinct c.id, c.status, c.quitada_em, p.nome, c.pagador_id in (select meus_proprietarios())
    from despesa_itens i
    join cobrancas c on c.id = i.cobranca_id
    join proprietarios p on p.id = c.pagador_id
   where i.proprietario_id in (select meus_proprietarios());
$$;

-- Quem paga as contas de cada cadastro meu (quando não sou eu)
create function meus_pagadores_nomes() returns table (proprietario_id uuid, pagador text)
language sql stable security definer set search_path = public as $$
  select p.id, pg.nome from proprietarios p join proprietarios pg on pg.id = p.pagador_id
   where p.id in (select meus_proprietarios());
$$;

revoke all on function minhas_contas_cobradas() from public, anon;
revoke all on function meus_pagadores_nomes() from public, anon;
grant execute on function minhas_contas_cobradas(), meus_pagadores_nomes() to authenticated;
