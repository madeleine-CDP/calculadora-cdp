// ═══════════════════════════════════════════════════════
// PASTA DO ORÇAMENTO (Etapa C3b)
// Tela única do orçamento aberto: cliente + etapa, itens por ambiente, totais,
// "Adicionar item" (vai à calculadora e volta) e "Salvar e fechar" (volta à lista).
// Não mexe em nenhuma fórmula: só mostra o que já está no carrinho (CART).
// ═══════════════════════════════════════════════════════

function orcamentoAberto(){ return CART.length > 0 || !!EDITING_ORC_ID; }

// Pergunta antes de descartar alterações não salvas
function confirmarSairOrc(){
  if(!ORC_SUJO) return true;
  return confirm('Este orçamento tem alterações que ainda não foram salvas.\n\nSair sem salvar?');
}

function voltarParaLista(){
  if(!confirmarSairOrc()) return;
  limparOrcamentoEmAndamento();
  document.body.classList.remove('cli-aberto');
  irParaTab('hist');
  renderHistory();
  window.scrollTo({top:0});
}

function abrirPasta(){
  irParaTab('orc');
  renderPasta();
  window.scrollTo({top:0});
}

function orcEmEdicao(){ return HISTORY_CACHE.find(x => x.id === EDITING_ORC_ID) || null; }

function renderPasta(){
  syncCliente();
  const c = STATE.cliente || {};
  const e = orcEmEdicao();
  $('pasta-nome').textContent = c.nome || 'Cliente sem nome';
  $('pasta-sub').innerHTML = [
    e && e.numero ? '<strong>' + numCDP(e.numero) + '</strong>' : '<em>ainda não salvo</em>',
    c.bairro ? escHtml(c.bairro) : '',
    c.tel ? escHtml(c.tel) : '',
    c.tiny ? 'Tiny #' + escHtml(c.tiny) : ''
  ].filter(Boolean).join(' · ');

  // etapa (fechado/perdido entram na C4; aqui só aparecem se o orçamento já estiver nelas)
  const atual = (e && e.etapa) || 'orcamento';
  const sel = $('pasta-etapa');
  sel.innerHTML = ETAPAS.filter(([id]) => (id !== 'fechado' && id !== 'perdido') || id === atual)
    .map(([id, nome]) => `<option value="${id}"${id===atual?' selected':''}>${nome}</option>`).join('');
  sel.disabled = !EDITING_ORC_ID;
  sel.title = EDITING_ORC_ID ? '' : 'Salve o orçamento primeiro para escolher a etapa';
  sel.className = 'etapa-' + atual;

  // sem nome do cliente: abre os dados do cliente sozinho
  if(!c.nome) document.body.classList.add('cli-aberto');
  $('pasta-dados').setAttribute('aria-expanded', document.body.classList.contains('cli-aberto'));

  // itens agrupados por ambiente
  const grupos = {};
  CART.forEach(item => { const amb = (item.ambiente || 'Sem ambiente').trim(); (grupos[amb] = grupos[amb] || []).push(item); });
  const nAmb = Object.keys(grupos).length;
  $('pasta-n').textContent = CART.length ? CART.length + (CART.length>1?' itens':' item') + ' · ' + nAmb + (nAmb>1?' ambientes':' ambiente') : '';

  $('pasta-lista').innerHTML = !CART.length
    ? '<div class="pasta-vazio">Nenhum item ainda.<br>Toque em <strong>Adicionar item</strong> para calcular o primeiro.</div>'
    : Object.entries(grupos).map(([amb, itens]) => {
        const sub = itens.reduce((s,i)=>s+(i.avista||0),0);
        return `<div class="pasta-amb">
          <div class="pasta-amb-topo"><span>${ic('local',15)} ${escHtml(amb)} <em>· ${itens.length} ${itens.length>1?'itens':'item'}</em></span><span>${fmt(sub)}</span></div>
          ${itens.map((item, n) => cardItemPasta(item, n)).join('')}
        </div>`;
      }).join('');

  document.querySelectorAll('#pasta-lista textarea').forEach(autoAltura);

  const tAv = CART.reduce((s,i)=>s+(i.avista||0),0);
  const tCa = CART.reduce((s,i)=>s+(i.cartao||0),0);
  const tTa = CART.reduce((s,i)=>s+(i.tabela||0),0);
  $('pasta-totais').style.display = CART.length ? '' : 'none';
  $('pasta-totais').innerHTML = `
    <div class="pasta-total-av"><span>${ic('dinheiro',16)} Total à vista / PIX</span><strong>${fmt(tAv)}</strong></div>
    <div class="pasta-total-outros">
      <div><span>${ic('cartao',15)} Cartão</span><strong>${fmt(tCa)}</strong></div>
      <div><span>${ic('etiqueta',15)} Tabela</span><strong>${fmt(tTa)}</strong></div>
    </div>`;
}

