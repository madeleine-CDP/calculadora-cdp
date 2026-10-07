-- OLIST · parte A: onde a "mini central" (Edge Function olist) guarda a autorização do Olist.
-- As duas tabelas ficam TRANCADAS: ninguém pelo site (nem logado) lê ou escreve.
-- Só a mini central, que roda no servidor com a chave interna do Supabase, acessa.

create table if not exists public.olist_conexao (
  id              integer primary key default 1 check (id = 1),   -- uma linha só
  access_token    text,
  refresh_token   text,
  access_expira   timestamptz,
  refresh_expira  timestamptz,
  conectado_por   text,
  conectado_em    timestamptz,
  atualizado_em   timestamptz not null default now(),
  ultimo_erro     text
);

-- "senha de ida e volta" de cada pedido de conexão (expira em 15 min)
create table if not exists public.olist_estado (
  estado     text primary key,
  email      text not null,
  voltar     text not null,
  criado_em  timestamptz not null default now()
);

alter table public.olist_conexao enable row level security;
alter table public.olist_estado  enable row level security;
revoke all on public.olist_conexao from anon, authenticated;
revoke all on public.olist_estado  from anon, authenticated;

-- Renovação automática a cada 3 horas (a autorização do Olist vence em 1 dia sem uso).
select cron.schedule(
  'olist-renovar',
  '17 */3 * * *',
  $$ select net.http_post(
       url := 'https://hvgtbwkpavrclndacder.supabase.co/functions/v1/olist/renovar',
       headers := '{"Content-Type":"application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
