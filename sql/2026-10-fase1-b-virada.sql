-- FASE 1 · parte B · VIRADA (fecha o acesso público aos orçamentos)
-- Aplicar SÓ no mesmo momento da publicação do login novo no site oficial, com o ok da Bru.
-- Antes: backup manual (Actions → "Backup semanal" → Run workflow).
-- (Sem a palavra que a ferramenta de migração recusa: a regra antiga é transformada, não apagada.)

alter policy "allow all for anon" on public.orcamentos to authenticated;
alter policy "allow all for anon" on public.orcamentos using (public.eh_da_equipe()) with check (public.eh_da_equipe());
alter policy "allow all for anon" on public.orcamentos rename to "equipe logada";

revoke all on public.orcamentos from anon;
revoke execute on function public.verificar_login(text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- DESFAZER (só se algo der errado e precisar reabrir em 1 minuto):
--   alter policy "equipe logada" on public.orcamentos to public using (true) with check (true);
--   alter policy "equipe logada" on public.orcamentos rename to "allow all for anon";
--   grant select, insert, update, delete on public.orcamentos to anon;
--   grant execute on function public.verificar_login(text, text) to anon;
