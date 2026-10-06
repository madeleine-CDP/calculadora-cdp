// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let STATE = {
  fab: null,        // 'real' | 'dec' | 'cdp'
  cat: '', prod: '', fam: '', col: '',
  w: 0, h: 0, qty: 1,
  discReal: 20, discDecNorm: 12, discDecNorm2: 3, discDecPromo: 3,
  tubo: null,       // objeto tubo Real
  reducao: false,   // Decore auto
  lastResult: null,
  cmpActive: false,
  // Cortina Tradicional CDP
  cdpTipo: '', cdpCam1: '', cdpCam2: '', cdpIlhos: false, cdpCurvo: false, cdpCurvoValor: 0
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
function fmt(v){ return 'R$\u00a0' + Math.round(v).toLocaleString('pt-BR'); }
function fmtDec(v){ return 'R$\u00a0' + v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
function fabName(fab){ return fab==='real' ? 'Real' : (fab==='cdp' ? 'CDP' : 'Decore'); }
function fabColor(fab){ return fab==='real' ? 'var(--real)' : (fab==='cdp' ? 'var(--gold)' : 'var(--dec)'); }
function fabBg(fab){ return fab==='real' ? 'var(--real-bg)' : (fab==='cdp' ? 'var(--gold2)' : 'var(--dec-bg)'); }
function fabBd(fab){ return fab==='real' ? 'var(--real-bd)' : (fab==='cdp' ? 'rgba(200,150,14,.3)' : 'var(--dec-bd)'); }
function getKey(){ return STATE.cat+'|'+STATE.prod+'|'+STATE.fam; }
function getDB(){ return STATE.fab==='real' ? DB_REAL : DB_DECORE; }
function getData(){ return getDB()[getKey()]; }

function getColPrice(data, colVal){
  if(!data) return null;
  if(data.subCols){
    const p = colVal.split('||');
    return data.subCols[p[0]] && data.subCols[p[0]][p[1]] ? data.subCols[p[0]][p[1]] : null;
  }
  return data.cols && data.cols[colVal] ? data.cols[colVal] : null;
}

function colLabel(v){ return v&&v.includes('||') ? v.split('||')[1] : v||''; }

function populate(selId, items, disabled){
  const sel = $(selId);
  sel.innerHTML = '<option value="">— Selecione —</option>';
  items.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v; sel.appendChild(o);
  });
  sel.disabled = !!disabled;
}

// switchTab moved to API key section below

// ═══════════════════════════════════════════════════════
// FACTORY SELECTION
// ═══════════════════════════════════════════════════════
// Os três valores ao cliente + aviso de qual tabela foi usada no cálculo.
// (Só exibição: os valores já chegam calculados em r.)
function sellGridHTML(r, fab){
  const aviso = textoTabela(fab);
  return `
    <div class="sell-item tabela">
      <div class="sell-lbl">${ic('etiqueta',15)} Tabela</div>
      <div class="sell-price">${fmt(r.tabela)}</div>
      <div class="sell-note">Preço cheio</div>
    </div>
    <div class="sell-item">
      <div class="sell-lbl">${ic('cartao',15)} Cartão</div>
      <div class="sell-price">${fmt(r.cartao)}</div>
      <div class="sell-note">Tabela −5%</div>
    </div>
    <div class="sell-item avista">
      <div class="sell-lbl">${ic('dinheiro',15)} À Vista</div>
      <div class="sell-price">${fmt(r.avista)}</div>
      <div class="sell-note">Tabela −15% (custo ×2)</div>
    </div>
    ${aviso ? `<div class="tabela-aviso">${ic('calendario',14)}<span>Calculado com a ${aviso}. Se chegou tabela nova da fábrica, confira antes de fechar.</span></div>` : ''}`;
}

// Preenche a data da tabela nos botões das fábricas (fonte: TABELAS_INFO em precos.js)
function preencherDatasTabelas(){
  [['real','fb-real'],['dec','fb-dec'],['cdp','fb-cdp']].forEach(([fab,id]) => {
    const btn = document.getElementById(id); const t = TABELAS_INFO[fab];
    if(!btn || !t || !t.data) return;
    let el = btn.querySelector('.fab-btn-data');
    if(!el){ el = document.createElement('div'); el.className = 'fab-btn-data'; btn.appendChild(el); }
    el.innerHTML = ic('calendario',12) + ' ' + t.tabela + ' · ' + t.rotulo + ' ' + t.data;
  });
}
preencherDatasTabelas();

function selectFab(fab){
  if(fab === 'servico'){
    alert('🔧 Serviços (manutenção, instalação, lavagem) ainda está em construção — aguardando a tabela de preços por modelo. Assim que estiver pronta, entra aqui do mesmo jeito que Real/Decore/CDP.');
    return;
  }
  STATE.fab = fab;
  $('fb-real').className = 'fab-btn' + (fab==='real' ? ' sel-real' : '');
  $('fb-dec').className  = 'fab-btn' + (fab==='dec'  ? ' sel-dec'  : '');
  $('fb-cdp').className  = 'fab-btn' + (fab==='cdp'  ? ' sel-cdp'  : '');

  // Alterna entre o card de Produto (Real/Decore) e o card de Cortina Tradicional CDP
  $('prod-card-wrap').style.display = fab==='cdp' ? 'none' : 'block';
  $('cdp-trad-card').style.display  = fab==='cdp' ? 'block' : 'none';

  // Enable cascade (Real/Decore)
  $('s-cat').disabled = false;
  // Show discount row — não se aplica à Cortina Tradicional CDP (custo direto, sem desconto de fábrica)
  $('disc-row').style.display = fab==='cdp' ? 'none' : 'flex';
  $('disc-real').style.display      = fab==='real' ? 'flex' : 'none';
  $('disc-dec-normal').style.display  = fab==='dec' ? 'flex' : 'none';
  $('disc-dec-normal2').style.display = fab==='dec' ? 'flex' : 'none';
  $('disc-dec-promo').style.display   = fab==='dec' ? 'flex' : 'none';

  // Comparar com outra fábrica não faz sentido pra produção própria
  const btnCmp = $('btn-compare');
  if(btnCmp) btnCmp.style.display = fab==='cdp' ? 'none' : 'flex';

  // Reset cascata
  resetCascata();
  resetCdpTrad();
}

function recalcDisc(){
  STATE.discReal      = parseFloat($('disc-real-val').value)||20;
  STATE.discDecNorm   = parseFloat($('disc-dec-norm-val').value)||12;
  STATE.discDecNorm2  = parseFloat($('disc-dec-norm2-val').value)||3;
  STATE.discDecPromo  = parseFloat($('disc-dec-promo-val').value)||3;
}

// ═══════════════════════════════════════════════════════
// CASCADE
// ═══════════════════════════════════════════════════════
function existeNaFabrica(cat, prod, fam){
  const db = getDB();
  const key = fam ? (cat+'|'+prod+'|'+fam) : null;
  if(key) return !!db[key];
  // sem fam: existe se QUALQUER fam desse prod existir nessa fábrica
  return Object.keys(db).some(k => k.startsWith(cat+'|'+prod+'|'));
}

function onCat(){
  STATE.cat = $('s-cat').value;
  STATE.prod = STATE.fam = STATE.col = '';
  const todosProds = STATE.cat ? Object.keys(CATMAP[STATE.cat]) : [];
  const prods = STATE.fab ? todosProds.filter(p => existeNaFabrica(STATE.cat, p)) : todosProds;
  populate('s-prod', prods, !STATE.cat);
  populate('s-fam', [], true);
  populate('s-col', [], true);
  clearChips(); clearObs(); clearAcc(); $('result-wrap').classList.remove('on');
}

function onProd(){
  STATE.prod = $('s-prod').value;
  STATE.fam = STATE.col = '';
  const todosFams = STATE.cat && STATE.prod ? CATMAP[STATE.cat][STATE.prod] : [];
  const fams = STATE.fab ? todosFams.filter(f => existeNaFabrica(STATE.cat, STATE.prod, f)) : todosFams;
  populate('s-fam', fams, !STATE.prod);
  populate('s-col', [], true);
  clearChips(); clearObs(); clearAcc(); $('result-wrap').classList.remove('on');
  const det = $('item-detalhamento'); if(det){ det.value=''; delete det.dataset.editedManually; }
}

function onFam(){
  STATE.fam = $('s-fam').value;
  STATE.col = '';
  if(!STATE.fam){ populate('s-col',[],true); clearObs(); clearAcc(); return; }
  const data = getData();
  fillColSel(data);
  updateObs(data);
  buildAcc();
  onCol();
}

