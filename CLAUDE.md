# CLAUDE.md — Calculadora de Orçamentos CDP

Leia este arquivo inteiro antes de qualquer alteração.

## Quem usa e como falar comigo

- Dona do projeto: **Bruna (Bru)**, administradora da Central das Persianas (Recife). **Não é programadora.**
- Explique tudo em português simples, sem jargão. Se precisar usar um termo técnico, explique em uma frase.
- **Antes de mexer em qualquer coisa, apresente o plano** (o que vai mudar, onde, e os riscos) e espere a aprovação.
- Faça **uma mudança por vez**. Se o pedido for grande, proponha dividir em etapas.
- Quando algo travar ou der erro repetido, explique em linguagem de leiga o que está acontecendo e como ela pode ajudar, em vez de insistir.
- Usuários da calculadora: Bruna, Mirelle (atendimento), Ricardo (vendas) e Madeleine (dona). Pense sempre em quem vai usar no celular, no meio do atendimento.

## O que é o projeto

Calculadora de orçamentos de persianas e cortinas, que está virando o **CDP Sistema**: o sistema operacional da loja (orçamentos, retornos, agenda, pedidos, OS e validação financeira). Site estático, **sem build**: os arquivos são publicados como estão.

- **Plano do projeto (fases, jornada, decisões):** doc "CDP Sistema — Plano do projeto" no claude.ai — https://claude.ai/code/artifact/e1ec3be8-5b99-4263-abe4-fefec201edda. Leia antes de começar uma fase nova.
- **⚠️ Créditos do Netlify (plano gratuito por créditos):** cada publicação na `main` custa 15 créditos; se os créditos acabarem o site SAI DO AR até a renovação. Por isso: **trabalhe na branch `dev`** (branch deploy grátis, endereço `dev--sistemacdp.netlify.app`, que usa o MESMO banco de verdade) e **só faça merge/push na `main` quando a Bru aprovar explicitamente uma publicação**, juntando várias etapas. Out/2026: 75 créditos até a renovação (~25/10).
- **Hospedagem:** Netlify, na conta da loja (equipe CDP, madeleine@centraldaspersianas.com): `sistemacdp.netlify.app`, com subdomínio `sistemacdp.` + domínio da loja (DNS no UOL Host). Publicado automaticamente a partir da branch `main`. O antigo `calculadora-cdp.netlify.app` está na conta pessoal da Bru e será desativado depois da troca de link. `netlify.toml` manda o navegador sempre buscar a versão nova (sem cache de tabela antiga).
- **Dados:** Supabase (projeto `cdp-calculadora`, região sa-east-1). Tabela `orcamentos` guarda os orçamentos salvos, compartilhados entre os usuários.
- **Login (Fase 1):** contas do **Supabase Auth**, uma por pessoa (Bruna, Mirelle, Madeleine). Entra por usuário (`cdaspersianas`, `operacao@cdaspersianas`, `madeleine@cdaspersianas`, ou `bru`/`mirelle`/`madeleine`); o mapa usuário → e-mail fica em `USUARIOS_EMAIL` (`js/login.js`). A Bru cria a conta no painel do Supabase com senha provisória (o Claude nunca digita senhas); no 1º acesso a pessoa cria a própria (`perfis.senha_provisoria`). Tabela `perfis` = equipe (e-mail, usuário, nome, papel: dona/admin/atendimento/vendas). **Todo acesso ao banco passa por `sbFetch()`** (manda o token de quem está logado e renova sozinho). "Criado por" é gravado pelo banco (gatilho `orcamentos_quem_criou`). Só quem está em `perfis` vê dados (`eh_da_equipe()`). O cadastro aberto ("Allow new users to sign up") fica DESLIGADO no painel. O login antigo (`usuarios` + `verificar_login`) fica desligado, guardado até tudo estabilizar.
- **Virada da Fase 1:** `sql/2026-10-fase1-b-virada.sql` fecha o banco para quem não está logado. Só aplicar junto com a publicação na `main`, com ok da Bru, depois do backup manual e do segredo `SUPABASE_BACKUP_KEY` cadastrado no GitHub. O mesmo arquivo traz o comando para desfazer.
- **Fonte da verdade:** este repositório. O antigo Artifact no claude.ai virou histórico e não deve mais ser editado.

