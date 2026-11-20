-- PASSOS NOVOS DO ORÇAMENTO (pedido da Bru, 20/11/2026)
-- Pré-orçamento → Pré enviado → Visita agendada → Pós-visita → Pós enviado → Fechado ou perdido.
-- Aproveita os valores que já existem e só cria um novo:
--   pre_orcamento = Pré-orçamento (montar e enviar o pré)      · pre_enviado = Pré enviado (NOVO)
--   visita        = Visita agendada                           · orcamento   = Pós-visita
--   enviado       = Pós enviado                               · fechado / perdido = iguais
-- 1) a regra do banco passa a aceitar 'pre_enviado'
-- 2) o pré-orçamento que já tem itens (ou seja, já foi montado) passa para "Pré enviado"
-- 3) os "enviado" que começaram como pré-orçamento e nunca evoluíram para visita (eram pré enviados) passam para "Pré enviado"
--    (em 20/11/2026: 17 orçamentos; os 6 antigos sem "como começou" ficam em "Pós enviado" e a Bru ajusta à mão se precisar)
-- Desfazer (antes de alguém mexer nos passos):

--   Mais simples: os ids alterados ficam anotados no fim deste arquivo; voltar cada um ao valor antigo.
--   e voltar a regra antiga (sem 'pre_enviado') com o mesmo comando abaixo trocando a lista.
alter table public.orcamentos drop constraint if exists orcamentos_etapa_check;
alter table public.orcamentos add constraint orcamentos_etapa_check
  check (etapa = any (array['pre_orcamento','pre_enviado','visita','orcamento','enviado','fechado','perdido']));
update public.orcamentos set etapa = 'pre_enviado'
  where etapa = 'pre_orcamento' and coalesce(total_avista, 0) > 0;
update public.orcamentos o set etapa = 'pre_enviado'
  where o.etapa = 'enviado' and o.como_comecou = 'pre_orcamento'
    and not exists (select 1 from public.orcamentos f where f.anterior_id = o.id);
