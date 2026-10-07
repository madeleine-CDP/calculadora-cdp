-- FASE 1 · parte A2 (não fecha nada; reforço de segurança)
-- Estar logado não basta: só quem está na tabela da equipe (perfis) enxerga os dados.
-- Assim, mesmo que alguém consiga criar uma conta no Supabase por fora, não vê nada.

create or replace function public.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.perfis where email = auth.email()) $$;

revoke all on function public.eh_da_equipe() from public, anon;
grant execute on function public.eh_da_equipe() to authenticated;

alter policy "equipe ve a equipe" on public.perfis using (public.eh_da_equipe());
