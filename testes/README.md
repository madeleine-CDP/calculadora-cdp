# Testes do CDP Sistema

Nada aqui toca em dados reais: o banco (Supabase), o Olist e a Agenda são **simulados** dentro de cada teste.

## 1. Testes de tela (obrigatórios antes de propor aprovação)
- Pasta `testes/tela/` — um arquivo por módulo (Playwright em Python + Chromium já instalado no ambiente).
- Rodar: `bash testes/rodar_tela.sh` (sobe um servidor local na porta 8766 e roda todos).
- Cada teste deve terminar com `ERROS JS: []` e sem `Traceback`.
- A maioria roda em largura de celular (360px); `teste_etapa1.py` testa também o computador (1366px).
- Quando uma mudança de comportamento é intencional, **atualize o teste** (ex.: a janela de saída trocou o `confirm()` do navegador pela janela própria `#modal-sair`).

| Arquivo | O que cobre |
|---|---|
| teste_login | login, senha provisória |
| teste_c1 / c2 / c3b / c3c / c4 | lista de orçamentos, novo orçamento, pasta, salvar/sair, perdido |
| teste_d1 / d2 | calculadora em passos, cálculo rápido |
| teste_e1 | Início |
| teste_etapa1 | cidade com lista, painel do item, detalhamento (TAMANHO CORTINA + acessórios), janela de saída |
| teste_etapa2 | retornos por responsável no Início, lembrete de cobrança da OS |
| teste_cidade, teste_semlocal | cidade/UF e "cliente não informou" |
| teste_combos | combinações (opções A–D) na proposta |
| teste_ret | retornos |
| teste_precos | tabelas de preço pela tela |
| teste_olist | busca de cliente no Olist |
| teste_agenda, teste_conf | agenda e confirmações (copiar mensagem, já enviei, desfazer) |
| teste_gar | garantia e pós-venda |
| teste_fech | fechamento (6 passos, validação só da Madeleine) |
| teste_ped | pedidos por fase |
| teste_nf | nota fiscal das entregues (emitir, enviar, fora do Tiny, enviada por e-mail pelo Olist) |
| teste_aviso, teste_b, teste_cfg | avisos, etapa B, configurações/links |

## 2. Testes de cálculo (obrigatórios em qualquer mudança de preço ou fórmula)
- Pasta `testes/calculos/` (Node + jsdom). Instalar uma vez: `cd testes/calculos && npm install jsdom`.
- `teste.js ANTES/index.html DEPOIS/index.html` — compara 288 cálculos (3 coleções de cada produto de cada fábrica × 3 medidas) e conta erros de JavaScript. Para ter o "ANTES": `git archive main | tar -x -C /tmp/antes`.
  Resultado esperado quando a fórmula NÃO mudou: `iguais: 288, diferentes: 0` e `Erros de JavaScript — original: 0 | nova: 0`.
- `teste_reducao.js ANTES/index.html DEPOIS/index.html` — limite da redução de peso da Decore (1,80m / 2,00m).
- `teste_reajuste.js index.html` — reajuste pela tela (+10% → à vista ~+10%; desfazer = idêntico).
- Para mudança de fórmula, mostrar à Bru a tabela antes × depois (Rolô, Romana, Vertical, Horizontal, Double Vision, Cortina Tradicional CDP).
