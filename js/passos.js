// ═══════════════════════════════════════════════════════
// CALCULADORA EM PASSOS (Etapa D1)
// Ambiente → Produto → Medidas → Resultado.
// Só organiza a tela: o cálculo continua sendo o calcular() de sempre.
// ═══════════════════════════════════════════════════════
const PASSO_NOMES = { 1: 'Ambiente', 2: 'Produto', 3: 'Medidas', 4: 'Resultado' };
let CALC_OUTRO = false;   // "Adicionar e calcular outro" → depois de adicionar, já começa o próximo item

function erroPasso(msg){
  const el = $('passo-erro');
  el.textContent = msg || '';
  el.classList.toggle('on', !!msg);
  if(msg) el.scrollIntoView({behavior:'smooth', block:'center'});
}

// O que falta para sair do passo n (texto do aviso) — vazio = pode seguir
function faltaNoPasso(n){
  if(n === 1){
    const amb = ($('item-ambiente').value || '').trim();
    if(!amb) return 'Escreva o ambiente deste item (ex.: Sala, Quarto Casal).';
    STATE.ambiente = amb;
    return '';
  }
  if(n === 2){
    if(!STATE.fab) return 'Escolha a fábrica.';
    if(STATE.fab === 'cdp'){
      if(!STATE.cdpTipo) return 'Escolha o tipo da cortina (única ou dupla).';
      if(!STATE.cdpCam1) return 'Escolha o tecido da camada 1.';
      if(STATE.cdpTipo === 'dupla' && !STATE.cdpCam2) return 'Escolha a camada 2 (forro ou blackout).';
      return '';
    }
    if(!STATE.cat) return 'Escolha a categoria.';
    if(!STATE.prod) return 'Escolha o produto.';
    if(!STATE.fam) return 'Escolha a família.';
    if(!STATE.col) return 'Escolha a coleção.';
    return '';
  }
  if(n === 3){
    const w = parseFloat(($('i-w').value || '').replace(',', '.'));
    const h = parseFloat(($('i-h').value || '').replace(',', '.'));
    if(!w) return 'Informe a largura.';
    if(STATE.fab !== 'cdp' && !h) return 'Informe a altura.';
    return '';
  }
  return '';
}

// Roda o cálculo de sempre; true se deu certo
function calcularPasso(){
  STATE.lastResult = null;
  calcular();
  return !!STATE.lastResult;
}

// Vai para o passo n. Para frente, confere cada passo no caminho; o Resultado sempre recalcula.
function irPasso(n, semConferir){
  erroPasso('');
  if(!semConferir && n > 1){
    for(let k = 1; k < n; k++){
      const falta = faltaNoPasso(k);
      if(falta){ PASSO = k; renderPassos(); erroPasso(falta); return false; }
    }
    if(n === 4 && !calcularPasso()){ PASSO = 3; renderPassos(); return false; }
  }
  PASSO = n;
  renderPassos();
  window.scrollTo({top:0});
  if(n === 1) setTimeout(() => { const a = $('item-ambiente'); if(a && !a.value && window.innerWidth > 720) a.focus(); }, 50);
  return true;
}

function passoAvancar(){
  if(PASSO < 3) return irPasso(PASSO + 1);
  if(PASSO === 3) return irPasso(4);
  if(!EDITING_ORC_ID) return usarCalculo('novo');   // Cálculo rápido → criar orçamento
  addToCart();             // passo 4: adiciona (ou substitui) e volta para a pasta
}

function passoVoltar(){
  if(PASSO > 1) return irPasso(PASSO - 1, true);
  if(EDITING_ORC_ID) abrirPasta(); else sairCalculoRapido();
}

function calcularOutro(){ CALC_OUTRO = true; addToCart(); }

