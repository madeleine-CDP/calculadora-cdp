-- TABELAS DE PREÇO PELA TELA (Fase 2)
-- A tabela base de cada fábrica continua no código (js/precos.js). Aqui ficam só os AJUSTES por cima dela:
-- reajuste geral (%) ou preço corrigido de uma coleção/acessório. As fórmulas NÃO mudam.
-- Cada reajuste é um "lote" (pode ser desfeito inteiro). valor_base = preço que estava no código quando o
-- ajuste foi feito: se a tabela base do código mudar depois, o ajuste antigo deixa de valer sozinho.

create table if not exists public.precos_ajustes (
  id          bigint generated always as identity primary key,
  lote        uuid not null,
  fabrica     text not null check (fabrica in ('real', 'dec', 'cdp')),
  tipo        text not null check (tipo in ('colecao', 'acessorio')),
  chave       text not null,          -- família (ex.: CORTINAS|CORTINA ROLÔ|BLACKOUT) ou id do acessório
  item        text not null,          -- coleção (ou "Sub › Coleção") ou cor do acessório (W, C, p)
  valor_base  numeric not null,
  valor_novo  numeric not null check (valor_novo > 0),
  descricao   text,                   -- ex.: "Reajuste geral +6,5% (todos os produtos)"
  versao      text,                   -- ex.: "Novembro/2026"
  vigencia    text,                   -- ex.: "01/11/2026"
  ativo       boolean not null default true,
  criado_por  text,
  criado_em   timestamptz not null default now()
);
create index if not exists precos_ajustes_ativos on public.precos_ajustes (fabrica, ativo, criado_em);
create index if not exists precos_ajustes_lote on public.precos_ajustes (lote);

-- Bruna e Madeleine (admin/dona) mudam preço; o resto da equipe só lê
create or replace function public.eh_gestora()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.perfis where email = auth.email() and papel in ('admin', 'dona')) $$;
revoke all on function public.eh_gestora() from public, anon;
grant execute on function public.eh_gestora() to authenticated;

alter table public.precos_ajustes enable row level security;
create policy "equipe le precos" on public.precos_ajustes
  for select to authenticated using (public.eh_da_equipe());
create policy "gestora inclui precos" on public.precos_ajustes
  for insert to authenticated with check (public.eh_gestora());
create policy "gestora desfaz precos" on public.precos_ajustes
  for update to authenticated using (public.eh_gestora()) with check (public.eh_gestora());
revoke all on public.precos_ajustes from anon, authenticated;
grant select, insert on public.precos_ajustes to authenticated;
grant update (ativo) on public.precos_ajustes to authenticated;

create or replace function public.precos_ajustes_quem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  new.criado_por := coalesce(v_nome, new.criado_por);
  new.criado_em := now();
  return new;
end;
$$;
revoke execute on function public.precos_ajustes_quem() from public, anon, authenticated;
create or replace trigger precos_ajustes_quem
  before insert on public.precos_ajustes
  for each row execute function public.precos_ajustes_quem();