function fillColSel(data){
  const sel = $('s-col');
  if(!data){ sel.innerHTML='<option value="">— N/D —</option>'; sel.disabled=true; return; }
  sel.innerHTML='<option value="">— Selecione a coleção —</option>';
  const w = STATE.w;
  if(data.subCols){
    Object.keys(data.subCols).forEach(sub => {
      const g = document.createElement('optgroup'); g.label = sub;
      Object.keys(data.subCols[sub]).forEach(c => {
        const info = data.subCols[sub][c];
        const fw = info.fw||99;
        const incomp = fw < w;
        const o = document.createElement('option');
        o.value = sub+'||'+c;
        o.textContent = c + (incomp ? ' · não cabe (tecido '+fw+'m)' : '');
        if(incomp) o.style.color='#FF5068';
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
  } else {
    Object.keys(data.cols).forEach(c => {
      const info = data.cols[c];
      const fw = info.fw||99;
      const incomp = fw < w;
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c + (incomp ? ' · não cabe (tecido '+fw+'m)' : '');
      if(incomp) o.style.color='#FF5068';
      sel.appendChild(o);
    });
  }
  sel.disabled = false;
}

function onCol(){
  STATE.col = $('s-col').value;
  if(!STATE.col) return;
  updateChips();
  validateMedidas();
  updateDetalhamentoPreview();
}

// ═══════════════════════════════════════════════════════
// MEDIDAS
// ═══════════════════════════════════════════════════════
function onTipoMedida(){
  const isJanela = $('tipo-medida').value === 'janela';
  $('janela-wrap').style.display = isJanela ? 'block' : 'none';
  $('medidas-sub').textContent = isJanela
    ? 'Preenchida automaticamente a partir da janela + sobra (pode ajustar na mão se precisar)'
    : 'Medida final da cortina/persiana (já com sobra, se aplicável)';
  if(isJanela) calcSobra();
}

function acessoriosSelecionados(){
  // varre os checkboxes de Acessórios & Opcionais já marcados, extraindo a largura real (6cm/8cm/etc) de cada guia
  const marcados = Array.from(document.querySelectorAll('#acc-content input[type="checkbox"]:checked'));
  let temBando = false, guiaInfCm = 0, guiaLatCm = 0;
  marcados.forEach(chk => {
    const label = document.querySelector('label[for="'+chk.id+'"]');
    if(!label) return;
    const txt = label.textContent;
    if(/bandô/i.test(txt) && !/comando/i.test(txt)) temBando = true;
    if(/guia inferior/i.test(txt)){
      const m = txt.match(/(\d+(?:,\d+)?)\s*cm/i);
      if(m) guiaInfCm = Math.max(guiaInfCm, parseFloat(m[1].replace(',','.')));
    }
    if(/guia lateral/i.test(txt)){
      const m = txt.match(/(\d+(?:,\d+)?)\s*cm/i);
      if(m) guiaLatCm = Math.max(guiaLatCm, parseFloat(m[1].replace(',','.')));
    }
  });
  return {temBando, guiaInfCm, guiaLatCm};
}

function calcSobra(){
  const jw = parseFloat($('jan-w').value);
  const jh = parseFloat($('jan-h').value);
  const isRolo = (STATE.prod||'').toUpperCase() === 'CORTINA ROLÔ';
  const isRomana = (STATE.prod||'').toUpperCase() === 'CORTINA ROMANA';
  const notaBk = $('jan-bk-nota');
  if(notaBk) notaBk.style.display = isRolo ? 'block' : 'none';
  if(!jw || !jh){ $('jan-sugestao').innerHTML = ''; return; }

  const instalacao = $('jan-instalacao').value;
  let w = jw, h = jh;
  let obs = [];

  if(instalacao === 'fora'){
    let usouMolduraLarg = false, usouMolduraAlt = false;

    if(isRolo){
      const {temBando, guiaInfCm, guiaLatCm} = acessoriosSelecionados();
      if(guiaLatCm > 0){
        const add = (guiaLatCm/100)*2;
        w += add; obs.push(`+${(add*100).toFixed(0)}cm larg. (guias laterais ${guiaLatCm}cm cada lado)`);
        usouMolduraLarg = true;
      }
      if(temBando || guiaInfCm > 0){
        let add = 0;
        if(temBando){ add += 0.10; obs.push('+10cm alt. (bandô)'); }
        if(guiaInfCm > 0){ add += guiaInfCm/100; obs.push(`+${guiaInfCm}cm alt. (guia inferior)`); }
        h += add;
        usouMolduraAlt = true;
      }
    }

    if(!usouMolduraLarg){ w += 0.20; obs.push('+20cm larg. (fora do vão)'); }
    if(!usouMolduraAlt){
      if(isRomana){ h += 0.55; obs.push('+55cm alt. (Cortina Romana: 35cm cima pelo gomo superior + 20cm baixo)'); }
      else { h += 0.30; obs.push('+30cm alt. (fora do vão, genérico — sem bandô/guias marcados)'); }
    }
  } else {
    obs.push('dentro do vão: sem sobra, medida = janela');
  }

  w = Math.round(w*100)/100;
  h = Math.round(h*100)/100;
  $('i-w').value = w;
  $('i-h').value = h;
  onMedidas();

  $('jan-sugestao').innerHTML = `${ic('ok',15)} Sugestão: <b>${w.toFixed(2)}L × ${h.toFixed(2)}A</b> (janela ${jw.toFixed(2)}×${jh.toFixed(2)}m) — ${obs.join(' · ')}`;
}

function updateDetalhamentoPreview(){
  const box = $('item-detalhamento');
  if(!box) return;
  const w = parseFloat($('i-w').value);
  const h = parseFloat($('i-h').value);
  if(!w || !h) return;
  if(STATE.fab !== 'cdp' && !STATE.prod) return;
  const usandoJanela = $('tipo-medida') && $('tipo-medida').value === 'janela';
  const jw = usandoJanela ? parseFloat($('jan-w').value) : null;
  const jh = usandoJanela ? parseFloat($('jan-h').value) : null;
  const gerado = baseDetalhamento(STATE.fab==='cdp' ? 'Cortina Tradicional' : STATE.prod, w, h, jw, jh);
  // só sobrescreve se o campo ainda não foi editado à mão pelo usuário para esta medida
  if(!box.dataset.editedManually){
    box.value = gerado;
  }
}

function onMedidas(){
  STATE.w   = parseFloat($('i-w').value)||0;
  STATE.h   = parseFloat($('i-h').value)||0;
  STATE.qty = parseInt($('i-qty').value)||1;
  updateChips();
  validateMedidas();
  if(STATE.fam){ fillColSel(getData()); }
  autoFillAccMl();
  updateDetalhamentoPreview();
}

function autoFillAccMl(){
  if(!STATE.w && !STATE.h) return;
  // Fill by data-acc-unit attribute
  document.querySelectorAll('input[data-acc-unit]').forEach(inp => {
    const unit = inp.getAttribute('data-acc-unit');
    if(unit === 'ml-larg' && STATE.w > 0) inp.value = STATE.w.toFixed(2);
    else if(unit === 'ml-alt' && STATE.h > 0) inp.value = STATE.h.toFixed(2);
  });
  // Fallback: fill by ID pattern ml_ (for inputs without data-acc-unit yet)
  const accList = STATE.fab==='real' ? ACC_REAL : ACC_DECORE;
  if(!accList) return;
  accList.forEach(sec => {
    sec.items.forEach(item => {
      const inp = document.getElementById('ml_'+item.id);
      if(!inp) return;
      if(item.unit === 'ml-larg' && STATE.w > 0) inp.value = STATE.w.toFixed(2);
      else if(item.unit === 'ml-alt' && STATE.h > 0) inp.value = STATE.h.toFixed(2);
    });
  });
}

function validateMedidas(){
  const data = getData();
  if(!data || !STATE.w || !STATE.h){ $('alert-med').classList.remove('on'); return; }
  const w = STATE.w, h = STATE.h, area = w*h;
  const msgs = [];

  if(data.maxLarg && w > data.maxLarg)
    msgs.push('Largura máxima para este produto: ' + data.maxLarg + 'm (informado: ' + w + 'm)');
  if(data.maxAlt && h > data.maxAlt)
    msgs.push('Altura máxima para este produto: ' + data.maxAlt + 'm (informado: ' + h + 'm)');
  if(data.maxM2 && area > data.maxM2)
    msgs.push('Área máxima: ' + data.maxM2 + 'm² (calculado: ' + area.toFixed(2) + 'm²)');
  if(data.minAlt && h < data.minAlt)
    msgs.push('Altura mínima: ' + data.minAlt + 'm');
  if(data.minLarg && w < data.minLarg)
    msgs.push('Largura mínima: ' + data.minLarg + 'm');
  if(data.minFab && (w < data.minFab || h < data.minFab))
    msgs.push('Medida abaixo do padrão de fabricação (mín. ' + data.minFab + 'm) — orçamento será gerado pela cobrança mínima e provavelmente ficará fora da garantia de fábrica');

  // Verifica largura do tecido da coleção selecionada
  if(STATE.col){
    const colInfo = getColPrice(data, STATE.col);
    if(colInfo && colInfo.fw && colInfo.fw < 99 && w > colInfo.fw){
      const cname = colLabel(STATE.col);
      msgs.push('O tecido "' + cname + '" tem largura ' + colInfo.fw + 'm — não atende a largura de ' + w + 'm.');
      // Sugerir coleções compatíveis
      const compat = getSuggestCols(data, w);
      if(compat.length){
        $('compat-sugest').style.display='block';
        $('compat-sugest').innerHTML = '<div class="chip chip-gold">'+ic('info',15)+' Coleções compatíveis com '+w+'m: ' + compat.join(', ') + '</div>';
      } else {
        $('compat-sugest').style.display='none';
      }
    } else {
      $('compat-sugest').style.display='none';
    }
  }

  // Real: verifica tubo
  if(STATE.fab==='real' && STATE.prod && STATE.prod.includes('ROLÔ')){
    const tubo = getTuboReal(w, h);
    if(!tubo) msgs.push('Medidas excedem os limites de fabricação da Rolô Real. Larg máx: 4,00m, Alt máx: 3,50m, Área máx: 8,00m².');
  }

  const el = $('alert-med');
  if(msgs.length){ el.innerHTML = msgs.map(m=>ic('alerta',15)+' '+m).join('<br>'); el.classList.add('on'); }
  else el.classList.remove('on');
}

function getSuggestCols(data, w){
  const compat = [];
  const cols = data.cols || {};
  Object.entries(cols).forEach(([c,info]) => {
    if((info.fw||99) >= w) compat.push(c);
  });
  return compat.slice(0,5);
}

// ═══════════════════════════════════════════════════════
// CHIPS — TUBO / REDUÇÃO
// ═══════════════════════════════════════════════════════
function updateChips(){
  const w = STATE.w, h = STATE.h;
  // Real: tubo automático
  if(STATE.fab==='real' && STATE.prod && STATE.prod.includes('ROLÔ')){
    const tubo = getTuboReal(w, h);
    STATE.tubo = tubo;
    if(tubo){
      $('comando-chip').style.display='inline-flex';
      $('comando-txt').textContent = tubo.label + ' — Bandôs compatíveis: ' + tubo.bandos.join(', ');
    } else {
      $('comando-chip').style.display='none';
    }
  } else {
    $('comando-chip').style.display='none';
    STATE.tubo = null;
  }

  // Decore: redução de peso automática
  if(STATE.fab==='dec' && STATE.prod && (STATE.prod.includes('ROLÔ') || STATE.prod.includes('ELEGANCE'))){
    const needReducao = w > 1.80 || h > 2.00;
    STATE.reducao = needReducao;
    if(needReducao){
      $('reducao-chip').style.display='inline-flex';
      $('reducao-txt').textContent = 'Redução de Peso aplicada automaticamente (larg ' + w + 'm / alt ' + h + 'm) — +R$75,00 por peça';
    } else {
      $('reducao-chip').style.display='none';
    }
  } else {
    $('reducao-chip').style.display='none';
    STATE.reducao = false;
  }
}

function clearChips(){
  $('comando-chip').style.display='none';
  $('reducao-chip').style.display='none';
}

// ═══════════════════════════════════════════════════════
// OBSERVAÇÕES
// ═══════════════════════════════════════════════════════
function updateObs(data){
  if(!data||!data.obs||!data.obs.length){ $('obs-box').classList.remove('on'); return; }
  $('obs-list').innerHTML = data.obs.map(o=>'<li class="obs-li">'+o+'</li>').join('');
  $('obs-box').classList.add('on');
}
function clearObs(){ $('obs-box').classList.remove('on'); }

// ═══════════════════════════════════════════════════════
// ACESSÓRIOS
// ═══════════════════════════════════════════════════════
function buildAcc(){
  const accList = STATE.fab==='real' ? ACC_REAL : ACC_DECORE;
  const prod = STATE.prod;
  const wrap = $('acc-wrap');
  const content = $('acc-content');
  content.innerHTML = '';
  let anySection = false;

  accList.forEach(sec => {
    // Filter items compatible with this product
    const items = sec.items.filter(item =>
      !item.compat || item.compat.some(c => prod.includes(c.replace('CORTINA ','').replace('PERSIANA ','')))
      || item.compat.indexOf(prod) >= 0
    );
    if(!items.length) return;

    anySection = true;
    const secDiv = document.createElement('div');
    secDiv.className = 'acc-section';

    let rows = items.map(item => {
      const u = item.unit;
      const w = STATE.w, h = STATE.h;

      // Incompatibility check
      let incompatMsg = '';
      if(item.maxLarg && w > item.maxLarg)
        incompatMsg = 'Incompatível: larg ' + w + 'm > máx ' + item.maxLarg + 'm';
      if(STATE.fab==='real' && STATE.tubo && item.l.includes('Bandô')){
        const tuboCompat = STATE.tubo.bandos.some(b => item.l.includes(b.replace('Bandô ','')));
        if(!incompatMsg && !tuboCompat) incompatMsg = 'Incompatível: ' + STATE.tubo.label + ' não aceita este bandô (ver tabela de restrições)';
      }

      // Price display
      let priceStr = '';
      if(item.cor){
        priceStr = 'Br/Pt: '+fmtDec(item.cor.W)+'/ml' + (item.cor.C ? ' | Cor: '+fmtDec(item.cor.C)+'/ml' : ' (só branco)');
      } else if(item.p){
        priceStr = fmtDec(item.p)+'/und';
      }

      // Controls
      let ctrl = '';
      if(u==='und'){
        ctrl = '<input type="number" id="qty_'+item.id+'" value="1" min="1" max="50" step="1" style="width:52px">';
      } else {
        const defVal = '';
        ctrl = (item.cor && item.cor.C)
          ? '<select id="cor_'+item.id+'"><option value="W">Branco/Preto</option><option value="C">Cor (cinza/bege)</option></select>'
          : '';
        ctrl += '<input type="number" id="ml_'+item.id+'" value="'+defVal+'" min="0.10" max="20" step="0.01" placeholder="ml" data-acc-unit="'+u+'">';
      }

      return `<div class="acc-item${incompatMsg?' incompatible':''}" id="awi_${item.id}">
        <input type="checkbox" id="chk_${item.id}" ${incompatMsg?'disabled':''} onchange="onAccChange(this,'${item.id}')">
        <div class="acc-item-body">
          <label class="ai-label" for="chk_${item.id}">${item.l}</label>
          ${item.note?'<div class="ai-note">'+item.note+'</div>':''}
          ${incompatMsg?'<div class="ai-incomp">'+ic('alerta',13)+' '+incompatMsg+'</div>':''}
          <div class="ai-controls" id="ctrl_${item.id}" style="display:none">${ctrl}</div>
        </div>
        <span class="ai-price">${priceStr}</span>
      </div>`;
    }).join('');

    secDiv.innerHTML = `<div class="acc-sec-hd">${sec.sec}</div><div class="acc-grid">${rows}</div>`;
    content.appendChild(secDiv);
  });

  wrap.classList.toggle('on', anySection);
  // Auto-fill ml fields with current medidas
  setTimeout(autoFillAccMl, 50);
}

function onAccChange(chk, id){
  const ctrlDiv = $('ctrl_'+id);
  if(ctrlDiv) ctrlDiv.style.display = chk.checked ? 'flex' : 'none';
  const item = $('awi_'+id);
  if(item) item.classList.toggle('checked', chk.checked);
  if($('tipo-medida') && $('tipo-medida').value === 'janela') calcSobra();
}

function clearAcc(){
  $('acc-wrap').classList.remove('on');
  $('acc-content').innerHTML='';
}

function calcAccCost(){
  const accList = STATE.fab==='real' ? ACC_REAL : ACC_DECORE;
  let total = 0;
  const lines = [];
  const w = STATE.w, h = STATE.h;

  // Itens sem desconto (preço fixo conforme tabela)
  const SEM_DESCONTO = [
    // Motorização Real — preço fixo
    'r_m6n','r_mmaxi','r_m4f','r_mwifi','r_mbat','r_fonte',
    'r_rm6n','r_rm4f','r_rmwifi','r_rmbat','r_ph50mot','r_ph50wf',
    // Controles Real — preço fixo
    'r_rc1','r_rc15','r_rctimer','r_hub',
    // Outros opcionais Real — "não se aplicam descontos" na tabela
    'r_junc','r_red','r_redplus','r_supduplo','r_romred',
    // Motorização Decore — sem desconto ("não se aplicam descontos de Revendedores")
    'd_mmec','d_mrf','d_mele','d_mt38','d_mt38wf','d_mwmec','d_mwele','d_rmmot','d_rmmotwf','d_ph50mot','d_ph50motwf',
    // Controles Decore — sem desconto
    'd_dc1','d_dc16','d_bpi1','d_bpi15','d_jmt',
    // Monocomandos Decore — sem desconto
    'd_ph50mono','d_ph25mono','d_ph25ev','d_red',
    // Monocomandos Real — sem desconto
    'r_ph50mono','r_ph25mono','r_ph25ev','r_ph25cabo'
  ];

  accList.forEach(sec => {
    sec.items.forEach(item => {
      const chk = $('chk_'+item.id);
      if(!chk || !chk.checked) return;
      const u = item.unit;
      let cost = 0, label = '';

      if(u==='und'){
        const qty = parseFloat(($('qty_'+item.id)||{}).value)||1;
        cost = (item.p||0) * qty;
        label = item.l + (qty>1?' ×'+qty:'');
      } else if(u==='ml-larg'){
        const ml = parseFloat(($('ml_'+item.id)||{}).value)||w;
        const corSel = $('cor_'+item.id);
        const isColor = corSel && corSel.value==='C';
        const price = isColor ? (item.cor.C||item.cor.W) : item.cor.W;
        cost = price * ml;
        label = item.l + ' ' + ml.toFixed(2) + 'ml ' + (isColor?'(cor)':'(branco)');
      } else if(u==='ml-alt'){
        const ml = parseFloat(($('ml_'+item.id)||{}).value)||h;
        const corSel = $('cor_'+item.id);
        const isColor = corSel && corSel.value==='C';
        const price = isColor ? (item.cor.C||item.cor.W) : item.cor.W;
        cost = price * ml;
        label = item.l + ' ' + ml.toFixed(2) + 'ml ' + (isColor?'(cor)':'(branco)');
      }

      // Verifica se tem desconto
      const semDesconto = SEM_DESCONTO.indexOf(item.id) >= 0;
      let costDisc = cost;
      let discLabel = '';
      if(!semDesconto){
        if(STATE.fab==='real'){
          costDisc = cost * (1 - STATE.discReal/100);
          discLabel = STATE.discReal+'%';
        } else if(item.promo){
          costDisc = cost * (1 - STATE.discDecPromo/100);
          discLabel = STATE.discDecPromo+'%';
        } else {
          // Cascata: 12% + 3%
          const d1 = STATE.discDecNorm||12;
          const d2 = STATE.discDecNorm2||3;
          costDisc = cost * (1 - d1/100) * (1 - d2/100);
          discLabel = d1+'%+'+d2+'%';
        }
      }
      total += costDisc;
      lines.push({
        label,
        cost: costDisc,
        costOrig: cost,
        discLabel,
        semDesconto
      });
    });
  });

  // Decore: redução automática — sem desconto (preço fixo)
  if(STATE.reducao){
    total += 75;
    lines.push({label:'Redução de Peso (auto — sem desconto)', cost:75, costOrig:75, disc:0, semDesconto:true});
  }

  return {total, lines};
}

// Varre os mesmos checkboxes que calcAccCost() lê, mas guarda a SELEÇÃO (id/qty/ml/cor)
// em vez do custo calculado — usado pra restaurar acessórios ao editar um item do carrinho.
function captureAccSelections(){
  const accList = STATE.fab==='real' ? ACC_REAL : ACC_DECORE;
  const sel = [];
  accList.forEach(sec => {
    sec.items.forEach(item => {
      const chk = $('chk_'+item.id);
      if(!chk || !chk.checked) return;
      const entry = { id: item.id };
      if(item.unit === 'und'){
        entry.qty = parseFloat(($('qty_'+item.id)||{}).value) || 1;
      } else {
        const mlEl = $('ml_'+item.id);
        entry.ml = mlEl ? parseFloat(mlEl.value) || null : null;
        const corSel = $('cor_'+item.id);
        if(corSel) entry.cor = corSel.value;
      }
      sel.push(entry);
    });
  });
  return sel;
}

// Reaplica uma seleção capturada por captureAccSelections() nos checkboxes já construídos
// por buildAcc() (chamado a partir de onFam()). Roda depois do autoFillAccMl() (que tem um
// setTimeout de 50ms dentro de buildAcc) pra não ter os valores de ml sobrescritos.
function restoreAccSelections(selections){
  if(!selections || !selections.length) return;
  selections.forEach(s => {
    const chk = $('chk_'+s.id);
    if(!chk) return; // acessório não existe mais pra esse produto/fábrica — ignora
    chk.checked = true;
    onAccChange(chk, s.id);
    if(s.qty != null){ const q = $('qty_'+s.id); if(q) q.value = s.qty; }
    if(s.ml != null){ const m = $('ml_'+s.id); if(m) m.value = s.ml; }
    if(s.cor != null){ const c = $('cor_'+s.id); if(c) c.value = s.cor; }
  });
}

// ═══════════════════════════════════════════════════════
// CALCULATE
// ═══════════════════════════════════════════════════════
function calcular(){
  if(!STATE.fab){ alert('Selecione a fábrica.'); return; }
  if(STATE.fab==='cdp') return calcularCdpTrad();
  if(!STATE.cat||!STATE.prod||!STATE.fam||!STATE.col){ alert('Complete a seleção do produto.'); return; }
  const w = STATE.w, h = STATE.h, qty = STATE.qty;
  if(!w||!h){ alert('Informe largura e altura.'); return; }
  if(!STATE.ambiente || !STATE.ambiente.trim()){
    alert('⚠️ Preencha o Ambiente deste item antes de calcular (ex: Quarto Casal, Sala).');
    $('item-ambiente').focus();
    return;
  }

  const data = getData();
  if(!data){ alert('Produto não disponível nesta fábrica.'); return; }

  const colInfo = getColPrice(data, STATE.col);
  if(!colInfo){ alert('Coleção não encontrada.'); return; }

  // Check fabric width
  if(colInfo.fw && colInfo.fw < 99 && w > colInfo.fw){
    alert('⚠️ O tecido "' + colLabel(STATE.col) + '" tem largura máxima de ' + colInfo.fw + 'm e não atende ' + w + 'm.\n\nEscolha uma coleção compatível.');
    return;
  }

  const area = w * h;
  const minA = data.minM2 || 1.20;
  const usedArea = Math.max(area, minA);
  const priceM2 = colInfo.p;
  const subtecido = usedArea * priceM2;

  // Desconto
  const isPromo = colInfo.promo || data.isPromo || false;
  let discPct = 0, discPct2 = 0;
  let subtDesconto = 0;
  if(STATE.fab==='real'){
    discPct = STATE.discReal;
    subtDesconto = subtecido * (1 - discPct/100);
  } else if(isPromo){
    discPct = STATE.discDecPromo;
    subtDesconto = subtecido * (1 - discPct/100);
  } else {
    // Normal Decore: 12% + 3% em cascata
    discPct  = STATE.discDecNorm;
    discPct2 = STATE.discDecNorm2||3;
    subtDesconto = subtecido * (1 - discPct/100) * (1 - discPct2/100);
  }

  // Impostos — Real já incluso, Decore soma
  const tipoImp = data.tipoImp || getTipoImposto(STATE.prod, STATE.fam);
  const imp = getImpostos(tipoImp);
  let impostoValor = 0, impostoDesc = '';
  if(STATE.fab==='dec'){
    impostoValor = subtDesconto * imp.ipi + subtDesconto * (1+imp.ipi) * imp.st;
    if(imp.ipi > 0 || imp.st > 0){
      impostoDesc = 'IPI ' + (imp.ipi*100).toFixed(2) + '%' + (imp.st>0 ? ' + ICMS-ST ' + (imp.st*100).toFixed(2) + '%' : '');
    }
  }

  const subtComImp = subtDesconto + impostoValor;

  // Acessórios
  const acc = calcAccCost();
  const totalUnitario = subtComImp + acc.total;
  const totalGeral = totalUnitario * qty;

  // Preços de venda (extras já são valor final — somados após o markup)
  const extrasTotal = totalExtras();
  const descontoExtraReal = (STATE.fab === 'real') ? 0.975 : 1;
  const avista = Math.round(totalGeral * 2 * descontoExtraReal) + Math.round(extrasTotal);
  const tabela = Math.round(avista / 0.85);
  const cartao = Math.round(tabela * 0.95);

  // Save result state
  const foraDoPadrao = !!(data.minFab && (w < data.minFab || h < data.minFab));
  STATE.lastResult = {
    fab: STATE.fab, cat: STATE.cat, prod: STATE.prod, fam: STATE.fam,
    col: STATE.col, colLabel: colLabel(STATE.col),
    ambiente: STATE.ambiente,
    w, h, qty, area, usedArea, priceM2, subtecido,
    discPct, discPct2, isPromo, subtDesconto,
    tipoImp, imp, impostoValor, impostoDesc,
    subtComImp, acc, accSelections: captureAccSelections(), totalUnitario, totalGeral,
    extras: EXTRAS.map(e=>({...e})), extrasTotal,
    avista, tabela, cartao,
    tubo: STATE.tubo, reducao: STATE.reducao,
    foraDoPadrao, minFab: data.minFab
  };

  renderResult(STATE.lastResult);
}

function renderResult(r){
  const isFab = r.fab==='real';
  const fabLabel = isFab ? 'Real Persianas' : 'Decore Persianas';
  const cls = isFab ? 'real' : 'decore';

  // Build breakdown rows
  let rows = '';
  if(r.tubo) rows += `<div class="brow cmd-row"><span class="k">${ic('engrenagem',14)} Tubo automático</span><span class="v">${r.tubo.label}</span></div>`;
  if(r.reducao) rows += `<div class="brow red-row"><span class="k">${ic('raio',14)} Redução de peso (auto)</span><span class="v">+R$75/peça</span></div>`;
  if(r.foraDoPadrao) rows += `<div class="alert" style="display:block"><strong>${ic('alerta',15)} Medida fora do padrão de fabricação</strong> (mín. ${r.minFab}m) — orçamento gerado pela cobrança mínima. Provavelmente <strong>fora da garantia de fábrica</strong>. Avise o cliente.</div>`;
  rows += `<div class="brow"><span class="k">Dimensões</span><span class="v">${r.w.toFixed(2)}m × ${r.h.toFixed(2)}m</span></div>`;
  rows += `<div class="brow"><span class="k">Área calculada</span><span class="v">${r.usedArea.toFixed(2)} m²${r.usedArea>r.area?' (mínimo)':''}</span></div>`;
  rows += `<div class="brow"><span class="k">Preço tabela/m²</span><span class="v">${fmtDec(r.priceM2)}</span></div>`;
  if(r.isPromo) rows += `<div class="brow"><span class="k" style="color:var(--gold)">Tabela Promocional</span><span class="v" style="color:var(--gold)">✓</span></div>`;
  rows += `<div class="brow"><span class="k">Subtotal tecido (tabela)</span><span class="v">${fmtDec(r.subtecido)}</span></div>`;
  if(r.fab==='dec' && !r.isPromo && r.discPct2){
    const apos1desc = r.subtecido * (1 - r.discPct/100);
    rows += `<div class="brow disc-row"><span class="k">1º Desconto ${r.discPct}%</span><span class="v">-${fmtDec(r.subtecido - apos1desc)}</span></div>`;
    rows += `<div class="brow"><span class="k">Após 1º desconto</span><span class="v">${fmtDec(apos1desc)}</span></div>`;
    rows += `<div class="brow disc-row"><span class="k">2º Desconto ${r.discPct2}%</span><span class="v">-${fmtDec(apos1desc - r.subtDesconto)}</span></div>`;
  } else {
    rows += `<div class="brow disc-row"><span class="k">Desconto ${r.discPct}%${r.isPromo?' (promo)':''}</span><span class="v">-${fmtDec(r.subtecido-r.subtDesconto)}</span></div>`;
  }
  rows += `<div class="brow"><span class="k">Subtotal c/ desconto</span><span class="v">${fmtDec(r.subtDesconto)}</span></div>`;

  if(r.impostoValor > 0){
    rows += `<div class="brow tax-row"><span class="k">Impostos PE (${r.impostoDesc})</span><span class="v">+${fmtDec(r.impostoValor)}</span></div>`;
  } else if(r.fab==='real' && (r.imp.ipi>0||r.imp.st>0)){
    rows += `<div class="brow"><span class="k" style="color:var(--tx3)">Impostos PE — já inclusos na tabela Real</span><span class="v" style="color:var(--tx3)">✓</span></div>`;
  } else {
    rows += `<div class="brow"><span class="k" style="color:var(--tx3)">Impostos PE — não incidem neste produto</span><span class="v" style="color:var(--tx3)">—</span></div>`;
  }

  if(r.acc.lines.length){
    r.acc.lines.forEach(l => {
      const discInfo = l.semDesconto
        ? '<span style="font-size:10px;color:var(--tx3);margin-left:4px">(preço fixo)</span>'
        : (l.discLabel ? '<span style="font-size:10px;color:var(--grn);margin-left:4px">(-'+l.discLabel+')</span>' : '');
      rows += `<div class="brow"><span class="k">+ ${l.label}${discInfo}</span><span class="v">${fmtDec(l.cost)}</span></div>`;
    });
  }

  if(r.qty > 1){
    rows += `<div class="brow"><span class="k">Custo unitário</span><span class="v">${fmtDec(r.totalUnitario)}</span></div>`;
    rows += `<div class="brow total-row"><span class="k">TOTAL (${r.qty} peças)</span><span class="v">${fmtDec(r.totalGeral)}</span></div>`;
  } else {
    rows += `<div class="brow total-row"><span class="k">CUSTO TOTAL</span><span class="v">${fmtDec(r.totalGeral)}</span></div>`;
  }

  if(r.extras && r.extras.length){
    r.extras.forEach(e => { rows += `<div class="brow disc-row"><span class="k">${ic('ferramenta',14)} ${e.desc} <span style="color:var(--tx3);font-size:10.5px">(valor final, sem markup)</span></span><span class="v">+${fmtDec(e.valor)}</span></div>`; });
  }

  const body = `
    <div class="rcard ${cls}">
      <div class="rc-fab">${fabLabel}</div>
      <div class="rc-prod">${r.prod} ${r.fam} — ${r.colLabel}</div>
      <div class="rc-lbl">Custo de Fabricação</div>
      <div class="rc-cost">${fmt(r.totalGeral)}</div>
      <div class="bdown">${rows}</div>
    </div>`;

  $('rcard-body').innerHTML = body;

  // Sell prices
  $('sell-grid').innerHTML = sellGridHTML(r, r.fab);

  $('result-wrap').classList.add('on');
  $('cmp-section').classList.remove('on');
  $('cbar-wrap').style.display='none';
  $('cmp-results').style.display='none';
  $('fair-warn').classList.remove('on');

  setTimeout(() => $('result-wrap').scrollIntoView({behavior:'smooth',block:'start'}), 100);
}

// ═══════════════════════════════════════════════════════
// SAVE / HISTORY
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// SUPABASE — armazenamento compartilhado de orçamentos
// ═══════════════════════════════════════════════════════
const SB_URL = 'https://hvgtbwkpavrclndacder.supabase.co';
const SB_KEY = 'sb_publishable_N2iBuXbs2V4eFrl0UzHjew_Dvm2-oSO';
const SB_HEADERS = { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

// Nome de quem está logado (gravado pelo login em 'cdp_sessao'), usado no campo criado_por
function getUsuarioLogado(){
  try{ const o = JSON.parse(localStorage.getItem('cdp_sessao') || 'null'); return (o && (o.nome || o.login)) || null; }
  catch(e){ return null; }
}

let HISTORY_CACHE = [];

// Número automático do orçamento (gerado pelo banco): 6 → "CDP-0006"
function numCDP(n){ return n ? 'CDP-' + String(n).padStart(4,'0') : ''; }
// Nome curto do orçamento em edição: número CDP, senão nº do Tiny
function nomeOrcEditando(){
  const e = HISTORY_CACHE.find(x => x.id === EDITING_ORC_ID);
  return (e && numCDP(e.numero)) || ($('cli-tiny').value ? '#' + $('cli-tiny').value : 'salvo');
}

async function sbFetchHistory(){
  const res = await fetch(SB_URL + '/rest/v1/orcamentos?select=*&order=created_at.desc', { headers: SB_HEADERS });
  if(!res.ok) throw new Error('Falha ao carregar: ' + res.status);
  const rows = await res.json();
  return rows.map(r => ({
    id: r.id,
    ref: r.ref,
    client: r.client,
    date: r.date,
    items: r.items,
    totalTabela: Number(r.total_tabela),
    totalCartao: Number(r.total_cartao),
    totalAvista: Number(r.total_avista),
    criadoPor: r.criado_por || null,
    numero: r.numero || null,
    etapa: r.etapa || 'orcamento',
    telefone: r.telefone || '',
    bairro: r.bairro || ''
  }));
}

async function sbInsertOrcamento(entry){
  const res = await fetch(SB_URL + '/rest/v1/orcamentos', {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      ref: entry.ref || '', client: entry.client, date: entry.date, items: entry.items,
      total_tabela: entry.totalTabela, total_cartao: entry.totalCartao, total_avista: entry.totalAvista,
      telefone: entry.telefone || null, bairro: entry.bairro || null,
      criado_por: getUsuarioLogado()
    })
  });
  if(!res.ok) throw new Error('Falha ao salvar: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

// Atualiza (substitui) um orçamento já existente — usado quando reabrimos um
// orçamento salvo (reopenOrc) e salvamos de novo, em vez de criar uma linha duplicada
async function sbUpdateOrcamento(id, entry){
  const res = await fetch(SB_URL + '/rest/v1/orcamentos?id=eq.' + id, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      ref: entry.ref || '', client: entry.client, date: entry.date, items: entry.items,
      total_tabela: entry.totalTabela, total_cartao: entry.totalCartao, total_avista: entry.totalAvista,
      telefone: entry.telefone || null, bairro: entry.bairro || null,
      criado_por: getUsuarioLogado()
    })
  });
  if(!res.ok) throw new Error('Falha ao atualizar: ' + res.status + ' ' + (await res.text()));
  return res.json();
}

async function sbDeleteOrcamento(id){
  const res = await fetch(SB_URL + '/rest/v1/orcamentos?id=eq.' + id, { method: 'DELETE', headers: SB_HEADERS });
  if(!res.ok) throw new Error('Falha ao excluir: ' + res.status);
}

function getHistory(){ return HISTORY_CACHE; }

// ── Lista de orçamentos (C1): busca + filtro por etapa ──
const ETAPAS = [
  ['pre_orcamento','Pré-orçamento'], ['visita','Visita'], ['orcamento','Orçamento'],
  ['enviado','Enviado'], ['fechado','Fechado'], ['perdido','Perdido']
];
const ETAPA_NOME = Object.fromEntries(ETAPAS);
let HIST_ETAPA = 'todos';
let HIST_CARREGADO = false;

function semAcento(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }
function iniciais(nome){
  const p = String(nome||'').trim().split(/\s+/).filter(Boolean);
  if(!p.length) return '?';
  return ((p[0][0]||'') + (p.length>1 ? p[p.length-1][0] : '')).toUpperCase();
}
function escHtml(t){ return String(t==null?'':t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function ambientesDe(e){
  if(!e.items || !e.items.length) return 0;
  return new Set(e.items.map(i => (i.ambiente||'').trim().toLowerCase()).filter(Boolean)).size || 1;
}
function combinaBusca(e, termo){
  if(!termo) return true;
  const alvo = semAcento([e.client, e.bairro, numCDP(e.numero), e.ref ? 'tiny '+e.ref : '', (e.items||[]).map(i=>i.ambiente).join(' ')].join(' '));
  if(alvo.includes(termo)) return true;
  const digitos = termo.replace(/\D/g,'');
  if(digitos){
    if(e.numero && String(e.numero) === String(parseInt(digitos,10))) return true;
    if(e.ref && String(e.ref).includes(digitos)) return true;
    if(digitos.length >= 4 && e.telefone && e.telefone.replace(/\D/g,'').includes(digitos)) return true;
  }
  return false;
}

function escolherEtapaFiltro(etapa){ HIST_ETAPA = etapa; filtrarHistorico(); }

async function renderHistory(){
  const list = $('hist-list');
  if(!HIST_CARREGADO) list.innerHTML = '<div class="hist-empty">Carregando orçamentos…</div>';
  try{
    HISTORY_CACHE = await sbFetchHistory();
    HIST_CARREGADO = true;
  } catch(err){
    $('hist-contagem').textContent = '';
    list.innerHTML = '<div class="hist-empty" style="color:var(--red)">'+ic('alerta',16)+' Não foi possível carregar os orçamentos.<br><span style="font-size:11px;color:var(--tx3)">Verifique sua conexão e tente de novo.</span></div>';
    return;
  }
  filtrarHistorico();
}

function filtrarHistorico(){
  const list = $('hist-list');
  const h = HISTORY_CACHE;
  const abertos = h.filter(e => e.etapa !== 'fechado' && e.etapa !== 'perdido').length;
  $('hist-contagem').textContent = h.length ? abertos + ' em aberto · ' + h.length + ' no total' : '';

  // filtros: "Todos" + só as etapas que têm orçamento (ou a que está selecionada)
  const cont = {}; h.forEach(e => { cont[e.etapa] = (cont[e.etapa]||0) + 1; });
  const chip = (id, nome, n) => `<button type="button" role="tab" class="hist-chip${HIST_ETAPA===id?' on':''}" aria-selected="${HIST_ETAPA===id}" onclick="escolherEtapaFiltro('${id}')">${nome} <span>${n}</span></button>`;
  $('hist-filtros').innerHTML = chip('todos','Todos',h.length) +
    ETAPAS.filter(([id]) => cont[id] || HIST_ETAPA===id).map(([id,nome]) => chip(id, nome, cont[id]||0)).join('');

  if(!h.length){ list.innerHTML = '<div class="hist-empty">Nenhum orçamento salvo ainda.<br>Toque em <strong>Novo orçamento</strong> para começar.</div>'; return; }

  const termo = semAcento(($('hist-busca') && $('hist-busca').value || '').trim());
  const vis = h.filter(e => (HIST_ETAPA==='todos' || e.etapa===HIST_ETAPA) && combinaBusca(e, termo));
  if(!vis.length){ list.innerHTML = '<div class="hist-empty">Nenhum orçamento encontrado'+(termo?' para “'+escHtml(termo)+'”':'')+'.</div>'; return; }

  list.innerHTML = vis.map(e => {
    const isMulti = !!e.items;
    const totalAv = isMulti ? e.totalAvista : (e.full ? e.full.avista : 0);
    const amb = ambientesDe(e);
    const linha2 = [numCDP(e.numero), e.bairro, amb ? amb + (amb>1?' ambientes':' ambiente') : ''].filter(Boolean).map(escHtml).join(' · ');
    const etapa = e.etapa || 'orcamento';
    return `
    <div class="hist-item hist-card" onclick="reopenOrc(${e.id})">
      <div class="hist-avatar etapa-${etapa}" aria-hidden="true">${escHtml(iniciais(e.client))}</div>
      <div class="hist-info">
        <div class="hist-client">${escHtml(e.client)}</div>
        <div class="hist-detail">${linha2}</div>
        <div class="hist-meta">
          <span class="hist-etapa etapa-${etapa}">${ETAPA_NOME[etapa]||escHtml(etapa)}</span>
          ${e.ref ? '<span class="hist-tiny">Tiny #'+escHtml(e.ref)+'</span>' : ''}
        </div>
      </div>
      <div class="hist-valor">
        <div class="hist-cost">${fmt(totalAv)}</div>
        <div class="hist-cost-lbl">à vista</div>
      </div>
      <div class="hist-rodape">
        <span class="hist-date">${escHtml(e.date)}${e.criadoPor ? ' · '+ic('usuario',13)+' '+escHtml(e.criadoPor) : ''}</span>
        <span class="hist-acoes">
          <button class="btn-outline hist-abrir" onclick="event.stopPropagation();reopenOrc(${e.id})">${ic('editar',15)} Abrir</button>
          <button class="hist-del" onclick="event.stopPropagation();delOrc(${e.id})" title="Excluir" aria-label="Excluir orçamento de ${escHtml(e.client)}">${ic('lixeira',16)}</button>
        </span>
      </div>
    </div>`;
  }).join('');
}

function reopenOrc(id){
  const h = getHistory();
  const e = h.find(x=>x.id===id);
  if(!e) return;

  if(e.items){
    CART = e.items.map(i=>({...i}));
    EDITING_ORC_ID = e.id;
    $('cli-nome').value = e.client;
    $('cli-tiny').value = e.ref || '';
    if(e.telefone) $('cli-tel').value = e.telefone;
    if(e.bairro) $('cli-bairro').value = e.bairro;
    syncCliente();
    updateCartBar();
    irParaTab('proposta');
    syncPropostaFromCart();
  } else if(e.full){
    STATE.lastResult = e.full;
    renderResult(e.full);
    irParaTab('calc');
  }
}

async function delOrc(id){
  if(!confirm('Excluir este orçamento? Isso remove para toda a equipe.')) return;
  try{
    await sbDeleteOrcamento(id);
    if(EDITING_ORC_ID === id) EDITING_ORC_ID = null;
    await renderHistory();
  } catch(err){
    alert('⚠️ Não foi possível excluir. Verifique sua conexão e tente de novo.');
  }
}


// ═══════════════════════════════════════════════════════
// COMPARE
// ═══════════════════════════════════════════════════════
function toggleCompare(){
  const cmp = $('cmp-section');
  cmp.classList.toggle('on');
  if(!cmp.classList.contains('on')) return;

  const r = STATE.lastResult;
  if(!r) return;

  const otherFab = r.fab==='real' ? 'Decore' : 'Real';
  const otherFabKey = r.fab==='real' ? 'dec' : 'real';
  const otherDB  = r.fab==='real' ? DB_DECORE : DB_REAL;
  const key = r.cat+'|'+r.prod+'|'+r.fam;
  const otherData = otherDB[key];

  let html = `<div style="font-size:12px;color:var(--tx2);margin-bottom:12px">
    Configurando comparação com <b style="color:${r.fab==='real'?'var(--dec)':'var(--real)'}">${otherFab}</b> para o mesmo produto.
  </div>`;

  if(!otherData){
    html += `<div class="chip chip-warn">${ic('alerta',15)} ${r.prod} ${r.fam} não está disponível na ${otherFab}.</div>`;
    $('cmp-config').innerHTML = html;
    return;
  }

  // Col selector
  html += `<div class="fg" style="margin-bottom:14px">
    <div class="fl"><label>Coleção (${otherFab})</label>
      <select id="cmp-col"><option value="">— Selecione a coleção —</option>`;
  if(otherData.subCols){
    Object.keys(otherData.subCols).forEach(sub => {
      html += `<optgroup label="${sub}">`;
      Object.keys(otherData.subCols[sub]).forEach(c => {
        html += `<option value="${sub}||${c}">[${sub}] ${c}</option>`;
      });
      html += '</optgroup>';
    });
  } else {
    Object.keys(otherData.cols).forEach(c => {
      html += `<option value="${c}">${c}</option>`;
    });
  }
  html += `</select></div></div>`;

  // Acessórios da outra fábrica
  const accList = otherFabKey==='real' ? ACC_REAL : ACC_DECORE;
  const prod = r.prod;
  let accHtml = '';
  let anyAcc = false;

  accList.forEach(sec => {
    const items = sec.items.filter(item =>
      !item.compat || item.compat.some(c => prod.includes(c.replace('CORTINA ','').replace('PERSIANA ','')))
      || item.compat.indexOf(prod) >= 0
    );
    if(!items.length) return;
    anyAcc = true;

    accHtml += `<div class="acc-section" style="margin-bottom:12px">
      <div class="acc-sec-hd">${sec.sec}</div>
      <div class="acc-grid">`;

    items.forEach(item => {
      const u = item.unit;
      const priceStr = u==='und'
        ? fmtDec(item.p||0)+'/und'
        : (item.cor ? fmtDec(item.cor.W)+'/ml' : '');

      let ctrl = '';
      if(u==='und'){
        ctrl = `<input type="number" id="cmp_qty_${item.id}" value="1" min="1" max="30" step="1">`;
      } else {
        ctrl = (item.cor && item.cor.C)
          ? `<select id="cmp_cor_${item.id}"><option value="W">Branco/Preto</option><option value="C">Cor</option></select>`
          : '';
        const defVal = u==='ml-larg' ? (r.w||'') : (r.h||'');
        ctrl += `<input type="number" id="cmp_ml_${item.id}" value="${defVal}" min="0.10" max="20" step="0.01" placeholder="ml" data-acc-unit="${u}">`;
      }

      accHtml += `<div class="acc-item" id="cmp_awi_${item.id}">
        <input type="checkbox" id="cmp_chk_${item.id}" onchange="onCmpAccChange(this,'${item.id}')">
        <div class="acc-item-body">
          <label class="ai-label" for="cmp_chk_${item.id}">${item.l}</label>
          ${item.note?'<div class="ai-note">'+item.note+'</div>':''}
          <div class="ai-controls" id="cmp_ctrl_${item.id}" style="display:none">${ctrl}</div>
        </div>
        <span class="ai-price">${priceStr}</span>
      </div>`;
    });

    accHtml += `</div></div>`;
  });

  if(anyAcc){
    html += `<div style="font-size:11.5px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
      Acessórios da comparação (${otherFab})
    </div>`;
    html += accHtml;
  }

  $('cmp-config').innerHTML = html;

  // Fair warning
  if(r.acc && r.acc.total > 0){
    $('fair-warn').innerHTML = ic('comparar',15)+' Atenção: o cálculo original inclui <b>R$'+fmtDec(r.acc.total)+'</b> em acessórios. Selecione os equivalentes acima para uma comparação justa.';
    $('fair-warn').classList.add('on');
  } else {
    $('fair-warn').classList.remove('on');
  }
}

function onCmpAccChange(chk, id){
  const ctrl = $('cmp_ctrl_'+id);
  if(ctrl) ctrl.style.display = chk.checked ? 'flex' : 'none';
  const item = $('cmp_awi_'+id);
  if(item) item.classList.toggle('checked', chk.checked);
}

function calcCmpAccCost(otherFabKey){
  const accList = otherFabKey==='real' ? ACC_REAL : ACC_DECORE;
  const r = STATE.lastResult;
  const w = r.w, h = r.h;
  let total = 0;
  const lines = [];

  const SEM_DESCONTO = [
    'r_m6n','r_mmaxi','r_m4f','r_mwifi','r_mbat','r_fonte',
    'r_rm6n','r_rm4f','r_rmwifi','r_rmbat','r_ph50mot','r_ph50wf',
    'r_rc1','r_rc15','r_rctimer','r_hub',
    'r_junc','r_red','r_redplus','r_supduplo','r_romred',
    'd_mmec','d_mrf','d_mele','d_mt38','d_mt38wf','d_mwmec','d_mwele','d_rmmot','d_rmmotwf','d_ph50mot','d_ph50motwf',
    'd_dc1','d_dc16','d_bpi1','d_bpi15','d_jmt',
    'd_ph50mono','d_ph25mono','d_ph25ev','d_red',
    'r_ph50mono','r_ph25mono','r_ph25ev','r_ph25cabo'
  ];

  accList.forEach(sec => {
    sec.items.forEach(item => {
      const chk = $('cmp_chk_'+item.id);
      if(!chk || !chk.checked) return;
      const u = item.unit;
      let cost = 0, label = '';

      if(u==='und'){
        const qty = parseFloat(($('cmp_qty_'+item.id)||{}).value)||1;
        cost = (item.p||0) * qty;
        label = item.l + (qty>1?' ×'+qty:'');
      } else if(u==='ml-larg'){
        const ml = parseFloat(($('cmp_ml_'+item.id)||{}).value)||w;
        const corSel = $('cmp_cor_'+item.id);
        const isColor = corSel && corSel.value==='C';
        const price = isColor ? (item.cor.C||item.cor.W) : item.cor.W;
        cost = price * ml;
        label = item.l + ' ' + ml.toFixed(2) + 'ml';
      } else if(u==='ml-alt'){
        const ml = parseFloat(($('cmp_ml_'+item.id)||{}).value)||h;
        const corSel = $('cmp_cor_'+item.id);
        const isColor = corSel && corSel.value==='C';
        const price = isColor ? (item.cor.C||item.cor.W) : item.cor.W;
        cost = price * ml;
        label = item.l + ' ' + ml.toFixed(2) + 'ml';
      }

      const semDesc = SEM_DESCONTO.indexOf(item.id) >= 0;
      let costDisc = cost, discLabel = '';
      if(!semDesc){
        if(otherFabKey==='real'){
          costDisc = cost * (1 - STATE.discReal/100);
          discLabel = STATE.discReal+'%';
        } else if(item.promo){
          costDisc = cost * (1 - STATE.discDecPromo/100);
          discLabel = STATE.discDecPromo+'%';
        } else {
          const d1 = STATE.discDecNorm||12;
          const d2 = STATE.discDecNorm2||3;
          costDisc = cost * (1 - d1/100) * (1 - d2/100);
          discLabel = d1+'%+'+d2+'%';
        }
      }
      total += costDisc;
      lines.push({label, cost:costDisc, discLabel, semDesc});
    });
  });

  return {total, lines};
}

function runCompare(){
  const r = STATE.lastResult;
  if(!r) return;
  const cmpColSel = $('cmp-col');
  if(!cmpColSel){ alert('Configure a coleção para comparar.'); return; }
  const cmpCol = cmpColSel.value;
  if(!cmpCol){ alert('Selecione a coleção para comparar.'); return; }

  const otherFab = r.fab==='real' ? 'dec' : 'real';
  const otherDB  = r.fab==='real' ? DB_DECORE : DB_REAL;
  const key = r.cat+'|'+r.prod+'|'+r.fam;
  const otherData = otherDB[key];
  if(!otherData) return;

  const colInfo = getColPrice(otherData, cmpCol);
  if(!colInfo){ alert('Coleção não encontrada.'); return; }

  const usedArea = Math.max(r.w*r.h, otherData.minM2||1.20);
  const subtecido = usedArea * colInfo.p;
  const isPromo = colInfo.promo || otherData.isPromo || false;
  let discPct = 0, subtDesc = 0;
  if(otherFab==='real'){
    discPct = STATE.discReal;
    subtDesc = subtecido * (1 - discPct/100);
  } else if(isPromo){
    discPct = STATE.discDecPromo;
    subtDesc = subtecido * (1 - discPct/100);
  } else {
    discPct = STATE.discDecNorm||12;
    subtDesc = subtecido * (1 - discPct/100) * (1 - (STATE.discDecNorm2||3)/100);
  }

  const tipoImp = otherData.tipoImp || getTipoImposto(r.prod, r.fam);
  const imp = getImpostos(tipoImp);
  let impostoValor = 0;
  if(otherFab==='dec'){
    impostoValor = subtDesc * imp.ipi + subtDesc * (1+imp.ipi) * imp.st;
  }

  // Acessórios da comparação
  const cmpAcc = calcCmpAccCost(otherFab);
  const cmpTotal = (subtDesc + impostoValor + cmpAcc.total) * r.qty;

  // Render side by side
  const orig = r.totalGeral;
  const cmp  = cmpTotal;
  const diff = Math.abs(orig - cmp);
  const cheaper = orig <= cmp ? r.fab : otherFab;
  const max = Math.max(orig, cmp);

  $('cbar-wrap').style.display='block';
  $('cbar-r').style.width = ((r.fab==='real'?orig:cmp)/max*100)+'%';
  $('cbar-d').style.width = ((r.fab==='real'?cmp:orig)/max*100)+'%';
  $('cval-r').textContent = fmt(r.fab==='real'?orig:cmp);
  $('cval-d').textContent = fmt(r.fab==='real'?cmp:orig);
  $('cdiff').innerHTML = '<strong>'+fmt(diff)+'</strong><span>'+((diff/Math.min(orig,cmp))*100).toFixed(1)+'% diferença</span>';

  const origCard = `<div class="rcard ${r.fab}">
    <div class="rc-fab">${r.fab==='real'?'Real Persianas':'Decore'} (original)</div>
    <div class="rc-prod">${r.colLabel}</div>
    <div class="rc-lbl">Custo total</div>
    <div class="rc-cost">${fmt(orig)}</div>
    <div class="bdown">
      <div class="brow"><span class="k">Preço/m²</span><span class="v">${fmtDec(r.priceM2)}</span></div>
      <div class="brow disc-row"><span class="k">Desconto ${r.discPct}%</span><span class="v">−${fmtDec(r.subtecido-r.subtDesconto)}</span></div>
      ${r.impostoValor>0?'<div class="brow tax-row"><span class="k">Impostos</span><span class="v">+'+fmtDec(r.impostoValor)+'</span></div>':''}
      ${r.acc.total>0?'<div class="brow"><span class="k">Acessórios</span><span class="v">+'+fmtDec(r.acc.total)+'</span></div>':''}
      <div class="brow total-row"><span class="k">Total</span><span class="v">${fmt(orig)}</span></div>
    </div>
  </div>`;

  const cmpAccRows = cmpAcc.lines.map(l =>
    `<div class="brow"><span class="k">+ ${l.label}${l.semDesc?'<span style=\"font-size:10px;color:var(--tx3)\">(fixo)</span>':l.disc>0?'<span style=\"font-size:10px;color:var(--grn)\">(-'+l.disc+'%)</span>':''}</span><span class="v">${fmtDec(l.cost)}</span></div>`
  ).join('');

  const otherCard = `<div class="rcard ${otherFab==='real'?'real':'decore'}">
    <div class="rc-fab">${otherFab==='real'?'Real Persianas':'Decore'} (comparação)</div>
    <div class="rc-prod">${colLabel(cmpCol)}</div>
    <div class="rc-lbl">Custo total</div>
    <div class="rc-cost">${fmt(cmpTotal)}</div>
    <div class="bdown">
      <div class="brow"><span class="k">Área calc.</span><span class="v">${usedArea.toFixed(2)} m²</span></div>
      <div class="brow"><span class="k">Preço/m²</span><span class="v">${fmtDec(colInfo.p)}</span></div>
      <div class="brow disc-row"><span class="k">Desconto ${discPct}%</span><span class="v">−${fmtDec(subtecido-subtDesc)}</span></div>
      ${impostoValor>0?'<div class="brow tax-row"><span class="k">Impostos PE</span><span class="v">+'+fmtDec(impostoValor)+'</span></div>':''}
      ${cmpAccRows}
      <div class="brow total-row"><span class="k">Total</span><span class="v">${fmt(cmpTotal)}</span></div>
    </div>
  </div>`;

  $('cmp-results').innerHTML = origCard + otherCard;
  $('cmp-results').style.display='grid';
}

// ═══════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════
// Botão "↺ Limpar" da barra fixa — só pede confirmação quando há algo a perder
// (fábrica escolhida, medidas ou ambiente preenchidos). Itens já adicionados ao
// orçamento não são afetados, então não vale incomodar por eles.
function onLimparClick(){
  const iw = $('i-w'), ih = $('i-h'), amb = $('item-ambiente');
  const temCoisa = STATE.fab || (iw && iw.value) || (ih && ih.value) || (amb && amb.value.trim());
  if(temCoisa && !confirm('Isso limpa fábrica, produto, medidas e acessórios preenchidos neste item.\n\nItens já adicionados ao orçamento não são afetados. Continuar?')) return;
  resetCalc();
}

function resetCalc(){
  EXTRAS = []; renderExtras();
  const tm = $('tipo-medida'); if(tm){ tm.value = 'cortina'; }
  const jw = $('jan-w'); if(jw) jw.value = '';
  const jh = $('jan-h'); if(jh) jh.value = '';
  const jwrap = $('janela-wrap'); if(jwrap) jwrap.style.display = 'none';
  const jsug = $('jan-sugestao'); if(jsug) jsug.innerHTML = '';
  const det = $('item-detalhamento'); if(det){ det.value=''; delete det.dataset.editedManually; }
  const amb = $('item-ambiente'); if(amb) amb.value = '';
  STATE = {fab:null,cat:'',prod:'',fam:'',col:'',w:0,h:0,qty:1,discReal:20,discDecNorm:12,discDecNorm2:3,discDecPromo:3,tubo:null,reducao:false,lastResult:null,cmpActive:false,cdpTipo:'',cdpCam1:'',cdpCam2:'',cdpIlhos:false,cdpCurvo:false,cdpCurvoValor:0};
  $('fb-real').className='fab-btn'; $('fb-dec').className='fab-btn'; $('fb-cdp').className='fab-btn';
  $('disc-row').style.display='none';
  $('prod-card-wrap').style.display='block';
  $('cdp-trad-card').style.display='none';
  $('s-cat').innerHTML='<option value="">— Selecione —</option><option>CORTINAS</option><option>PERSIANAS</option>';
  $('s-cat').disabled=true;
  ['s-prod','s-fam','s-col'].forEach(id=>{ $(id).innerHTML='<option value="">— Selecione —</option>'; $(id).disabled=true; });
  $('i-w').value=''; $('i-h').value=''; $('i-qty').value='';
  clearChips(); clearObs(); clearAcc();
  resetCdpTrad();
  $('result-wrap').classList.remove('on');
  $('alert-med').classList.remove('on');
  $('compat-sugest').style.display='none';
}

function resetCascata(){
  STATE.cat=STATE.prod=STATE.fam=STATE.col='';
  $('s-cat').value='';
  ['s-prod','s-fam','s-col'].forEach(id=>{ $(id).innerHTML='<option value="">— Selecione —</option>'; $(id).disabled=true; });
  clearChips(); clearObs(); clearAcc();
  $('result-wrap').classList.remove('on');
}

// ═══════════════════════════════════════════════════════
// CORTINA TRADICIONAL — PRODUÇÃO PRÓPRIA CDP
// ═══════════════════════════════════════════════════════
function resetCdpTrad(){
  STATE.cdpTipo=''; STATE.cdpCam1=''; STATE.cdpCam2=''; STATE.cdpIlhos=false; STATE.cdpCurvo=false; STATE.cdpCurvoValor=0;
  const tipoSel = $('cdp-tipo'); if(tipoSel) tipoSel.value='';
  const cam1Sel = $('cdp-cam1');
  if(cam1Sel){ cam1Sel.innerHTML='<option value="">— Selecione o tipo primeiro —</option>'; cam1Sel.disabled=true; }
  const cam2Sel = $('cdp-cam2');
  if(cam2Sel) cam2Sel.innerHTML='<option value="">— Selecione —</option>';
  const cam2Wrap = $('cdp-cam2-wrap'); if(cam2Wrap) cam2Wrap.style.display='none';
  const ilhos = $('cdp-ilhos'); if(ilhos) ilhos.checked=false;
  const curvo = $('cdp-curvo'); if(curvo) curvo.checked=false;
  const curvoValorEl = $('cdp-curvo-valor'); if(curvoValorEl) curvoValorEl.value='';
  const curvoWrap = $('cdp-curvo-valor-wrap'); if(curvoWrap) curvoWrap.style.display='none';
  const lbl = $('cdp-cam1-label'); if(lbl) lbl.textContent='Camada 1';
}

function cdpCamadaOptions(tecido, preco){
  const semPreco = (preco===null || preco===undefined);
  const label = tecido + (semPreco ? ' — preço a confirmar' : ' — ' + fmtDec(preco) + '/ml');
  return {tecido, preco, label};
}

function onCdpTipo(){
  STATE.cdpTipo = $('cdp-tipo').value;
  STATE.cdpCam1 = ''; STATE.cdpCam2 = '';
  const cam1Sel = $('cdp-cam1');
  const cam2Wrap = $('cdp-cam2-wrap');
  const lbl = $('cdp-cam1-label');

  if(!STATE.cdpTipo){
    cam1Sel.innerHTML = '<option value="">— Selecione o tipo primeiro —</option>';
    cam1Sel.disabled = true;
    cam2Wrap.style.display = 'none';
    $('result-wrap').classList.remove('on');
    return;
  }

  cam1Sel.disabled = false;

  if(STATE.cdpTipo === 'unica'){
    lbl.textContent = 'Camada única (Voil, Forro ou Blackout)';
    let opts = '<option value="">— Selecione —</option>';
    opts += '<optgroup label="Voil">' + CDP_TRAD.voil.map(v =>
      '<option value="voil|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('') + '</optgroup>';
    opts += '<optgroup label="Forro">' + CDP_TRAD.forro.map(v =>
      '<option value="forro|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('') + '</optgroup>';
    opts += '<optgroup label="Blackout (cortina completa)">' + CDP_TRAD.blackoutUnica.map(v =>
      '<option value="blackoutUnica|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('') + '</optgroup>';
    cam1Sel.innerHTML = opts;
    cam2Wrap.style.display = 'none';
  } else {
    // Dupla: camada 1 é sempre Voil; camada 2 é Forro ou Blackout (simples)
    lbl.textContent = 'Camada 1 (Voil)';
    cam1Sel.innerHTML = '<option value="">— Selecione —</option>' + CDP_TRAD.voil.map(v =>
      '<option value="voil|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('');
    let opts2 = '<option value="">— Selecione —</option>';
    opts2 += '<optgroup label="Forro">' + CDP_TRAD.forro.map(v =>
      '<option value="forro|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('') + '</optgroup>';
    opts2 += '<optgroup label="Blackout (camada simples)">' + CDP_TRAD.blackoutSimples.map(v =>
      '<option value="blackoutSimples|'+v.nome+'">'+cdpCamadaOptions(v.nome, v.preco).label+'</option>').join('') + '</optgroup>';
    $('cdp-cam2').innerHTML = opts2;
    cam2Wrap.style.display = 'block';
  }
  $('result-wrap').classList.remove('on');
}

function onCdpCamada(){
  STATE.cdpCam1 = $('cdp-cam1').value;
  STATE.cdpCam2 = STATE.cdpTipo==='dupla' ? $('cdp-cam2').value : '';
  STATE.cdpIlhos = $('cdp-ilhos').checked;
  STATE.cdpCurvo = $('cdp-curvo').checked;
  STATE.cdpCurvoValor = parseFloat($('cdp-curvo-valor').value) || 0;
  $('result-wrap').classList.remove('on');
}

function onCdpCurvo(){
  const checked = $('cdp-curvo').checked;
  $('cdp-curvo-valor-wrap').style.display = checked ? 'block' : 'none';
  onCdpCamada();
}

function getCdpCamadaData(valor){
  if(!valor) return null;
  const [grupo, nome] = valor.split('|');
  const list = CDP_TRAD[grupo];
  if(!list) return null;
  return list.find(x => x.nome === nome) || null;
}

function calcularCdpTrad(){
  if(!STATE.cdpTipo){ alert('Selecione o tipo (única ou dupla).'); return; }
  if(!STATE.cdpCam1){ alert('Selecione a camada 1.'); return; }
  if(STATE.cdpTipo==='dupla' && !STATE.cdpCam2){ alert('Selecione a camada 2 (forro ou blackout).'); return; }
  if(!STATE.ambiente || !STATE.ambiente.trim()){
    alert('⚠️ Preencha o Ambiente deste item antes de calcular (ex: Quarto Casal, Sala).');
    $('item-ambiente').focus();
    return;
  }

  const w = STATE.w, h = STATE.h, qty = STATE.qty;
  if(!w){ alert('Informe a largura.'); return; }

  const cam1 = getCdpCamadaData(STATE.cdpCam1);
  const cam2 = STATE.cdpTipo==='dupla' ? getCdpCamadaData(STATE.cdpCam2) : null;
  if(!cam1 || (STATE.cdpTipo==='dupla' && !cam2)){ alert('Tecido não encontrado.'); return; }

  if(cam1.preco==null || (cam2 && cam2.preco==null)){
    alert('⚠️ O tecido selecionado ainda não tem preço confirmado nesta calculadora.\n\nFale com a Bru antes de usar este item num orçamento — ela vai confirmar o valor.');
    return;
  }

  const precoM1 = cam1.preco;
  const precoM2 = cam2 ? cam2.preco : 0;
  const precoMl = precoM1 + precoM2;
  let subtotalUnit = w * precoMl;

  const ilhosAplicado = STATE.cdpIlhos;
  const subtotalSemIlhos = subtotalUnit;
  if(ilhosAplicado) subtotalUnit = subtotalUnit * 1.20;

  const curvoAplicado = STATE.cdpCurvo;
  const curvoValor = curvoAplicado ? (STATE.cdpCurvoValor || 0) : 0;

  const totalGeral = subtotalUnit * qty + curvoValor;

  // Preço da tabela CDP já é o valor de venda final (à vista, por metro linear) — não multiplicar por 2
  const extrasTotal = totalExtras();
  const avista = Math.round(totalGeral) + Math.round(extrasTotal);
  const tabela = Math.round(avista / 0.85);
  const cartao = Math.round(tabela * 0.95);

  const camadaLabel = cam2 ? (cam1.nome + ' + ' + cam2.nome) : cam1.nome;
  const alturaAcima27 = h && h > 2.70;

  STATE.lastResult = {
    fab: 'cdp', cat: 'CORTINA TRADICIONAL', prod: 'Cortina Tradicional', fam: STATE.cdpTipo==='dupla' ? 'Dupla' : 'Única',
    col: STATE.cdpCam1 + (cam2?('+'+STATE.cdpCam2):''), colLabel: camadaLabel,
    ambiente: STATE.ambiente,
    w, h, qty,
    cam1, cam2, precoM1, precoM2, precoMl,
    subtotalSemIlhos, ilhosAplicado, curvoAplicado, curvoValor, subtotalUnit, totalGeral,
    extras: EXTRAS.map(e=>({...e})), extrasTotal,
    alturaAcima27,
    avista, tabela, cartao
  };

  renderResultCdp(STATE.lastResult);
}

function renderResultCdp(r){
  let rows = '';
  if(r.alturaAcima27) rows += `<div class="brow" style="color:var(--warn)"><span class="k">${ic('alerta',14)} Altura acima de 2,70m</span><span class="v">cálculo personalizado — confirmar com o ateliê</span></div>`;
  rows += `<div class="brow"><span class="k">Tipo</span><span class="v">${r.fam}</span></div>`;
  rows += `<div class="brow"><span class="k">Camada 1</span><span class="v">${r.cam1.nome} — ${fmtDec(r.precoM1)}/ml</span></div>`;
  if(r.cam2) rows += `<div class="brow"><span class="k">Camada 2</span><span class="v">${r.cam2.nome} — ${fmtDec(r.precoM2)}/ml</span></div>`;
  rows += `<div class="brow"><span class="k">Largura</span><span class="v">${r.w.toFixed(2)}m</span></div>`;
  if(r.h) rows += `<div class="brow"><span class="k">Altura</span><span class="v">${r.h.toFixed(2)}m</span></div>`;
  rows += `<div class="brow"><span class="k">Valor/ml (camadas somadas)</span><span class="v">${fmtDec(r.precoMl)}</span></div>`;
  rows += `<div class="brow"><span class="k">Subtotal (largura × valor/ml)</span><span class="v">${fmtDec(r.subtotalSemIlhos)}</span></div>`;
  if(r.ilhosAplicado) rows += `<div class="brow disc-row"><span class="k">Ilhós (+20%)</span><span class="v">+${fmtDec(r.subtotalUnit - r.subtotalSemIlhos)}</span></div>`;
  if(r.curvoAplicado) rows += `<div class="brow disc-row"><span class="k">${ic('ferramenta',14)} Trilho curvo (fornecedor externo)</span><span class="v">+${fmtDec(r.curvoValor)}</span></div>`;
  if(r.extras && r.extras.length) r.extras.forEach(e => { rows += `<div class="brow disc-row"><span class="k">${ic('ferramenta',14)} ${e.desc}</span><span class="v">+${fmtDec(e.valor)}</span></div>`; });
  if(r.qty > 1){
    rows += `<div class="brow"><span class="k">Custo unitário</span><span class="v">${fmtDec(r.subtotalUnit)}</span></div>`;
    rows += `<div class="brow total-row"><span class="k">TOTAL (${r.qty} peças)</span><span class="v">${fmtDec(r.totalGeral)}</span></div>`;
  } else {
    rows += `<div class="brow total-row"><span class="k">CUSTO TOTAL</span><span class="v">${fmtDec(r.totalGeral)}</span></div>`;
  }

  const body = `
    <div class="rcard cdp">
      <div class="rc-fab">CDP — Cortina Tradicional</div>
      <div class="rc-prod">Cortina Tradicional ${r.fam} — ${r.colLabel}</div>
      <div class="rc-lbl">Custo de Produção</div>
      <div class="rc-cost">${fmt(r.totalGeral)}</div>
      <div class="bdown">${rows}</div>
    </div>`;

  $('rcard-body').innerHTML = body;

  $('sell-grid').innerHTML = sellGridHTML(r, 'cdp');

  $('result-wrap').classList.add('on');
  $('cmp-section').classList.remove('on');
  $('cbar-wrap').style.display='none';
  $('cmp-results').style.display='none';
  $('fair-warn').classList.remove('on');

  setTimeout(() => $('result-wrap').scrollIntoView({behavior:'smooth',block:'start'}), 100);
}

// ═══════════════════════════════════════════════════
// CARRINHO — MÚLTIPLOS ITENS POR ORÇAMENTO
// ═══════════════════════════════════════════════════
let CART = [];
// Quando não-nulo, "Salvar Orçamento" ATUALIZA esse id (Supabase) em vez de criar um novo —
// setado por reopenOrc() ao reabrir um orçamento salvo, limpo por novoOrcamento()/clearCart()
let EDITING_ORC_ID = null;

function baseDetalhamento(prod, w, h, jw, jh){
  const wf = w.toFixed(2).replace('.',',');
  const hf = h.toFixed(2).replace('.',',');
  const jwf = (jw ? jw.toFixed(2).replace('.',',') : wf);
  const jhf = (jh ? jh.toFixed(2).replace('.',',') : hf);
  const fam = prod || '';
  const T = {
    'CORTINA ROLÔ': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM MONOCOMANDO. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM BANDÔ E SEM GUIAS)`,
    'CORTINA ROMANA': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM MONOCOMANDO. INSTALAÇÃO: FORA DO VÃO DA JANELA.`,
    'CORTINA PAINEL': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: A DEFINIR. ABERTURA: A DEFINIR. QTD. FOLHAS: X. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM BANDÔ)`,
    'CORTINA ELEGANCE / DOUBLE VISION': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM MONOCOMANDO. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM BANDÔ)`,
    'CORTINA CELULAR': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM MONOCOMANDO. INSTALAÇÃO: FORA DO VÃO DA JANELA.`,
    'CORTINA NUETTE': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM MONOCOMANDO. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM BANDÔ)`,
    'PERSIANA VERTICAL': `TAMANHO JANELA: ${jwf}L X ${jhf}A. PERSIANA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ABERTURA: A DEFINIR. ACIONAMENTO: MANUAL. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM BANDÔ)`,
    'PERSIANA HORIZONTAL': `TAMANHO JANELA: ${jwf}L X ${jhf}A. PERSIANA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. LADO COMANDO: A DEFINIR. ACIONAMENTO: MANUAL, COM CORDÕES E HASTE ACRÍLICA. ACABAMENTO: A DEFINIR. INSTALAÇÃO: FORA DO VÃO DA JANELA.`,
    'Cortina Tradicional': `TAMANHO JANELA: ${jwf}L X ${jhf}A. CORTINA FICA COM: ${wf}L X ${hf}A. COR: A DEFINIR. PREGA: A DEFINIR (SE FOR FORRO, SEM PREGAS). ABERTURA: A DEFINIR. ACIONAMENTO: MANUAL. TRILHO: LINEAR 1 CALHA. INSTALAÇÃO: FORA DO VÃO DA JANELA. (SEM FORRO E SEM BLACKOUT)`
  };
  return T[fam] || `TAMANHO: ${wf}L X ${hf}A. COR: A DEFINIR. ACIONAMENTO: A DEFINIR.`;
}

// Verifica se algum item ainda tem "A DEFINIR" no detalhamento antes de uma ação
// que "trava" o texto (adicionar ao orçamento, salvar, gerar proposta pro cliente).
// Não bloqueia — só confirma, porque às vezes é mesmo intencional seguir assim.
function confirmarPendencias(items, acaoLabel){
  const pendentes = items.filter(i => (i.detail||'').toUpperCase().includes('A DEFINIR'));
  if(!pendentes.length) return true;
  const lista = pendentes.map(i => '• ' + (i.label || i.ambiente || 'item')).join('\n');
  return confirm(
    '⚠️ ' + pendentes.length + ' ' + (pendentes.length>1 ? 'itens ainda têm' : 'item ainda tem') +
    ' campo(s) "A DEFINIR" no detalhamento:\n\n' + lista +
    '\n\n' + acaoLabel + ' assim mesmo?'
  );
}

function addToCart(){
  if(!STATE.lastResult){ alert('Calcule um produto primeiro.'); return; }
  const r = STATE.lastResult;
  const mesmoAmbiente = CART.filter(i => i.ambiente === r.ambiente).length;
  const sugestao = r.ambiente + (mesmoAmbiente > 0 ? ' - Item ' + (mesmoAmbiente+1) : '');
  const label = prompt('Nome deste item (ajuste se for outro vão/janela ou outra opção do mesmo ambiente):', sugestao) || sugestao;
  const detBox = $('item-detalhamento');
  const baseDetail = (detBox && detBox.value.trim()) ? detBox.value.trim() : baseDetalhamento(r.prod, r.w, r.h);
  const fullDetail = baseDetail
    + ((r.extras && r.extras.length) ? ' ADICIONAIS: ' + r.extras.map(e=>e.desc.toUpperCase()).join('; ') + '.' : '')
    + (r.foraDoPadrao ? ` — ⚠️ Medida fora do padrão de fabricação (mín. ${r.minFab}m): cobrado pelo mínimo; possivelmente fora da garantia de fábrica.` : '');

  if(!confirmarPendencias([{label, detail: fullDetail}], 'Adicionar ao orçamento')) return;

  CART.push({
    id: Date.now(),
    label,
    ambiente: r.ambiente || '',
    fab: r.fab,
    prod: r.prod,
    fam: r.fam,
    col: r.colLabel,
    w: r.w, h: r.h, qty: r.qty,
    tabela: r.tabela,
    cartao: r.cartao,
    avista: r.avista,
    totalGeral: r.totalGeral,
    detail: fullDetail,
    foraDoPadrao: !!r.foraDoPadrao,
    full: r
  });

  updateCartBar();
  EXTRAS = []; renderExtras();
  if(detBox){ detBox.value=''; delete detBox.dataset.editedManually; }
  
  // Visual feedback
  const btn = (window.event && (event.currentTarget || event.target)) || null;
  if(!btn || !btn.style) return;
  const orig = btn.innerHTML;
  btn.innerHTML = ic('ok',17)+' Adicionado!';
  btn.style.background = 'linear-gradient(135deg,var(--grn),#1a8a5a)';
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1500);
}

function duplicarItemCarrinho(id){
  const item = CART.find(x => x.id === id);
  if(!item) return;
  const mesmoAmbiente = CART.filter(i => i.ambiente === item.ambiente).length;
  const copia = {
    ...item,
    id: Date.now(),
    label: item.label.replace(/\s*-\s*Item\s*\d+$/i, '') + ' - Item ' + (mesmoAmbiente + 1) + ' (cópia)'
  };
  CART.push(copia);
  updateCartBar();
}

function editarItemCarrinho(id){
  const item = CART.find(x => x.id === id);
  if(!item) return;
  if(!confirm('Isso remove o item do orçamento e traz os dados pra Calculadora — fábrica, produto, coleção, medidas, acessórios e peças adicionais são restaurados automaticamente. Continuar?')) return;

  const full = item.full || {};

  // muda pra aba Calculadora
  irParaTab('calc');

  selectFab(item.fab);
  $('item-ambiente').value = item.ambiente || '';
  STATE.ambiente = item.ambiente || '';

  // Medidas primeiro — onMedidas() reconstrói o select de coleção quando STATE.fam já
  // está preenchido, então precisa rodar ANTES da cascata categoria→produto→família→coleção
  // pra não zerar a coleção que a gente ainda vai selecionar.
  $('i-w').value = item.w; $('i-h').value = item.h; $('i-qty').value = item.qty;
  onMedidas();

  // Avisa se o desconto usado no cálculo original é diferente do que está nos campos
  // de desconto agora (eles são globais da sessão, não por item — não mexe sozinho pra
  // não afetar outros itens que você ainda vai calcular).
  let avisoDesconto = '';
  if(item.fab === 'real' && full.discPct != null && full.discPct !== STATE.discReal){
    avisoDesconto = `\n\n⚠️ Este item foi calculado com desconto de ${full.discPct}% (campo atual: ${STATE.discReal}%). Ajuste o campo de desconto Real se quiser manter o valor original.`;
  } else if(item.fab === 'dec' && full.discPct != null){
    const atual = full.isPromo ? STATE.discDecPromo : STATE.discDecNorm;
    if(full.discPct !== atual){
      avisoDesconto = `\n\n⚠️ Este item foi calculado com desconto de ${full.discPct}%${full.discPct2 ? '+'+full.discPct2+'%' : ''} (campo atual: ${atual}%). Ajuste o(s) campo(s) de desconto Decore se quiser manter o valor original.`;
    }
  }

  if(item.fab === 'cdp'){
    // Restaura Cortina Tradicional (produção própria CDP)
    $('cdp-tipo').value = full.fam === 'Dupla' ? 'dupla' : 'unica';
    onCdpTipo();
    const partes = (full.col || '').split('+');
    $('cdp-cam1').value = partes[0] || '';
    if(partes[1]) $('cdp-cam2').value = partes[1];
    $('cdp-ilhos').checked = !!full.ilhosAplicado;
    $('cdp-curvo').checked = !!full.curvoAplicado;
    if(full.curvoAplicado){
      $('cdp-curvo-valor-wrap').style.display = 'block';
      $('cdp-curvo-valor').value = full.curvoValor || '';
    }
    onCdpCamada();
  } else {
    // Restaura a cascata categoria → produto → família → coleção
    $('s-cat').value = full.cat || '';
    onCat();
    $('s-prod').value = full.prod || '';
    onProd();
    $('s-fam').value = full.fam || '';
    onFam(); // reconstrói acessórios (buildAcc) e agenda autoFillAccMl em 50ms
    $('s-col').value = full.col || '';
    onCol();

    // Restaura acessórios depois do autoFillAccMl (roda em 50ms lá dentro do buildAcc),
    // senão os campos de metragem que a gente restaura seriam sobrescritos por ele.
    setTimeout(() => restoreAccSelections(full.accSelections), 120);
  }

  // Restaura peças adicionais / serviços fora de tabela
  EXTRAS = (full.extras || []).map(e => ({...e}));
  renderExtras();

  $('item-detalhamento').value = item.detail || '';
  $('item-detalhamento').dataset.editedManually = '1';

  CART = CART.filter(x => x.id !== id);
  updateCartBar();
  window.scrollTo({top:0, behavior:'smooth'});
  alert('📝 Item carregado na Calculadora com fábrica, produto, coleção, medidas' + (item.fab!=='cdp' ? ', acessórios' : '') + ' e peças adicionais restaurados. Confira e clique em Adicionar ao Orçamento.' + avisoDesconto);
}

function toggleResumoOrc(){
  const painel = $('orc-resumo-painel');
  const seta = $('orc-resumo-seta');
  const abrindo = painel.style.display === 'none';
  painel.style.display = abrindo ? 'block' : 'none';
  seta.textContent = abrindo ? '▼' : '▲';
}

function renderResumoOrc(){
  const barWrap = $('orc-resumo-bar');
  if(!CART.length){ barWrap.style.display = 'none'; return; }
  barWrap.style.display = 'block';

  const totalTabela = CART.reduce((s,i)=>s+i.tabela,0);
  const totalCartao = CART.reduce((s,i)=>s+i.cartao,0);
  const totalAvista = CART.reduce((s,i)=>s+i.avista,0);
  $('orc-resumo-contador').innerHTML = (EDITING_ORC_ID ? ic('editar',15)+' Editando <span style="white-space:nowrap">' + nomeOrcEditando() + '</span> · ' : ic('orcamentos',15)+' ') + CART.length + (CART.length>1?' itens':' item');
  $('orc-resumo-valores').innerHTML = '<span class="rv">'+ic('etiqueta',13)+' Tabela '+fmt(totalTabela)+'</span><span class="rv">'+ic('cartao',13)+' Cartão '+fmt(totalCartao)+'</span><span class="rv rv-av">'+ic('dinheiro',13)+' À vista '+fmt(totalAvista)+'</span>';

  // agrupar por ambiente
  const grupos = {};
  CART.forEach(item => {
    const amb = item.ambiente || 'Sem ambiente';
    if(!grupos[amb]) grupos[amb] = [];
    grupos[amb].push(item);
  });

  $('orc-resumo-painel').innerHTML = Object.entries(grupos).map(([amb, itens]) => {
    const subAvista = itens.reduce((s,i)=>s+i.avista,0);
    return `
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:12.5px;color:var(--gold);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--gold2);display:flex;align-items:center;gap:6px">${ic('local',14)} ${amb} (${itens.length} ${itens.length>1?'itens':'item'} · ${fmt(subAvista)})</div>
      ${itens.map(item => {
        const fc = fabColor(item.fab), fbg = fabBg(item.fab), fbd = fabBd(item.fab);
        const medidas = (item.w && item.h) ? (item.w+'×'+item.h+'m' + (item.qty>1?' ×'+item.qty:'')) : '';
        const modeloColecao = [item.prod, item.fam].filter(Boolean).join(' · ') + (item.col ? ' — '+item.col : '');
        return `
        <div style="padding:7px 0 7px 14px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:flex-start;gap:8px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:9.5px;font-weight:700;letter-spacing:.4px;color:${fc};background:${fbg};border:1px solid ${fbd};border-radius:3px;padding:1.5px 6px;white-space:nowrap">${fabName(item.fab).toUpperCase()}</span>
                <span style="font-weight:600;font-size:12px;color:var(--tx)">${item.label}</span>
              </div>
              <div style="font-size:11px;color:var(--tx2);margin-top:3px;line-height:1.4">${modeloColecao}${medidas ? ' · '+medidas : ''}</div>
            </div>
            <div style="text-align:right;white-space:nowrap">
              <div style="font-weight:700;font-size:12.5px;color:var(--gold)">${fmt(item.avista)}</div>
              <div style="font-size:9.5px;color:var(--tx3)">tab. ${fmt(item.tabela)} · cart. ${fmt(item.cartao)}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px">
              <button onclick="duplicarItemCarrinho(${item.id})" style="background:none;border:none;color:var(--tx2);cursor:pointer;font-size:11px" title="Duplicar" aria-label="Duplicar item">${ic('copiar',15)}</button>
              <button onclick="editarItemCarrinho(${item.id})" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:11px" title="Editar" aria-label="Editar item">${ic('editar',15)}</button>
              <button onclick="removeFromCart(${item.id})" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px" title="Remover" aria-label="Remover item">${ic('fechar',15)}</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// Alimenta o autocomplete do campo Ambiente com os nomes já usados no orçamento
// em andamento, pra reduzir o risco de "Quarto Casal" x "quarto casal" virarem
// grupos diferentes no resumo por causa de digitação.
function updateAmbientesDatalist(){
  const dl = $('ambientes-datalist');
  if(!dl) return;
  const nomes = [...new Set(CART.map(i => i.ambiente).filter(Boolean))];
  dl.innerHTML = nomes.map(n => `<option value="${n.replace(/"/g,'&quot;')}">`).join('');
}

function updateCartBar(){
  renderResumoOrc();
  updateAmbientesDatalist();
  const bar = $('cart-bar');
  const count = $('cart-count');
  const banner = $('cart-editing-banner');
  const saveBtn = $('btn-save-orc');
  if(CART.length === 0){
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  count.textContent = CART.length + ' item' + (CART.length>1?'s':'') + ' adicionado' + (CART.length>1?'s':'');
  if(EDITING_ORC_ID){
    banner.style.display = 'block';
    banner.textContent = 'Editando o orçamento ' + nomeOrcEditando() + ', já salvo — ao clicar em Atualizar, a versão antiga é substituída (não cria um novo).';
    saveBtn.innerHTML = ic('salvar',16)+' Atualizar orçamento';
  } else {
    banner.style.display = 'none';
    saveBtn.innerHTML = ic('salvar',16)+' Salvar orçamento';
  }
  renderCartItems();
}

function viewCart(){
  const itemsDiv = $('cart-items');
  itemsDiv.style.display = itemsDiv.style.display==='none' ? 'block' : 'none';
}

function renderCartItems(){
  const div = $('cart-items');
  if(!CART.length){ div.innerHTML=''; return; }
  div.innerHTML = CART.map((item,i) => `
    <div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12.5px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="color:var(--tx3);min-width:20px">${i+1}.</span>
        <div style="flex:1">
          <div style="font-weight:600;color:var(--tx)">${item.label}</div>
          <div style="color:var(--tx2);font-size:11.5px">${fabName(item.fab)} · ${item.w}×${item.h}m${item.qty>1?' ×'+item.qty:''}</div>
        </div>
        <div style="text-align:right;min-width:90px">
          <div style="font-weight:700;color:var(--gold)">${fmt(item.avista)} <span style="font-size:10px;font-weight:400;color:var(--tx3)">à vista</span></div>
          <div style="font-size:11px;color:var(--tx3);text-decoration:line-through">${fmt(item.tabela)} tabela</div>
        </div>
        <button onclick="duplicarItemCarrinho(${item.id})" style="background:none;border:none;color:var(--tx2);cursor:pointer;font-size:12px;padding:2px 6px;white-space:nowrap" title="Duplicar" aria-label="Duplicar item">${ic('copiar',15)}</button>
        <button onclick="editarItemCarrinho(${item.id})" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;padding:2px 6px;white-space:nowrap">${ic('editar',15)} Editar</button>
        <button onclick="removeFromCart(${item.id})" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:14px;padding:2px 6px;transition:color .2s" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--tx3)'">${ic('fechar',15)}</button>
      </div>
      <div style="margin-top:6px;padding-left:30px">
        <label style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">Detalhamento (editável — troque os "A DEFINIR")</label>
        <textarea oninput="updateItemDetail(${item.id}, this.value)" rows="2" style="width:100%;margin-top:3px;padding:6px 8px;border:1px solid var(--border);border-radius:var(--r2);font-family:inherit;font-size:11.5px;color:var(--tx);resize:vertical;background:var(--s2)">${item.detail||''}</textarea>
      </div>
    </div>
  `).join('') + `
    <div style="display:flex;justify-content:flex-end;padding-top:8px;gap:4px">
      <button class="btn-outline" style="font-size:11.5px;padding:5px 12px;color:var(--red);border-color:var(--red)" onclick="clearCart()">${ic('lixeira',15)} Remover todos os itens</button>
    </div>`;
}

function updateItemDetail(id, value){
  const item = CART.find(x => x.id === id);
  if(item) item.detail = value;
}

function removeFromCart(id){
  CART = CART.filter(x => x.id !== id);
  updateCartBar();
}

function clearCart(){
  if(!confirm('Remover todos os itens do orçamento?')) return;
  CART = [];
  EDITING_ORC_ID = null;
  updateCartBar();
}

// ═══════════════════════════════════════════════════
// NOVO ORÇAMENTO — reset completo (carrinho + cliente + calculadora)
// separado de "Abrir Orçamentos" (que reabre um já salvo, ver reopenOrc)
// ═══════════════════════════════════════════════════
function novoOrcamento(){
  const temCoisa = CART.length > 0 || (($('cli-nome') && $('cli-nome').value.trim()));
  if(temCoisa && !confirm('Isso limpa o orçamento em andamento (itens já adicionados e dados do cliente) pra começar um novo do zero.\n\nSe algo aqui ainda não foi salvo, vai se perder. Continuar?')) return;

  CART = [];
  EDITING_ORC_ID = null;
  updateCartBar();

  ['cli-nome','cli-tel','cli-bairro','cli-tiny','cli-cpf','cli-email','cli-end','cli-contato'].forEach(id=>{
    const el = $(id); if(el) el.value = '';
  });
  syncCliente();

  resetCalc();

  irParaTab('calc');

  window.scrollTo({top:0, behavior:'smooth'});
}

async function saveOrcamento(){
  if(!CART.length){ alert('Adicione pelo menos um item ao orçamento.'); return; }
  if(!confirmarPendencias(CART, 'Salvar o orçamento')) return;
  syncCliente();
  const ref    = STATE.cliente.tiny;
  const client = STATE.cliente.nome;
  if(!client){ alert('Preencha o nome do cliente no topo da tela.'); return; }

  const entry = {
    ref, client,
    telefone: STATE.cliente.tel, bairro: STATE.cliente.bairro,
    date: new Date().toLocaleDateString('pt-BR'),
    items: CART.map(item => ({...item})),
    totalTabela: CART.reduce((s,i)=>s+i.tabela,0),
    totalCartao: CART.reduce((s,i)=>s+i.cartao,0),
    totalAvista: CART.reduce((s,i)=>s+i.avista,0)
  };

  const count = entry.items.length;
  const isUpdate = !!EDITING_ORC_ID;
  let nome = isUpdate ? nomeOrcEditando() : '';
  try{
    const resp = isUpdate ? await sbUpdateOrcamento(EDITING_ORC_ID, entry) : await sbInsertOrcamento(entry);
    const linha = Array.isArray(resp) ? resp[0] : resp;
    if(linha && linha.numero) nome = numCDP(linha.numero);
  } catch(err){
    if(String(err && err.message).includes('está fechado')){
      alert('Este orçamento está FECHADO e não pode mudar itens ou valores.\n\nSe precisar alterar, reabra o orçamento antes.');
      return;
    }
    alert('⚠️ Não foi possível ' + (isUpdate?'atualizar':'salvar') + ' o orçamento.\n\nSeus itens continuam aqui — verifique a conexão e tente de novo.');
    return;
  }

  CART = [];
  EDITING_ORC_ID = null;
  updateCartBar();
  alert(isUpdate
    ? '✅ Orçamento ' + (nome || '#' + ref) + ' atualizado com ' + count + (count>1?' itens':' item') + '!\n\nA versão antiga foi substituída — já está disponível para toda a equipe.'
    : '✅ Orçamento ' + (nome ? nome + ' ' : '') + 'salvo com ' + count + (count>1?' itens':' item') + '!\n\nJá está disponível para toda a equipe.');
}

// ═══════════════════════════════════════════════════
// PROPOSTA COMERCIAL
// ═══════════════════════════════════════════════════
// Mostra a aba t ('hist', 'calc' ou 'proposta') sem depender da ordem dos botões
function irParaTab(t){
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $('tab-'+t).classList.add('active');
  const sticky = $('sticky-actions');
  if(sticky) sticky.style.display = (t==='calc') ? 'flex' : 'none';
  document.body.classList.toggle('na-lista', t==='hist');
}

function switchTab(t){
  irParaTab(t);
  if(t==='hist') renderHistory();
  if(t==='proposta') syncPropostaFromCalc();
}

function syncPropostaFromCalc(){
  syncPropostaFromCart();
}

function syncPropostaFromCart(){
  const info = $('p-from-calc');
  if(CART.length){
    info.innerHTML = ic('ok',16)+' <b>' + CART.length + ' item' + (CART.length>1?'s':'') + '</b> no orçamento: ' +
      CART.map((i,n) => '<b>'+(n+1)+'.</b> '+i.label).join(' | ');
    info.style.background = 'rgba(46,125,82,.08)';
    info.style.borderColor = 'rgba(46,125,82,.25)';
    info.style.color = 'var(--grn)';
  } else if(STATE.lastResult){
    const r = STATE.lastResult;
    info.innerHTML = ic('alerta',16)+' Nenhum item adicionado ao orçamento. Último cálculo: <b>'+r.prod+' '+r.fam+'</b> | Use "Adicionar ao orçamento" na calculadora.';
    info.style.background = '';
    info.style.borderColor = '';
    info.style.color = 'var(--gold)';
  } else {
    info.innerHTML = ic('info',16)+' Calcule produtos na aba <b>Calculadora</b> e clique em "Adicionar ao orçamento".';
    info.style.background = '';
    info.style.borderColor = '';
    info.style.color = 'var(--gold)';
  }
  renderPropostaDetalhes();
}

function renderPropostaDetalhes(){
  const wrap = $('p-detalhes-itens');
  if(!wrap) return;
  if(!CART.length){ wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Detalhamento por item (editável — troque os "A DEFINIR")</div>' +
    CART.map((item,i) => `
    <div style="margin-bottom:10px">
      <div style="font-size:11.5px;font-weight:600;color:var(--tx);margin-bottom:3px">${i+1}. ${item.label}</div>
      <textarea oninput="updateItemDetail(${item.id}, this.value)" rows="2" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--r2);font-family:inherit;font-size:11.5px;color:var(--tx);resize:vertical;background:var(--s2)">${item.detail||''}</textarea>
    </div>`).join('');
}

let EXTRAS = [];

function addExtra(){
  const desc = $('extra-desc').value.trim();
  const valor = parseFloat($('extra-valor').value);
  if(!desc){ alert('Informe a descrição do serviço ou peça.'); return; }
  if(!valor || valor <= 0){ alert('Informe um valor válido.'); return; }
  EXTRAS.push({ id: Date.now(), desc, valor });
  $('extra-desc').value = '';
  $('extra-valor').value = '';
  renderExtras();
  $('result-wrap').classList.remove('on');
}

function removeExtra(id){
  EXTRAS = EXTRAS.filter(x => x.id !== id);
  renderExtras();
  $('result-wrap').classList.remove('on');
}

function renderExtras(){
  const div = $('extras-list');
  if(!div) return;
  if(!EXTRAS.length){ div.innerHTML = ''; return; }
  div.innerHTML = EXTRAS.map(e => `
    <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--s3);border:1px solid var(--border);border-radius:var(--r2);margin-bottom:5px;font-size:12.5px">
      <span style="flex:1">${e.desc}</span>
      <span style="font-weight:700;color:var(--gold)">${fmtDec(e.valor)}</span>
      <button onclick="removeExtra(${e.id})" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:14px;padding:0 4px">${ic('fechar',15)}</button>
    </div>`).join('');
}

function totalExtras(){
  return EXTRAS.reduce((s,e) => s + e.valor, 0);
}

function onPTipo(){
  const wrap = $('p-datavisita-wrap');
  wrap.style.display = ($('p-tipo').value === 'ORÇAMENTO PÓS-VISITA') ? 'block' : 'none';
}

function syncCliente(){
  STATE.cliente = {
    nome: $('cli-nome').value.trim(),
    tel: $('cli-tel').value.trim(),
    bairro: $('cli-bairro').value.trim(),
    tiny: $('cli-tiny').value.trim(),
    cpf: $('cli-cpf').value.trim(),
    email: $('cli-email').value.trim(),
    end: $('cli-end').value.trim(),
    contato: $('cli-contato').value.trim()
  };
}

function gerarProposta(){
  const items = CART.length ? CART : (STATE.lastResult ? [{
    label: STATE.lastResult.prod+' '+STATE.lastResult.fam+' — '+STATE.lastResult.colLabel,
    ambiente: STATE.lastResult.ambiente || '',
    fab: STATE.lastResult.fab,
    qty: STATE.lastResult.qty,
    tabela: STATE.lastResult.tabela,
    cartao: STATE.lastResult.cartao,
    avista: STATE.lastResult.avista,
    detail: '',
    w: STATE.lastResult.w,
    h: STATE.lastResult.h
  }] : null);
  if(!items){ alert('Adicione itens ao orçamento primeiro.'); return; }
  if(!confirmarPendencias(items, 'Gerar a proposta pro cliente')) return;
  syncCliente();
  if(!STATE.cliente.nome){ alert('Preencha o nome do cliente na barra do topo.'); return; }
  const r = items[0];
  const nome   = STATE.cliente.nome || 'Cliente';
  const cpf    = STATE.cliente.cpf || '—';
  const tel    = STATE.cliente.tel || '—';
  const email  = STATE.cliente.email || '—';
  const end    = (STATE.cliente.end || STATE.cliente.bairro || '—');
  const contato= STATE.cliente.contato || '—';
  const site   = 'centraldaspersianas.com';
  const insta  = '@centraldaspersianas';
  const detail = $('p-detail').value.trim()|| '—';
  const validade = $('p-val').value;
  const tipo     = $('p-tipo').value;
  const hoje = new Date().toLocaleDateString('pt-BR');

  const tabela = r ? fmt(r.tabela) : '—';
  const cartao = r ? fmt(r.cartao) : '—';
  const avista = r ? fmt(r.avista) : '—';
  const qty = r ? r.qty : 1;

  const isPos = tipo === 'ORÇAMENTO PÓS-VISITA';
  const dataVisitaEl = $('p-datavisita');
  const dataVisita = (isPos && dataVisitaEl && dataVisitaEl.value) ? new Date(dataVisitaEl.value+'T00:00:00').toLocaleDateString('pt-BR') : '';
  const tipoLabel = isPos ? ('PÓS-VISITA' + (dataVisita ? ' (visita técnica realizada em '+dataVisita+')' : '')) : tipo;
  const waMsgAgendar = encodeURIComponent('Olá! Recebi o pré-orçamento! Gostaria de agendar a visita técnica.');
  const waMsgFechar = encodeURIComponent('Olá! Recebi a proposta! Gostaria de fechar a compra.');
  const waMsgDuvidas = encodeURIComponent('Olá! Recebi a proposta! Gostaria de tirar dúvidas.');
  const WA = '5581995514700';

  const somaTabela = items.reduce((s,i)=>s+(i.tabela||0),0);
  const somaCartao = items.reduce((s,i)=>s+(i.cartao||0),0);
  const somaAvista = items.reduce((s,i)=>s+(i.avista||0),0);
  const ambientesLista = [...new Set(items.map(i=>(i.label||i.ambiente||'Item').toUpperCase()))].join(', ');

  const doc = `
  <div id="proposta-print" style="background:#fff;font-family:'Gill Sans','Gill Sans MT',Poppins,sans-serif;color:#333;max-width:900px;margin:0 auto;box-shadow:0 2px 40px rgba(0,0,0,.12);border-radius:8px;overflow:hidden">

    <!-- CAPA -->
    <div style="position:relative">
      <img src="data:image/jpeg;base64,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" style="width:100%;display:block" alt="Central das Persianas">
    </div>

    <div style="padding:32px 40px">

      <!-- LOGO TOPO -->
      <div style="text-align:center;background:#F5F5F0;padding:14px;margin:-32px -40px 24px -40px">
        <img src="data:image/png;base64,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" style="height:44px" alt="Central das Persianas">
      </div>

      <!-- NOSSA PROPOSTA -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">NOSSA <i>PROPOSTA</i></span>
      </div>
      <div style="font-size:12.5px;line-height:1.7;color:#444;margin-bottom:8px">Um ambiente bem planejado se destaca pelos <i>detalhes</i>. <strong>Cortinas e persianas transformam espaços, equilibrando iluminação, conforto e sofisticação.</strong></div>
      <div style="font-size:12.5px;line-height:1.7;color:#444;margin-bottom:20px">Na <strong>Central das Persianas</strong>, oferecemos <i>soluções sob medida</i> com uma variedade de modelos e coleções que valorizam cada ambiente. Nesta <i>proposta única</i>, apresentamos opções pensadas especialmente para o <strong>seu espaço</strong>, considerando suas preferências e especificações.</div>

      <div style="font-family:'EB Garamond',Garamond,serif;font-size:24px;margin-bottom:6px">Olá, <span style="color:#B68235;font-weight:700;font-style:italic">${nome}</span></div>
      <div style="font-size:12.5px;color:#555;margin-bottom:20px">Preparamos esta proposta pensando especialmente no <strong>seu espaço</strong> e nas suas <strong>preferências</strong>!</div>

      <!-- DADOS DO CLIENTE -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12.5px">
        <tr>
          <td style="width:50%;padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">⭐ CLIENTE:</td>
          <td style="width:50%;padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">🪪 CPF/CNPJ:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">${nome}</td>
          <td style="padding:7px 10px;border:1px solid #DDD">${cpf}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">☎️ TELEFONE:</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">✉️ E-MAIL:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">${tel}</td>
          <td style="padding:7px 10px;border:1px solid #DDD">${email}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">📍 ENDEREÇO:</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;color:#333;font-size:11px">👤 CONTATO:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">${end}</td>
          <td style="padding:7px 10px;border:1px solid #DDD">${contato}</td>
        </tr>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:24px;font-size:12px">
        <div style="border:1px solid #DDD;border-right:none">
          <div style="background:#F0EEE9;padding:7px 10px;font-weight:700;font-size:11px">💻 SITE:</div>
          <div style="padding:10px">${site==='—' ? '<span style="color:#999">—</span>' : `<a href="${site.startsWith('http')?site:'https://'+site}" style="color:#5A1524;text-decoration:none;font-weight:700">${site}</a>`}</div>
        </div>
        <div style="border:1px solid #DDD">
          <div style="background:#F0EEE9;padding:7px 10px;font-weight:700;font-size:11px">📱 INSTAGRAM:</div>
          <div style="padding:10px">${insta==='—' ? '<span style="color:#999">—</span>' : `<a href="https://instagram.com/${insta.replace('@','')}" style="color:#5A1524;text-decoration:none;font-weight:700">${insta}</a>`}</div>
        </div>
      </div>

      <!-- DATA / VALIDADE / TIPO -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12.5px">
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">🗓️ DATA</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">⏳ VALIDADE</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">🔘 TIPO</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">${hoje}</td>
          <td style="padding:7px 10px;border:1px solid #DDD">${validade}</td>
          <td style="padding:7px 10px;border:1px solid #DDD;color:#B68235;font-weight:700">${tipoLabel}</td>
        </tr>
      </table>

      <!-- PRODUTOS & SERVIÇOS -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Produtos <i>&</i> Serviços</span>
      </div>
      <div style="font-size:12.5px;color:#555;margin-bottom:14px">Nossa <i>proposta</i> para <i>sofisticar</i> o seu ambiente:</div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:11.5px">
        <thead>
          <tr style="background:#F0EEE9">
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px">AMBIENTE</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px">MODELO E<br>COLEÇÃO</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px">DETALHAMENTO</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px">QUANTIDADE</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px">🏷️PREÇO<br>TABELA</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#E3ECF7">💳PREÇO<br>CARTÃO</th>
            <th style="padding:10px 8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#E5F0E3">💵PREÇO<br>À VISTA</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item,idx) => `
          <tr>
            <td style="padding:10px 8px;border:1px solid #DDD;font-weight:700;text-align:center;vertical-align:middle">${item.label||item.ambiente||'Item'}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;text-align:center;vertical-align:middle">${fabName(item.fab)} ${item.prod||''} ${item.fam||''}${item.col?' '+item.col:''}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;line-height:1.5;text-align:center;vertical-align:middle">${item.detail||detail||'—'}${item.foraDoPadrao?`<br><span style="color:#B54708;font-size:10.5px">⚠️ Medida fora do padrão de fabricação — provavelmente fora da garantia de fábrica.</span>`:''}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;text-align:center;vertical-align:middle">${item.qty||1}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;text-align:center;vertical-align:middle;color:#C0392B;text-decoration:line-through">${fmt(item.tabela)}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;text-align:center;font-weight:700;vertical-align:middle;background:#E3ECF7">${fmt(item.cartao)}</td>
            <td style="padding:10px 8px;border:1px solid #DDD;text-align:center;font-weight:700;vertical-align:middle;background:#E5F0E3">${fmt(item.avista)}</td>
          </tr>`).join('')}
        </tbody>
      </table>

      <!-- CONDIÇÕES -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Condições <i>especiais</i></span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px">Descontos abaixo <strong>já aplicados</strong>!</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="border:1px solid #DDD;border-radius:6px;overflow:hidden">
          <div style="background:#F0EEE9;padding:8px;text-align:center;font-weight:700;font-size:12px">À VISTA · PIX</div>
          <div style="display:flex;align-items:center;gap:12px;padding:14px">
            <div style="font-size:22px">💵</div>
            <div>
              <div style="font-size:26px;font-weight:700;color:#333">15%</div>
              <div style="font-size:10.5px;color:#666;line-height:1.5">50% de entrada + 50% 1 dia antes da instalação<br>Banco do Brasil (001) · Agência 1837-6 · CC 121800-0<br>PIX CNPJ: 11.360.869/0001-63</div>
            </div>
          </div>
        </div>
        <div style="border:1px solid #DDD;border-radius:6px;overflow:hidden">
          <div style="background:#F0EEE9;padding:8px;text-align:center;font-weight:700;font-size:12px">CARTÃO DE CRÉDITO</div>
          <div style="display:flex;align-items:center;gap:12px;padding:14px">
            <div style="font-size:22px">💳</div>
            <div>
              <div style="font-size:26px;font-weight:700;color:#333">5%</div>
              <div style="font-size:10.5px;color:#666;line-height:1.5">100% do valor na entrada<br>Em até 8x sem juros.<br>Bandeiras: Visa, Master, Elo, Amex.</div>
            </div>
          </div>
        </div>
      </div>
      <div style="border:1px solid #F0D08A;background:#FFFBF0;border-radius:6px;padding:10px 14px;font-size:11px;color:#7A5A00;margin-bottom:28px">⚠️ <u>OBS.:</u> Os descontos já foram aplicados sobre o valor inicial de tabela e estão refletidos nos preços apresentados acima.</div>

      <!-- INVESTIMENTO & VALORES -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Investimento <i>&</i> Valores</span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px">O investimento inclui todos os <strong>benefícios</strong>:</div>
      <div style="display:flex;gap:16px;border:1px solid #DDD;border-radius:6px;padding:16px;margin-bottom:20px">
        <div style="font-size:34px;flex-shrink:0">🎁</div>
        <div style="font-size:12px;color:#444;line-height:1.9">
          <div><strong>01. Consultoria</strong> especializada e personalizada — para definirmos juntos a melhor opção para o seu ambiente;</div>
          <div><strong>02. Visita técnica</strong> gratuita e sem compromisso;</div>
          <div><strong>03. Soluções em cortinas e persianas</strong> sob medida e serviços especializados;</div>
          <div><strong>04. Entrega e instalação</strong> profissional;</div>
          <div><strong>05. Cobertura</strong> em garantia.</div>
        </div>
      </div>

      <!-- VALOR TOTAL DA PROPOSTA -->
      <div style="display:grid;grid-template-columns:150px 1fr;border:1px solid #6B5D4F;border-radius:6px;overflow:hidden;margin-bottom:24px">
        <div style="background:#6B5D4F;color:#FFF;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;font-family:'EB Garamond',Garamond,serif;font-size:17px;font-weight:700">VALOR TOTAL DA PROPOSTA</div>
        <div>
          <div style="background:#6B5D4F;color:#FFF;padding:8px 14px;font-size:11px;font-weight:700;text-align:center">AMBIENTES E OPÇÕES: ${ambientesLista}</div>
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <tr>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px">🏷️PREÇO TABELA</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#E3ECF7">💳PREÇO CARTÃO</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-size:10px;background:#E5F0E3">💵PREÇO À VISTA</td>
            </tr>
            <tr>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;color:#C0392B;text-decoration:line-through">${fmt(somaTabela)}</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-weight:700;background:#E3ECF7">${fmt(somaCartao)}</td>
              <td style="padding:8px;text-align:center;border:1px solid #DDD;font-weight:700;background:#E5F0E3">${fmt(somaAvista)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- CTA -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:6px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Vamos <i style="color:#B68235">transformar</i> o seu ambiente?</span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px">Escolha abaixo como prefere continuar:</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px">
        <a href="https://wa.me/${WA}?text=${waMsgFechar}" style="flex:1;min-width:160px;text-align:center;background:#E5F0E3;border:1px solid #BFE0BA;color:#2E7D52;text-decoration:none;padding:14px 12px;border-radius:6px;font-weight:700;font-size:12.5px">✅ FECHAR A COMPRA!</a>
        ${!isPos ? `<a href="https://wa.me/${WA}?text=${waMsgAgendar}" style="flex:1;min-width:160px;text-align:center;background:#E3ECF7;border:1px solid #B9CDE8;color:#2C4D7A;text-decoration:none;padding:14px 12px;border-radius:6px;font-weight:700;font-size:12.5px">🗓️ AGENDAR VISITA TÉCNICA!</a>` : ''}
        <a href="https://wa.me/${WA}?text=${waMsgDuvidas}" style="flex:1;min-width:160px;text-align:center;background:#F0EEE9;border:1px solid #DDD;color:#555;text-decoration:none;padding:14px 12px;border-radius:6px;font-weight:700;font-size:12.5px">💬 TIRAR DÚVIDAS!</a>
      </div>

      <!-- ENTREGA & INSTALAÇÃO -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Entrega <i>&</i> Instalação</span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px">Nossos <i>prazos</i> para <i>sofisticar</i> o seu ambiente:</div>
      <div style="display:flex;gap:16px;border:1px solid #DDD;border-radius:6px;padding:16px;margin-bottom:20px">
        <div style="font-size:34px;flex-shrink:0">🚚</div>
        <div style="font-size:12px;color:#444;line-height:1.9">
          <div style="font-weight:700">ENTREGA E INSTALAÇÃO INCLUSAS!</div>
          <div><strong>01. Novas cortinas e persianas:</strong> em até 12 dias úteis!</div>
          <div><strong>02. Serviços:</strong> em até 5 dias úteis!</div>
        </div>
      </div>

      <!-- COBERTURA & GARANTIA -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Cobertura <i>&</i> Garantia</span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px">Nossas <i>coberturas</i> de garantia:</div>
      <div style="display:flex;gap:16px;border:1px solid #DDD;border-radius:6px;padding:16px;margin-bottom:28px">
        <div style="font-size:34px;flex-shrink:0">💎</div>
        <div style="font-size:12px;color:#444;line-height:1.9">
          <div style="font-weight:700">GARANTIAS INCLUSAS!</div>
          <div><strong>01. Novas cortinas e persianas:</strong> 1 ano (contra defeitos de fabricação)!</div>
          <div><strong>02. Serviços:</strong> 3 meses!</div>
        </div>
      </div>

      <!-- A JORNADA COMPLETA -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">A <i style="color:#B68235">jornada</i> completa · Do início à <i style="color:#B68235">transformação</i></span>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:14px">Como funciona <i>o passo-a-passo</i>:</div>
      <div style="display:flex;flex-direction:column;gap:1px;margin-bottom:24px">
        <div style="display:grid;grid-template-columns:56px 1fr;background:#FAF9F5">
          <div style="background:#6B5D4F;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">1</div>
          <div style="padding:12px 16px">
            <div style="font-size:10px;letter-spacing:1px;color:#999;font-weight:700">ANTES DO PEDIDO</div>
            <div style="font-family:'EB Garamond',Garamond,serif;font-size:16px;color:#B68235;margin-bottom:4px">${isPos ? 'Visita <i>Técnica</i> (Realizada! ✅)' : 'Visita <i>Técnica</i>'}</div>
            <div style="font-size:11.5px;color:#444;line-height:1.6">${isPos
              ? 'Nosso técnico esteve no seu espaço e conferiu as <strong>medidas ideais</strong>, apresentou os <strong>mostruários</strong> com os <strong>materiais disponíveis</strong> e tirou todas as dúvidas.<br>Após a visita já realizada, essa aqui é a nossa proposta <strong>exclusiva</strong> para você, <strong>mais assertiva e alinhada</strong> com a realidade do seu ambiente e suas preferências!'
              : 'Nosso técnico vai até você para conferir as <strong>medidas ideais</strong>, apresentar os <strong>mostruários</strong> com os <strong>materiais disponíveis</strong> e <strong>tirar todas as suas dúvidas</strong>.<br><strong>Após a visita</strong>, conseguimos fornecer um orçamento <strong>mais assertivo e alinhado</strong> com a realidade do seu ambiente e suas preferências!'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:56px 1fr;background:#FAF9F5">
          <div style="background:#6B5D4F;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">2</div>
          <div style="padding:12px 16px">
            <div style="font-size:10px;letter-spacing:1px;color:#999;font-weight:700">FORMALIZAÇÃO</div>
            <div style="font-family:'EB Garamond',Garamond,serif;font-size:16px;color:#B68235;margin-bottom:4px">Ordem de Serviço <i>&</i> Pagamento</div>
            <div style="font-size:11.5px;color:#444;line-height:1.6">Montamos sua <strong>Ordem de Serviço</strong> com todos os dados e o <strong>detalhamento completo</strong> das soluções definidas por ambiente. Enviamos para sua conferência e confirmação, junto com a forma de pagamento desejada.<br>PIX: 50% de entrada + 50% restantes até 1 dia útil antes da instalação. Cartão: 100% do valor na entrada.</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:56px 1fr;background:#FAF9F5">
          <div style="background:#6B5D4F;color:#FFF;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">3</div>
          <div style="padding:12px 16px">
            <div style="font-size:10px;letter-spacing:1px;color:#999;font-weight:700">EXECUÇÃO</div>
            <div style="font-family:'EB Garamond',Garamond,serif;font-size:16px;color:#B68235;margin-bottom:4px">Produção <i>&</i> Instalação</div>
            <div style="font-size:11.5px;color:#444;line-height:1.6">Com o <strong>pagamento confirmado</strong>, seu pedido segue para produção na fábrica! O prazo é de até <strong>12 dias úteis</strong> para novas e até <strong>5 dias úteis</strong> para serviços — e já deixamos uma data pré-agendada para entrega e instalação. <strong>Entrega e instalação profissional inclusas</strong> no investimento!</div>
          </div>
        </div>
      </div>

      <!-- LINKS ÚTEIS -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Links <i style="color:#B68235">úteis</i></span>
      </div>
      <div style="font-size:12px;color:#555;font-style:italic;margin-bottom:12px"><i>Explore</i> mais aqui:</div>
      <div style="display:flex;gap:16px;border:1px solid #DDD;border-radius:6px;padding:16px;margin-bottom:28px">
        <div style="font-size:34px;flex-shrink:0">🧭</div>
        <div style="font-size:12px;color:#444;line-height:1.8">
          <div><strong>01. Catálogo completo:</strong> todos os tipos de materiais e coleções! Para acessar, clique: <a href="https://www.centraldaspersianas.com" style="color:#B68235;font-weight:700">▶️ aqui ◀️</a></div>
          <div><strong>02. Inspirações por tipo de ambiente:</strong> opções para varanda, sala, quarto, cozinha e muito mais! Para acessar, clique: <a href="https://www.instagram.com/centraldaspersianas" style="color:#B68235;font-weight:700">▶️ aqui ◀️</a></div>
        </div>
      </div>

      <!-- SOBRE NÓS -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Sobre nós · CENTRAL DAS PERSIANAS</span>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:14px">Nossos <i>dados e contatos</i>:</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:12px">
        <tr>
          <td style="width:50%;padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">RAZÃO SOCIAL:</td>
          <td style="width:50%;padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">CNPJ:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">CENTRAL DAS PERSIANAS LTDA</td>
          <td style="padding:7px 10px;border:1px solid #DDD">11.360.869/0001-63</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">TELEFONE:</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">E-MAIL:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">(81) 99551-4700 e (81) 3203-5044</td>
          <td style="padding:7px 10px;border:1px solid #DDD">contato@centraldaspersianas.com</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">ENDEREÇO:</td>
          <td style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">INSCRIÇÃO ESTADUAL E MUNICIPAL:</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #DDD">R. Dom Vital, 191 - Loja C - Piedade, Jaboatão dos Guararapes - PE, CEP: 54420-190.</td>
          <td style="padding:7px 10px;border:1px solid #DDD">0390578-01 | 959.598-8</td>
        </tr>
        <tr><td colspan="2" style="padding:7px 10px;border:1px solid #DDD;background:#F0EEE9;font-weight:700;font-size:11px">HORÁRIOS DE ATENDIMENTO:</td></tr>
        <tr><td colspan="2" style="padding:7px 10px;border:1px solid #DDD">Segunda à Sexta - 8h às 12h e 14h às 18h; Sábado - 8h às 12h.</td></tr>
      </table>

      <!-- OBSERVAÇÕES IMPORTANTES -->
      <div style="background:#F0EEE9;padding:10px 14px;margin-bottom:10px">
        <span style="font-family:'EB Garamond',Garamond,serif;font-size:19px;font-weight:700">Observações importantes · ${isPos ? 'PÓS-VISITA' : 'PRÉ-ORÇAMENTO'}</span>
      </div>
      <div style="font-weight:700;font-style:italic;text-decoration:underline;margin-bottom:12px;font-size:12.5px">LEIA COM ATENÇÃO:</div>
      <div style="display:flex;gap:14px;border:1px solid #DDD;border-radius:6px;padding:16px 18px;margin-bottom:28px">
        <div style="font-size:28px;flex-shrink:0">⚠️</div>
        <div style="font-size:11px;line-height:1.75;color:#333">
          ${!isPos ? `
          <div style="font-weight:700;margin-bottom:4px">📝 MEDIDAS E ESCOPO:</div>
          <div style="margin-bottom:8px"><strong>01. Medidas e especificações provisórias/estimadas:</strong> <u>este pré-orçamento foi elaborado com base nas medidas e especificações informadas pelo cliente.</u> Os valores finais serão confirmados após a visita técnica, que pode identificar ajustes nas dimensões e especificações de instalação. Caso modelo, material ou cor ainda não tenham sido definidos, os valores podem variar conforme as escolhas realizadas na visita técnica.</div>
          <div style="margin-bottom:8px"><strong>02. Escopo do fornecimento:</strong> os produtos e acessórios incluídos neste pré-orçamento são exclusivamente os descritos acima por ambiente. Itens não especificados — como bandô, guias laterais, guias inferiores ou demais acessórios/opcionais — <u>não fazem parte do orçamento, salvo quando expressamente mencionados neste documento.</u></div>
          <div style="margin-bottom:8px"><strong>03. Cores e texturas:</strong> devido a variações de calibração de tela e iluminação, as cores exibidas em fotos e catálogos digitais podem diferir levemente do produto final. E por pequenas variações de fabricante/lote. Recomendamos a aprovação presencial das amostras físicas.</div>
          <div style="margin-bottom:12px"><strong>04. Imagens de referência:</strong> <u>fotos e referências visuais são meramente ilustrativas.</u> O resultado final pode variar conforme o material, a coleção escolhida e as condições do ambiente.</div>

          <div style="font-weight:700;margin-bottom:4px">💳 CONDIÇÕES COMERCIAIS:</div>
          <div style="margin-bottom:8px"><strong>05. Condições de pagamento:</strong> <u>PIX / À VISTA:</u> 50% de entrada + 50% restantes até 1 dia útil antes da instalação. O agendamento da instalação será confirmado somente após a quitação do saldo residual. <u>CARTÃO DE CRÉDITO:</u> 100% do valor na entrada.</div>
          <div style="margin-bottom:8px"><strong>06. Produção sob medida:</strong> todos os produtos são fabricados exclusivamente sob medida após confirmação e pagamento da entrada. <u>Após a aprovação, não é possível realizar alterações, cancelamentos ou devoluções em razão da personalização.</u></div>
          <div style="margin-bottom:12px"><strong>07. Validade:</strong> proposta válida por 7 dias corridos a partir da data de emissão, sujeita a reajuste de tabela após esse prazo.</div>

          <div style="font-weight:700;margin-bottom:4px">🚚 ENTREGA E INSTALAÇÃO:</div>
          <div style="margin-bottom:8px"><strong>08. Prazo de fabricação, entrega e instalação:</strong> <u>o prazo inicia a contagem somente após confirmação de pagamento.</u> Eventuais ajustes de agenda de entrega e instalação serão alinhados com o cliente conforme disponibilidade da equipe técnica. Para novos produtos adquiridos na Central das Persianas, a entrega e instalação profissional estão inclusas no investimento final total.</div>
          <div style="margin-bottom:8px"><strong>09. Condições de instalação:</strong> o local deve estar liberado, limpo e com acesso desobstruído para a equipe técnica. <u>A Central das Persianas não se responsabiliza por atrasos decorrentes de impedimentos no local.</u></div>
          <div style="margin-bottom:8px"><strong>10. Acesso ao local:</strong> em caso de condomínio, <u>o cliente é responsável pela liberação de acesso da nossa equipe técnica junto à administração/portaria na data agendada.</u></div>
          <div style="margin-bottom:8px"><strong>11. Pontos elétricos:</strong> <u>para modelos motorizados, os pontos elétricos devem estar prontos no local antes da instalação, sendo de responsabilidade do cliente providenciá-los.</u></div>
          <div style="margin-bottom:8px"><strong>12. Escopo do serviço:</strong> <u>a Central das Persianas é especializada exclusivamente em cortinas, persianas e acessórios.</u> Adequações estruturais (alvenaria, marcenaria, elétrica e similares) não estão inclusas e são de responsabilidade do cliente.</div>
          <div style="margin-bottom:8px"><strong>13. Alterações no ambiente:</strong> <u>caso haja algum projeto ou previsão de alterações estruturais, arquitetônicas, de engenharia e/ou mobiliário no ambiente antes da instalação, recomendamos que a visita técnica seja agendada também após a conclusão dessas intervenções.</u> Isso garante que as medidas e especificações coletadas reflitam a realidade final do espaço, evitando divergências no momento da instalação.</div>
          <div style="margin-bottom:12px"><strong>14. Sequência de instalação em obras e reformas:</strong> <u>em ambientes que estejam passando ou que irão passar por obras ou reformas, a instalação das cortinas e persianas deve ser realizada como uma das últimas etapas</u> — após a conclusão de quebra-quebra, alvenaria, emassamento, pintura, limpeza e demais intervenções. A instalação prematura dos produtos poderá resultar em danos, sujidade ou necessidade de reinstalação, situações que não são cobertas pela garantia e poderão gerar custos adicionais.</div>

          <div style="font-weight:700;margin-bottom:4px">🛡️ GARANTIA:</div>
          <div><strong>15. Garantia:</strong> <u>PRODUTOS</u> - 1 ano exclusivamente para defeitos de fabricação, conforme condições do fabricante. Chamados técnicos decorrentes de mau uso, desgaste natural ou causas externas não são cobertos. Em caso de acionamento de garantia, daremos todo o suporte junto à fábrica até a devida resolução, atendimento sujeito ao prazo dado pela fábrica (sob consulta). <u>SERVIÇOS</u> – 3 meses.</div>
          ` : `
          <div style="font-weight:700;margin-bottom:4px">📝 MEDIDAS E ESCOPO:</div>
          <div style="margin-bottom:8px"><strong>01. Medidas e especificações confirmadas:</strong> este orçamento foi elaborado com base nas medidas e especificações coletadas pelo nosso técnico durante a visita realizada. <u>Alterações solicitadas após a aprovação poderão impactar diretamente em alterações de prazos e valores.</u></div>
          <div style="margin-bottom:8px"><strong>02. Escopo do fornecimento:</strong> os produtos e acessórios incluídos nesta proposta são exclusivamente os descritos acima por ambiente. Itens não especificados — como bandô, guias laterais, guias inferiores ou demais acessórios/opcionais — <u>não fazem parte do fornecimento, salvo quando expressamente mencionados neste documento.</u></div>
          <div style="margin-bottom:8px"><strong>03. Cores e texturas:</strong> devido a variações de calibração de tela e iluminação, as cores exibidas em fotos e catálogos digitais podem diferir levemente do produto final. E por pequenas variações de fabricante/lote. Recomendamos a aprovação presencial das amostras físicas.</div>
          <div style="margin-bottom:12px"><strong>04. Alterações no ambiente pós-visita:</strong> este orçamento foi elaborado com base no contexto atual dos ambientes, vãos e janelas verificados durante a visita técnica, realizada na data informada acima. Caso ocorram alterações estruturais, arquitetônicas, de engenharia e/ou mobiliário após a visita — que impactem as dimensões ou condições de instalação das cortinas e persianas — recomendamos fortemente que uma nova visita técnica seja realizada após a conclusão dessas intervenções. <u>A não comunicação dessas alterações (ou existência de projeto) à Central das Persianas isenta a empresa de qualquer responsabilidade por disparidades entre o escopo apresentado e a realidade encontrada no momento da instalação, sendo os eventuais custos de adequação de responsabilidade do cliente.</u></div>

          <div style="font-weight:700;margin-bottom:4px">💳 CONDIÇÕES COMERCIAIS:</div>
          <div style="margin-bottom:8px"><strong>05. Condições de pagamento:</strong> <u>PIX / À VISTA:</u> 50% de entrada + 50% restantes até 1 dia útil antes da instalação. O agendamento da instalação será confirmado somente após a quitação do saldo residual. <u>CARTÃO DE CRÉDITO:</u> 100% do valor na entrada.</div>
          <div style="margin-bottom:8px"><strong>06. Produção sob medida:</strong> todos os produtos são fabricados exclusivamente sob medida após confirmação e pagamento da entrada. <u>Após a aprovação, não é possível realizar alterações, cancelamentos ou devoluções em razão da personalização.</u></div>
          <div style="margin-bottom:12px"><strong>07. Validade:</strong> proposta válida por 7 dias corridos a partir da data de emissão, sujeita a reajuste de tabela após esse prazo.</div>

          <div style="font-weight:700;margin-bottom:4px">🚚 ENTREGA E INSTALAÇÃO:</div>
          <div style="margin-bottom:8px"><strong>08. Prazo de fabricação, entrega e instalação:</strong> <u>o prazo inicia a contagem somente após confirmação de pagamento.</u> Eventuais ajustes de agenda de entrega e instalação serão alinhados com o cliente conforme disponibilidade da equipe técnica. Para novos produtos adquiridos na Central das Persianas, a entrega e instalação profissional estão inclusas no investimento final total.</div>
          <div style="margin-bottom:8px"><strong>09. Condições de instalação:</strong> o local deve estar liberado, limpo e com acesso desobstruído para a equipe técnica. <u>A Central das Persianas não se responsabiliza por atrasos decorrentes de impedimentos no local.</u></div>
          <div style="margin-bottom:8px"><strong>10. Acesso ao local:</strong> em caso de condomínio, <u>o cliente é responsável pela liberação de acesso da nossa equipe técnica junto à administração/portaria na data agendada.</u></div>
          <div style="margin-bottom:8px"><strong>11. Pontos elétricos:</strong> <u>para modelos motorizados, os pontos elétricos devem estar prontos no local antes da instalação, sendo de responsabilidade do cliente providenciá-los.</u></div>
          <div style="margin-bottom:8px"><strong>12. Escopo do serviço:</strong> <u>a Central das Persianas é especializada exclusivamente em cortinas, persianas e acessórios.</u> Adequações estruturais (alvenaria, marcenaria, elétrica e similares) não estão inclusas e são de responsabilidade do cliente.</div>
          <div style="margin-bottom:12px"><strong>13. Sequência de instalação em obras e reformas:</strong> <u>em ambientes que estejam passando ou que irão passar por obras ou reformas, a instalação das cortinas e persianas deve ser realizada como uma das últimas etapas</u> — após a conclusão de quebra-quebra, alvenaria, emassamento, pintura, limpeza e demais intervenções. A instalação prematura dos produtos poderá resultar em danos, sujidade ou necessidade de reinstalação, situações que não são cobertas pela garantia e poderão gerar custos adicionais.</div>

          <div style="font-weight:700;margin-bottom:4px">🛡️ GARANTIA:</div>
          <div><strong>14. Garantia:</strong> <u>PRODUTOS</u> - 1 ano exclusivamente para defeitos de fabricação, conforme condições do fabricante. Chamados técnicos decorrentes de mau uso, desgaste natural ou causas externas não são cobertos. Em caso de acionamento de garantia, daremos todo o suporte junto à fábrica até a devida resolução, atendimento sujeito ao prazo dado pela fábrica (sob consulta). <u>SERVIÇOS</u> – 3 meses.</div>
          `}
        </div>
      </div>

    </div>
  </div>`;

  $('proposta-doc').innerHTML = doc;
  $('proposta-preview').style.display = 'block';
  $('proposta-preview').scrollIntoView({behavior:'smooth', block:'start'});
}

function imprimirProposta(){
  const doc = $('proposta-print');
  if(!doc){ alert('Gere a proposta primeiro.'); return; }
  const w = window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#EEE;font-family:'Gill Sans','Gill Sans MT',Poppins,sans-serif}@media print{body{background:#FFF;padding:0}}</style>
    </head><body>${doc.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 800);
}

// ── Tela inicial = lista de orçamentos. Carrega assim que o login sai da frente. ──
(function iniciarLista(){
  const tela = document.getElementById('login-screen');
  let feito = false;
  const tentar = () => {
    if(feito) return;
    if(tela && getComputedStyle(tela).display !== 'none') return;
    feito = true; irParaTab('hist'); renderHistory();
  };
  if(tela && window.MutationObserver) new MutationObserver(tentar).observe(tela, {attributes:true, attributeFilter:['style']});
  document.addEventListener('DOMContentLoaded', () => setTimeout(tentar, 0));
  tentar();
})();