function renderPassos(){
  const tab = $('tab-calc'); if(!tab) return;
  tab.dataset.passoAtual = PASSO;
  document.querySelectorAll('#passos li').forEach(li => {
    const p = +li.dataset.p;
    li.className = p === PASSO ? 'atual' : (p < PASSO ? 'feito' : '');
    li.querySelector('button').setAttribute('aria-current', p === PASSO ? 'step' : 'false');
  });

  // contexto: para qual orçamento é este item
  const e = typeof orcEmEdicao === 'function' ? orcEmEdicao() : null;
  const nome = ($('cli-nome').value || '').trim();
  $('passos-contexto').innerHTML = EDITANDO_ITEM_ID
    ? '<strong>Editando item</strong> · ' + escHtml(nome || 'orçamento') + (e ? ' · ' + numCDP(e.numero) : '')
    : (EDITING_ORC_ID
        ? '<strong>Novo item</strong> · Orçamento de ' + escHtml(nome || 'cliente sem nome') + (e ? ' · ' + numCDP(e.numero) : '')
        : '<strong>Cálculo rápido</strong> · sem cliente');
  if(EDITING_ORC_ID) $('passos-contexto').innerHTML += ' <button type="button" class="passos-ver" onclick="abrirPasta()">' + (EDITANDO_ITEM_ID ? 'cancelar edição' : 'ver orçamento') + '</button>';

  // ambiente escolhido, com "Trocar", nos passos 2 a 4
  const amb = ($('item-ambiente').value || '').trim();
  $('passo-amb').innerHTML = (PASSO > 1 && amb)
    ? ic('local',15) + ' Ambiente: <strong>' + escHtml(amb) + '</strong> <button type="button" onclick="irPasso(1, true)">Trocar</button>'
    : '';

  // passo 1: atalhos com os ambientes que o orçamento já tem
  let sug = $('passo-amb-sug');
  if(!sug){ sug = document.createElement('div'); sug.id = 'passo-amb-sug'; sug.className = 'passo-amb-sug'; $('ambiente-card').appendChild(sug); }
  const jaTem = [...new Set(CART.map(i => (i.ambiente||'').trim()).filter(Boolean))];
  sug.innerHTML = jaTem.length
    ? '<span>Já neste orçamento:</span>' + jaTem.map(a => `<button type="button" class="hist-chip" onclick="escolherAmbiente(this.dataset.a)" data-a="${escHtml(a)}">${escHtml(a)}</button>`).join('')
    : '';

  // passo 4: resumo do item no topo do resultado
  const r = STATE.lastResult, tit = $('rcard-title');
  if(PASSO === 4 && r && tit){
    const area = r.usedArea || r.area;
    const med = r.w ? numBR(r.w,2) + (r.h ? ' × ' + numBR(r.h,2) : '') + ' m' + (r.fab !== 'cdp' && area ? ' · ' + numBR(area,2) + ' m²' : '') : '';
    tit.innerHTML = '<div class="res-item">' + escHtml([r.prod, r.fam].filter(Boolean).join(' · ')) + (r.colLabel ? ' — ' + escHtml(r.colLabel) : '') + '</div>'
      + '<div class="res-sub">' + [escHtml(fabName(r.fab)), med, (r.qty||1) + ((r.qty||1) > 1 ? ' peças' : ' peça')].filter(Boolean).join(' · ') + '</div>';
  }

  // passo 4: o que o orçamento já tem + "Adicionar e calcular outro"
  const res = $('passo-orc-resumo');
  if(PASSO === 4 && STATE.lastResult && !EDITING_ORC_ID){
    const n = CART.length + 1, tot = CART.reduce((s,i)=>s+(i.avista||0),0) + (STATE.lastResult.avista||0);
    res.innerHTML = (CART.length
        ? '<div class="passo-ja-tem"><div>Neste cálculo rápido:</div>' + CART.map(i => `<div class="passo-ja-item"><span>${escHtml(i.label)}</span><strong>${fmt(i.avista)}</strong></div>`).join('')
          + `<div class="passo-ja-item"><span><em>+ este item</em></span><strong>${fmt(STATE.lastResult.avista)}</strong></div><div class="passo-ja-item total"><span>Total à vista (${n} itens)</span><strong>${fmt(tot)}</strong></div></div>`
        : '')
      + `<div class="rapido-acoes">
          <button type="button" class="passo-outro-btn" onclick="usarCalculo('existente')">${ic('orcamentos',17)} Adicionar a um orçamento existente</button>
          <button type="button" class="passo-outro-btn" onclick="usarCalculo('outro')">${ic('mais',17)} Somar outro item a este cálculo</button>
          <button type="button" class="rapido-novo" onclick="novoCalculoRapido()">${ic('limpar',15)} Descartar e fazer novo cálculo</button>
        </div>`;
  } else if(PASSO === 4 && STATE.lastResult){
    const outros = CART.filter(i => i.id !== EDITANDO_ITEM_ID);
    res.innerHTML = (outros.length
        ? '<div class="passo-ja-tem"><div>Este orçamento já tem:</div>' + outros.map(i => `<div class="passo-ja-item"><span>${escHtml(i.label)}</span><strong>${fmt(i.avista)}</strong></div>`).join('') + '</div>'
        : '')
      + (EDITANDO_ITEM_ID ? '' : `<button type="button" class="passo-outro-btn" onclick="calcularOutro()">${ic('mais',17)} Adicionar e calcular outro item</button>`);
  } else res.innerHTML = '';

  // barra do rodapé
  const voltar = $('passo-voltar'), avancar = $('passo-avancar');
  voltar.innerHTML = PASSO === 1 ? (document.body.classList.contains('lado-a-lado') ? ic('limpar',16) + ' Limpar' : ic('fechar',16) + (EDITING_ORC_ID ? ' Voltar ao orçamento' : ' Sair')) : ic('limpar',16) + ' Voltar';
  if(PASSO < 3) avancar.innerHTML = 'Continuar';
  else if(PASSO === 3) avancar.innerHTML = ic('calculadora',17) + ' Calcular';
  else avancar.innerHTML = ic('ok',17) + (EDITANDO_ITEM_ID ? ' Substituir item' : (EDITING_ORC_ID ? ' Adicionar ao orçamento' : ' Criar orçamento'));
}

function escolherAmbiente(a){
  $('item-ambiente').value = a;
  $('item-ambiente').dispatchEvent(new Event('input'));
  STATE.ambiente = a;
  irPasso(2);
}

