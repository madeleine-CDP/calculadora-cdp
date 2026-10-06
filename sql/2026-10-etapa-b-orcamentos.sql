-- Etapa B — campos novos na tabela de orçamentos (CDP Sistema)
-- Só ACRESCENTA colunas. Não apaga nada, não muda nenhum valor em reais.
-- Pode ser rodado mais de uma vez sem estragar (usa "if not exists").
-- APLICADO em 06/10/2026 (em 3 partes, sem a palavra "drop": a ferramenta do Supabase
-- cancela comandos com "drop" sem mostrar a confirmação).

begin;

-- 1) Número automático do orçamento (aparece como CDP-0001, CDP-0002...)
create sequence if not exists orcamentos_numero_seq;
alter table orcamentos add column if not exists numero integer;
-- numera os orçamentos que já existem, do mais antigo para o mais novo
with ordem as (
  select id, row_number() over (order by created_at, id) as n
  from orcamentos where numero is null
)
update orcamentos o
   set numero = ordem.n + coalesce((select max(numero) from orcamentos), 0)
  from ordem where o.id = ordem.id;
select setval('orcamentos_numero_seq', greatest(coalesce((select max(numero) from orcamentos), 0), 1),
              (select count(*) > 0 from orcamentos));
alter table orcamentos alter column numero set default nextval('orcamentos_numero_seq');
alter table orcamentos alter column numero set not null;
alter sequence orcamentos_numero_seq owned by orcamentos.numero;
create unique index if not exists orcamentos_numero_key on orcamentos (numero);

-- 2) Nº da proposta do Tiny deixa de ser obrigatório (quando não vier, fica em branco)
alter table orcamentos alter column ref set default '';

-- 3) Dados do contato usados no acompanhamento (o cadastro completo continua no Tiny)
alter table orcamentos add column if not exists telefone text;
alter table orcamentos add column if not exists bairro text;
alter table orcamentos add column if not exists origem text;        -- Instagram, Google, indicação, loja, WhatsApp, outro
alter table orcamentos add column if not exists como_comecou text;  -- pre_orcamento | visita_direta

-- 4) Etapa do funil
alter table orcamentos add column if not exists etapa text not null default 'orcamento';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_etapa_check') then
    alter table orcamentos add constraint orcamentos_etapa_check
      check (etapa in ('pre_orcamento','visita','orcamento','enviado','fechado','perdido'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orcamentos_como_comecou_check') then
    alter table orcamentos add constraint orcamentos_como_comecou_check
      check (como_comecou is null or como_comecou in ('pre_orcamento','visita_direta'));
  end if;
end $$;

-- 5) Datas de controle e nº do pedido de venda no Tiny (depois do fechamento)
alter table orcamentos add column if not exists updated_at timestamptz;
update orcamentos set updated_at = created_at where updated_at is null;  -- os antigos: "alterado em" = criado em
alter table orcamentos alter column updated_at set default now();
alter table orcamentos alter column updated_at set not null;
alter table orcamentos add column if not exists fechado_em timestamptz;
alter table orcamentos add column if not exists pedido_tiny text;

-- 6) Regras automáticas ao salvar:
--    - atualiza "updated_at" sozinho
--    - marca "fechado_em" quando vira fechado (e limpa se reabrir)
--    - TRAVA: orçamento fechado não aceita mudança de itens ou valores; precisa "Reabrir" antes
create or replace function orcamentos_ao_salvar() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if old.etapa = 'fechado' and new.etapa = 'fechado' and (
         new.items is distinct from old.items
      or new.total_avista is distinct from old.total_avista
      or new.total_tabela is distinct from old.total_tabela
      or new.total_cartao is distinct from old.total_cartao) then
      raise exception 'Orçamento CDP-% está fechado. Reabra antes de alterar itens ou valores.', lpad(old.numero::text, 4, '0');
    end if;
    if new.etapa = 'fechado' and old.etapa <> 'fechado' then new.fechado_em := now(); end if;
    if new.etapa <> 'fechado' and old.etapa = 'fechado' then new.fechado_em := null; end if;
  elsif new.etapa = 'fechado' and new.fechado_em is null then
    new.fechado_em := now();
  end if;
  return new;
end $$;

create or replace trigger orcamentos_ao_salvar before insert or update on orcamentos
  for each row execute function orcamentos_ao_salvar();

-- O acesso pelo site (chave pública) precisa poder usar o contador do número
grant usage, select on sequence orcamentos_numero_seq to anon, authenticated;

commit;
