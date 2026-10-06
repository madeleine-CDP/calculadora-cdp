-- C4 — motivo de perda do orçamento (Preço, Sem retorno, Escolheu concorrente, Desistiu, Outro)
-- Só ACRESCENTA uma coluna de texto. Não apaga nada, não muda nenhum valor.
-- APLICADO em 06/10/2026.
alter table orcamentos add column if not exists motivo_perda text;
