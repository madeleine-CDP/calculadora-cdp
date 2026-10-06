-- C3a — liga um orçamento ao anterior do mesmo cliente (pré-orçamento → orçamento de visita/final)
-- APLICADO em 06/10/2026.
-- Só ACRESCENTA uma coluna. Não apaga nada, não muda nenhum valor.
-- "anterior_id" = de qual orçamento este nasceu. O anterior aparece como "Evoluído → CDP-xxxx".
-- Se o anterior for excluído, o novo continua existindo (só perde a ligação).

alter table orcamentos add column if not exists anterior_id bigint
  references orcamentos(id) on delete set null;
create index if not exists orcamentos_anterior_id_idx on orcamentos (anterior_id);
-- para achar rápido os orçamentos do mesmo cliente pelo WhatsApp
create index if not exists orcamentos_telefone_idx on orcamentos (telefone);
