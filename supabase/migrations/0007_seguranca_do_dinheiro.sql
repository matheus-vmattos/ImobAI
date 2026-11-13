-- ImobAI · Segurança do dinheiro
-- 1. resposta do proprietário travada depois que a conta entrou em cobrança ou repasse
-- 2. decisão só vale para a parte que é do proprietário (não a do inquilino nem a paga direto)
-- 3. operações de dinheiro "tudo ou nada": cada função roda numa transação só
-- 5. dia do repasse configurável
-- 6. registro de quem fez o quê

alter table config add column repasse_dia smallint not null default 10 check (repasse_dia between 1 and 28);
alter table pagamentos add column confirmado_por uuid references auth.users (id) on delete set null;

-- hoje em São Paulo (o servidor roda em UTC)
create function hoje_sp() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

/* ---------- registro de atividade ---------- */
create table eventos (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  acao text not null,                -- pagamento_confirmado, abono, cobranca_emitida, repasse_fechado...
  ref_tipo text,                     -- pagamento, cobranca, repasse, despesa
  ref_id uuid,
  proprietario_id uuid references proprietarios (id) on delete set null,
  valor numeric(12, 2),
  detalhe text
);
create index eventos_ref_idx on eventos (ref_tipo, ref_id);
create index eventos_quando_idx on eventos (quando desc);
alter table eventos enable row level security;
create policy admin_ler on eventos for select using (is_admin());
create policy admin_gravar on eventos for insert with check (is_admin());
-- ninguém altera nem apaga o registro (sem política de update/delete)

create function registrar(p_acao text, p_tipo text, p_id uuid, p_prop uuid, p_valor numeric, p_detalhe text, p_user uuid default null)
returns void language sql as $$
  insert into eventos (user_id, acao, ref_tipo, ref_id, proprietario_id, valor, detalhe)
  values (coalesce(p_user, auth.uid()), p_acao, p_tipo, p_id, p_prop, p_valor, p_detalhe);
$$;

