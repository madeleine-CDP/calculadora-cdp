-- NOTA FISCAL DAS OS ENTREGUES (aprovado pela Bru em 13/10/2026)
-- O sistema lê no Olist se a OS tem nota fiscal ligada (campo idNotaFiscal do pedido) e a situação da nota.
-- Entregue sem NF → pendência "Emitir NF"; com NF → "Enviar NF ao cliente" (Já enviei, com desfazer).
-- NF de serviço emitida fora do Tiny (Tinus) → botão "NF emitida fora do Tiny" (com desfazer).
-- Só ACRESCENTA colunas na tabela os_acompanhamento; nada que já existe é apagado ou alterado.
-- Para desfazer (se um dia precisar), rodar à mão:
--   alter table public.os_acompanhamento drop column nf_id, drop column nf_numero, drop column nf_situacao,
--     drop column nf_checado_em, drop column nf_enviada_em, drop column nf_enviada_por, drop column nf_fora_em, drop column nf_fora_por;

alter table public.os_acompanhamento
  add column if not exists nf_id          bigint,        -- id da nota fiscal no Olist (lido pelo servidor)
  add column if not exists nf_numero      text,          -- nº da nota
  add column if not exists nf_situacao    integer,       -- 1 pendente, 2 emitida, 3 cancelada, 4/9 enviada aguardando, 5 rejeitada, 6 autorizada, 7 emitida DANFE, 8 registrada, 10 denegada
  add column if not exists nf_checado_em  timestamptz,   -- última vez que o servidor procurou a nota (evita gastar o limite do Olist)
  add column if not exists nf_enviada_em  timestamptz,   -- equipe: NF enviada ao cliente
  add column if not exists nf_enviada_por text,
  add column if not exists nf_fora_em     timestamptz,   -- equipe: NF (de serviço) emitida fora do Tiny
  add column if not exists nf_fora_por    text;

-- a equipe só pode marcar estes campos (os outros vêm do Olist pelo servidor)
grant update (nf_enviada_em, nf_fora_em) on public.os_acompanhamento to authenticated;

-- quem marcou (pelo login); desmarcar (desfazer) limpa o nome junto
create or replace function public.os_acompanhamento_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
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
  return new;
end;
$$;
revoke execute on function public.os_acompanhamento_ao_marcar() from public, anon, authenticated;