// Enter no campo de ambiente = Continuar
document.addEventListener('DOMContentLoaded', () => {
  const a = $('item-ambiente');
  if(a) a.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); irPasso(2); } });
});


// ═══════════════════════════════════════════════════════
// CÁLCULO RÁPIDO (Etapa D2) — calcular sem cliente e depois virar orçamento
// O item calculado vai para CART; PENDENTES guarda os itens enquanto se escolhe o destino.
// ═══════════════════════════════════════════════════════
let DESTINO_RAPIDO = null;   // 'novo' | 'existente' | 'outro'
let PENDENTES = [];          // itens do cálculo rápido esperando um orçamento

function usarCalculo(destino){
  DESTINO_RAPIDO = destino;
  if(destino === 'outro') CALC_OUTRO = true;
  addToCart();               // pede o nome do item e põe no CART; o resto segue em destinoRapido()
}

// chamado pelo addToCart quando não há orçamento aberto
function destinoRapido(){
  const d = DESTINO_RAPIDO; DESTINO_RAPIDO = null;
  if(d === 'existente'){ PENDENTES = CART.map(i => ({...i})); escolherOrcamentoDestino(); return true; }
  if(d === 'novo'){
    PENDENTES = CART.map(i => ({...i}));
    ORC_SUJO = false;
    novoOrcamento();
    const n = PENDENTES.length, tot = PENDENTES.reduce((s,i)=>s+(i.avista||0),0);
    const sub = document.querySelector('#tab-novo .hist-sub');
    if(sub) sub.innerHTML = '<span class="rapido-pendente">' + ic('calculadora',15) + ' ' + n + (n>1?' itens':' item') + ' do cálculo rápido (' + fmt(tot) + ' à vista) vão entrar neste orçamento.</span>';
    return true;
  }
  return false;              // 'outro' segue o fluxo de "calcular outro"
}

async function escolherOrcamentoDestino(){
  if(!HIST_CARREGADO){ try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }catch(e){} }
  const abertos = HISTORY_CACHE.filter(e => e.etapa !== 'fechado' && e.etapa !== 'perdido' && !evoluidoPara(e.id))
    .sort((a,b) => (b.numero||0) - (a.numero||0));
  const n = PENDENTES.length;
  abrirModal('Adicionar a qual orçamento?',
    `<p>${n} ${n>1?'itens':'item'} do cálculo rápido (${fmt(PENDENTES.reduce((s,i)=>s+(i.avista||0),0))} à vista).</p>
     <div class="hist-busca"><input type="search" id="destino-busca" placeholder="Buscar cliente, bairro ou nº" oninput="filtrarDestino()" autocomplete="off"></div>
     <div class="destino-lista" id="destino-lista">${abertos.length ? abertos.map(e => `
       <button type="button" class="destino-item" data-busca="${escHtml(semAcento([e.client, e.bairro, numCDP(e.numero)].join(' ')))}" onclick="escolherDestino(${e.id})">
         <span><strong>${escHtml(e.client)}</strong><em>${numCDP(e.numero)}${e.bairro ? ' · ' + escHtml(e.bairro) : ''} · ${ETAPA_NOME[e.etapa]||e.etapa}</em></span>
         <span>${fmt(e.totalAvista||0)}</span></button>`).join('') : '<div class="pasta-vazio">Nenhum orçamento em aberto.</div>'}</div>`,
    '', () => {});
  $('modal-ok').style.display = 'none';
}
function filtrarDestino(){
  const t = semAcento(($('destino-busca').value||'').trim());
  document.querySelectorAll('#destino-lista .destino-item').forEach(b => { b.style.display = !t || b.dataset.busca.includes(t) ? '' : 'none'; });
}
function escolherDestino(id){
  fecharModal();
  const itens = PENDENTES; PENDENTES = [];
  ORC_SUJO = false;
  reopenOrc(id);                                   // abre a pasta do orçamento escolhido
  const base = Date.now();
  itens.forEach((it, i) => CART.push({ ...it, id: base + i }));
  ORC_SUJO = true;
  updateCartBar();
  renderPasta();
  const e = orcEmEdicao();
  avisoTopo(itens.length + (itens.length>1?' itens adicionados':' item adicionado') + ' ao <strong>' + (e ? numCDP(e.numero) : 'orçamento') + '</strong>. Confira e toque em Salvar e fechar.');
}

function novoCalculoRapido(){
  if(CART.length && !confirm('Descartar ' + (CART.length>1 ? 'os ' + CART.length + ' itens' : 'o item') + ' deste cálculo rápido?')) return;
  limparOrcamentoEmAndamento();
  PENDENTES = [];
  irParaTab('calc'); irPasso(1, true);
}

function sairCalculoRapido(){
  if(CART.length && !confirm('Sair do cálculo rápido? ' + (CART.length>1 ? 'Os ' + CART.length + ' itens somados não serão guardados.' : 'O item somado não será guardado.'))) return;
  limparOrcamentoEmAndamento();
  switchTab('hist');
}