-- só a imobiliária (admin logado) ou o servidor (service role, na rotina diária)
create function exigir_operador() returns void language plpgsql stable as $$
begin
  if not (is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Sem permissão para esta operação.';
  end if;
end $$;

/* ---------- 1 e 2: resposta do proprietário ---------- */
create or replace function responder_despesa(p_despesa uuid, p_decisao decisao_despesa, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from despesa_itens
              where despesa_id = p_despesa and proprietario_id in (select meus_proprietarios())
                and responsavel = 'proprietario'
                and (cobranca_id is not null or repasse_id is not null or reembolso = 'confirmado')) then
    raise exception 'Esta conta já entrou numa cobrança ou num repasse. Para mudar, fale com a imobiliária.';
  end if;
  update despesa_itens i
     set decisao = p_decisao,
         decidido_auto = false,
         comentario = coalesce(nullif(trim(p_comentario), ''), case when p_decisao is null then null else i.comentario end),
         respondido_em = case when p_decisao is null then null else now() end,
         reembolso = case when p_decisao = 'reembolso' then 'pendente'::status_reembolso end,
         reembolso_informado_em = null
   where i.despesa_id = p_despesa
     and i.proprietario_id in (select meus_proprietarios())
     and i.responsavel = 'proprietario'
     and exists (select 1 from despesas d where d.id = p_despesa and d.status = 'enviada');
  if not found then raise exception 'Despesa não encontrada.'; end if;
end $$;

/* ---------- 3: pagamentos ---------- */

/** Usa o valor livre de um pagamento confirmado nas cobranças em aberto, da mais antiga para a mais nova. */
create function alocar_pagamento(p_pagamento uuid, out alocado numeric, out ultima uuid)
language plpgsql as $$
declare
  v_pagador uuid;
  v_livre numeric;
  v_c record;
  v_usa numeric;
begin
  alocado := 0; ultima := null;
  select p.pagador_id, p.valor_confirmado - coalesce((select sum(a.valor) from alocacoes a where a.pagamento_id = p.id), 0)
    into v_pagador, v_livre
    from pagamentos p where p.id = p_pagamento and p.status = 'confirmado';
  if v_pagador is null then return; end if;
  for v_c in
    select id, total - pago - abonado - descontado as saldo
      from cobrancas where pagador_id = v_pagador and status = 'aberta'
     order by vencimento, emitida_em for update
  loop
    exit when v_livre <= 0;
    v_usa := least(v_livre, v_c.saldo);
    if v_usa > 0 then
      insert into alocacoes (pagamento_id, cobranca_id, valor) values (p_pagamento, v_c.id, v_usa)
        on conflict (pagamento_id, cobranca_id) do update set valor = alocacoes.valor + excluded.valor;
      update cobrancas
         set pago = pago + v_usa,
             status = case when v_c.saldo - v_usa <= 0 then 'paga' else status end,
             quitada_em = case when v_c.saldo - v_usa <= 0 then now() else quitada_em end
       where id = v_c.id;
      v_livre := v_livre - v_usa; alocado := alocado + v_usa; ultima := v_c.id;
    end if;
  end loop;
end $$;

/** Crédito do pagador (pagamentos com valor ainda não usado) aplicado nas cobranças em aberto. */
create function aplicar_credito(p_pagador uuid) returns void language plpgsql as $$
declare v_p record;
begin
  for v_p in
    select p.id from pagamentos p
     where p.pagador_id = p_pagador and p.status = 'confirmado'
       and p.valor_confirmado > coalesce((select sum(a.valor) from alocacoes a where a.pagamento_id = p.id), 0)
     order by p.data, p.created_at
  loop
    perform alocar_pagamento(v_p.id);
  end loop;
end $$;

/** Imobiliária confirma o valor que caiu na conta: dá baixa nas cobranças, abona a diferença pequena
 *  (até config.abono_ate, se p_abonar) e guarda a sobra como crédito. Tudo ou nada. */
create function confirmar_pagamento(p_pagamento uuid, p_valor numeric, p_abonar boolean, p_user uuid default null)
returns jsonb language plpgsql as $$
declare
  v_p pagamentos;
  v_alocado numeric; v_ultima uuid;
  v_credito numeric; v_abono numeric := 0; v_saldo numeric; v_limite numeric;
begin
  perform exigir_operador();
  select * into v_p from pagamentos where id = p_pagamento for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  if v_p.status = 'confirmado' then raise exception 'Este pagamento já foi confirmado.'; end if;
  if not coalesce(p_valor > 0, false) then raise exception 'Informe o valor que caiu na conta.'; end if;

  update pagamentos
     set status = 'confirmado', valor_confirmado = round(p_valor, 2), confirmado_em = now(),
         confirmado_por = coalesce(p_user, auth.uid()), motivo_recusa = null
   where id = p_pagamento;
  select a.alocado, a.ultima into v_alocado, v_ultima from alocar_pagamento(p_pagamento) a;
  v_credito := round(p_valor, 2) - v_alocado;
  perform registrar('pagamento_confirmado', 'pagamento', p_pagamento, v_p.pagador_id, round(p_valor, 2),
    case when v_credito > 0 then 'sobrou ' || v_credito || ' de crédito' end, p_user);

  if p_abonar and v_credito = 0 and v_ultima is not null then
    select abono_ate into v_limite from config;
    select total - pago - abonado - descontado into v_saldo from cobrancas where id = v_ultima and status = 'aberta' for update;
    if v_saldo > 0 and v_saldo <= coalesce(v_limite, 0) then
      update cobrancas set abonado = abonado + v_saldo, status = 'paga', quitada_em = now() where id = v_ultima;
      v_abono := v_saldo;
      perform registrar('abono', 'cobranca', v_ultima, v_p.pagador_id, v_saldo, 'diferença perdoada na conferência do pagamento', p_user);
    end if;
  end if;
  return jsonb_build_object('alocado', v_alocado, 'credito', v_credito, 'abonado', v_abono);
end $$;

/* ---------- 3: cobrança ---------- */

/** Emite a cobrança de um pagador: grava a foto das linhas, prende as contas e os ajustes nela,
 *  leva a sobra de crédito para a próxima e usa o crédito que ele já tenha. Tudo ou nada. */
create function emitir_cobranca(p_pagador uuid, p_inicio date, p_fim date, p_vencimento date, p_total numeric,
  p_linhas jsonb, p_itens uuid[], p_ajustes uuid[], p_sobra numeric default 0, p_user uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid; v_n int;
begin
  perform exigir_operador();
  insert into cobrancas (pagador_id, inicio, fim, vencimento, total, linhas, status, quitada_em)
  values (p_pagador, p_inicio, p_fim, p_vencimento, p_total, p_linhas,
          case when p_total <= 0 then 'paga' else 'aberta' end, case when p_total <= 0 then now() end)
  returning id into v_id;

  update despesa_itens set cobranca_id = v_id where id = any(p_itens) and cobranca_id is null;
  get diagnostics v_n = row_count;
  if v_n <> coalesce(array_length(p_itens, 1), 0) then
    raise exception 'Alguma conta já entrou em outra cobrança. Gere de novo.';
  end if;
  update ajustes set cobranca_id = v_id where id = any(p_ajustes) and cobranca_id is null;
  get diagnostics v_n = row_count;
  if v_n <> coalesce(array_length(p_ajustes, 1), 0) then
    raise exception 'Algum ajuste já entrou em outra cobrança. Gere de novo.';
  end if;
  if p_sobra < 0 then
    insert into ajustes (pagador_id, descricao, valor) values (p_pagador, 'Crédito da cobrança anterior', p_sobra);
  end if;
  perform registrar('cobranca_emitida', 'cobranca', v_id, p_pagador, p_total, jsonb_array_length(p_linhas) || ' linhas', p_user);
  perform aplicar_credito(p_pagador);
  return v_id;
end $$;

/* ---------- 3: repasse ---------- */

/** Fecha o repasse de um proprietário no mês: congela as linhas, marca as contas descontadas
 *  e quita as cobranças vencidas que saíram dele. Tudo ou nada. */
create function fechar_repasse(p_proprietario uuid, p_competencia date, p_aluguel numeric, p_taxa numeric, p_seguro numeric,
  p_despesas numeric, p_liquido numeric, p_linhas jsonb, p_itens uuid[], p_cobrancas jsonb, p_user uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid; v_c record; v_n int;
begin
  perform exigir_operador();
  insert into repasses (proprietario_id, competencia, aluguel, taxa_adm, seguro, despesas, liquido, linhas, created_by)
  values (p_proprietario, p_competencia, p_aluguel, p_taxa, p_seguro, p_despesas, p_liquido, p_linhas, coalesce(p_user, auth.uid()))
  returning id into v_id;

  update despesa_itens set repasse_id = v_id, repassado_em = now() where id = any(p_itens) and repasse_id is null;
  get diagnostics v_n = row_count;
  if v_n <> coalesce(array_length(p_itens, 1), 0) then
    raise exception 'Alguma conta já entrou em outro repasse. Atualize a página e feche de novo.';
  end if;
  for v_c in select (x ->> 'id')::uuid as id, (x ->> 'saldo')::numeric as saldo from jsonb_array_elements(coalesce(p_cobrancas, '[]'::jsonb)) x loop
    update cobrancas
       set descontado = descontado + v_c.saldo, status = 'paga', quitada_em = now(), repasse_id = v_id
     where id = v_c.id and status = 'aberta' and total - pago - abonado - descontado = v_c.saldo;
    if not found then raise exception 'Uma cobrança vencida mudou (foi paga?). Atualize a página e feche de novo.'; end if;
  end loop;
  perform registrar('repasse_fechado', 'repasse', v_id, p_proprietario, p_liquido, to_char(p_competencia, 'MM/YYYY'), p_user);
  return v_id;
end $$;

/** Desfaz um repasse fechado: as contas voltam a ficar pendentes e as cobranças que ele quitou reabrem. */
create function reabrir_repasse(p_id uuid, p_user uuid default null) returns void language plpgsql as $$
declare v_r repasses;
begin
  perform exigir_operador();
  select * into v_r from repasses where id = p_id for update;
  if not found then raise exception 'Repasse não encontrado.'; end if;
  update despesa_itens set repasse_id = null, repassado_em = null where repasse_id = p_id;
  update cobrancas set descontado = 0, status = 'aberta', quitada_em = null, repasse_id = null where repasse_id = p_id;
  delete from repasses where id = p_id;
  perform registrar('repasse_reaberto', 'repasse', p_id, v_r.proprietario_id, v_r.liquido, to_char(v_r.competencia, 'MM/YYYY'), p_user);
end $$;

-- registro automático de ajustes e recusas (feitos por gravação direta)
create function registrar_ajuste() returns trigger language plpgsql as $$
begin
  if new.descricao <> 'Crédito da cobrança anterior' then
    perform registrar('ajuste', 'ajuste', new.id, new.pagador_id, new.valor, new.descricao, new.created_by);
  end if;
  return new;
end $$;
create trigger ajustes_registrar after insert on ajustes for each row execute function registrar_ajuste();

create function registrar_recusa() returns trigger language plpgsql as $$
begin
  if new.status = 'recusado' and old.status <> 'recusado' then
    perform registrar('pagamento_recusado', 'pagamento', new.id, new.pagador_id, new.valor, new.motivo_recusa);
  end if;
  return new;
end $$;
create trigger pagamentos_registrar after update on pagamentos for each row execute function registrar_recusa();

revoke all on function confirmar_pagamento(uuid, numeric, boolean, uuid) from public, anon;
revoke all on function emitir_cobranca(uuid, date, date, date, numeric, jsonb, uuid[], uuid[], numeric, uuid) from public, anon;
revoke all on function fechar_repasse(uuid, date, numeric, numeric, numeric, numeric, numeric, jsonb, uuid[], jsonb, uuid) from public, anon;
revoke all on function reabrir_repasse(uuid, uuid) from public, anon;
revoke all on function aplicar_credito(uuid) from public, anon;
revoke all on function alocar_pagamento(uuid) from public, anon;
grant execute on function confirmar_pagamento(uuid, numeric, boolean, uuid), emitir_cobranca(uuid, date, date, date, numeric, jsonb, uuid[], uuid[], numeric, uuid),
  fechar_repasse(uuid, date, numeric, numeric, numeric, numeric, numeric, jsonb, uuid[], jsonb, uuid), reabrir_repasse(uuid, uuid),
  aplicar_credito(uuid), alocar_pagamento(uuid), registrar(text, text, uuid, uuid, numeric, text, uuid), exigir_operador() to authenticated, service_role;
