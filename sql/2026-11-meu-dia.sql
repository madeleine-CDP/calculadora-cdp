-- MEU DIA: minhas tarefas, mural da equipe e bloco de notas (aprovado pela Bru em 19/11/2026; protótipo aprovado)
-- 1) tarefas: lista pessoal (cada pessoa só vê e mexe nas próprias)
-- 2) mural: recados que toda a equipe vê; quem escreveu (ou a gestora: Bruna/Madeleine) muda ou apaga
-- 3) notas: um bloco de notas por pessoa (só a própria pessoa vê)
-- Nada que já existe é alterado.
--
-- Desfazer: drop table public.tarefas, public.mural, public.notas; drop function public.mural_ao_salvar();

-- ── 1) tarefas ──
create table if not exists public.tarefas (
  id         bigint generated always as identity primary key,
  dono       text not null default auth.email(),
  texto      text not null check (length(btrim(texto)) between 1 and 300),
  para_dia   date,
  feita_em   timestamptz,
  criada_em  timestamptz not null default now()
);
create index if not exists tarefas_dono on public.tarefas (dono, feita_em);
alter table public.tarefas enable row level security;
create policy "cada um nas proprias tarefas" on public.tarefas
  for all to authenticated
  using (public.eh_da_equipe() and dono = auth.email())
  with check (public.eh_da_equipe() and dono = auth.email());
revoke all on public.tarefas from anon, authenticated;
grant select, insert, update, delete on public.tarefas to authenticated;

-- ── 2) mural ──
create table if not exists public.mural (
  id           bigint generated always as identity primary key,
  texto        text not null check (length(btrim(texto)) between 1 and 1000),
  fixado       boolean not null default false,
  lembrar_em   date,
  autor_email  text not null default auth.email(),
  autor        text,
  criado_em    timestamptz not null default now()
);
alter table public.mural enable row level security;
create policy "equipe le o mural" on public.mural
  for select to authenticated using (public.eh_da_equipe());
create policy "equipe escreve no mural" on public.mural
  for insert to authenticated with check (public.eh_da_equipe());
create policy "autor ou gestora muda o recado" on public.mural
  for update to authenticated
  using (public.eh_da_equipe() and (autor_email = auth.email() or public.eh_gestora()))
  with check (public.eh_da_equipe());
create policy "autor ou gestora apaga o recado" on public.mural
  for delete to authenticated
  using (public.eh_da_equipe() and (autor_email = auth.email() or public.eh_gestora()));
revoke all on public.mural from anon, authenticated;
grant select, insert, update, delete on public.mural to authenticated;

-- quem escreveu é gravado pelo banco (não dá para escrever em nome de outra pessoa)
create or replace function public.mural_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.autor_email := auth.email();
    select nome into new.autor from public.perfis where email = auth.email();
    new.criado_em := now();
  else
    new.autor_email := old.autor_email; new.autor := old.autor; new.criado_em := old.criado_em;
  end if;
  return new;
end;
$$;
revoke execute on function public.mural_ao_salvar() from public, anon, authenticated;
create or replace trigger mural_ao_salvar
  before insert or update on public.mural
  for each row execute function public.mural_ao_salvar();

-- ── 3) bloco de notas ──
create table if not exists public.notas (
  dono           text primary key default auth.email(),
  texto          text not null default '' check (length(texto) <= 20000),
  atualizado_em  timestamptz not null default now()
);
alter table public.notas enable row level security;
create policy "cada um no proprio bloco" on public.notas
  for all to authenticated
  using (public.eh_da_equipe() and dono = auth.email())
  with check (public.eh_da_equipe() and dono = auth.email());
revoke all on public.notas from anon, authenticated;
grant select, insert, update, delete on public.notas to authenticated;
