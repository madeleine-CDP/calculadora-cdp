-- CONFIRMAÇÃO DO DIA SEGUINTE · desfazer (pedido da Bru, 07/10/2026)
-- Permite à equipe desfazer um "Já enviei" tocado sem querer: o registro do compromisso é removido
-- e ele volta a aparecer como "sem lembrete". Continua valendo só para quem é da equipe (política existente).
grant delete on public.agenda_confirmacoes to authenticated;
