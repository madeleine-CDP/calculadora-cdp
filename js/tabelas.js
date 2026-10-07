// ═══════════════════════════════════════════════════════
// TABELAS DE PREÇO PELA TELA (Fase 2)
// A tabela base de cada fábrica continua em js/precos.js. O banco (precos_ajustes) guarda só os ajustes
// feitos pela tela: reajuste geral (%) ou preço corrigido de uma coleção/acessório.
// As FÓRMULAS não mudam: só o preço de tabela da fábrica (p da coleção / cor do acessório).
// Cada reajuste é um "lote" que pode ser desfeito. valor_base = preço do código na hora do ajuste;
// se a base do código mudar (tabela nova inteira), o ajuste antigo deixa de valer sozinho.
// Só Bruna e Madeleine (admin/dona) salvam; todos leem e calculam com os ajustes.
// ═══════════════════════════════════════════════════════
const PRECO_FONTES = {
  real: { db: DB_REAL, acc: ACC_REAL },
  dec:  { db: DB_DECORE, acc: ACC_DECORE }
};
const TABELAS_INFO_CODIGO = JSON.parse(JSON.stringify(TABELAS_INFO));
const COR_ACC = { W: 'branco/preto', C: 'outras cores', p: '' };

// Todos os "pontos de preço" de uma fábrica (coleções, subcoleções e acessórios)
function pontosDePreco(fab){
  const f = PRECO_FONTES[fab]; if(!f) return [];
  const out = [];
  Object.entries(f.db).forEach(([chave, fam]) => {
    const [, prod, famN] = chave.split('|');
    if(fam.cols) Object.entries(fam.cols).forEach(([col, info]) => {
      if(typeof info.p === 'number') out.push({ fab, tipo: 'colecao', chave, item: col, prod, fam: famN, col, rotulo: `${prod} · ${famN} · ${col}`, obj: info, campo: 'p' });
    });
    if(fam.subCols) Object.entries(fam.subCols).forEach(([sub, cols]) => Object.entries(cols).forEach(([col, info]) => {
      if(typeof info.p === 'number') out.push({ fab, tipo: 'colecao', chave, item: sub + ' › ' + col, prod, fam: famN, col, sub, rotulo: `${prod} · ${famN} · ${sub} · ${col}`, obj: info, campo: 'p' });
    }));
  });
  f.acc.forEach(sec => sec.items.forEach(it => {
    if(it.cor) Object.keys(it.cor).forEach(k => {
      if(typeof it.cor[k] === 'number') out.push({ fab, tipo: 'acessorio', chave: it.id, item: k, prod: 'Acessórios', rotulo: `Acessório · ${it.l}${Object.keys(it.cor).length > 1 ? ' (' + (COR_ACC[k] || k) + ')' : ''}`, obj: it.cor, campo: k });
    });
    if(typeof it.p === 'number') out.push({ fab, tipo: 'acessorio', chave: it.id, item: 'p', prod: 'Acessórios', rotulo: `Acessório · ${it.l}`, obj: it, campo: 'p' });
  }));
  return out;
}
const chavePonto = p => [p.fab || p.fabrica, p.tipo, p.chave, p.item].join('|');

// Preços do código, guardados antes de qualquer ajuste
const PRECO_BASE = {};
['real', 'dec'].forEach(fab => pontosDePreco(fab).forEach(p => { PRECO_BASE[chavePonto(p)] = p.obj[p.campo]; }));

let PRECOS_AJUSTES = [];       // ajustes ativos (do banco)
let PRECOS_OBSOLETOS = 0;

