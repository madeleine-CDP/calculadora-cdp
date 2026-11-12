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
let COMBOS_NOMES = {};
// Como o total aparece na proposta quando há opções (12/11/2026, pedido da Bru):
//  'combos' = combinações marcadas (como antes) · 'faixa' = "a depender das escolhas" (com ou sem faixa de valores)
//  'sugerido' = uma escolha por ambiente (TOTAL_SUG[chave do ambiente] = letra)
let TOTAL_MODO = 'combos', TOTAL_FAIXA = true, TOTAL_SUG = {};      // chave → nome dado pela Bru (ex.: "Essencial")

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
      ? variaveis.map(p => p.escolha.letra === 'sem' ? 'sem ' + p.amb.nome : p.amb.nome + (p.escolha.letra ? ' (opção ' + p.escolha.letra + ')' : '')).join(' + ').replace(/ \+ sem /g, ' · sem ')
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
  const auto = typeof rotuloItem === 'function' && it.label === rotuloItem(it);   // nome automático acompanha a letra
  if(letra) it.opcao = letra; else delete it.opcao;
  if(auto) it.label = rotuloItem(it);
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
  const modo = (m, txt, sub) => `<button type="button" class="total-modo${TOTAL_MODO === m ? ' on' : ''}" onclick="TOTAL_MODO='${m}'; renderCombosProposta()"><strong>${txt}</strong><span>${sub}</span></button>`;
  const topo = `<div class="combos-tit">Como mostrar o total para o cliente</div>
    <div class="total-modos">${modo('faixa', 'A depender das escolhas', 'o total depende das opções')}${modo('sugerido', 'Total sugerido', 'uma escolha por ambiente')}${modo('combos', 'Combinações', 'várias somas prontas')}</div>`;
  if(TOTAL_MODO === 'faixa'){
    box.innerHTML = `<div class="combos-config">${topo}
      <label class="total-faixa-op"><input type="checkbox" ${TOTAL_FAIXA ? 'checked' : ''} onchange="TOTAL_FAIXA=this.checked; renderCombosProposta()"> Mostrar a faixa de valores (das opções mais em conta às mais completas)</label>
      <div class="combos-dica">${TOTAL_FAIXA ? 'De ' + fmtCent(todos[0].totais.avista) + ' a ' + fmtCent(todos[todos.length - 1].totais.avista) + ' à vista.' : 'A proposta mostra só a frase "o valor total depende das opções escolhidas acima".'}</div></div>`;
    return;
  }
  if(TOTAL_MODO === 'sugerido'){
    const ambs = ambientesComEscolhas(itens).filter(a => a.escolhas.length > 1);
    const sug = comboSugerido(itens);
    box.innerHTML = `<div class="combos-config">${topo}
      ${ambs.map(a => `<label class="total-sug-linha"><span>${escHtml(a.nome)}</span><select onchange="TOTAL_SUG['${escHtml(a.chave)}']=this.value; renderCombosProposta()">${a.escolhas.map(e => `<option value="${e.letra}"${escolhaSugerida(a) === e.letra ? ' selected' : ''}>${e.letra === 'sem' ? 'Sem este ambiente' : 'Opção ' + e.letra}</option>`).join('')}</select></label>`).join('')}
      <div class="combos-dica">Total sugerido: <strong>${sug ? fmtCent(sug.totais.avista) : '—'}</strong> à vista.</div></div>`;
    return;
  }
  box.innerHTML = `<div class="combos-config">${topo}
    <div class="combos-tit">Combinações para a proposta <span>${todos.length}${todos.length > LIMITE_COMBINACOES ? '+' : ''} possíveis · ${COMBOS_SEL.length} marcadas</span></div>
    <div class="combos-dica">Marque as que vão aparecer para o cliente. Dê um nome se quiser (ex.: Essencial, Completa).</div>
    <div class="combos-lista">${todos.map(c => `
      <label class="combo-linha${COMBOS_SEL.includes(c.chave) ? ' on' : ''}">
        <input type="checkbox" ${COMBOS_SEL.includes(c.chave) ? 'checked' : ''} onchange="marcarCombo('${escHtml(c.chave)}', this.checked)">
        <span class="combo-rot">${escHtml(c.rotulo)}</span>
        <input type="text" class="combo-nome" placeholder="nome (opcional)" value="${escHtml(COMBOS_NOMES[c.chave] || '')}" oninput="COMBOS_NOMES['${escHtml(c.chave)}'] = this.value" onclick="event.stopPropagation()">
        <span class="combo-val">${fmtCent(c.totais.avista)}</span>
      </label>`).join('')}</div>
    <div class="combos-acoes"><button type="button" class="btn-outline" onclick="atalhoCombos('A')">Todas A</button>
      <button type="button" class="btn-outline" onclick="atalhoCombos('barata')">Mais em conta</button>
      <button type="button" class="btn-outline" onclick="atalhoCombos('cara')">Mais completa</button>
      <button type="button" class="btn-outline" onclick="COMBOS_SEL = null; renderCombosProposta()">Sugestão automática</button>
      <button type="button" class="btn-outline" onclick="COMBOS_SEL = gerarCombinacoes(CART).map(c => c.chave).slice(0, 30); renderCombosProposta()">Marcar todas</button></div>
  </div>`;
}
// Atalhos: acrescentam (ou tiram, se já marcada) uma combinação
function atalhoCombos(tipo){
  const todos = gerarCombinacoes(CART).sort((x, y) => x.totais.avista - y.totais.avista);
  if(!todos.length) return;
  let alvo = tipo === 'barata' ? todos[0] : tipo === 'cara' ? todos[todos.length - 1]
    : todos.find(c => c.chave.split('|').every(p => /:(A|-)$/.test(p)));
  if(!alvo) return;
  COMBOS_SEL = COMBOS_SEL || [];
  if(!COMBOS_SEL.includes(alvo.chave)) COMBOS_SEL.push(alvo.chave);
  renderCombosProposta();
}
function escolhaSugerida(a){
  const v = TOTAL_SUG[a.chave];
  return a.escolhas.some(e => e.letra === v) ? v : a.escolhas[0].letra;
}
function comboSugerido(itens){
  const ambs = ambientesComEscolhas(itens);
  const chave = ambs.map(a => a.chave + ':' + (a.escolhas.length > 1 ? (escolhaSugerida(a) || '-') : (a.escolhas[0].letra || '-'))).join('|');
  return gerarCombinacoes(itens).find(c => c.chave === chave) || null;
}

