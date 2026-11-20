-- ATELIÊ: OS de cortina tradicional em tecido (pedido da Bru, 20/11/2026)
-- 1) os_acompanhamento ganha "marcadores": as tags da OS no Olist (ex.: ATELIE, SERVIÇO), lidas pelo servidor.
--    As OS em aberto são relidas aos poucos (itens_lidos_em = null), por causa do limite de consultas do Olist.
-- 2) atelie_os: o andamento de cada OS no ateliê (um registro por OS). Toda a equipe vê e marca.
--    eh_atelie: correção à mão (true/false); null = automático (tag ATELIE no Olist).
--    Etapas (quem e quando gravados pelo banco): tecido (comprado/separado), enviado (ao ateliê), pronto (costura pronta),
--    voltou (voltou para a loja). previsao = data combinada com o ateliê. obs = anotação livre.
-- Desfazer:
--   drop table public.atelie_os; drop function public.atelie_os_ao_salvar();
--   alter table public.os_acompanhamento drop column marcadores;

alter table public.os_acompanhamento add column if not exists marcadores text;
update public.os_acompanhamento set itens_lidos_em = null where situacao not in (2, 6);

create table if not exists public.atelie_os (
  pedido_id      bigint primary key,
  eh_atelie      boolean,
  previsao       date,
  obs            text check (obs is null or length(obs) <= 1000),
  tecido_em      timestamptz, tecido_por   text,
  enviado_em     timestamptz, enviado_por  text,
  pronto_em      timestamptz, pronto_por   text,
  voltou_em      timestamptz, voltou_por   text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
alter table public.atelie_os enable row level security;
create policy "equipe no atelie" on public.atelie_os
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.atelie_os from anon, authenticated;
grant select, insert, update, delete on public.atelie_os to authenticated;

create or replace function public.atelie_os_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; passo text;
  antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  novo jsonb;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  novo := to_jsonb(new);
  foreach passo in array array['tecido', 'enviado', 'pronto', 'voltou'] loop
    if (novo ->> (passo || '_em')) is distinct from (antigo ->> (passo || '_em')) then
      novo := jsonb_set(novo, array[passo || '_por'], case when novo ->> (passo || '_em') is null then 'null'::jsonb else to_jsonb(coalesce(v_nome, novo ->> (passo || '_por'))) end);
    elsif tg_op = 'UPDATE' then
      novo := jsonb_set(novo, array[passo || '_por'], coalesce(antigo -> (passo || '_por'), 'null'::jsonb));
    end if;
  end loop;
  new := jsonb_populate_record(new, novo);
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  new.atualizado_em := now(); new.atualizado_por := v_nome;
  return new;
end;
$$;
revoke execute on function public.atelie_os_ao_salvar() from public, anon, authenticated;
create or replace trigger atelie_os_ao_salvar
  before insert or update on public.atelie_os
  for each row execute function public.atelie_os_ao_salvar();
