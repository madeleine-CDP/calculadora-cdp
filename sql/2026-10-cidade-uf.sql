-- Cidade e estado do cliente no orçamento (pedido da Bru, 07/10/2026), para a proposta sair completa.
alter table public.orcamentos add column if not exists cidade text;
alter table public.orcamentos add column if not exists uf text;
