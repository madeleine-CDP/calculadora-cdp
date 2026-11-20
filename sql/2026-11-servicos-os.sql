-- ACOMPANHAMENTO DAS OS DE SERVIÇO (pedido urgente da Bru, 20/11/2026)
-- 1) os_acompanhamento ganha o que o servidor lê nos itens da OS no Olist:
--    itens_resumo (lista dos itens), servico_tipos (instalação, lavagem, manutenção…), tem_produto (cortina/persiana nova),
--    marcado_servico (a OS tem a tag "SERVIÇO" no Olist), itens_lidos_em. Só o servidor escreve.
-- 2) servicos_os: o andamento de cada OS de serviço (um registro por OS). Toda a equipe vê e marca.
--    eh_servico: correção à mão (true/false); null = automático (tag SERVIÇO, ou serviço sem produto novo).
--    local: 'local' (na casa do cliente) ou 'loja' (retira, faz na loja e devolve).
--    precisa_peca + peca_desc/peca_fabrica/peca_pedido: peça, componente ou acessório que precisa chegar.
--    Etapas (quem e quando gravados pelo banco): peca_pedida, peca_chegou, retirada, feito, devolvido, concluido.
-- Desfazer:
--   drop table public.servicos_os; drop function public.servicos_os_ao_salvar();
--   alter table public.os_acompanhamento drop column itens_resumo, drop column servico_tipos, drop column tem_produto,
--     drop column marcado_servico, drop column itens_lidos_em;

alter table public.os_acompanhamento
  add column if not exists itens_resumo     text,
  add column if not exists servico_tipos    text,
  add column if not exists tem_produto      boolean,
  add column if not exists marcado_servico  boolean,
  add column if not exists itens_lidos_em   timestamptz;

create table if not exists public.servicos_os (
  pedido_id         bigint primary key,
  eh_servico        boolean,
  local             text check (local in ('local', 'loja')),
  precisa_peca      boolean,
  peca_desc         text check (peca_desc is null or length(peca_desc) <= 300),
  peca_fabrica      text check (peca_fabrica is null or length(peca_fabrica) <= 60),
  peca_pedido       text check (peca_pedido is null or length(peca_pedido) <= 60),
  obs               text check (obs is null or length(obs) <= 1000),
  peca_pedida_em    timestamptz, peca_pedida_por  text,
  peca_chegou_em    timestamptz, peca_chegou_por  text,
  retirada_em       timestamptz, retirada_por     text,
  feito_em          timestamptz, feito_por        text,
  devolvido_em      timestamptz, devolvido_por    text,
  concluido_em      timestamptz, concluido_por    text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    text
);
alter table public.servicos_os enable row level security;
create policy "equipe nos servicos" on public.servicos_os
  for all to authenticated using (public.eh_da_equipe()) with check (public.eh_da_equipe());
revoke all on public.servicos_os from anon, authenticated;
grant select, insert, update, delete on public.servicos_os to authenticated;

-- quem fez cada etapa (pelo login); desmarcar (desfazer) limpa o nome junto
create or replace function public.servicos_os_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; passo text;
  antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  novo jsonb;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  novo := to_jsonb(new);
  foreach passo in array array['peca_pedida', 'peca_chegou', 'retirada', 'feito', 'devolvido', 'concluido'] loop
    if (novo ->> (passo || '_em')) is distinct from (antigo ->> (passo || '_em')) then
      novo := jsonb_set(novo, array[passo || '_por'], case when novo ->> (passo || '_em') is null then 'null'::jsonb else to_jsonb(coalesce(v_nome, novo ->> (passo || '_por'))) end);
    elsif tg_op = 'UPDATE' then
      novo := jsonb_set(novo, array[passo || '_por'], coalesce(antigo -> (passo || '_por'), 'null'::jsonb));
    end if;
  end loop;
  new := jsonb_populate_record(new, novo);
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  new.atualizado_em := now(); new.atualizado_por := v_nome;
  return new;
end;
$$;
revoke execute on function public.servicos_os_ao_salvar() from public, anon, authenticated;
create or replace trigger servicos_os_ao_salvar
  before insert or update on public.servicos_os
  for each row execute function public.servicos_os_ao_salvar();