function aplicarAjustesPreco(){
  const idx = {};
  ['real', 'dec'].forEach(fab => pontosDePreco(fab).forEach(p => { idx[chavePonto(p)] = p; p.obj[p.campo] = PRECO_BASE[chavePonto(p)]; }));
  PRECOS_OBSOLETOS = 0;
  const ultimaVersao = {};
  PRECOS_AJUSTES.forEach(a => {
    const k = chavePonto(a), p = idx[k];
    if(!p) return;
    if(Math.abs(Number(PRECO_BASE[k]) - Number(a.valor_base)) > 0.005){ PRECOS_OBSOLETOS++; return; }  // tabela base mudou depois
    p.obj[p.campo] = Number(a.valor_novo);
    if(a.versao) ultimaVersao[a.fabrica] = a;
  });
  ['real', 'dec'].forEach(fab => {
    const a = ultimaVersao[fab];
    TABELAS_INFO[fab] = a ? Object.assign({}, TABELAS_INFO_CODIGO[fab], { tabela: a.versao, data: a.vigencia || '', rotulo: 'vigente desde' }) : Object.assign({}, TABELAS_INFO_CODIGO[fab]);
  });
  if(typeof preencherDatasTabelas === 'function') preencherDatasTabelas();
}

async function carregarAjustesPreco(){
  try{
    const r = await sbFetch('/rest/v1/precos_ajustes?select=*&ativo=eq.true&order=criado_em.asc,id.asc');
    if(!r.ok) return false;
    PRECOS_AJUSTES = await r.json();
    aplicarAjustesPreco();
    return true;
  }catch(e){ return false; }
}
document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
  if(typeof lerAuth === 'function' && lerAuth()) carregarAjustesPreco();
}, 0));

// ── Tela ──
let TP_FAB = 'dec', TP_EDITADOS = {}, TP_LOTES = [];
const tpEhGestora = () => { const a = (typeof AUTH !== 'undefined' && AUTH) || {}; return a.papel === 'admin' || a.papel === 'dona'; };
const fmtP = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctTexto = v => (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
function numBR(t){ const s = String(t || '').trim().replace(/\s|%|R\$/g, ''); if(!s) return NaN; return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); }

async function abrirTabelasPreco(){
  irParaTab('precos');
  window.scrollTo({ top: 0 });
  TP_EDITADOS = {};
  await carregarAjustesPreco();
  renderTabelasPreco();
  carregarLotes();
}

function renderTabelasPreco(){
  const box = $('tp-conteudo'); if(!box) return;
  if(!tpEhGestora()){ box.innerHTML = '<div class="hist-empty">Só a Bruna e a Madeleine atualizam as tabelas de preço.</div>'; return; }
  const info = TABELAS_INFO[TP_FAB] || {};
  const pontos = pontosDePreco(TP_FAB);
  const prods = [...new Set(pontos.filter(p => p.tipo === 'colecao').map(p => p.prod))];
  const ativos = PRECOS_AJUSTES.filter(a => a.fabrica === TP_FAB).length;
  box.innerHTML = `
    <div class="hist-filtros">${[['dec','Decore'],['real','Real']].map(([f,n]) => `<button type="button" class="hist-chip${TP_FAB===f?' on':''}" onclick="TP_FAB='${f}';TP_EDITADOS={};renderTabelasPreco();renderLotes()">${n}</button>`).join('')}</div>
    <div class="tp-versao">${ic('calendario',15)} <span>Tabela em uso: <b>${escHtml(info.tabela || '')}</b>${info.data ? ' · ' + escHtml(info.rotulo || '') + ' ' + escHtml(info.data) : ''}${ativos ? ' · ' + ativos + ' preço' + (ativos > 1 ? 's' : '') + ' ajustado' + (ativos > 1 ? 's' : '') + ' pela tela' : ''}</span></div>
    ${PRECOS_OBSOLETOS ? `<div class="tp-aviso">${ic('info',15)} ${PRECOS_OBSOLETOS} ajuste(s) antigo(s) deixaram de valer porque a tabela base foi atualizada depois.</div>` : ''}

    <div class="card tp-card">
      <div class="tp-tit">1. Reajuste geral <span>(quando a fábrica sobe tudo em %)</span></div>
      <div class="novo-linha">
        <label class="novo-campo"><span>Aplicar em</span>
          <select id="tp-escopo">
            <option value="tudo">Tudo (coleções e acessórios)</option>
            <option value="colecoes">Só coleções</option>
            <option value="acessorios">Só acessórios</option>
            ${prods.map(p => `<option value="prod:${escHtml(p)}">Só ${escHtml(p)}</option>`).join('')}
          </select></label>
        <label class="novo-campo"><span>Percentual</span>
          <input type="text" id="tp-pct" inputmode="decimal" autocomplete="off" placeholder="Ex.: 6,5 (ou -3 se baixou)"></label>
      </div>
    </div>

    <div class="card tp-card">
      <div class="tp-tit">2. Ajuste por item <span>(corrigir o preço de uma coleção ou acessório)</span></div>
      <input type="search" id="tp-busca" class="tp-busca" placeholder="Buscar coleção ou acessório (ex.: Delta, bandô)" autocomplete="off" oninput="renderBuscaPreco()">
      <div id="tp-res" class="tp-res"></div>
      <div id="tp-editados" class="tp-editados"></div>
    </div>

    <div class="card tp-card">
      <div class="tp-tit">3. Nova versão da tabela <span>(opcional)</span></div>
      <div class="novo-linha">
        <label class="novo-campo"><span>Nome da versão</span><input type="text" id="tp-versao" autocomplete="off" placeholder="Ex.: Novembro/2026"></label>
        <label class="novo-campo"><span>Vigente desde</span><input type="date" id="tp-vig"></label>
      </div>
    </div>

    <div class="tp-barra"><button type="button" class="btn" onclick="conferirReajuste()">${ic('ver',17)} Conferir antes de salvar</button></div>

    <div class="tp-hist-tit">Histórico de reajustes</div>
    <div id="tp-lotes" class="tp-lotes"><div class="olist-msg">Carregando…</div></div>`;
  renderEditados();
}

