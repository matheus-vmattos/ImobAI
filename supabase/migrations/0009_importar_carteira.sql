-- ImobAI · Importação da carteira por planilha, numa transação só (ou entra tudo, ou nada)

create function chave_nome(t text) returns text language sql immutable as $$
  select trim(regexp_replace(lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$$;

/** p: { proprietarios: [...], condominios: [...], imoveis: [...], contratos: [...] } já validados pelo servidor. */
create function importar_carteira(p jsonb, p_user uuid default null) returns jsonb language plpgsql as $$
declare
  x jsonb; d jsonb;
  v_cond uuid; v_im uuid; v_prop uuid;
  n_prop int := 0; n_cond int := 0; n_im int := 0; n_con int := 0;
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
  -- quem paga as contas de quem (depois de todos existirem)
  for x in select * from jsonb_array_elements(coalesce(p -> 'proprietarios', '[]')) loop
    if x ->> 'pagador' is not null then
      select id into v_prop from proprietarios where chave_nome(nome) = chave_nome(x ->> 'pagador') limit 1;
      if v_prop is null then raise exception 'Pagador "%" não encontrado.', x ->> 'pagador'; end if;
      update proprietarios set pagador_id = v_prop where chave_nome(nome) = chave_nome(x ->> 'nome') and id <> v_prop;
    end if;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p -> 'imoveis', '[]')) loop
    v_cond := null;
    if x ->> 'condominio' is not null then
      select id into v_cond from condominios where chave_nome(nome) = chave_nome(x ->> 'condominio') limit 1;
      if v_cond is null then raise exception 'Condomínio "%" não encontrado.', x ->> 'condominio'; end if;
    end if;
    insert into imoveis (condominio_id, identificacao, endereco, tipo, status, cotas, taxa_adm_pct, aluguel_pedido, seguro_incendio_mensal, condominio_pago_por)
    values (v_cond, x ->> 'identificacao', x ->> 'endereco', x ->> 'tipo', (x ->> 'status')::status_imovel, coalesce((x ->> 'cotas')::numeric, 1),
            coalesce((x ->> 'taxa_adm_pct')::numeric, 10), (x ->> 'aluguel_pedido')::numeric, (x ->> 'seguro')::numeric, coalesce(x ->> 'condominio_pago_por', 'imobiliaria'))
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
    insert into contratos (imovel_id, inquilino, inquilino_contato, aluguel, inicio, fim, dia_vencimento, ativo)
    values (v_im, x ->> 'inquilino', x ->> 'contato', (x ->> 'aluguel')::numeric, (x ->> 'inicio')::date, (x ->> 'fim')::date, (x ->> 'dia_vencimento')::smallint, true);
    n_con := n_con + 1;
  end loop;

  perform registrar('importacao', 'importacao', null, null, null,
    n_prop || ' proprietários, ' || n_cond || ' condomínios, ' || n_im || ' imóveis, ' || n_con || ' contratos', p_user);
  return jsonb_build_object('proprietarios', n_prop, 'condominios', n_cond, 'imoveis', n_im, 'contratos', n_con);
end $$;

revoke all on function importar_carteira(jsonb, uuid) from public, anon;
grant execute on function importar_carteira(jsonb, uuid) to authenticated, service_role;
