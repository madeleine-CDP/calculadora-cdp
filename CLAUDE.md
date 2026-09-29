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

Calculadora de orçamentos de persianas e cortinas, em **um único arquivo `index.html`** (HTML + CSS + JavaScript juntos, sem build).

- **Hospedagem:** Netlify (`calculadora-cdp.netlify.app`), publicado automaticamente a partir da branch `main`.
- **Dados:** Supabase (projeto `cdp-calculadora`, região sa-east-1). Tabela `orcamentos` guarda os orçamentos salvos, compartilhados entre os usuários.
- **Login:** senhas com hash bcrypt numa tabela própria no Supabase, verificadas por função no servidor. A senha nunca trafega em texto puro nem aparece no código.
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

- `DB_DECORE`, `DB_REAL`: preços por produto, família e coleção (`p` = preço/m², `fw` = largura máxima do tecido, 99 = sem limite).
- `ACC_DECORE`, `ACC_REAL`: acessórios e opcionais.
- `IMPOSTOS_PE`, `getTipoImposto()`: impostos da Decore.
- `FABRIC_W_DECORE`, `TUBOS_REAL`: larguras de tecido e tubos.
- `STATE`: estado da tela. `calcular()` é o cálculo principal.
- Carrinho e orçamentos: `editarItemCarrinho()` (restaura cascata, acessórios via `accSelections`, extras) e `reopenOrc()` (usa `EDITING_ORC_ID` para ATUALIZAR em vez de duplicar).

## Zonas proibidas sem aprovação explícita

- Estrutura do banco no Supabase (criar, apagar ou renomear tabelas e colunas). Se precisar, escreva o comando SQL, explique o que ele faz, e a Bru executa.
- Login, usuários e senhas.
- Qualquer fórmula da seção "Fábricas e fórmulas".
- **Nunca** coloque no repositório a chave `service_role` do Supabase, senhas ou dados de clientes. A chave pública (anon) que já está no HTML pode ficar.

## Como testar (obrigatório antes de propor aprovação)

1. Rode o HTML num navegador simulado (jsdom) e confirme **zero erros de JavaScript**.
2. Para qualquer mudança de preço ou fórmula, compare **antes x depois** chamando `calcular()` com casos reais (pelo menos: uma Rolô, uma Romana, uma Vertical, uma Horizontal, um Double Vision, e uma Cortina Tradicional CDP). Mostre à Bru uma tabela com os valores à vista antes e depois.
3. Teste também **reabrir um orçamento salvo antigo** e editar um item. Orçamentos anteriores podem não ter todos os campos novos (ex.: acessórios salvos só existem a partir da v40).
4. Teste a tela em largura de celular (~360px).

## Atualização de tabela de fábrica (roteiro)

Quando chegar tabela nova (Real ou Decore):
1. Use a aba oficial da planilha (na Decore, a aba "Tabela", não a "Tabela Base").
2. Gere um relatório: itens com custo alterado (com %), itens novos, itens removidos, regras que mudaram (medidas mínimas e máximas, prazos, acessórios).
3. Aponte inconsistências antes de aplicar.
4. Atualize a data da tabela no botão da fábrica na tela inicial.
5. Lembre a Bru: orçamentos em aberto dos itens que subiram devem ser recalculados antes de gerar a OS.

## Pendências (ordem combinada)

1. Atualizar a tabela de Tecido Ateliê com os preços novos e o custo da Vidal.
2. Módulo de Serviços (manutenção, lavagem, instalação). Depende da planilha de preços que a Bru vai preencher com a Madeleine.