function renderBuscaPreco(){
  const t = semAcento($('tp-busca').value.trim());
  const res = $('tp-res');
  if(t.length < 2){ res.innerHTML = ''; return; }
  const achados = pontosDePreco(TP_FAB).filter(p => semAcento(p.rotulo).includes(t)).slice(0, 30);
  res.innerHTML = achados.length ? achados.map(p => {
    const k = chavePonto(p);
    return `<div class="tp-item"><span>${escHtml(p.rotulo)}</span><em>atual ${fmtP(p.obj[p.campo])}</em>
      <input type="text" inputmode="decimal" placeholder="novo preço" value="${TP_EDITADOS[k] != null ? String(TP_EDITADOS[k]).replace('.', ',') : ''}" data-k="${escHtml(k)}" onchange="editarPrecoItem(this)"></div>`;
  }).join('') : '<div class="olist-msg">Nada encontrado.</div>';
}
function editarPrecoItem(el){
  const v = numBR(el.value);
  if(!el.value.trim()){ delete TP_EDITADOS[el.dataset.k]; }
  else if(!(v > 0)){ avisoTopo('Preço inválido.'); el.value = ''; delete TP_EDITADOS[el.dataset.k]; }
  else TP_EDITADOS[el.dataset.k] = Math.round(v * 100) / 100;
  renderEditados();
}
function renderEditados(){
  const box = $('tp-editados'); if(!box) return;
  const idx = {}; pontosDePreco(TP_FAB).forEach(p => idx[chavePonto(p)] = p);
  const l = Object.entries(TP_EDITADOS).filter(([k]) => idx[k]);
  box.innerHTML = l.length ? '<div class="tp-sub">Itens que você vai corrigir:</div>' + l.map(([k, v]) => `<div class="tp-ed"><span>${escHtml(idx[k].rotulo)}</span><em>${fmtP(idx[k].obj[idx[k].campo])} → <b>${fmtP(v)}</b></em><button type="button" class="ret-link" onclick="delete TP_EDITADOS['${escHtml(k).replace(/'/g, "\\'")}'];renderEditados();renderBuscaPreco()">tirar</button></div>`).join('') : '';
}

