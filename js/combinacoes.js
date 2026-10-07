// ═══════════════════════════════════════════════════════
// OPÇÕES E COMBINAÇÕES (clientes indecisos)
// • Cada item pode ter uma Opção (A, B, C, D) dentro do seu ambiente; sem opção = entra sempre.
//   Itens com a mesma letra no mesmo ambiente somam juntos (ex.: Opção A = rolô + bandô).
// • Um ambiente pode ser "opcional" (o cliente pode não fazer) → entra a combinação "sem ele".
// • A proposta mostra os totais das combinações escolhidas (Tabela · Cartão · À vista).
// Fica tudo dentro dos itens (item.opcao, item.ambienteOpcional): não precisa mexer no banco.
// ═══════════════════════════════════════════════════════
const LETRAS_OPCAO = ['A', 'B', 'C', 'D'];
const LIMITE_COMBINACOES = 200;
let COMBOS_SEL = null;      // chaves das combinações marcadas para a proposta (null = escolha automática)
let COMBOS_NOMES = {};      // chave → nome dado pela Bru (ex.: "Essencial")

const chaveAmb = a => (a || 'Sem ambiente').trim().toLowerCase();

// Ambientes na ordem em que aparecem, com suas escolhas possíveis
function ambientesComEscolhas(itens){
  const mapa = new Map();
  itens.forEach(it => {
    const k = chaveAmb(it.ambiente);
    if(!mapa.has(k)) mapa.set(k, { chave: k, nome: (it.ambiente || 'Sem ambiente').trim(), itens: [], opcional: false });
    const a = mapa.get(k);
    a.itens.push(it);
    if(it.ambienteOpcional) a.opcional = true;
  });
  return [...mapa.values()].map(a => {
    const fixos = a.itens.filter(i => !i.opcao);
    const letras = [...new Set(a.itens.filter(i => i.opcao).map(i => i.opcao))].sort();
    const escolhas = letras.length
      ? letras.map(l => ({ letra: l, itens: fixos.concat(a.itens.filter(i => i.opcao === l)) }))
      : [{ letra: '', itens: fixos }];
    if(a.opcional) escolhas.push({ letra: 'sem', itens: [] });
    return { ...a, letras, escolhas };
  });
}

function somar(itens){
  return itens.reduce((t, i) => ({ tabela: t.tabela + (i.tabela||0), cartao: t.cartao + (i.cartao||0), avista: t.avista + (i.avista||0) }),
                      { tabela: 0, cartao: 0, avista: 0 });
}

// Todas as combinações (uma escolha por ambiente)
function gerarCombinacoes(itens){
  const ambs = ambientesComEscolhas(itens);
  let combos = [{ partes: [], itens: [] }];
  for(const a of ambs){
    const novo = [];
    for(const c of combos){
      for(const e of a.escolhas){
        novo.push({ partes: c.partes.concat([{ amb: a, escolha: e }]), itens: c.itens.concat(e.itens) });
        if(novo.length > LIMITE_COMBINACOES) break;
      }
      if(novo.length > LIMITE_COMBINACOES) break;
    }
    combos = novo;
  }
  return combos.map(c => {
    const variaveis = c.partes.filter(p => p.amb.escolhas.length > 1);
    const chave = c.partes.map(p => p.amb.chave + ':' + (p.escolha.letra || '-')).join('|');
    const rotulo = variaveis.length
      ? variaveis.map(p => p.escolha.letra === 'sem' ? 'sem ' + p.amb.nome : p.amb.nome + (p.escolha.letra ? ' ' + p.escolha.letra : '')).join(' + ').replace(/ \+ sem /g, ' · sem ')
      : 'Proposta completa';
    return { chave, rotulo, totais: somar(c.itens), qtdItens: c.itens.length };
  }).filter(c => c.qtdItens > 0);
}

function temAlternativas(itens){ return ambientesComEscolhas(itens).some(a => a.escolhas.length > 1); }

// Escolha automática: mais barata, mais completa e as do meio (até 6)
function selecaoPadrao(combos){
  const ord = [...combos].sort((x, y) => x.totais.avista - y.totais.avista);
  if(ord.length <= 6) return ord.map(c => c.chave);
  const idx = new Set([0, ord.length - 1]);
  for(let k = 1; idx.size < 6; k++) idx.add(Math.round(k * (ord.length - 1) / 5));
  return [...idx].sort((a, b) => a - b).map(i => ord[i].chave);
}

function combosEscolhidos(itens){
  const todos = gerarCombinacoes(itens);
  const sel = COMBOS_SEL && COMBOS_SEL.length ? COMBOS_SEL : selecaoPadrao(todos);
  return todos.filter(c => sel.includes(c.chave)).sort((x, y) => x.totais.avista - y.totais.avista);
}

// ── Pasta: opção do item e ambiente opcional ──
function mudarOpcaoItem(id, letra){
  const it = CART.find(x => x.id === id); if(!it) return;
  if(letra) it.opcao = letra; else delete it.opcao;
  COMBOS_SEL = null;
  ORC_SUJO = true;
  renderPasta();
}
function mudarAmbOpcional(chave, marcado){
  CART.forEach(it => { if(chaveAmb(it.ambiente) === chave){ if(marcado) it.ambienteOpcional = true; else delete it.ambienteOpcional; } });
  COMBOS_SEL = null;
  ORC_SUJO = true;
  renderPasta();
}

