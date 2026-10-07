-- FASE 1 · parte A3 (ajustes apontados pelo verificador de segurança do Supabase; não fecha nada)
create or replace function public.ping()
returns integer
language sql
stable
set search_path = public
as $$ select 1 $$;

-- função de gatilho: ninguém precisa chamá-la direto
revoke execute on function public.orcamentos_quem_criou() from public, anon, authenticated;