// Monta a lista de mudanças (reajuste geral + itens) sem salvar
function montarMudancas(){
  const pct = numBR($('tp-pct').value);
  const escopo = $('tp-escopo').value;
  const mud = new Map();
  if(!isNaN(pct) && pct !== 0){
    pontosDePreco(TP_FAB).filter(p => escopo === 'tudo' || (escopo === 'colecoes' && p.tipo === 'colecao') || (escopo === 'acessorios' && p.tipo === 'acessorio') || (escopo.startsWith('prod:') && p.tipo === 'colecao' && p.prod === escopo.slice(5)))
      .forEach(p => { const atual = p.obj[p.campo]; mud.set(chavePonto(p), { p, atual, novo: Math.round(atual * (1 + pct / 100) * 100) / 100 }); });
  }
  const idx = {}; pontosDePreco(TP_FAB).forEach(p => idx[chavePonto(p)] = p);
  Object.entries(TP_EDITADOS).forEach(([k, v]) => { const p = idx[k]; if(p) mud.set(k, { p, atual: p.obj[p.campo], novo: v }); });
  return { pct, escopo, lista: [...mud.values()].filter(m => Math.abs(m.novo - m.atual) >= 0.005) };
}

function conferirReajuste(){
  const { pct, escopo, lista } = montarMudancas();
  const versao = $('tp-versao').value.trim(), vig = $('tp-vig').value;
  if(!lista.length && !versao){ avisoTopo('Nada para salvar: informe um percentual, corrija algum item ou dê nome a uma nova versão.'); return; }
  if(!isNaN(pct) && Math.abs(pct) > 40){ avisoTopo('Percentual muito alto (' + pctTexto(pct) + '). Confira o número.'); return; }
  const vars = lista.map(m => (m.novo / m.atual - 1) * 100);
  const ord = lista.slice().sort((a, b) => a.atual - b.atual);
  const exemplos = ord.length <= 5 ? ord : [0, Math.floor(ord.length / 4), Math.floor(ord.length / 2), Math.floor(3 * ord.length / 4), ord.length - 1].map(i => ord[i]);
  // orçamentos em aberto com itens das coleções que SUBIRAM
  const subiram = lista.filter(m => m.novo > m.atual && m.p.tipo === 'colecao');
  const afetados = (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).filter(e => e.etapa !== 'fechado' && e.etapa !== 'perdido' && (e.items || []).some(it =>
    it.fab === TP_FAB && subiram.some(m => it.prod === m.p.prod && it.fam === m.p.fam && String(it.col || '').includes(m.p.col))));
  const desc = [!isNaN(pct) && pct ? 'Reajuste geral ' + pctTexto(pct) + ' (' + $('tp-escopo').selectedOptions[0].textContent.trim().toLowerCase() + ')' : '', Object.keys(TP_EDITADOS).length ? Object.keys(TP_EDITADOS).length + ' item(ns) corrigido(s)' : ''].filter(Boolean).join(' + ') || 'Nova versão';
  abrirModal('Conferir reajuste · ' + (TP_FAB === 'dec' ? 'Decore' : 'Real'), `
    <p><b>${escHtml(desc)}</b>${versao ? '<br>Nova versão: <b>' + escHtml(versao) + '</b>' + (vig ? ' · vigente desde ' + escHtml(vig.split('-').reverse().join('/')) : '') : ''}</p>
    ${lista.length ? `<div class="tp-rel">
      <div><strong>${lista.length}</strong><span>preços mudam</span></div>
      <div><strong>${pctTexto(Math.min(...vars))}</strong><span>menor variação</span></div>
      <div><strong>${pctTexto(Math.max(...vars))}</strong><span>maior variação</span></div>
    </div>
    <div class="tp-sub">Exemplos (preço de tabela da fábrica, antes → depois):</div>
    ${exemplos.map(m => `<div class="tp-ed"><span>${escHtml(m.p.rotulo)}</span><em>${fmtP(m.atual)} → <b>${fmtP(m.novo)}</b></em></div>`).join('')}
    <p class="tp-nota">O valor à vista, cartão e tabela ao cliente acompanham na mesma proporção, pelas fórmulas de sempre.</p>` : '<p>Nenhum preço muda: só o nome/data da versão.</p>'}
    ${afetados.length ? `<div class="tp-aviso">${ic('alerta',15)} <span><b>${afetados.length} orçamento(s) em aberto</b> têm itens que subiram: ${afetados.slice(0, 6).map(e => escHtml(numCDP(e.numero) || e.client)).join(', ')}${afetados.length > 6 ? '…' : ''}. Recalcule antes de gerar a OS.</span></div>` : ''}`,
    ic('ok',16) + ' Salvar reajuste', () => salvarReajuste(lista, desc, versao, vig));
}

