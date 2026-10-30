-- ImobAI · Fase 3: renovação de contrato pelo proprietário
-- Perto do fim do contrato, cada proprietário do imóvel diz se quer renovar pelo valor atual,
-- propor um novo valor ou não renovar. A imobiliária registra o resultado (novo contrato ou devolução).

create type decisao_renovacao as enum ('atual', 'novo_valor', 'nao_renovar');

create table renovacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references contratos (id) on delete cascade,
  proprietario_id uuid not null references proprietarios (id) on delete cascade,
  decisao decisao_renovacao not null,
  valor_proposto numeric(12, 2) check (valor_proposto > 0),
  comentario text,
  respondido_em timestamptz not null default now(),
  concluida_em timestamptz,          -- preenchido quando a imobiliária registra o resultado
  unique (contrato_id, proprietario_id),
  check ((decisao = 'novo_valor') = (valor_proposto is not null))
);

alter table renovacoes enable row level security;
create policy admin_all on renovacoes for all using (is_admin()) with check (is_admin());
create policy minhas_renovacoes on renovacoes for select using (proprietario_id in (select meus_proprietarios()));

/** Proprietário responde (ou desfaz, com p_decisao nulo) a renovação de um contrato ativo de imóvel seu. */
create function responder_renovacao(p_contrato uuid, p_decisao decisao_renovacao, p_valor numeric default null, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_imovel uuid;
begin
  select imovel_id into v_imovel from contratos where id = p_contrato and ativo;
  if v_imovel is null or v_imovel not in (select meus_imoveis()) then
    raise exception 'Contrato não encontrado.';
  end if;
  if exists (select 1 from renovacoes where contrato_id = p_contrato and concluida_em is not null) then
    raise exception 'A imobiliária já registrou a renovação deste contrato.';
  end if;
  if p_decisao = 'novo_valor' and not coalesce(p_valor > 0, false) then
    raise exception 'Informe o novo valor do aluguel.';
  end if;

  if p_decisao is null then
    delete from renovacoes r
     using imovel_proprietarios ip
     where r.contrato_id = p_contrato and ip.imovel_id = v_imovel
       and r.proprietario_id = ip.proprietario_id and ip.proprietario_id in (select meus_proprietarios());
    return;
  end if;

  insert into renovacoes (contrato_id, proprietario_id, decisao, valor_proposto, comentario)
  select p_contrato, ip.proprietario_id, p_decisao,
         case when p_decisao = 'novo_valor' then round(p_valor, 2) end,
         nullif(trim(p_comentario), '')
    from imovel_proprietarios ip
   where ip.imovel_id = v_imovel and ip.proprietario_id in (select meus_proprietarios())
  on conflict (contrato_id, proprietario_id) do update
     set decisao = excluded.decisao, valor_proposto = excluded.valor_proposto,
         comentario = excluded.comentario, respondido_em = now();
end $$;

revoke all on function responder_renovacao(uuid, decisao_renovacao, numeric, text) from public;
grant execute on function responder_renovacao(uuid, decisao_renovacao, numeric, text) to authenticated;