// Faixa de totais para a pasta (quando há alternativas)
function faixaTotais(itens){
  if(!temAlternativas(itens)) return null;
  const c = gerarCombinacoes(itens);
  if(!c.length) return null;
  const av = c.map(x => x.totais.avista);
  return { min: Math.min(...av), max: Math.max(...av), n: c.length };
}

// ── Tela da Proposta: escolher quais combinações vão para o cliente ──
function renderCombosProposta(){
  const box = $('p-combos'); if(!box) return;
  const itens = CART;
  if(!itens.length || !temAlternativas(itens)){ box.innerHTML = ''; return; }
  const todos = gerarCombinacoes(itens).sort((x, y) => x.totais.avista - y.totais.avista);
  if(!COMBOS_SEL) COMBOS_SEL = selecaoPadrao(todos);
  box.innerHTML = `<div class="combos-config">
    <div class="combos-tit">Combinações para a proposta <span>${todos.length}${todos.length > LIMITE_COMBINACOES ? '+' : ''} possíveis · ${COMBOS_SEL.length} marcadas</span></div>
    <div class="combos-dica">Marque as que vão aparecer para o cliente. Dê um nome se quiser (ex.: Essencial, Completa).</div>
    <div class="combos-lista">${todos.map(c => `
      <label class="combo-linha${COMBOS_SEL.includes(c.chave) ? ' on' : ''}">
        <input type="checkbox" ${COMBOS_SEL.includes(c.chave) ? 'checked' : ''} onchange="marcarCombo('${escHtml(c.chave)}', this.checked)">
        <span class="combo-rot">${escHtml(c.rotulo)}</span>
        <input type="text" class="combo-nome" placeholder="nome (opcional)" value="${escHtml(COMBOS_NOMES[c.chave] || '')}" oninput="COMBOS_NOMES['${escHtml(c.chave)}'] = this.value" onclick="event.stopPropagation()">
        <span class="combo-val">${fmtCent(c.totais.avista)}</span>
      </label>`).join('')}</div>
    <div class="combos-acoes"><button type="button" class="btn-outline" onclick="COMBOS_SEL = null; renderCombosProposta()">Sugestão automática</button>
      <button type="button" class="btn-outline" onclick="COMBOS_SEL = gerarCombinacoes(CART).map(c => c.chave).slice(0, 30); renderCombosProposta()">Marcar todas</button></div>
  </div>`;
}
function marcarCombo(chave, on){
  COMBOS_SEL = (COMBOS_SEL || []).filter(k => k !== chave);
  if(on) COMBOS_SEL.push(chave);
  renderCombosProposta();
}

// ── Na proposta (documento): rótulo do ambiente e quadro de totais ──
function rotuloItemProposta(item){
  let r = item.label || item.ambiente || 'Item';
  if(item.opcao) r += ' (OPÇÃO ' + item.opcao + ')';
  if(item.ambienteOpcional) r += '<br><span style="font-weight:400">(OPCIONAL)</span>';
  return r;
}

function ambientesListaProposta(itens){
  return ambientesComEscolhas(itens).map(a => {
    let t = a.nome.toUpperCase();
    if(a.letras.length > 1) t += ' (OPÇÕES ' + a.letras.join(', ').replace(/, ([^,]*)$/, ' E $1') + ')';
    else if(a.letras.length === 1) t += ' (OPÇÃO ' + a.letras[0] + ')';
    if(a.opcional) t += ' · OPCIONAL';
    return t;
  }).join(', ');
}

// Quadro "Valor total da proposta": uma linha (como hoje) ou uma linha por combinação
function quadroTotaisProposta(itens, somaTabela, somaCartao, somaAvista){
  const cab = `<tr>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px">🏷️PREÇO TABELA</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#EBF2F9">💳PREÇO CARTÃO</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#E8F3E1">💵PREÇO À VISTA</td>
            </tr>`;
  const linha = (t, rot) => `${rot ? `<tr><td colspan="3" style="padding:6px 10px;border:1px solid #DDD;background:#F2F2F2;font-size:10.5px;font-weight:700;color:#5B3E3B;text-align:left">${rot}</td></tr>` : ''}
            <tr>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;color:#C0392B;text-decoration:line-through;white-space:nowrap">${fmtCent(t.tabela)}</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-weight:700;background:#EBF2F9;white-space:nowrap">${fmtCent(t.cartao)}</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-weight:700;background:#E8F3E1;white-space:nowrap">${fmtCent(t.avista)}</td>
            </tr>`;
  if(!temAlternativas(itens)){
    return `<table style="width:100%;border-collapse:collapse;font-size:12px">${cab}${linha({ tabela: somaTabela, cartao: somaCartao, avista: somaAvista })}</table>`;
  }
  const combos = combosEscolhidos(itens);
  return `<table style="width:100%;border-collapse:collapse;font-size:12px">${cab}${combos.map((c, n) => {
      const nome = (COMBOS_NOMES[c.chave] || '').trim();
      const rot = (nome ? escHtml(nome.toUpperCase()) + ' · ' : 'OPÇÃO DE TOTAL ' + (n + 1) + ' · ') + escHtml(c.rotulo.toUpperCase());
      return linha(c.totais, rot);
    }).join('')}</table>`;
}