async function salvarReajuste(lista, desc, versao, vig){
  const lote = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  const vigTxt = vig ? vig.split('-').reverse().join('/') : '';
  let linhas = lista.map(m => ({ lote, fabrica: TP_FAB, tipo: m.p.tipo, chave: m.p.chave, item: m.p.item, valor_base: PRECO_BASE[chavePonto(m.p)], valor_novo: m.novo, descricao: desc, versao: versao || null, vigencia: vigTxt || null }));
  if(!linhas.length && versao){
    // só versão nova: registra um ajuste "neutro" no primeiro ponto para guardar a versão
    const p = pontosDePreco(TP_FAB)[0];
    linhas = [{ lote, fabrica: TP_FAB, tipo: p.tipo, chave: p.chave, item: p.item, valor_base: PRECO_BASE[chavePonto(p)], valor_novo: p.obj[p.campo], descricao: desc, versao, vigencia: vigTxt || null }];
  }
  try{
    for(let i = 0; i < linhas.length; i += 200){
      const r = await sbFetch('/rest/v1/precos_ajustes', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(linhas.slice(i, i + 200)) });
      if(!r.ok) throw new Error(r.status + ' ' + await r.text());
    }
  }catch(e){
    $('modal-erro').textContent = 'Não foi possível salvar. Verifique a conexão e tente de novo.';
    console.error(e);
    return;
  }
  fecharModal();
  await carregarAjustesPreco();
  TP_EDITADOS = {};
  renderTabelasPreco(); carregarLotes();
  avisoTopo('Reajuste salvo. Os novos cálculos já usam os preços novos.');
}

async function carregarLotes(){
  try{
    const r = await sbFetch('/rest/v1/precos_ajustes?select=lote,fabrica,descricao,versao,vigencia,ativo,criado_por,criado_em&order=criado_em.desc&limit=5000');
    if(!r.ok) throw new Error(r.status);
    const m = new Map();
    (await r.json()).forEach(a => { if(!m.has(a.lote)) m.set(a.lote, Object.assign({ n: 0 }, a)); m.get(a.lote).n++; });
    TP_LOTES = [...m.values()];
  }catch(e){ TP_LOTES = null; }
  renderLotes();
}
function renderLotes(){
  const box = $('tp-lotes'); if(!box) return;
  if(TP_LOTES === null){ box.innerHTML = '<div class="olist-msg">Não foi possível carregar o histórico.</div>'; return; }
  const l = TP_LOTES.filter(x => x.fabrica === TP_FAB);
  box.innerHTML = l.length ? l.map(x => `<div class="tp-lote${x.ativo ? '' : ' desfeito'}">
      <div><strong>${escHtml(x.descricao || 'Ajuste')}</strong>
        <span>${x.versao ? escHtml(x.versao) + ' · ' : ''}${x.n} preço(s) · ${escHtml(x.criado_por || '')} · ${new Date(x.criado_em).toLocaleDateString('pt-BR')}${x.ativo ? '' : ' · <b>desfeito</b>'}</span></div>
      ${x.ativo ? `<button type="button" class="btn-outline" onclick="desfazerLote('${x.lote}')">Desfazer</button>` : ''}
    </div>`).join('') : '<div class="olist-msg">Nenhum reajuste feito pela tela ainda.</div>';
}
function desfazerLote(lote){
  const x = TP_LOTES.find(y => y.lote === lote); if(!x) return;
  abrirModal('Desfazer reajuste?', `<p>“${escHtml(x.descricao || 'Ajuste')}” (${x.n} preço(s)) deixa de valer e os preços voltam ao que eram antes dele. Fica registrado no histórico.</p>`,
    'Desfazer', async () => {
      const r = await sbFetch('/rest/v1/precos_ajustes?lote=eq.' + lote, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ ativo: false }) });
      if(!r.ok){ $('modal-erro').textContent = 'Não foi possível desfazer. Tente de novo.'; return; }
      fecharModal(); await carregarAjustesPreco(); renderTabelasPreco(); carregarLotes();
      avisoTopo('Reajuste desfeito.');
    });
}
