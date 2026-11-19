-- PAGAMENTO: ENTRADA E SALDO DE CADA PEDIDO (aprovado pela Bru em 19/11/2026)
-- Por quê: nada vai para a produção sem a entrada (ou o total) conferida no extrato, e nenhuma instalação
-- é confirmada sem o saldo conferido. A Madeleine confere; a Bruna também pode marcar "conferido pela
-- Madeleine" quando ela avisa (fica registrado "Madeleine (marcado por Bruna)").
--
-- 1) os_acompanhamento ganha:
--    entrada_validado_em/_por   → entrada (ou total) conferida, para OS sem Fechamento no sistema
--    saldo_modo                 → null = automático (PIX: tem saldo; cartão: 100% na entrada); 'tem' / 'nao' = escolhido à mão
--    saldo_comprovante_em/_por  → cliente mandou o comprovante do saldo (qualquer pessoa da equipe)
--    saldo_validado_em/_por     → saldo conferido no extrato (só Madeleine ou Bruna)
-- 2) fechamentos: o passo 5 (validado) passa a aceitar também a Bruna (admin), com o mesmo registro.
--
-- Desfazer:
--   alter table public.os_acompanhamento drop column entrada_validado_em, drop column entrada_validado_por,
--     drop column saldo_modo, drop column saldo_comprovante_em, drop column saldo_comprovante_por,
--     drop column saldo_validado_em, drop column saldo_validado_por;
--   (e recriar as duas funções como estavam em 2026-10-os-nota-fiscal.sql e 2026-10-fechamento-pedidos.sql)

alter table public.os_acompanhamento
  add column if not exists entrada_validado_em   timestamptz,
  add column if not exists entrada_validado_por  text,
  add column if not exists saldo_modo            text check (saldo_modo in ('tem', 'nao')),
  add column if not exists saldo_comprovante_em  timestamptz,
  add column if not exists saldo_comprovante_por text,
  add column if not exists saldo_validado_em     timestamptz,
  add column if not exists saldo_validado_por    text;

grant update (entrada_validado_em, saldo_modo, saldo_comprovante_em, saldo_validado_em) on public.os_acompanhamento to authenticated;

create or replace function public.os_acompanhamento_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text; v_papel text; v_conf text;
begin
  select nome, papel into v_nome, v_papel from public.perfis where email = auth.email();
  v_conf := case when v_papel = 'dona' then v_nome else 'Madeleine (marcado por ' || coalesce(v_nome, '?') || ')' end;
  if new.em_maos_em is distinct from old.em_maos_em then
    new.em_maos_por := case when new.em_maos_em is null then null else coalesce(v_nome, new.em_maos_por) end;
  end if;
  if new.avaliacao_em is distinct from old.avaliacao_em then
    new.avaliacao_por := case when new.avaliacao_em is null then null else coalesce(v_nome, new.avaliacao_por) end;
  end if;
  if new.nf_enviada_em is distinct from old.nf_enviada_em then
    new.nf_enviada_por := case when new.nf_enviada_em is null then null else coalesce(v_nome, new.nf_enviada_por) end;
  end if;
  if new.nf_fora_em is distinct from old.nf_fora_em then
    new.nf_fora_por := case when new.nf_fora_em is null then null else coalesce(v_nome, new.nf_fora_por) end;
  end if;
  if new.saldo_comprovante_em is distinct from old.saldo_comprovante_em then
    new.saldo_comprovante_por := case when new.saldo_comprovante_em is null then null else coalesce(v_nome, new.saldo_comprovante_por) end;
  end if;
  -- conferência no extrato: só a Madeleine (dona) ou a Bruna (admin) marcam ou desfazem
  if new.entrada_validado_em is distinct from old.entrada_validado_em then
    if coalesce(v_papel, '') not in ('dona', 'admin') then
      raise exception 'Só a Madeleine (ou a Bruna, avisada por ela) marca o pagamento como conferido.' using errcode = '42501';
    end if;
    new.entrada_validado_por := case when new.entrada_validado_em is null then null else v_conf end;
  else
    new.entrada_validado_por := old.entrada_validado_por;
  end if;
  if new.saldo_validado_em is distinct from old.saldo_validado_em then
    if coalesce(v_papel, '') not in ('dona', 'admin') then
      raise exception 'Só a Madeleine (ou a Bruna, avisada por ela) marca o pagamento como conferido.' using errcode = '42501';
    end if;
    new.saldo_validado_por := case when new.saldo_validado_em is null then null else v_conf end;
  else
    new.saldo_validado_por := old.saldo_validado_por;
  end if;
  return new;
end;
$$;
revoke execute on function public.os_acompanhamento_ao_marcar() from public, anon, authenticated;

create or replace function public.fechamentos_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text; v_papel text; passo text;
  antigo jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  novo jsonb;
  mudou_validado boolean := (tg_op = 'INSERT' and new.validado_em is not null) or (tg_op = 'UPDATE' and new.validado_em is distinct from old.validado_em);
begin
  select nome, papel into v_nome, v_papel from public.perfis where email = auth.email();
  if mudou_validado and coalesce(v_papel, '') not in ('dona', 'admin') then
    raise exception 'Só a Madeleine (ou a Bruna, avisada por ela) valida o pagamento no extrato.' using errcode = '42501';
  end if;
  novo := to_jsonb(new);
  foreach passo in array array['dados_pedidos', 'dados_ok', 'os_conferida', 'os_enviada', 'followup', 'comprovante', 'validado', 'confirmado'] loop
    if (novo ->> (passo || '_em')) is distinct from (antigo ->> (passo || '_em')) then
      novo := jsonb_set(novo, array[passo || '_por'], case when novo ->> (passo || '_em') is null then 'null'::jsonb else to_jsonb(coalesce(v_nome, novo ->> (passo || '_por'))) end);
    elsif tg_op = 'UPDATE' then
      novo := jsonb_set(novo, array[passo || '_por'], coalesce(antigo -> (passo || '_por'), 'null'::jsonb));
    end if;
  end loop;
  new := jsonb_populate_record(new, novo);
  if mudou_validado and new.validado_em is not null and v_papel <> 'dona' then
    new.validado_por := 'Madeleine (marcado por ' || coalesce(v_nome, '?') || ')';
  end if;
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.fechamentos_ao_salvar() from public, anon, authenticated;
