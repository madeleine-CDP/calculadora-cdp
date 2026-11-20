// ═════════ ATELIÊ (cortina tradicional em tecido; pedido da Bru, 20/11/2026; sql/2026-11-atelie-os.sql) ═════════
// É do ateliê: correção à mão (atelie_os.eh_atelie) ou a tag "ATELIE" na OS do Olist (os_acompanhamento.marcadores).
// Etapas (quem e quando gravados pelo banco, cada uma com desfazer): tecido comprado/separado → enviado ao ateliê →
// costura pronta → voltou para a loja. Depois disso a OS segue o caminho normal (agendar a instalação) em Pedidos.
// "Resumo para a Madeleine" monta um texto para copiar: o que providenciar e o que acompanhar com o ateliê.
let ATL_MAPA = {};
const ATL_ABERTO = new Set();
const ATL_ETAPAS = [['tecido', 'Tecido comprado / separado'], ['enviado', 'Enviado ao ateliê'], ['pronto', 'Costura pronta'], ['voltou', 'Voltou para a loja']];
let ATL_RESUMO = null;   // texto do resumo aberto (null = fechado)

async function atlCarregar(){
  try{
    const r = await sbFetch('/rest/v1/atelie_os?select=*');
    ATL_MAPA = {}; if(r.ok) (await r.json()).forEach(x => ATL_MAPA[x.pedido_id] = x);
  }catch(e){ /* sem a tabela: segue sem ateliê */ }
}
function atlEhAtelie(o){
  const a = ATL_MAPA[o.pedido_id];
  if(a && a.eh_atelie !== null && a.eh_atelie !== undefined) return !!a.eh_atelie;
  return /ATELI[EÊ]/i.test(String(o.marcadores || ''));
}
// em andamento = do ateliê, não cancelada/entregue no Olist e ainda não voltou para a loja
function atlEmAndamento(){
  const ord = { tecido: 0, enviado: 1, pronto: 2, voltou: 3 };
  return PED_OS.filter(o => atlEhAtelie(o) && Number(o.situacao) !== 2 && Number(o.situacao) !== 6 && !(ATL_MAPA[o.pedido_id] || {}).voltou_em)
    .sort((a, b) => (ord[atlProxima(a)[0]] ?? 9) - (ord[atlProxima(b)[0]] ?? 9) || String(a.data_venda || '').localeCompare(String(b.data_venda || '')));
}
const atlProxima = (o) => ATL_ETAPAS.find(([k]) => !(ATL_MAPA[o.pedido_id] || {})[k + '_em']) || ['', ''];
const atlDias = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : 0;
const atlDiaBR = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
function atlPrevisaoVencida(a){ return !!(a && a.previsao && !a.pronto_em && a.previsao < hojeIsoAtl()); }
const hojeIsoAtl = () => (typeof hojeIso === 'function' ? hojeIso() : new Date().toISOString().slice(0, 10));
// situação de uma OS do ateliê: cor do selo e texto curto
function atlSituacao(o){
  const a = ATL_MAPA[o.pedido_id] || {}, [k] = atlProxima(o);
  const pg = typeof pedPagamento === 'function' ? pedPagamento(o) : { producao: true };
  if(k === 'tecido') return pg.producao ? { cls: 'agir', selo: 'Providenciar', txt: 'Comprar ou separar o tecido' } : { cls: 'esp', selo: 'Pagamento', txt: 'Esperar a entrada ser conferida para começar' };
  if(k === 'enviado') return { cls: 'agir', selo: 'Providenciar', txt: 'Enviar ao ateliê' + (a.tecido_em ? ' · tecido desde ' + atlDiaBR(a.tecido_em) : '') };
  if(k === 'pronto'){
    const d = atlDias(a.enviado_em);
    if(atlPrevisaoVencida(a)) return { cls: 'atras', selo: 'Atrasado', txt: 'No ateliê há ' + d + (d === 1 ? ' dia' : ' dias') + ' · previsão era ' + atlDiaBR(a.previsao) };
    return { cls: 'espera', selo: 'No ateliê', txt: 'No ateliê há ' + d + (d === 1 ? ' dia' : ' dias') + (a.previsao ? ' · previsão ' + atlDiaBR(a.previsao) : ' · sem previsão combinada') };
  }
  return { cls: 'agir', selo: 'Buscar', txt: 'Costura pronta: buscar no ateliê' };
}
const ATL_SELO = { agir: 's-hoje', esp: 's-esp', espera: 's-esp', atras: 's-atr', ok: 's-ok' };