## Fábricas e fórmulas (NÃO ALTERAR SEM CONFIRMAÇÃO DA BRU)

Estas fórmulas foram confirmadas pela Bru. Qualquer mudança exige confirmação explícita dela na conversa, mesmo que pareça um bug.

### Decore Persianas
- Tabela vigente: **Outubro/2026** (vigência 01/10/2026). Não existe mais tabela promocional: todos os itens usam 12% + 3%.
- **Custo** = preço tabela × área × 0,88 (12%) × 0,97 (3% pedido pelo site) **+ impostos de PE** (IPI e ICMS-ST conforme `IMPOSTOS_PE` e `getTipoImposto()`).
- **À vista** = custo × 2.
- Itens **sem desconto** (motores, controles, monocomandos, redução de peso): lista `SEM_DESCONTO`. Ela aparece **em dois lugares** (cálculo normal e comparação entre fábricas). Ao adicionar um item sem desconto, atualize os dois.
- Redução de peso automática na Rolô e Double Vision: largura > 1,80m OU altura > 2,00m → +R$ 75,00 por peça, sem desconto.

### Real Persianas
- Tabela vigente: **Agosto/2026**. Impostos já inclusos no preço.
- **Custo** = metragem × preço/m² × 0,80 (20%).
- **À vista** = custo × 2 × 0,975 (desconto extra de 2,5%, só na Real).
- Tabela e cartão são recalculados a partir desse à vista menor.
- **Nuette** e **Persiana Horizontal 50mm PVC** só existem na Real. A calculadora já filtra por fábrica.

### Cortina Tradicional em Tecido (CDP)
- O preço da tabela **já é o valor de venda final**. **Não multiplicar por 2.**
- Cálculo em `calcularCdpTrad()`.

### Valores ao cliente (todas as fábricas)
- **Tabela** = à vista ÷ 0,85
- **Cartão** = tabela × 0,95
- Os três valores são arredondados ao real inteiro. Esse comportamento é intencional.

## Sobra de medida (janela → cortina)

Fonte: Guia de Processos de Atendimento (Google Drive). Função `calcSobra()`.

- **Regra geral** (tradicional, rolô, vertical, tudo menos Romana), instalação fora do vão: +20cm na largura, +30cm na altura.
- **Romana:** +35cm em cima + 20cm embaixo = **+55cm na altura** (substitui os +30cm).
- **Rolô com moldura** (só a Rolô): os acessórios **substituem** a sobra genérica, não somam.
  - Guias laterais (6cm ou 8cm, valor real do acessório × 2 lados) substituem a sobra de largura.
  - Bandô (+10cm) e/ou guia inferior (6 ou 8cm) substituem a sobra de altura. Se os dois estiverem marcados, soma os dois.
- Esses acessórios são marcados uma única vez em "Acessórios & Opcionais". A sobra lê dali, sem perguntar de novo.

## Mapa do código (onde fica cada coisa)

Arquivos (desde a fase 0 o antigo arquivo único foi separado, sem mudar nenhuma fórmula):