function marcarCombo(chave, on){
  COMBOS_SEL = (COMBOS_SEL || []).filter(k => k !== chave);
  if(on) COMBOS_SEL.push(chave);
  renderCombosProposta();
}

// ── Na proposta (documento): rótulo do ambiente e quadro de totais ──
function rotuloItemProposta(item){
  // Ambiente · Vão · Opção (o nome automático já traz a opção)
  const auto = typeof rotuloItem === 'function' && (item.vao || item.label === rotuloItem(item));
  let r = escHtml(auto ? rotuloItem(item) : (item.label || item.ambiente || 'Item'));
  if(item.opcao && !auto) r += ' (OPÇÃO ' + item.opcao + ')';
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
  const GILL = "'Gill Sans MT','Gill Sans',Poppins,sans-serif";
  const th = (em, nome, bg) => `<td style="padding:6px;text-align:center;border:1px solid #DDD;background:${bg};font-family:${GILL};font-size:13.5px;color:#7A7268;line-height:1.25"><div style="font-size:13.5px">${em}</div>PREÇO<br><b>${nome}</b></td>`;
  const cab = `<tr>${th('🏷️','TABELA','#FFFFFF')}${th('💳','CARTÃO','#EBF2F9')}${th('💵','À VISTA','#E8F3E1')}</tr>`;
  const val = 'padding:12px 8px;text-align:center;border:1px solid #DDD;font-family:Poppins,sans-serif;font-size:15px;white-space:nowrap';
  const linha = (t, rot) => `${rot ? `<tr><td colspan="3" style="padding:6px 10px;border:1px solid #DDD;background:#F2F2F2;font-family:Poppins,sans-serif;font-size:10.5px;font-weight:700;color:#5B3E3B;text-align:left">${rot}</td></tr>` : ''}
            <tr>
              <td style="${val};color:#7A7268;text-decoration:line-through">${fmtCent(t.tabela)}</td>
              <td style="${val};font-weight:700;color:#3B3838;background:#EBF2F9">${fmtCent(t.cartao)}</td>
              <td style="${val};font-weight:700;color:#3B3838;background:#E8F3E1">${fmtCent(t.avista)}</td>
            </tr>`;
  if(!temAlternativas(itens)){
    return `<table style="width:100%;border-collapse:collapse">${cab}${linha({ tabela: somaTabela, cartao: somaCartao, avista: somaAvista })}</table>`;
  }
  if(TOTAL_MODO === 'faixa'){
    const todos = gerarCombinacoes(itens).sort((x, y) => x.totais.avista - y.totais.avista);
    const frase = `<tr><td colspan="3" style="padding:10px;border:1px solid #DDD;background:#F2F2F2;font-family:Poppins,sans-serif;font-size:11.5px;font-weight:700;color:#5B3E3B;text-align:center">O VALOR TOTAL DEPENDE DAS OPÇÕES ESCOLHIDAS ACIMA</td></tr>`;
    if(!TOTAL_FAIXA || !todos.length) return `<table style="width:100%;border-collapse:collapse">${frase}</table>`;
    return `<table style="width:100%;border-collapse:collapse">${frase}${cab}${linha(todos[0].totais, 'A PARTIR DE (OPÇÕES MAIS EM CONTA)')}${todos.length > 1 ? linha(todos[todos.length - 1].totais, 'ATÉ (OPÇÕES MAIS COMPLETAS)') : ''}</table>`;
  }
  if(TOTAL_MODO === 'sugerido'){
    const c = comboSugerido(itens);
    if(c) return `<table style="width:100%;border-collapse:collapse">${cab}${linha(c.totais, 'TOTAL SUGERIDO · ' + escHtml(c.rotulo.toUpperCase()))}</table>`;
  }
  const combos = combosEscolhidos(itens);
  return `<table style="width:100%;border-collapse:collapse">${cab}${combos.map((c, n) => {
      const nome = (COMBOS_NOMES[c.chave] || '').trim();
      const rot = (nome ? escHtml(nome.toUpperCase()) + ' · ' : 'OPÇÃO DE TOTAL ' + (n + 1) + ' · ') + escHtml(c.rotulo.toUpperCase());
      return linha(c.totais, rot);
    }).join('')}</table>`;
}
