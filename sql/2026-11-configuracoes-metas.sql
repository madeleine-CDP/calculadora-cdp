-- CONFIGURAÇÕES (metas de vendas e outros ajustes da loja) — aprovado pela Bru em 19/11/2026
-- Uma linha por ajuste (chave → valor). Primeiro uso: 'metas_vendas' = {"minima": 65000, "ideal": 85000} (por mês).
-- Toda a equipe lê; só a gestora (Bruna/Madeleine) muda. Quem mudou e quando são gravados pelo banco.
-- Desfazer: drop table public.configuracoes; drop function public.configuracoes_ao_salvar();

create table if not exists public.configuracoes (
  chave           text primary key check (chave ~ '^[a-z0-9_]{1,60}$'),
  valor           jsonb not null,
  atualizado_por  text,
  atualizado_em   timestamptz not null default now()
);
alter table public.configuracoes enable row level security;
create policy "equipe le as configuracoes" on public.configuracoes
  for select to authenticated using (public.eh_da_equipe());
create policy "gestora cria configuracao" on public.configuracoes
  for insert to authenticated with check (public.eh_gestora());
create policy "gestora muda configuracao" on public.configuracoes
  for update to authenticated using (public.eh_gestora()) with check (public.eh_gestora());
revoke all on public.configuracoes from anon, authenticated;
grant select, insert, update on public.configuracoes to authenticated;

create or replace function public.configuracoes_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select nome into new.atualizado_por from public.perfis where email = auth.email();
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.configuracoes_ao_salvar() from public, anon, authenticated;
create or replace trigger configuracoes_ao_salvar
  before insert or update on public.configuracoes
  for each row execute function public.configuracoes_ao_salvar();

insert into public.configuracoes (chave, valor) values ('metas_vendas', '{"minima": 65000, "ideal": 85000}')
  on conflict (chave) do nothing;
