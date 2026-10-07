-- CONFIRMAÇÃO DO DIA SEGUINTE (Fase 3 · 3C)
-- Anota, para cada compromisso da Agenda CLIENTES CDP, se o lembrete já foi enviado ao cliente
-- e o que ele respondeu. A agenda do Google NÃO é alterada: aqui fica só o controle da equipe.
-- evento_id = id do compromisso no Google + horário de início (se o compromisso mudar de horário,
-- vira outro id e pede confirmação de novo, o que é o certo).
-- Só a equipe (perfis) enxerga e mexe. Nada que já existe é alterado.

create table if not exists public.agenda_confirmacoes (
  evento_id      text primary key,
  dia            date not null,
  cliente        text,
  status         text not null default 'enviado' check (status in ('enviado', 'confirmado', 'reagendar')),
  enviado_por    text,
  enviado_em     timestamptz not null default now(),
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists agenda_confirmacoes_dia on public.agenda_confirmacoes (dia);

alter table public.agenda_confirmacoes enable row level security;
create policy "equipe nas confirmacoes" on public.agenda_confirmacoes
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.agenda_confirmacoes from anon, authenticated;   -- o Supabase dá tudo por padrão; aqui fica só o necessário (sem apagar)
grant select, insert, update on public.agenda_confirmacoes to authenticated;

-- quem enviou / quem mudou por último (pelo login); o envio original nunca é sobrescrito
create or replace function public.agenda_confirmacoes_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  if tg_op = 'INSERT' then
    new.enviado_por := coalesce(v_nome, new.enviado_por);
    new.enviado_em := now();
  else
    new.enviado_por := old.enviado_por;
    new.enviado_em := old.enviado_em;
  end if;
  new.atualizado_por := coalesce(v_nome, new.atualizado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.agenda_confirmacoes_ao_salvar() from public, anon, authenticated;

create or replace trigger agenda_confirmacoes_ao_salvar
  before insert or update on public.agenda_confirmacoes
  for each row execute function public.agenda_confirmacoes_ao_salvar();