async function atlSalvar(id, campos, msg){
  const r = await sbFetch('/rest/v1/atelie_os?on_conflict=pedido_id', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(Object.assign({ pedido_id: id }, campos)) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); return false; }
  const l = (await r.json())[0]; if(l) ATL_MAPA[id] = l;
  if(typeof PED_MARCADAS !== 'undefined') PED_MARCADAS.add(id);
  if(msg) avisoTopo(msg);
  pedRedesenhar(); return true;
}
function atlMarcar(id, etapa, feito){
  const rot = (ATL_ETAPAS.find(([k]) => k === etapa) || [, etapa])[1];
  atlSalvar(id, { [etapa + '_em']: feito ? new Date().toISOString() : null }, feito ? rot + ': registrado. <button type="button" class="aviso-desfazer" onclick="atlMarcar(' + id + ',\'' + etapa + '\',false)">desfazer</button>' : 'Desfeito.');
}
function atlSalvarCampos(id){
  const prev = ($('atl-prev-' + id) || {}).value || null, obs = (($('atl-obs-' + id) || {}).value || '').trim() || null;
  atlSalvar(id, { previsao: prev, obs }, 'Anotado.');
}
function atlAbrir(id){ if(ATL_ABERTO.has(id)) ATL_ABERTO.delete(id); else ATL_ABERTO.add(id); pedRedesenhar(); }

