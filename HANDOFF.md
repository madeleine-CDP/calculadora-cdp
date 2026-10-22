# HANDOFF — CDP Sistema (atualizado em 22/10/2026)

Documento de passagem para continuar o trabalho numa nova sessão do Claude Code.
**Leia nesta ordem:** este arquivo → `CLAUDE.md` (regras, fórmulas, mapa do código) → `testes/README.md`.
Plano geral do projeto (fases e jornada): https://claude.ai/code/artifact/e1ec3be8-5b99-4263-abe4-fefec201edda

---

## 1. Como trabalhar com a Bru (resumo — o detalhe está no CLAUDE.md)
- Bruna (Bru), administradora da Central das Persianas (Recife). **Não é programadora.** Português do Brasil simples, sem jargão; se usar termo técnico, explique em uma frase. Respostas em blocos com título, tabelas e emojis nos painéis (ela gosta).
- **Antes de mexer, apresente o plano e espere o ok.** Uma mudança por vez; pedido grande = etapas.
- Banco (criar/alterar tabelas e colunas), login/senhas e **fórmulas de preço** = só com aprovação explícita.
- Nunca digitar senhas, chaves ou tokens; nunca criar contas; nunca colocar chave `service_role`, senha ou dado de cliente no repositório. Ao relatar dados reais, só **contagens**, nunca nomes de clientes.
- Equipe que usa: Bruna (admin), Mirelle (atendimento), Madeleine (dona — única que valida pagamento no extrato), Ricardo (vendas, conta ainda não criada). Pensar no uso **no celular**.
- Mensagens para cliente seguem o **Guia de Mensagens** da loja; padrão do sistema: mensagem para **copiar** (nunca link wa.me), botão "Já enviei" registra, **toda ação tem desfazer**.