- `index.html`: as telas (login, lista de orçamentos, novo orçamento, pasta do orçamento, calculadora, proposta). Carrega os scripts nesta ordem: `js/login.js`, `js/icones.js`, `js/precos.js`, `js/app.js`, `js/pasta.js`, `js/passos.js`, `js/inicio.js`, `js/proposta.js`, `js/combinacoes.js`, `js/pwa.js`.
- `js/icones.js`: ícones de traço (`ic('nome')`). `js/passos.js`: calculadora em 4 passos (Ambiente, Produto, Medidas, Resultado), blocos marcados com `data-passo` no HTML; `irPasso(n)` confere cada passo e o Resultado sempre recalcula. Sem orçamento aberto (`EDITING_ORC_ID` vazio) a calculadora é o **Cálculo rápido**: `usarCalculo('novo'|'existente'|'outro')` leva os itens (`PENDENTES`) para um orçamento novo, um existente, ou soma outro item. `js/proposta.js`: utilidades da proposta (nº CDP no cabeçalho, `ordenarPorAmbiente()`, tipo pela etapa). **A proposta deve ficar fiel ao modelo do Word da loja: mesmas cores, fontes e emojis** (pedido da Bru); o restyle `vestirProposta()` fica desligado (`PROPOSTA_VISUAL_NOVO = false`). O texto da proposta continua em `gerarProposta()` no `app.js`. `js/inicio.js`: painel Início (tela inicial): em aberto por etapa, "precisa de atenção" (pré-orçamento parado 3+ dias, orçamento pós-visita parado 1+ dia útil, enviado 3+ dias; usa `updated_at`) e resumo do mês. `js/pasta.js`: a pasta do orçamento (itens por ambiente, etapa, totais, "Salvar e fechar", aviso de alteração não salva). `js/combinacoes.js`: opções para cliente indeciso. Cada item pode ter `item.opcao` (A–D, dentro do ambiente) e o ambiente pode ser opcional (`item.ambienteOpcional`). `gerarCombinacoes()` monta os totais possíveis, e a tela da proposta deixa escolher quais combinações vão para o cliente (`COMBOS_SEL`, `COMBOS_NOMES`). Fica tudo dentro dos itens, sem coluna nova no banco.
- `css/tema.css`: visual novo (carregado depois do `app.css`). `sql/`: comandos já aplicados no banco, para histórico.
- `js/precos.js`: **todas as tabelas de preço e regras das fábricas** (DB_*, ACC_*, IMPOSTOS_PE, TUBOS, FABRIC_W, CDP_TRAD). É aqui que se atualiza tabela nova.
- `js/app.js`: lógica da tela, cálculo, carrinho, orçamentos salvos (Supabase) e proposta.
- `js/login.js`: login (Supabase Auth), sessão, `sbFetch()`, criar/trocar a própria senha (tocando no nome no topo).
- `css/app.css`: visual antigo (base). `assets/`: logos e ícones do app.
- `manifest.webmanifest`, `sw.js`, `js/pwa.js`: permitem instalar no celular. O `sw.js` **não** guarda cache de propósito.
- `.github/workflows/despertador.yml` (consulta diária para o Supabase gratuito não pausar) e `backup.yml` (exporta os orçamentos toda segunda; fica em Actions → Artifacts por 90 dias). Usam os segredos do repositório `SUPABASE_URL` e `SUPABASE_ANON_KEY`; o despertador chama a função `ping()` (funciona com o banco fechado); o backup precisa de `SUPABASE_BACKUP_KEY` (chave secreta do Supabase, só no GitHub) depois da virada.

Dentro do código:

- `DB_DECORE`, `DB_REAL`: preços por produto, família e coleção (`p` = preço/m², `fw` = largura máxima do tecido, 99 = sem limite).
- `ACC_DECORE`, `ACC_REAL`: acessórios e opcionais.
- `IMPOSTOS_PE`, `getTipoImposto()`: impostos da Decore.
- `FABRIC_W_DECORE`, `TUBOS_REAL`: larguras de tecido e tubos.
- `STATE`: estado da tela. `calcular()` é o cálculo principal.
- Carrinho e orçamentos: `editarItemCarrinho()` (restaura cascata, acessórios via `accSelections`, extras) e `reopenOrc()` (usa `EDITING_ORC_ID` para ATUALIZAR em vez de duplicar).
- Fluxo de telas: `irParaTab()` troca a tela (`inicio`, `hist`, `novo`, `orc`, `calc`, `proposta`; a Proposta abre pela pasta) e marca `body[data-tela]`. Lista = `renderHistory()`/`filtrarHistorico()`; novo orçamento = `criarOrcamento()` (já grava no banco e ganha número CDP); pasta = `abrirPasta()`/`renderPasta()`; salvar = `saveOrcamento()` (sempre fecha e volta à lista). `ORC_SUJO` = há alteração não salva. Fechar/perdido/reabrir = `fecharOrcamento()`, `perdidoOrcamento()`, `reabrirOrcamento()` em `js/pasta.js`; fechado e perdido ficam travados (o banco recusa mudar itens/valores de fechado). Evoluir = `evoluirOrcamento()` (novo orçamento com `anterior_id`). Cada item guarda `tabelaVer` (tabela usada no cálculo). No computador (≥1100px) com orçamento aberto, `irParaTab()` liga `body.lado-a-lado`: pasta fixa à esquerda e calculadora à direita (`ladoALado()`, `ajustarLado()`); no celular nada muda.

## Zonas proibidas sem aprovação explícita