// ── Descritivo completo de um item (só lê o que o cálculo já guardou) ──
function numBR(v, casas){ return (Number(v)||0).toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas}); }
function linhasDescritivo(item){
  const f = item.full || {};
  const L = [];
  const fam = item.fam || f.fam;
  L.push(['Modelo', [item.prod || f.prod, fam].filter(Boolean).join(' · ')]);
  if(item.fab === 'cdp'){
    L.push(['Tecido', item.col || f.colLabel || '']);
  } else {
    L.push(['Coleção', item.col || f.colLabel || '']);
  }
  const w = item.w || f.w, h = item.h || f.h, qty = item.qty || f.qty || 1;
  if(w){
    let med = numBR(w,2) + (h ? ' × ' + numBR(h,2) : '') + ' m';
    if(item.fab === 'cdp' && !h) med = numBR(w,2) + ' m de largura';
    const area = f.usedArea || f.area;
    if(item.fab !== 'cdp' && area) med += '  (' + numBR(area,2) + ' m²' + (qty>1 ? ' por peça' : '') + ')';
    L.push(['Medidas', med]);
  }
  L.push(['Quantidade', qty + (qty>1 ? ' peças' : ' peça')]);
  if(f.tubo && f.tubo.label) L.push(['Tubo', f.tubo.label]);
  const acc = (f.acc && Array.isArray(f.acc.lines)) ? f.acc.lines.map(l => l.label).filter(Boolean) : [];
  if(f.reducao && !acc.some(a => /redu/i.test(a))) acc.push('Redução de peso');
  if(item.fab === 'cdp'){
    if(f.ilhosAplicado) acc.push('Ilhós');
    if(f.curvoAplicado) acc.push('Trilho curvo');
  }
  if(acc.length) L.push(['Acessórios', acc.join(' · ')]);
  const extras = (f.extras || []).map(e => e.desc).filter(Boolean);
  if(extras.length) L.push(['Adicionais', extras.join(' · ')]);
  return L.filter(([, v]) => v);
}

