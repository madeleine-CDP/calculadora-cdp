-- LINKS ÚTEIS (Etapa A · Configurações) — aprovado pela Bru em 07/10/2026
-- Atalhos do dia a dia no rodapé do Início, visíveis para toda a equipe.
-- Só Bruna e Madeleine (admin/dona) incluem, mudam ou tiram links, pela tela Configurações.
-- Fica de fora de propósito: o doc de Credenciais (senhas) e o Notion.

create table if not exists public.links_uteis (
  id             bigint generated always as identity primary key,
  grupo          text not null check (grupo in ('sistemas', 'guias', 'pastas', 'cliente')),
  titulo         text not null,
  url            text not null check (url ~* '^https://'),
  emoji          text,
  ordem          integer not null default 0,
  copiar         boolean not null default false,   -- mostra "copiar link" (ex.: avaliação no Google, para mandar ao cliente)
  criado_por     text,
  atualizado_em  timestamptz not null default now()
);

alter table public.links_uteis enable row level security;
create policy "equipe le links" on public.links_uteis
  for select to authenticated using (public.eh_da_equipe());
create policy "gestora inclui links" on public.links_uteis
  for insert to authenticated with check (public.eh_gestora());
create policy "gestora muda links" on public.links_uteis
  for update to authenticated using (public.eh_gestora()) with check (public.eh_gestora());
create policy "gestora tira links" on public.links_uteis
  for delete to authenticated using (public.eh_gestora());
revoke all on public.links_uteis from anon, authenticated;
grant select, insert, update, delete on public.links_uteis to authenticated;

create or replace function public.links_uteis_ao_salvar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  select nome into v_nome from public.perfis where email = auth.email();
  new.criado_por := coalesce(v_nome, new.criado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.links_uteis_ao_salvar() from public, anon, authenticated;
create or replace trigger links_uteis_ao_salvar
  before insert or update on public.links_uteis
  for each row execute function public.links_uteis_ao_salvar();

-- lista inicial (do fluxo visual no Canva e dos guias)
insert into public.links_uteis (grupo, titulo, url, emoji, ordem, copiar)
select * from (values
  ('sistemas', 'WhatsApp Web',               'https://web.whatsapp.com/',                                                         '💬', 1, false),
  ('sistemas', 'Olist Tiny',                 'https://erp.tiny.com.br/',                                                          '🧾', 2, false),
  ('sistemas', 'Sistema Decore',             'https://www.persianasdecore.com.br/logar/',                                         '🏭', 3, false),
  ('sistemas', 'Sistema Real',               'https://real.auge.app/login',                                                       '🏭', 4, false),
  ('sistemas', 'Agenda CLIENTES CDP',        'https://calendar.google.com/',                                                      '📅', 5, false),
  ('sistemas', 'Portal Tinus (nota de serviço)', 'https://www.tinus.com.br/csp/JABOATAO/portal/index.csp',                        '🧮', 6, false),
  ('guias',    'Mensagens prontas',          'https://docs.google.com/document/d/1_EZ9PSlO4oDNWUMk7BBhxymLYW-f4hirDyh0_t2vPws/edit', '💬', 1, false),
  ('guias',    'Guia de Processos',          'https://docs.google.com/document/d/1qpfUwymKXkr3Y6DxgPlvQBbnU9-cInCWuwz0eVdrbtA/edit', '📘', 2, false),
  ('guias',    'Guia das Fábricas',          'https://docs.google.com/document/d/1lKMofvA9wAh3JexS-1CNV2RLBeMoaxQCOxxzSILKzqs/edit', '🏭', 3, false),
  ('guias',    'Guia de Preenchimento',      'https://docs.google.com/document/d/1_53V-cb_ab3xOhh3NscCh4mAxN6mzLizajseeJPaC8E/edit', '📋', 4, false),
  ('guias',    'Fluxo visual (Canva)',       'https://www.canva.com/design/DAGdI_6Mh1c/y1QluuWJZ3bbnpv7_dBd8g/view',               '🗺️', 5, false),
  ('pastas',   'Orçamentos e Propostas',     'https://drive.google.com/drive/folders/1aptLiDAnyzvZN_bfrm1Iv3nb7sIvWSqz',          '📂', 1, false),
  ('pastas',   'Ordens de serviço (IMPRESSÃO)', 'https://drive.google.com/drive/folders/1BKZbBOFGgyj1tr303sH7a5MVGotNCXsg',       '🖨️', 2, false),
  ('pastas',   'Tabelas de preço dos fornecedores', 'https://drive.google.com/drive/folders/1Fztt7J-ubeeb8xSu51c4lGm9ExBUkCzU',   '📊', 3, false),
  ('pastas',   'Arquivos CDP',               'https://drive.google.com/drive/folders/1qMJ73nNHRgIJwQz7yHYJvtwcfXVhZF8a',          '🗂️', 4, false),
  ('pastas',   'Curadoria e inspirações',    'https://drive.google.com/drive/folders/13tVbtj-iW1AB90qYRNexiYJA-dYLqHBW',          '🖼️', 5, false),
  ('pastas',   'Catálogos das coleções',     'https://drive.google.com/open?id=1-4xmU7tgSbrTcsvF5ooHwPBIJwjWU3OJ',                '🎨', 6, false),
  ('cliente',  'Catálogo virtual',           'https://www.canva.com/design/DAE8klb3w00/EdaJl9l0QRj-AvNSTIETdg/view',               '📖', 1, true),
  ('cliente',  'Instagram',                  'https://www.instagram.com/centraldaspersianas',                                     '📸', 2, true),
  ('cliente',  'Avaliação no Google',        'https://g.page/CentraldasPersianas/review?gm',                                      '⭐', 3, true)
) as v(grupo, titulo, url, emoji, ordem, copiar)
where not exists (select 1 from public.links_uteis);
