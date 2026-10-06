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
  addToCart();             // passo 4: adiciona (ou substitui) e volta para a pasta
}

function passoVoltar(){
  if(PASSO > 1) return irPasso(PASSO - 1, true);
  if(orcamentoAberto()) abrirPasta(); else switchTab('hist');
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
    : (orcamentoAberto()
        ? '<strong>Novo item</strong> · Orçamento de ' + escHtml(nome || 'cliente sem nome') + (e ? ' · ' + numCDP(e.numero) : '')
        : '<strong>Cálculo rápido</strong> · sem cliente');
  if(orcamentoAberto()) $('passos-contexto').innerHTML += ' <button type="button" class="passos-ver" onclick="abrirPasta()">' + (EDITANDO_ITEM_ID ? 'cancelar edição' : 'ver orçamento') + '</button>';

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
  if(PASSO === 4 && STATE.lastResult){
    const outros = CART.filter(i => i.id !== EDITANDO_ITEM_ID);
    res.innerHTML = (outros.length
        ? '<div class="passo-ja-tem"><div>Este orçamento já tem:</div>' + outros.map(i => `<div class="passo-ja-item"><span>${escHtml(i.label)}</span><strong>${fmt(i.avista)}</strong></div>`).join('') + '</div>'
        : '')
      + (EDITANDO_ITEM_ID ? '' : `<button type="button" class="passo-outro-btn" onclick="calcularOutro()">${ic('mais',17)} Adicionar e calcular outro item</button>`);
  } else res.innerHTML = '';

  // barra do rodapé
  const voltar = $('passo-voltar'), avancar = $('passo-avancar');
  voltar.innerHTML = PASSO === 1 ? ic('fechar',16) + (orcamentoAberto() ? ' Voltar ao orçamento' : ' Cancelar') : ic('limpar',16) + ' Voltar';
  if(PASSO < 3) avancar.innerHTML = 'Continuar';
  else if(PASSO === 3) avancar.innerHTML = ic('calculadora',17) + ' Calcular';
  else avancar.innerHTML = ic('ok',17) + (EDITANDO_ITEM_ID ? ' Substituir item' : ' Adicionar ao orçamento');
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