function cardAtelie(o){
  const a = ATL_MAPA[o.pedido_id] || {}, id = o.pedido_id, sit = atlSituacao(o);
  const quando = (k) => escHtml([a[k + '_por'], a[k + '_em'] ? new Date(a[k + '_em']).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · '));
  const iProx = ATL_ETAPAS.findIndex(([k]) => !a[k + '_em']);
  const fase = typeof pedFase === 'function' ? pedFase(o) : null;
  const etapas = ATL_ETAPAS.map(([k, rot], i) => {
    if(a[k + '_em']) return `<div class="svc-et ok"><span>${escHtml(rot)}</span><em>${quando(k)}</em><button type="button" class="conf-link" onclick="atlMarcar(${id},'${k}',false)">desfazer</button></div>`;
    if(i === iProx) return `<div class="svc-et prox"><button type="button" class="conf-btn ok" onclick="atlMarcar(${id},'${k}',true)">${escHtml(rot)}</button></div>`;
    return `<div class="svc-et depois"><span>${escHtml(rot)}</span></div>`;
  }).join('');
  return `<div class="ped-card svc-card atl-card svc-${sit.cls}">
    <div class="gar-topo"><strong>${escHtml(o.cliente || 'Cliente')}</strong><button type="button" class="ped-ver" onclick="abrirPedidoVenda(${id})">OS ${escHtml(o.numero || '')} · ver pedido ›</button></div>
    <div class="svc-tags">${/ATELI/i.test(o.marcadores || '') ? '<span class="olist">tag ATELIE</span>' : '<span class="olist">marcado à mão</span>'}${fase ? `<span class="prod">${escHtml(fase.tit.split(' · ')[0])}</span>` : ''}</div>
    ${o.itens_resumo ? `<div class="svc-itens">${escHtml(o.itens_resumo)}</div>` : ''}
    <div class="svc-sit">${escHtml(sit.txt)}</div>
    ${typeof pedFaixaPagamento === 'function' ? pedFaixaPagamento(o) : ''}
    <div class="svc-etapas">${etapas}</div>
    <form class="atl-campos" onsubmit="event.preventDefault();atlSalvarCampos(${id})">
      <label>Previsão do ateliê <input type="date" id="atl-prev-${id}" value="${escHtml(a.previsao || '')}"></label>
      <label class="atl-obs">Anotação <input id="atl-obs-${id}" maxlength="1000" placeholder="Ex.: tecido chega dia 25; ateliê da Vidal" value="${escHtml(a.obs || '')}"></label>
      <button type="submit" class="conf-btn">Salvar</button>
    </form>
    <div class="svc-rodape"><span class="conf-nota">${typeof buscaSituacaoTiny === 'function' ? escHtml(buscaSituacaoTiny(o)) : ''}${o.data_venda ? ' · OS de ' + escHtml(new Date(o.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')) : ''}</span>
      <button type="button" class="conf-link" onclick="atlSalvar(${id},{eh_atelie:false},'Tirado do Ateliê. <button type=&quot;button&quot; class=&quot;aviso-desfazer&quot; onclick=&quot;atlSalvar(${id},{eh_atelie:null})&quot;>desfazer</button>')">não é do ateliê</button></div>
  </div>`;
}
function atlLinha(o){
  const sit = atlSituacao(o), aberto = ATL_ABERTO.has(o.pedido_id);
  return `<div class="svc-item${aberto ? ' aberto' : ''}"><button type="button" class="svc-linha" aria-expanded="${aberto}" onclick="atlAbrir(${o.pedido_id})">
      <span class="svc-l-q"><b>${escHtml(o.cliente || 'Cliente')}</b><span>OS ${escHtml(o.numero || '')}${(ATL_MAPA[o.pedido_id] || {}).previsao ? ' · previsão ' + atlDiaBR(ATL_MAPA[o.pedido_id].previsao) : ''}</span></span>
      <span class="selo ${ATL_SELO[sit.cls] || 's-neu'}">${sit.selo}</span>
      <span class="svc-l-o">${escHtml(sit.txt)}</span>
      <span class="fila-seta">${aberto ? '‹' : '›'}</span></button>
    ${aberto ? cardAtelie(o) : ''}</div>`;
}
function pedBlocoAtelie(compacto){
  const l = atlEmAndamento();
  const botao = `<button type="button" class="btn-outline atl-resumo-bt" onclick="atlResumo()">${ic('copiar',15)} Resumo para a Madeleine</button>`;
  return `<section class="ped-grupo${compacto ? ' svc-compacto' : ''}" id="ped-atelie">
    <div class="inicio-bloco-tit"><span>${ic('etiqueta',16)}Ateliê · cortina em tecido</span><strong>${l.length}</strong></div>
    ${compacto ? '' : `<div class="atl-topo"><span class="conf-nota">OS com a tag ATELIE no Olist (ou marcadas à mão). Marque cada etapa; quando voltar para a loja, a OS segue em Pedidos para agendar a instalação.</span>${botao}</div>${ATL_RESUMO !== null ? atlPainelResumo() : ''}`}
    ${l.length ? (compacto ? `<div class="svc-linhas">${l.map(atlLinha).join('')}</div><button type="button" class="orc-mais" onclick="PED_FILTRO='atelie';desenharPedidos();window.scrollTo({top:0})">Abrir o Ateliê e o resumo ›</button>` : `<div class="ped-lista">${l.map(cardAtelie).join('')}</div>`) : '<div class="conf-nota ped-vazio">Nenhuma OS do ateliê em andamento.</div>'}
  </section>`;
}

// ── resumo para a Madeleine (texto para copiar) ──
async function atlResumo(){
  const l = atlEmAndamento();
  ATL_RESUMO = 'Montando o resumo…'; pedRedesenhar();
  // itens com o detalhamento (medidas, tecido) vêm do pedido de venda no Olist, lido na hora (no máximo 15 OS)
  const det = {};
  for(const o of l.filter(o => ['tecido', 'enviado'].includes(atlProxima(o)[0])).slice(0, 15)){
    try{ const d = await olistChamar('pedido', { id: o.pedido_id }); if(d && d.pedido) det[o.pedido_id] = d.pedido; }catch(e){ /* fica o resumo dos itens */ }
  }
  ATL_RESUMO = atlTextoResumo(l, det); pedRedesenhar();
}
function atlTextoResumo(l, det){
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const prov = l.filter(o => ['tecido', 'enviado'].includes(atlProxima(o)[0]));
  const acomp = l.filter(o => ['pronto', 'voltou'].includes(atlProxima(o)[0]));
  const linhaItens = (o) => {
    const p = det && det[o.pedido_id];
    if(p && p.itens && p.itens.length) return p.itens.filter(i => !/^S$/i.test(i.tipo || '')).map(i => '   • ' + (i.quantidade && i.quantidade !== 1 ? String(i.quantidade).replace('.', ',') + '× ' : '') + i.descricao + (i.detalhe ? '\n     ' + String(i.detalhe).replace(/\s+/g, ' ').trim() : '')).join('\n');
    return o.itens_resumo ? '   • ' + o.itens_resumo.split(' · ').join('\n   • ') : '';
  };
  const cab = (o) => '▪ ' + (o.cliente || 'Cliente') + ' · OS ' + (o.numero || '') + (o.data_venda ? ' (de ' + atlDiaBR(o.data_venda) + ')' : '');
  const partes = ['ATELIÊ · RESUMO DE ' + hoje, ''];
  partes.push('1) PROVIDENCIAR PRODUÇÃO (' + prov.length + ')');
  if(!prov.length) partes.push('   Nada a providenciar.');
  prov.forEach(o => {
    const a = ATL_MAPA[o.pedido_id] || {}, pg = typeof pedPagamento === 'function' ? pedPagamento(o) : { producao: true };
    const falta = atlProxima(o)[0] === 'tecido' ? 'Falta: comprar/separar o tecido e enviar ao ateliê' : 'Falta: enviar ao ateliê (tecido ok em ' + atlDiaBR(a.tecido_em) + ')';
    partes.push(cab(o), '   ' + falta + (pg.producao ? '' : ' · ATENÇÃO: entrada ainda não conferida'));
    const it = linhaItens(o); if(it) partes.push(it);
    if(a.obs) partes.push('   Obs.: ' + a.obs);
    partes.push('');
  });
  partes.push('2) ACOMPANHAR COM O ATELIÊ (' + acomp.length + ')');
  if(!acomp.length) partes.push('   Nada no ateliê agora.');
  acomp.forEach(o => {
    const a = ATL_MAPA[o.pedido_id] || {};
    const st = atlProxima(o)[0] === 'voltou' ? 'Costura pronta em ' + atlDiaBR(a.pronto_em) + ' · buscar no ateliê'
      : 'Enviado em ' + atlDiaBR(a.enviado_em) + ' (há ' + atlDias(a.enviado_em) + ' dias)' + (a.previsao ? ' · previsão ' + atlDiaBR(a.previsao) + (atlPrevisaoVencida(a) ? ' — ATRASADO' : '') : ' · sem previsão: combinar com o ateliê');
    partes.push(cab(o), '   ' + st);
    if(a.obs) partes.push('   Obs.: ' + a.obs);
    partes.push('');
  });
  return partes.join('\n').trim();
}
function atlPainelResumo(){
  const pronto = ATL_RESUMO && ATL_RESUMO !== 'Montando o resumo…';
  return `<div class="conf-painel atl-painel">
    <label class="sr-only" for="atl-resumo-tx">Resumo do ateliê</label>
    <textarea id="atl-resumo-tx" class="conf-msg" rows="12" ${pronto ? '' : 'readonly'}>${escHtml(ATL_RESUMO || '')}</textarea>
    <div class="atl-bts"><button type="button" class="conf-btn ok" ${pronto ? '' : 'disabled'} onclick="atlCopiarResumo(this)">${ic('copiar',15)} Copiar</button><button type="button" class="conf-link" onclick="ATL_RESUMO=null;pedRedesenhar()">fechar</button></div>
  </div>`;
}
async function atlCopiarResumo(botao){
  const ok = await copiarTexto($('atl-resumo-tx').value);
  if(ok){ botao.innerHTML = ic('ok',15) + ' Copiado'; avisoTopo('Resumo copiado. Cole no WhatsApp da Madeleine.'); }
  else avisoTopo('Não consegui copiar sozinho: selecione o texto e copie.');
}
