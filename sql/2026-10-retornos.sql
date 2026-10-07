-- HUB DE RETORNOS (Fase 2) — tudo que a loja deve a um cliente, num lugar só.
-- 1) Tabela retornos: cliente (ligado ou não a um orçamento), assunto, quem age, prazo e status.
-- 2) No orçamento: último contato, próximo contato combinado e quantos contatos de follow-up já foram feitos.
-- Só a equipe (perfis) enxerga e mexe. Nada que já existe é alterado.

create table if not exists public.retornos (
  id             bigint generated always as identity primary key,
  orcamento_id   bigint references public.orcamentos(id) on delete set null,
  cliente        text not null,
  telefone       text,
  assunto        text not null,
  responsavel    text not null default 'Bruna',
  prazo          timestamptz,
  status         text not null default 'aberto' check (status in ('aberto', 'aguardando', 'respondido')),
  obs            text,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  respondido_em  timestamptz
);
create index if not exists retornos_status_prazo on public.retornos (status, prazo);
create index if not exists retornos_orcamento on public.retornos (orcamento_id);

alter table public.retornos enable row level security;
create policy "equipe nos retornos" on public.retornos
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.retornos from anon;
grant select, insert, update, delete on public.retornos to authenticated;

-- quem criou (pelo login), data da última mudança e data em que foi respondido
create or replace function public.retornos_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if tg_op = 'INSERT' then
    select nome into v_nome from public.perfis where email = auth.email();
    if v_nome is not null then new.criado_por := v_nome; end if;
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  if new.status = 'respondido' and (tg_op = 'INSERT' or old.status is distinct from 'respondido') then
    new.respondido_em := now();
  elsif new.status <> 'respondido' then
    new.respondido_em := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.retornos_ao_salvar() from public, anon, authenticated;

create or replace trigger retornos_ao_salvar
  before insert or update on public.retornos
  for each row execute function public.retornos_ao_salvar();

-- follow-up no orçamento
alter table public.orcamentos add column if not exists ultimo_contato  timestamptz;
alter table public.orcamentos add column if not exists proximo_contato date;
alter table public.orcamentos add column if not exists qtd_contatos    integer not null default 0;
