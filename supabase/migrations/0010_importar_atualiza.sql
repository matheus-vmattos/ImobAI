-- ImobAI · Importação que também atualiza (relatórios da Superlógica e planilha)
-- · código do imóvel no sistema anterior (para reimportar sem duplicar)
-- · contrato com datas estimadas fica "a conferir" até alguém salvar as datas certas

alter table imoveis add column codigo_externo text;
create unique index imoveis_codigo_externo_idx on imoveis (codigo_externo) where codigo_externo is not null;
alter table contratos add column datas_a_conferir boolean not null default false;

create or replace function importar_carteira(p jsonb, p_user uuid default null) returns jsonb language plpgsql as $$
declare
  x jsonb; d jsonb;
  v_cond uuid; v_im uuid; v_prop uuid; v_con contratos%rowtype;
  n_prop int := 0; n_cond int := 0; n_im int := 0; n_im_at int := 0; n_con int := 0; n_con_at int := 0; n_enc int := 0;
begin
  perform exigir_operador();

  for x in select * from jsonb_array_elements(coalesce(p -> 'condominios', '[]')) loop
    insert into condominios (nome, endereco, cidade, cotas_padrao, iptu_inscricao, energia_cliente, agua_cliente)
    values (x ->> 'nome', x ->> 'endereco', x ->> 'cidade', (x ->> 'cotas_padrao')::numeric, x ->> 'iptu_inscricao', x ->> 'energia_cliente', x ->> 'agua_cliente');
    n_cond := n_cond + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p -> 'proprietarios', '[]')) loop
    insert into proprietarios (nome, cpf_cnpj, email, telefone, pix, dados_bancarios, forma_padrao)
    values (x ->> 'nome', x ->> 'cpf_cnpj', x ->> 'email', x ->> 'telefone', x ->> 'pix', x ->> 'dados_bancarios', coalesce(x ->> 'forma_padrao', 'cobranca'));
    n_prop := n_prop + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'proprietarios', '[]')) loop
    if x ->> 'pagador' is not null then
      select id into v_prop from proprietarios where chave_nome(nome) = chave_nome(x ->> 'pagador') limit 1;
      if v_prop is null then raise exception 'Pagador "%" não encontrado.', x ->> 'pagador'; end if;
      update proprietarios set pagador_id = v_prop where chave_nome(nome) = chave_nome(x ->> 'nome') and id <> v_prop;
    end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p -> 'imoveis', '[]')) loop
    v_cond := null; v_im := null;
    if x ->> 'condominio' is not null then
      select id into v_cond from condominios where chave_nome(nome) = chave_nome(x ->> 'condominio') limit 1;
      if v_cond is null then raise exception 'Condomínio "%" não encontrado.', x ->> 'condominio'; end if;
    end if;
    if x ->> 'codigo' is not null then select id into v_im from imoveis where codigo_externo = x ->> 'codigo'; end if;
    if v_im is null then
      select i.id into v_im from imoveis i where chave_nome(i.identificacao) = chave_nome(x ->> 'identificacao') and i.condominio_id is not distinct from v_cond limit 1;
    end if;

    if v_im is not null then
      -- já cadastrado: atualiza dados (proprietários e rateio não mudam)
      update imoveis set
        tipo = coalesce(x ->> 'tipo', tipo),
        taxa_adm_pct = coalesce((x ->> 'taxa_adm_pct')::numeric, taxa_adm_pct),
        aluguel_pedido = coalesce((x ->> 'aluguel_pedido')::numeric, aluguel_pedido),
        seguro_incendio_mensal = coalesce((x ->> 'seguro')::numeric, seguro_incendio_mensal),
        codigo_externo = coalesce(x ->> 'codigo', codigo_externo),
        iptu_inscricao = coalesce(x ->> 'iptu_inscricao', iptu_inscricao),
        energia_cliente = coalesce(x ->> 'energia_cliente', energia_cliente),
        agua_cliente = coalesce(x ->> 'agua_cliente', agua_cliente),
        observacoes = coalesce(x ->> 'observacoes', observacoes)
      where id = v_im;
      if (x ->> 'vagou')::boolean then
        update contratos set ativo = false where imovel_id = v_im and ativo;
        if found then n_enc := n_enc + 1; end if;
        update imoveis set status = 'vazio' where id = v_im and status <> 'vazio';
      end if;
      n_im_at := n_im_at + 1;
      continue;
    end if;

    insert into imoveis (condominio_id, identificacao, endereco, tipo, status, cotas, taxa_adm_pct, aluguel_pedido, seguro_incendio_mensal, condominio_pago_por,
                         codigo_externo, iptu_inscricao, energia_cliente, agua_cliente, observacoes)
    values (v_cond, x ->> 'identificacao', x ->> 'endereco', x ->> 'tipo', (x ->> 'status')::status_imovel, coalesce((x ->> 'cotas')::numeric, 1),
            coalesce((x ->> 'taxa_adm_pct')::numeric, 10), (x ->> 'aluguel_pedido')::numeric, (x ->> 'seguro')::numeric, coalesce(x ->> 'condominio_pago_por', 'imobiliaria'),
            x ->> 'codigo', x ->> 'iptu_inscricao', x ->> 'energia_cliente', x ->> 'agua_cliente', x ->> 'observacoes')
    returning id into v_im;
    for d in select * from jsonb_array_elements(x -> 'donos') loop
      select id into v_prop from proprietarios where chave_nome(nome) = chave_nome(d ->> 'nome') limit 1;
      if v_prop is null then raise exception 'Proprietário "%" não encontrado.', d ->> 'nome'; end if;
      insert into imovel_proprietarios (imovel_id, proprietario_id, percentual) values (v_im, v_prop, (d ->> 'percentual')::numeric);
    end loop;
    n_im := n_im + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p -> 'contratos', '[]')) loop
    select i.id into v_im from imoveis i left join condominios c on c.id = i.condominio_id
     where chave_nome(i.identificacao) = chave_nome(x ->> 'imovel') and chave_nome(c.nome) = chave_nome(x ->> 'condominio') limit 1;
    if v_im is null then raise exception 'Imóvel "%" não encontrado.', x ->> 'imovel'; end if;
    select * into v_con from contratos where imovel_id = v_im and ativo;
    if found and chave_nome(v_con.inquilino) = chave_nome(x ->> 'inquilino') then
      -- mesmo inquilino: atualiza valor e término; datas estimadas não apagam datas já conferidas
      update contratos set
        aluguel = (x ->> 'aluguel')::numeric,
        fim = greatest((x ->> 'fim')::date, case when (x ->> 'a_conferir')::boolean and not v_con.datas_a_conferir then v_con.inicio else (x ->> 'inicio')::date end),
        inicio = case when (x ->> 'a_conferir')::boolean and not v_con.datas_a_conferir then inicio else (x ->> 'inicio')::date end,
        dia_vencimento = case when (x ->> 'a_conferir')::boolean and not v_con.datas_a_conferir then dia_vencimento else (x ->> 'dia_vencimento')::smallint end,
        datas_a_conferir = v_con.datas_a_conferir and (x ->> 'a_conferir')::boolean,
        inquilino_contato = coalesce(x ->> 'contato', inquilino_contato)
      where id = v_con.id;
      n_con_at := n_con_at + 1;
    else
      if found then update contratos set ativo = false where id = v_con.id; n_enc := n_enc + 1; end if;
      insert into contratos (imovel_id, inquilino, inquilino_contato, aluguel, inicio, fim, dia_vencimento, ativo, datas_a_conferir)
      values (v_im, x ->> 'inquilino', x ->> 'contato', (x ->> 'aluguel')::numeric, (x ->> 'inicio')::date, (x ->> 'fim')::date,
              (x ->> 'dia_vencimento')::smallint, true, coalesce((x ->> 'a_conferir')::boolean, false));
      n_con := n_con + 1;
    end if;
    update imoveis set status = 'locado' where id = v_im and status <> 'locado';
  end loop;

  perform registrar('importacao', 'importacao', null, null, null,
    n_prop || ' proprietários, ' || n_cond || ' condomínios, ' || n_im || ' imóveis novos e ' || n_im_at || ' atualizados, '
      || n_con || ' contratos novos e ' || n_con_at || ' atualizados' || case when n_enc > 0 then ', ' || n_enc || ' encerrados' else '' end, p_user);
  return jsonb_build_object('proprietarios', n_prop, 'condominios', n_cond, 'imoveis', n_im, 'imoveis_atualizados', n_im_at,
    'contratos', n_con, 'contratos_atualizados', n_con_at, 'encerrados', n_enc);
end $$;

revoke all on function importar_carteira(jsonb, uuid) from public, anon;
grant execute on function importar_carteira(jsonb, uuid) to authenticated, service_role;