## 2. Onde está cada coisa (acessos)
| O quê | Onde |
|---|---|
| Código | GitHub `madeleine-CDP/calculadora-cdp`. Trabalhar **sempre na branch `dev`**. `main` = site oficial |
| Site oficial | https://sistemacdp.netlify.app (Netlify, conta da loja; publica a `main` sozinho) |
| Site de testes | https://dev--sistemacdp.netlify.app (publica a `dev`; **grátis**; usa o MESMO banco real) |
| Banco | Supabase, projeto `cdp-calculadora`, id `hvgtbwkpavrclndacder` (sa-east-1). Ferramentas MCP do Supabase funcionam (execute_sql, apply_migration, deploy_edge_function, query_logs) |
| Funções do servidor | Edge Functions `olist` (v13, `verify_jwt=false`, confere a equipe por dentro) e `agenda` (v5). Código em `supabase/functions/*/index.ts`. Publicar = ferramenta do Supabase (`deploy_edge_function`), não a Netlify. Depois de publicar, confira que o código publicado é igual ao do repositório |
| Agenda Google | Ponte Apps Script na conta da Madeleine (`google/agenda-ponte.gs`); segredos `AGENDA_URL`/`AGENDA_SEGREDO` |
| Olist (Tiny API v3) | App da CDP; segredos `OLIST_CLIENT_ID`/`OLIST_CLIENT_SECRET`; autorização em `olist_conexao` (renovada a cada 3h pelo pg_cron `olist-renovar`). **Permissões confirmadas em 22/10: clientes, pedidos, notas fiscais e produtos (leitura)** |
| Segredos do GitHub | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_BACKUP_KEY` (workflows `despertador.yml` diário 08:17 e `backup.yml` às segundas) |
| Docs da loja | Projeto "CDP · Central das Persianas" no claude.ai (Contexto base, mapeamento das fábricas, sistemática do ateliê, ficha de visita etc.) + Google Drive (Guia de Processos, Guia de Mensagens, Guia das Fábricas) |
| Planilha de produtos | "PLANILHA PRODUTOS E CÁLCULOS - CDP.xlsx" no Drive da loja (id `1zaBMV4eopt_ng2xMPo14eCtP8w7DFTjG`, dona madeleine@centraldaspersianas.com) |

### ⚠️ Créditos do Netlify e como publicar
- Cada publicação na `main` gasta **15 créditos**. Se acabarem, **o site sai do ar** até a renovação. Depois das publicações de 07/10 e 13/10 sobraram ~15 créditos até a renovação (~25/10). **Confirme com a Bru o saldo antes de qualquer publicação.** Junte várias etapas numa publicação só.
- O envio direto para a `main` a partir da sessão é recusado. Publicação = **pull request `dev` → `main`** no GitHub, no Chrome da Bru logado como **madeleine-CDP**. O Claude cria o PR pelo Chrome; **o clique em "Merge" é bloqueado para o Claude** (classificador "Production Deploy") → a Bru clica em "Merge pull request" → "Confirm merge". **Nunca apagar a branch `dev`.**
- Para conferir depois: abrir um arquivo novo no site oficial pelo Chrome (o `curl` da sessão não alcança a Netlify).

## 3. Estado em 22/10/2026
- **No ar (site oficial, PR #2 de 13/10):** tudo listado no CLAUDE.md — orçamentos em pasta, calculadora em passos, cálculo rápido, combinações A–D, proposta fiel ao Word, cidade/UF com lista de todos os municípios, Início por urgência, retornos com gestão à vista por responsável, agenda (leitura) e confirmações, garantia e pós-venda 6 meses, Configurações e links úteis, tabelas de preço pela tela, Fechamento (6 passos + lembrete de cobrança da OS), Pedidos por fase (status lidos do Tiny), nota fiscal das entregues (regra do e-mail), detalhamento automático com TAMANHO CORTINA + acessórios + motor, janela de saída Salvar/Sair/Continuar, painel do item que recolhe no computador.
- **Só na `dev` (ainda não publicado):** atualização do CLAUDE.md (créditos), pasta `testes/` e este HANDOFF. Nada de funcionalidade pendente de publicação.
- **Dados reais conferidos em 22/10:** 33 OS entregues com NF ligada e número da nota lido; 31 marcadas "enviada por e-mail pelo Olist". `/produtos` do Olist responde (1.170 produtos).
- **E-mail "projeto pausado" (14/10):** era o projeto vazio "madeleine-CDP's Project" (id `bwopvylmakbuskfewspt`, outra organização), **não** o do sistema. A Bru pode apagá-lo se estiver vazio.
- O Olist às vezes responde "Sua consulta levou muito tempo" na busca por nome: é lentidão do Olist (a função já tenta 2 vezes); na tela aparece "Olist indisponível".

## 4. Banco de dados (tabelas e regras)
Tabelas (todas com RLS: só quem está em `perfis` enxerga; `eh_da_equipe()`, `eh_gestora()`; gatilhos gravam quem/quando pelo login):
`perfis`, `orcamentos`, `retornos`, `precos_ajustes`, `agenda_confirmacoes`, `garantias`, `posvenda`, `links_uteis`, `fechamentos`, `os_acompanhamento`, `conferencias_fabrica`, `olist_conexao` (trancada), `olist_estado`. Login antigo (`usuarios`, `verificar_login`) desligado e guardado. Função `ping()` para o despertador.
Histórico dos comandos aplicados: pasta `sql/` (um arquivo por mudança; alguns trazem o comando de desfazer).
Regras:
- Mudança de estrutura: escrever o SQL, **ensaiar num Postgres local** (o ensaio anterior usava Postgres 16 em `/tmp/pgensaio`, porta 5499, banco `e3c`, com `auth.email()` simulado lendo `request.jwt.claim.email`; numa sessão nova pode ser preciso recriar), explicar à Bru, aplicar com o ok dela, guardar em `sql/`.
- `apply_migration` **cancela qualquer comando que contenha a palavra "drop"** (até em comentário) → use `create or replace`, `add column if not exists` etc. e tire o "desfazer" do texto enviado.
- `upsert` em lote do supabase-js grava NULL nas colunas que faltam em algumas linhas → manter sempre as mesmas colunas em todas as linhas (ver `sincronizarOS()`).
- Leitura exploratória no Olist sem expor o token: `select net.http_get(url := 'https://api.tiny.com.br/public-api/v3/...', headers := jsonb_build_object('Authorization','Bearer '||(select access_token from olist_conexao where id=1),'Accept','application/json'));` e depois `select status_code, content from net._http_response where id = <n>;`. **Só GET (leitura)**, nunca mostrar o token, respeitar o limite de 60 consultas/min.

## 5. Decisões já tomadas pela Bru (não contradizer)
- Fórmulas e regras de sobra: ver CLAUDE.md (Romana +55cm; redução de peso Decore ≥ 1,80m ou ≥ 2,00m; Real ×0,975 extra; CDP não multiplica por 2).
- Status das OS é mudado **no Tiny**; o sistema só lê. A proposta/orçamento **não** é lançada no Tiny.
- Salvamento do orçamento é **manual** (Salvar e fechar) com janela de saída de 3 botões.
- Detalhamento: `TAMANHO CORTINA` (ou PERSIANA) quando a medida é da peça pronta; motor/controle na linha ACIONAMENTO; resto em `ACESSÓRIOS: …`.
- Lembrete de cobrança da OS: 1 dia útil, depois a cada 2; 5+ dias úteis → avisar a Madeleine (dia útil = seg–sex).
- NF: entregue sem NF = emitir; com NF = enviar; cliente com e-mail no Olist = considera enviada por e-mail pelo Olist (com desfazer); NF de serviço (Tinus) = botão "fora do Tiny"; olhar entregues dos últimos 30 dias.
- Links úteis visíveis para todos; sem o doc de Credenciais e sem o Notion.
- 3B (agendar pelo sistema) **adiado de propósito** até a equipe usar o sistema no dia a dia. Make (automações do SOP) não está rodando.

## 6. TRABALHO EM ANDAMENTO — revisão do cadastro de produtos do Olist
**Pedido da Bru (16/10):** melhorar a nomenclatura (nomes repetitivos/ruins), **manter o SKU** dos que já existem, cadastrar os produtos que ficaram de fora desde 2023, **inativar** os que saíram de linha e criar uma hierarquia de categorias/taxonomia melhor. Isso também prepara a Fase 6 (o sistema criar o pedido de venda no Olist), que depende de cada item do orçamento apontar para um produto/SKU.

**O que já se sabe**
- Planilha (abas principais): `DEPARA` (1.250 linhas; colunas FORNECEDOR, CÓDIGO, TIPO, CATEGORIA MASTER, PRODUTO, COLEÇÃO, DESCRIÇÃO, UNIDADE, NCM, IPI/ISS, preços de custo/CDP, DATA ATUALIZAÇÃO = **todas de 05/2023**, MARKUP) e `Modelo importação` (1.192 produtos no formato de importação do Olist: Código, Descrição, Preço de compra, Preço de venda, Unidade, NCM, Categoria…). Outras abas: tabelas Decore/Real/CDP, cortina tradicional, restrições/medidas das fábricas, calculadora m², checklist de pedido e abas avulsas.
- Contagem na `Modelo importação`: Decore 648 · Real 524 · CDP 20. Categorias: Cortinas 608 · Acessórios, peças e componentes 328 · Persianas 210 · Motor e controle 38 · Catálogos 6 · Almofadas 2. A DEPARA também tem **serviços** (instalação, lavagem, manutenção) com preço — útil para o Módulo de Serviços.
- No Olist hoje: **1.170 produtos** (`GET /produtos`, campos: id, sku, descricao, tipo, situacao A/I, dataCriacao, dataAlteracao, unidade, precos{preco, precoCusto…}). ⚠️ O SKU no Olist tem sufixo "A" (ex.: `CDP11A`) e na `Modelo importação` aparece sem (ex.: `CDP11`) → conferir a regra antes de montar qualquer importação.
- Problemas de nome encontrados: palavra repetida ("REAL CORTINAS CORTINA ROLÔ Peça Rolô…", "BANDÔ Bandô Rolô Maxi"), família repetida na coleção ("BLACKOUT BK Pétala"), duplicados de promoção que não existe mais (`DECORE2PROMOA` × `DECORE2A`), maiúsculas/minúsculas misturadas, categoria única gigante de acessórios.

**Proposta apresentada à Bru (aguardando as 3 decisões abaixo)**
- Hierarquia: Nível 1 Linha (Cortinas · Persianas · Motorização · Acessórios e peças · Serviços · Casa · Catálogos) → Nível 2 Tipo (Rolô, Romana, Painel, Double Vision/Elegance, Celular, Nuette, Tradicional; Vertical, Horizontal 25mm, 50mm; Motores, Controles, Automação; Bandôs, Guias, Barras, Trilhos, Peças) → Nível 3 Família/tecido (Blackout, Translúcida, Tela solar, Linho, Voil…). Fornecedor vira campo próprio, não categoria.
- Nome: `TIPO + FAMÍLIA + COLEÇÃO + DETALHE/COR – FORNECEDOR`, maiúsculas, sem repetir palavra, igual aos nomes da calculadora. Ex.: "CORTINA ROLÔ BLACKOUT PÉTALA – REAL", "BANDÔ ROLÔ MAXI PRETO – REAL".
- SKU: manter os existentes; novos continuando a sequência atual (recomendação) ou padrão novo legível.
- **Decisões pendentes da Bru:** (1) hierarquia ok? (2) padrão de nome e posição do fornecedor; (3) padrão do SKU novo.

**Próximos passos combinados**
1. Ler todos os produtos do Olist (paginado, 100 por vez; leitura apenas) e cruzar com a planilha e com as tabelas vigentes do sistema (`js/precos.js`: Decore Out/2026, Real Ago/2026, CDP/Ateliê).
2. Entregar à Bru uma planilha de revisão (uma linha por produto): SKU · nome atual · nome novo · categoria nova · preço novo · ação (manter / renomear / inativar / cadastrar). Ela revisa.
3. Teste pequeno: importar 3–5 produtos no Olist para confirmar que a importação **atualiza pelo SKU** e não duplica. **Quem importa é a Bru**; o sistema/Claude não grava no Olist sem aprovação.
4. Importação completa em lotes (renomeados → novos → inativados).
Não colocar a planilha nem dados exportados do Olist no repositório (usar a pasta temporária da sessão).

## 7. Backlog completo (ordem sugerida; confirmar com a Bru)
1. **Revisão de produtos do Olist** (seção 6) — em andamento.
2. **Fase 6 · CDP → Olist** (pedido da Bru, item 6 da lista de melhorias de 13/10): criar/atualizar **cliente** e criar **pedido de venda (OS)** pelo sistema no Fechamento.
   - Cliente: procurar no Olist por CPF/CNPJ → celular → nome; se achar, confirmar "é este?" e completar; se não, criar. Guardar o **id do contato** no orçamento.
   - Pedido: itens da opção escolhida + forma de pagamento + parcelas + observações (detalhamento), cada item apontando para o **SKU** do produto. Guardar **id e número do pedido** (`pedido_tiny`) e conferir o valor (como o passo 2 do Fechamento já faz).
   - Precisa: permissão de **escrita** no app do Olist; 2–3 colunas novas (ex.: `olist_contato_id`, `olist_pedido_id`) com aprovação; mapeamento item da calculadora → SKU (depende do item 1). Preenche sozinho os passos 1–2 do Fechamento. Testar com um cliente "TESTE" combinado com a Bru.
3. **Tecido Ateliê**: atualizar a tabela com os preços novos e o custo da Vidal (aguarda dados da Bru).
4. **Módulo de Serviços** (manutenção, lavagem, instalação): aguarda a planilha de preços que a Bru vai preencher com a Madeleine (a DEPARA já tem serviços de 2023 como ponto de partida).
5. Data/versão da tabela **CDP** em `TABELAS_INFO` (pedir à Bru).
6. Fase 5 restante: **alçada de desconto** (Bru e Mirelle até 3–5%; acima, aprovação da Madeleine).
7. 4B: ficha do ateliê. 3B: agendar pelo sistema (adiado).
8. Apresentação do sistema para a Madeleine.

**Pendências com a Bru (não são código):** convidar a conta pessoal `brubamo` como colaboradora no GitHub (o Claude não pode conceder acesso); decidir tornar o repositório privado (conferir antes o impacto na Netlify); atualizar Canva e guias; criar a conta do Ricardo no Supabase Auth (ela cria com senha provisória; o Claude inclui em `perfis` e o apelido em `USUARIOS_EMAIL`); apagar o projeto vazio do Supabase; conferir saldo de créditos da Netlify após ~25/10.

## 8. Como testar (antes de pedir aprovação)
- `bash testes/rodar_tela.sh` → todos "ok" (banco/Olist simulados; 360px).
- Mudou preço/fórmula ou `app.js`/`precos.js`: `testes/calculos/teste.js` antes × depois (288 cálculos iguais, 0 erros de JS).
- Reabrir um orçamento antigo e editar um item; conferir largura 360px.
- Função do servidor: checar sintaxe com `npx -y esbuild@0.24.0 supabase/functions/olist/index.ts --loader:.ts=ts --format=esm --outfile=/dev/null`, publicar com `deploy_edge_function` e depois conferir com `get_edge_function` + `query_logs`.
- Sempre: commit na `dev` com mensagem em português e push. Atualizar o CLAUDE.md quando mudar algo relevante.

## 9. Atenções
- O site de testes usa o **banco real**: cuidado com dados ao testar à mão.
- O Olist limita 60 consultas/min; as rotas da função já têm tetos (25–40 detalhes por leitura) e não insistem em 403/429.
- Mudar o comportamento de uma tela quase sempre exige atualizar o teste correspondente.
- O Chrome da Bru (extensão Claude in Chrome) é usado para o GitHub (PR) e para conferir o site oficial; abrir aba nova e fechar no fim.
