-- FECHAMENTO E PEDIDOS (aprovado pela Bru em 07/10/2026)
-- 1) fechamentos: checklist do fechamento de cada orçamento fechado (dados p/ OS → OS no Tiny → OS + pagamento
--    enviados → comprovante → validação no extrato → pagamento confirmado). Guarda só QUEM e QUANDO de cada passo;
--    os dados do cliente (CPF, endereço) continuam só no Olist. A validação só a dona (Madeleine) marca.
-- 2) os_acompanhamento: cópia do status das OS do Olist (lida pelo servidor), desde quando estão no status,
--    nº do pedido na fábrica (D/R), conferência em mãos e pedido de avaliação.
-- 3) conferencias_fabrica: "Conferi a Decore / a Real hoje" (pedidos em produção), uma vez por fábrica.
-- Só a equipe (perfis) enxerga e mexe. Nada que já existe é alterado.

-- ── 1) fechamentos ──
create table if not exists public.fechamentos (
  orcamento_id         bigint primary key references public.orcamentos(id) on delete cascade,
  tipo_pessoa          text check (tipo_pessoa in ('pf', 'pj')),
  forma_pagamento      text check (forma_pagamento in ('pix', 'cartao')),
  link_cartao          text check (link_cartao is null or link_cartao ~* '^https://'),
  os_valor             numeric,             -- valor da OS lido do Olist (para conferir com o orçamento)
  dados_pedidos_em     timestamptz, dados_pedidos_por     text,
  dados_ok_em          timestamptz, dados_ok_por          text,
  os_conferida_em      timestamptz, os_conferida_por      text,
  os_enviada_em        timestamptz, os_enviada_por        text,
  followup_em          timestamptz, followup_por          text,
  comprovante_em       timestamptz, comprovante_por       text,
  validado_em          timestamptz, validado_por          text,
  confirmado_em        timestamptz, confirmado_por        text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
create index if not exists fechamentos_validacao on public.fechamentos (comprovante_em) where validado_em is null;

alter table public.fechamentos enable row level security;
create policy "equipe nos fechamentos" on public.fechamentos
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.fechamentos from anon, authenticated;
grant select, insert, update, delete on public.fechamentos to authenticated;

-- quem fez cada passo (pelo login); desmarcar (desfazer) limpa o nome junto; validar = só a dona
create or replace function public.fechamentos_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_papel text; passo text;
  antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  novo jsonb;
begin
  select nome, papel into v_nome, v_papel from public.perfis where email = auth.email();
  if (tg_op = 'INSERT' and new.validado_em is not null) or (tg_op = 'UPDATE' and new.validado_em is distinct from old.validado_em) then
    if coalesce(v_papel, '') <> 'dona' then
      raise exception 'Só a Madeleine valida o pagamento no extrato.' using errcode = '42501';
    end if;
  end if;
  novo := to_jsonb(new);
  foreach passo in array array['dados_pedidos', 'dados_ok', 'os_conferida', 'os_enviada', 'followup', 'comprovante', 'validado', 'confirmado'] loop
    if (novo ->> (passo || '_em')) is distinct from (antigo ->> (passo || '_em')) then
      novo := jsonb_set(novo, array[passo || '_por'], case when novo ->> (passo || '_em') is null then 'null'::jsonb else to_jsonb(coalesce(v_nome, novo ->> (passo || '_por'))) end);
    elsif tg_op = 'UPDATE' then
      novo := jsonb_set(novo, array[passo || '_por'], coalesce(antigo -> (passo || '_por'), 'null'::jsonb));
    end if;
  end loop;
  new := jsonb_populate_record(new, novo);
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.fechamentos_ao_salvar() from public, anon, authenticated;
create or replace trigger fechamentos_ao_salvar
  before insert or update on public.fechamentos
  for each row execute function public.fechamentos_ao_salvar();

-- ── 2) acompanhamento das OS (lidas do Olist pelo servidor) ──
create table if not exists public.os_acompanhamento (
  pedido_id       bigint primary key,      -- id da OS no Olist
  numero          text,                    -- nº do pedido de venda (OS) no Tiny
  cliente         text,
  celular         text,
  valor           numeric,
  situacao        integer,                 -- código do Olist: 0 aberta, 3 aprovada, 4 preparando envio, 7 pronto, 5 enviada, 1 faturada, 6 entregue, 2 cancelada, 9 não entregue
  situacao_desde  timestamptz,             -- desde quando o sistema viu a OS neste status
  data_venda      date,
  data_prevista   date,
  data_entrega    date,
  numero_fabrica  text,                    -- nº do pedido na fábrica (ex.: D2299, R2249)
  lido_em         timestamptz not null default now(),
  em_maos_em      timestamptz, em_maos_por    text,   -- itens conferidos em mãos (antes de confirmar a instalação)
  avaliacao_em    timestamptz, avaliacao_por  text    -- pedido de avaliação no Google enviado
);
create index if not exists os_acompanhamento_situacao on public.os_acompanhamento (situacao);

alter table public.os_acompanhamento enable row level security;
create policy "equipe le os" on public.os_acompanhamento
  for select to authenticated using (public.eh_da_equipe());
create policy "equipe marca os" on public.os_acompanhamento
  for update to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.os_acompanhamento from anon, authenticated;
grant select on public.os_acompanhamento to authenticated;
grant update (em_maos_em, avaliacao_em) on public.os_acompanhamento to authenticated;

create or replace function public.os_acompanhamento_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  if new.em_maos_em is distinct from old.em_maos_em then
    new.em_maos_por := case when new.em_maos_em is null then null else coalesce(v_nome, new.em_maos_por) end;
  end if;
  if new.avaliacao_em is distinct from old.avaliacao_em then
    new.avaliacao_por := case when new.avaliacao_em is null then null else coalesce(v_nome, new.avaliacao_por) end;
  end if;
  return new;
end;
$$;
revoke execute on function public.os_acompanhamento_ao_marcar() from public, anon, authenticated;
create or replace trigger os_acompanhamento_ao_marcar
  before update on public.os_acompanhamento
  for each row execute function public.os_acompanhamento_ao_marcar();

-- ── 3) conferência dos pedidos em produção, por fábrica ──
create table if not exists public.conferencias_fabrica (
  id             bigint generated always as identity primary key,
  fabrica        text not null check (fabrica in ('decore', 'real', 'atelie')),
  conferido_em   timestamptz not null default now(),
  conferido_por  text
);
create index if not exists conferencias_fabrica_ultima on public.conferencias_fabrica (fabrica, conferido_em desc);

alter table public.conferencias_fabrica enable row level security;
create policy "equipe nas conferencias" on public.conferencias_fabrica
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.conferencias_fabrica from anon, authenticated;
grant select, insert, delete on public.conferencias_fabrica to authenticated;

create or replace function public.conferencias_fabrica_quem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  new.conferido_por := coalesce(v_nome, new.conferido_por);
  new.conferido_em := now();
  return new;
end;
$$;
revoke execute on function public.conferencias_fabrica_quem() from public, anon, authenticated;
create or replace trigger conferencias_fabrica_quem
  before insert on public.conferencias_fabrica
  for each row execute function public.conferencias_fabrica_quem();
