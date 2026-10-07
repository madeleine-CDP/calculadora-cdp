-- FASE 1 · parte A (não fecha nada; pode ser aplicada antes da virada)
-- 1) Tabela da equipe: liga a conta de login (e-mail) ao nome e ao papel de cada pessoa.
-- 2) "Criado por" automático: o banco grava quem criou o orçamento a partir de quem está logado.
-- 3) Função ping: o despertador diário passa a usar ela (continua funcionando com o banco fechado).

create table if not exists public.perfis (
  email            text primary key,
  usuario          text not null unique,
  nome             text not null,
  papel            text not null default 'atendimento'
                   check (papel in ('dona', 'admin', 'atendimento', 'vendas')),
  senha_provisoria boolean not null default true,
  criado_em        timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- Quem está logado vê a equipe (para mostrar nomes); ninguém de fora vê.
create policy "equipe ve a equipe" on public.perfis
  for select to authenticated using (true);

-- Cada pessoa só pode mexer no próprio perfil, e só no aviso de senha provisória.
create policy "cada um no proprio perfil" on public.perfis
  for update to authenticated
  using (email = auth.email()) with check (email = auth.email());

revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (senha_provisoria) on public.perfis to authenticated;

insert into public.perfis (email, usuario, nome, papel) values
  ('contato@centraldaspersianas.com',        'cdaspersianas',           'Bruna',     'admin'),
  ('operacao.centraldaspersianas@gmail.com', 'operacao@cdaspersianas',  'Mirelle',   'atendimento'),
  ('madeleine@centraldaspersianas.com',      'madeleine@cdaspersianas', 'Madeleine', 'dona')
on conflict (email) do nothing;

-- Quem criou: no INSERT, se a pessoa está logada, o nome vem do perfil dela.
-- No UPDATE, o "criado por" nunca muda.
create or replace function public.orcamentos_quem_criou()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if tg_op = 'INSERT' then
    select nome into v_nome from public.perfis where email = auth.email();
    if v_nome is not null then
      new.criado_por := v_nome;
    end if;
  else
    new.criado_por := old.criado_por;
  end if;
  return new;
end;
$$;

create or replace trigger orcamentos_quem_criou
  before insert or update on public.orcamentos
  for each row execute function public.orcamentos_quem_criou();

-- Despertador: consulta leve que não expõe nenhum dado.
create or replace function public.ping()
returns integer
language sql
stable
as $$ select 1 $$;

grant execute on function public.ping() to anon, authenticated;