function cardItemPasta(item, n){
  const f = item.full || {};
  const pend = (item.detail||'').toUpperCase().includes('A DEFINIR');
  const fora = item.foraDoPadrao || f.foraDoPadrao;
  return `<div class="pasta-item">
    <div class="pasta-item-cab">
      <div class="pasta-item-nome"><span class="pasta-fab fab-${item.fab}">${escHtml(fabName(item.fab))}</span>${escHtml(item.label)}</div>
      <span class="pasta-botoes">
        <button type="button" onclick="editarItemCarrinho(${item.id})" title="Editar" aria-label="Editar ${escHtml(item.label)}">${ic('editar',16)}</button>
        <button type="button" onclick="duplicarItemCarrinho(${item.id})" title="Duplicar" aria-label="Duplicar ${escHtml(item.label)}">${ic('copiar',16)}</button>
        <button type="button" onclick="removerItemPasta(${item.id})" title="Remover" aria-label="Remover ${escHtml(item.label)}">${ic('lixeira',16)}</button>
      </span>
    </div>
    <dl class="pasta-desc">
      ${linhasDescritivo(item).map(([k,v]) => `<div><dt>${k}</dt><dd>${escHtml(v)}</dd></div>`).join('')}
    </dl>
    ${fora ? `<div class="pasta-alerta">${ic('alerta',14)} Medida fora do padrão de fabricação${f.minFab ? ' (mín. ' + numBR(f.minFab,2) + ' m)' : ''}: cobrado pelo mínimo.</div>` : ''}
    <label class="pasta-detalhe${pend ? ' pendente' : ''}">
      <span>${pend ? ic('alerta',14) + ' Detalhamento — troque os "A DEFINIR"' : ic('nota',14) + ' Detalhamento'}</span>
      <textarea rows="3" oninput="autoAltura(this); updateItemDetail(${item.id}, this.value); this.closest('.pasta-detalhe').classList.toggle('pendente', this.value.toUpperCase().includes('A DEFINIR'))">${escHtml(item.detail||'')}</textarea>
    </label>
    <div class="pasta-valores">
      <div class="av"><span>${ic('dinheiro',14)} À vista</span><strong>${fmt(item.avista)}</strong></div>
      <div><span>${ic('cartao',14)} Cartão</span><strong>${fmt(item.cartao)}</strong></div>
      <div><span>${ic('etiqueta',14)} Tabela</span><strong>${fmt(item.tabela)}</strong></div>
    </div>
  </div>`;
}

// Caixa de texto cresce para mostrar o detalhamento inteiro
function autoAltura(el){ el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }

function removerItemPasta(id){
  const item = CART.find(x => x.id === id);
  if(!item) return;
  if(!confirm('Remover "' + item.label + '" deste orçamento?')) return;
  removeFromCart(id);
}

async function mudarEtapa(etapa){
  const e = orcEmEdicao();
  if(!EDITING_ORC_ID || !e) return;
  const antes = e.etapa;
  try{
    const res = await fetch(SB_URL + '/rest/v1/orcamentos?id=eq.' + EDITING_ORC_ID, {
      method: 'PATCH', headers: { ...SB_HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({ etapa })
    });
    if(!res.ok) throw new Error(res.status);
    e.etapa = etapa;
    $('pasta-etapa').className = 'etapa-' + etapa;
    avisoTopo('Etapa alterada para <strong>' + (ETAPA_NOME[etapa] || etapa) + '</strong>.');
  } catch(err){
    $('pasta-etapa').value = antes;
    alert('⚠️ Não foi possível mudar a etapa. Verifique a conexão e tente de novo.');
  }
}

function toggleDadosCliente(){
  const aberto = document.body.classList.toggle('cli-aberto');
  $('pasta-dados').setAttribute('aria-expanded', aberto);
  if(aberto) window.scrollTo({top:0, behavior:'smooth'});
}

function adicionarItemPasta(){
  resetCalc();
  document.body.classList.remove('cli-aberto');
  irParaTab('calc');
  window.scrollTo({top:0});
  setTimeout(() => { const a = $('item-ambiente'); if(a && window.innerWidth > 720) a.focus(); }, 50);
}

function abrirPropostaPasta(){ switchTab('proposta'); window.scrollTo({top:0}); }

function salvarEFechar(){
  if(!CART.length){
    if(EDITING_ORC_ID && !ORC_SUJO){ voltarParaLista(); return; }
    alert('Adicione pelo menos um item antes de salvar.');
    return;
  }
  saveOrcamento();
}

// Mudou algo nos dados do cliente → tem alteração por salvar
['cli-nome','cli-tel','cli-bairro','cli-tiny','cli-cpf','cli-email','cli-end','cli-contato'].forEach(id => {
  const el = document.getElementById(id);
  if(el) el.addEventListener('input', () => { ORC_SUJO = true; if(document.body.dataset.tela === 'orc') renderPasta(); });
});

// Fechar a aba/recarregar com alteração não salva → o navegador pergunta
window.addEventListener('beforeunload', ev => {
  if(ORC_SUJO){ ev.preventDefault(); ev.returnValue = ''; }
});
