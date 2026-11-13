-- ImobAI · Contas do prédio que voltam pelo inquilino
-- Fluxo: a imobiliária paga a conta, o proprietário reembolsa (cobrança semanal) e a parte de cada
-- unidade alugada vai para o boleto do inquilino, voltando ao proprietário no repasse.
-- Obras e extras ficam com o proprietário. O proprietário vê a marca e pode questionar.

-- condomínio em que o proprietário paga tudo e o inquilino reembolsa a parte da unidade
alter table condominios add column inquilino_reembolsa boolean not null default false;
update condominios set inquilino_reembolsa = true;  -- a carteira atual (Itaúna) funciona assim

-- marca visível ao proprietário: true = "Despesa será rateada com os inquilinos"; false = "Despesa do proprietário"
alter table despesas add column rateada_inquilinos boolean not null default false;

-- parte de unidade alugada que volta pelo inquilino; quando a imobiliária lançou no boleto dele
alter table despesa_itens
  add column volta_inquilino boolean not null default false,
  add column inquilino_lancado_em date;

/* ---------- questionamentos do proprietário ---------- */
create table despesa_questionamentos (
  id uuid primary key default gen_random_uuid(),
  despesa_id uuid not null references despesas (id) on delete cascade,
  proprietario_id uuid not null references proprietarios (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  texto text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now(),
  resposta text,
  respondido_em timestamptz
);
create index despesa_questionamentos_despesa_idx on despesa_questionamentos (despesa_id);

alter table despesa_questionamentos enable row level security;
create policy admin_all on despesa_questionamentos for all using (is_admin()) with check (is_admin());
create policy meus_questionamentos on despesa_questionamentos for select using (proprietario_id in (select meus_proprietarios()));
-- o proprietário só pergunta sobre despesa enviada em que ele tem parte, e não responde
create policy perguntar on despesa_questionamentos for insert with check (
  ver_como() is null and user_id = auth.uid() and resposta is null and respondido_em is null
  and proprietario_id in (select meus_proprietarios())
  and despesa_id in (select minhas_despesas())
);

-- registro na Atividade
create function registrar_questionamento() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform registrar('questionamento', 'despesa', new.despesa_id, new.proprietario_id, null, left(new.texto, 200), new.user_id);
  elsif new.resposta is distinct from old.resposta and new.resposta is not null then
    perform registrar('questionamento_respondido', 'despesa', new.despesa_id, new.proprietario_id, null, left(new.resposta, 200), auth.uid());
  end if;
  return new;
end $$;
create trigger questionamento_evento after insert or update on despesa_questionamentos for each row execute function registrar_questionamento();
