-- GARANTIA E PÓS-VENDA (Fase 3 · 3D) — aprovado pela Bru em 07/10/2026
-- A data da instalação vem do Olist (OS "Entregue" com a data real): aqui não se repete o que o Olist já guarda.
-- 1) garantias: chamados de garantia/problema (hoje só ficam no WhatsApp e na agenda).
-- 2) posvenda: OS entregues lidas do Olist (cópia da data de entrega, para não consultar o Olist toda hora)
--    + marcação do contato de 6 meses (para ninguém mandar duas vezes).
-- Só a equipe (perfis) enxerga e mexe. Nada que já existe é alterado.

-- ── 1) chamados de garantia ──
create table if not exists public.garantias (
  id                   bigint generated always as identity primary key,
  orcamento_id         bigint references public.orcamentos(id) on delete set null,
  cliente              text not null,
  telefone             text,
  olist_contato_id     bigint,
  pedido_numero        text,              -- nº da OS (pedido de venda) no Olist
  data_entrega         date,              -- data real da instalação, lida do Olist
  tipo                 text not null default 'produto' check (tipo in ('produto', 'servico')),
  sem_cadastro         boolean not null default false,
  relato               text not null,
  fotos                boolean not null default false,
  acionado             text check (acionado in ('decore', 'real', 'atelie', 'tecnico')),
  status               text not null default 'aberto' check (status in ('aberto', 'aguardando', 'resolvido', 'nao_defeito')),
  prazo_retorno        timestamptz,       -- primeiro retorno ao cliente: mesmo dia útil
  primeiro_retorno_em  timestamptz,
  solucao              text,
  criado_por           text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  resolvido_em         timestamptz
);
create index if not exists garantias_status on public.garantias (status, prazo_retorno);

alter table public.garantias enable row level security;
create policy "equipe nas garantias" on public.garantias
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.garantias from anon;
grant select, insert, update, delete on public.garantias to authenticated;

create or replace function public.garantias_ao_salvar()
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
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  new.atualizado_em := now();
  if new.status in ('resolvido', 'nao_defeito') and (tg_op = 'INSERT' or old.status not in ('resolvido', 'nao_defeito')) then
    new.resolvido_em := now();
  elsif new.status not in ('resolvido', 'nao_defeito') then
    new.resolvido_em := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.garantias_ao_salvar() from public, anon, authenticated;
create or replace trigger garantias_ao_salvar
  before insert or update on public.garantias
  for each row execute function public.garantias_ao_salvar();

-- ── 2) pós-venda de 6 meses ──
-- As linhas são gravadas pelo servidor (função "olist"), que lê as OS entregues; a equipe só marca o contato.
create table if not exists public.posvenda (
  pedido_id     bigint primary key,       -- id da OS no Olist
  numero        text,
  cliente       text,
  celular       text,
  data_entrega  date,                     -- data real da instalação (OS "Entregue")
  lido_em       timestamptz not null default now(),
  contato_em    timestamptz,              -- contato de 6 meses feito
  contato_por   text
);
create index if not exists posvenda_entrega on public.posvenda (data_entrega);

alter table public.posvenda enable row level security;
create policy "equipe le posvenda" on public.posvenda
  for select to authenticated using (public.eh_da_equipe());
create policy "equipe marca posvenda" on public.posvenda
  for update to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.posvenda from anon, authenticated;
grant select on public.posvenda to authenticated;
grant update (contato_em) on public.posvenda to authenticated;

-- quem marcou o contato (pelo login); desmarcar (desfazer) limpa o nome junto
create or replace function public.posvenda_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if new.contato_em is distinct from old.contato_em then
    if new.contato_em is null then
      new.contato_por := null;
    else
      select nome into v_nome from public.perfis where email = auth.email();
      new.contato_em := now();
      new.contato_por := coalesce(v_nome, new.contato_por);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.posvenda_ao_marcar() from public, anon, authenticated;
create or replace trigger posvenda_ao_marcar
  before update on public.posvenda
  for each row execute function public.posvenda_ao_marcar();