- Estrutura do banco no Supabase (criar, apagar ou renomear tabelas e colunas). Se precisar, escreva o comando SQL, explique o que ele faz, ensaie num Postgres local e só aplique com o ok da Bru (ou ela executa). Guarde o comando em `sql/`. A ferramenta de migração do Supabase cancela comandos que contêm "drop": prefira `create or replace` / `set default`.
- Login, usuários e senhas.
- Qualquer fórmula da seção "Fábricas e fórmulas".
- **Nunca** coloque no repositório a chave `service_role` do Supabase, senhas ou dados de clientes. A chave pública (anon) que já está no HTML pode ficar.

## Como testar (obrigatório antes de propor aprovação)

1. Rode o `index.html` num navegador simulado (jsdom, carregando os scripts locais de `js/`) e confirme **zero erros de JavaScript**.
2. Para qualquer mudança de preço ou fórmula, compare **antes x depois** chamando `calcular()` com casos reais (pelo menos: uma Rolô, uma Romana, uma Vertical, uma Horizontal, um Double Vision, e uma Cortina Tradicional CDP). Mostre à Bru uma tabela com os valores à vista antes e depois.
3. Teste também **reabrir um orçamento salvo antigo** e editar um item. Orçamentos anteriores podem não ter todos os campos novos (ex.: acessórios salvos só existem a partir da v40).
4. Teste a tela em largura de celular (~360px).

## Atualização de tabela de fábrica (roteiro)

Quando chegar tabela nova (Real ou Decore):
1. Use a aba oficial da planilha (na Decore, a aba "Tabela", não a "Tabela Base").
2. Gere um relatório: itens com custo alterado (com %), itens novos, itens removidos, regras que mudaram (medidas mínimas e máximas, prazos, acessórios).
3. Aponte inconsistências antes de aplicar.
4. Atualize a versão e a data da tabela em `TABELAS_INFO` (`js/precos.js`). Ela aparece sozinha no botão da fábrica e no aviso abaixo dos valores. A CDP ainda não tem data registrada: peça à Bru.
5. Lembre a Bru: orçamentos em aberto dos itens que subiram devem ser recalculados antes de gerar a OS.

## Regras do negócio que o sistema precisa respeitar

- **Jornada:** contato → pré-orçamento (ou visita direta) → visita técnica → orçamento final → fechamento → OS + pagamento validado → pedido e produção → instalação → garantia/pós-venda. Só entra no sistema quem pede orçamento.
- **Comprovante ≠ pagamento:** nada vai para a produção sem a validação financeira registrada (Madeleine é a única com acesso ao banco). SLA de 4h úteis para validar.
- **Alçada de desconto:** Bru e Mirelle até 3–5%, caso a caso; acima disso, aprovação da Madeleine.
- **Olist Tiny é a fonte da verdade** de cadastro do cliente, pedido de venda, OS, parcelas e nota fiscal. O sistema não duplica isso: guarda o nº do pedido de venda do Tiny. A proposta/orçamento NÃO é lançada no Tiny. Integração pela API v3 oficial do Olist (plano da loja: Evoluir): leitura de clientes depois do login fechado (fim da fase 1); criação de cliente e pedido de venda na fase 6. Chaves do Olist só no servidor, nunca no navegador.
- **Follow-up do pré-orçamento:** até 3 lembretes, a cada 3 dias; depois sugere "Perdido · sem retorno".
- **Orçamento pós-visita:** enviar em 1 dia útil (limite 2).
- **Garantia:** 1 ano para produtos novos, 3 meses para serviços; primeiro retorno no mesmo dia útil; visita que não é defeito (ou fora da garantia) cobra taxa.
- **Agenda:** a Agenda CLIENTES CDP (Google) continua sendo a dos técnicos; o sistema lê e sincroniza.
- Custos dos itens são calculados no sistema (tabelas em `js/precos.js`); os portais Decore e Real ficam só para fazer os pedidos.

## Pendências (ordem combinada)

0. Seguir as fases do plano do projeto (link no topo). Fase 0 = este repositório organizado, app instalável, despertador e backup, subdomínio.

1. Atualizar a tabela de Tecido Ateliê com os preços novos e o custo da Vidal.
2. Módulo de Serviços (manutenção, lavagem, instalação). Depende da planilha de preços que a Bru vai preencher com a Madeleine.
