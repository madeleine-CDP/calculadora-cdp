// ═══════════════════════════════════════════════════════
// HUB DE RETORNOS (Fase 2)
// Tudo que a loja deve a um cliente, num lugar só: lançar em menos de 30 s no celular,
// atrasados em vermelho no topo, filtro "o que depende de mim".
// Status: aberto → aguardando (interno: fábrica, Madeleine, Cícero…) → respondido.
// Na pasta do orçamento: "Registrei contato" (follow-up) e "+ Retorno".
// ═══════════════════════════════════════════════════════
const RET_QUEM = ['Bruna', 'Mirelle', 'Madeleine', 'Fábrica', 'Cícero'];
const RET_STATUS = { aberto: 'Aberto', aguardando: 'Aguardando interno', respondido: 'Respondido' };
let RETORNOS = [], RET_CARREGADO = false, RET_FILTRO = 'meus';

function meuNome(){ return (typeof getUsuarioLogado === 'function' && getUsuarioLogado()) || ''; }

// ── datas ──
function fimDoDia(d){ const x = new Date(d); x.setHours(18, 0, 0, 0); return x; }
function maisDiasUteis(n){ const d = new Date(); let k = 0; while(k < n){ d.setDate(d.getDate() + 1); const s = d.getDay(); if(s !== 0 && s !== 6) k++; } return d; }
function isoData(d){ const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); }
function hojeIso(){ return isoData(new Date()); }
function situacaoPrazo(r){
  if(r.status === 'respondido' || !r.prazo) return r.status === 'respondido' ? 'feito' : 'sem';
  const p = new Date(r.prazo), agora = new Date();
  if(p < agora) return 'atrasado';
  return isoData(p) === hojeIso() ? 'hoje' : 'futuro';
}
function textoPrazo(r){
  if(!r.prazo) return 'sem prazo';
  const p = new Date(r.prazo), hj = hojeIso(), dp = isoData(p);
  const amanha = isoData(new Date(Date.now() + 86400000)), ontem = isoData(new Date(Date.now() - 86400000));
  const hora = p.getHours() || p.getMinutes() ? ' às ' + String(p.getHours()).padStart(2,'0') + 'h' + (p.getMinutes() ? String(p.getMinutes()).padStart(2,'0') : '') : '';
  if(dp === hj) return 'hoje' + hora;
  if(dp === amanha) return 'amanhã' + hora;
  if(dp === ontem) return 'ontem' + hora;
  return p.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + hora;
}

// ── banco ──
async function carregarRetornos(){
  const desde = new Date(Date.now() - 30 * 86400000).toISOString();
  const r = await sbFetch('/rest/v1/retornos?select=*&or=(status.neq.respondido,respondido_em.gte.' + encodeURIComponent(desde) + ')&order=prazo.asc.nullslast');
  if(!r.ok) throw new Error('retornos ' + r.status);
  RETORNOS = await r.json(); RET_CARREGADO = true;
  return RETORNOS;
}
async function salvarRetorno(corpo, id){
  const r = await sbFetch('/rest/v1/retornos' + (id ? '?id=eq.' + id : ''), {
    method: id ? 'PATCH' : 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(corpo)
  });
  if(!r.ok) throw new Error(r.status + ' ' + await r.text());
  const j = await r.json(); const linha = Array.isArray(j) ? j[0] : j;
  RETORNOS = RETORNOS.filter(x => x.id !== linha.id).concat([linha]);
  return linha;
}
function retornosAbertos(){ return RETORNOS.filter(r => r.status !== 'respondido'); }
function retornosDoOrc(id){ return RETORNOS.filter(r => r.orcamento_id === id && r.status !== 'respondido'); }

// ── tela ──
async function renderRetornos(recarregar){
  const box = $('ret-lista'); if(!box) return;
  if(recarregar || !RET_CARREGADO){
    if(!RET_CARREGADO) box.innerHTML = '<div class="hist-empty">Carregando retornos…</div>';
    try{ await carregarRetornos(); }
    catch(e){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">' + ic('alerta',16) + ' Não foi possível carregar os retornos. Verifique a conexão.</div>'; return; }
  }
  const eu = meuNome();
  const abertos = retornosAbertos();
  const meus = abertos.filter(r => r.responsavel === eu);
  const aguard = abertos.filter(r => r.status === 'aguardando');
  const feitos = RETORNOS.filter(r => r.status === 'respondido');
  const atras = abertos.filter(r => situacaoPrazo(r) === 'atrasado');
  $('ret-contagem').textContent = abertos.length ? abertos.length + ' em aberto' + (atras.length ? ' · ' + atras.length + ' atrasado' + (atras.length > 1 ? 's' : '') : '') : 'Nada pendente';
  const chip = (id, nome, n) => `<button type="button" class="hist-chip${RET_FILTRO===id?' on':''}" onclick="RET_FILTRO='${id}';renderRetornos()">${nome} <span>${n}</span></button>`;
  $('ret-filtros').innerHTML = chip('meus','Depende de mim', meus.length) + chip('todos','Todos abertos', abertos.length) + chip('aguardando','Aguardando interno', aguard.length) + chip('feitos','Respondidos', feitos.length);

  let lista = RET_FILTRO === 'meus' ? meus : RET_FILTRO === 'aguardando' ? aguard : RET_FILTRO === 'feitos' ? feitos.slice().sort((a,b) => new Date(b.respondido_em) - new Date(a.respondido_em)) : abertos;
  if(!lista.length){
    box.innerHTML = `<div class="ret-vazio">${ic('ok',18)} ${RET_FILTRO === 'feitos' ? 'Nenhum retorno respondido nos últimos 30 dias.' : 'Nada pendente aqui. Tudo em dia!'}</div>`;
    return;
  }
  if(RET_FILTRO === 'feitos'){ box.innerHTML = lista.map(cardRetorno).join(''); return; }
  const grupos = [['atrasado','Atrasados'],['hoje','Para hoje'],['futuro','Próximos'],['sem','Sem prazo']];
  box.innerHTML = grupos.map(([k, t]) => {
    const g = lista.filter(r => situacaoPrazo(r) === k); if(!g.length) return '';
    return `<div class="ret-grupo ret-g-${k}">${t} <span>${g.length}</span></div>` + g.map(cardRetorno).join('');
  }).join('');
}

function cardRetorno(r){
  const s = situacaoPrazo(r);
  const orc = r.orcamento_id && typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE.find(e => e.id === r.orcamento_id) : null;
  const acoes = r.status === 'respondido'
    ? `<button type="button" class="ret-acao" onclick="mudarStatusRetorno(${r.id},'aberto')">Reabrir</button>`
    : `${r.status === 'aberto' ? `<button type="button" class="ret-acao" onclick="mudarStatusRetorno(${r.id},'aguardando')">Aguardando interno</button>` : `<button type="button" class="ret-acao" onclick="mudarStatusRetorno(${r.id},'aberto')">Voltou para mim</button>`}
       <button type="button" class="ret-acao ret-ok" onclick="mudarStatusRetorno(${r.id},'respondido')">${ic('ok',15)} Respondido</button>`;
  return `<div class="ret-card ret-${s} ret-st-${r.status}">
    <div class="ret-topo">
      <strong>${escHtml(r.cliente)}</strong>
      <span class="ret-prazo">${s === 'atrasado' ? ic('alerta',13) + ' ' : ''}${escHtml(r.status === 'respondido' ? 'respondido ' + textoPrazo({ prazo: r.respondido_em }) : textoPrazo(r))}</span>
    </div>
    <div class="ret-assunto">${escHtml(r.assunto)}</div>
    <div class="ret-meta">
      <span class="ret-quem">${ic('usuario',13)} ${escHtml(r.responsavel)}</span>
      ${r.status === 'aguardando' ? '<span class="ret-tag">Aguardando interno</span>' : ''}
      ${orc ? `<button type="button" class="ret-link" onclick="reopenOrc(${orc.id})">${escHtml(numCDP(orc.numero) || 'orçamento')} ›</button>` : ''}
      ${r.telefone ? `<a class="ret-link" href="https://wa.me/55${escHtml(String(r.telefone).replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,''))}" target="_blank" rel="noopener">WhatsApp ›</a>` : ''}
      <button type="button" class="ret-link" onclick="editarRetorno(${r.id})">Editar</button>
    </div>
    <div class="ret-acoes">${acoes}</div>
  </div>`;
}

async function mudarStatusRetorno(id, status){
  const r = RETORNOS.find(x => x.id === id); if(!r) return;
  const antes = r.status; r.status = status;
  renderRetornos(); if(document.body.dataset.tela === 'orc') renderContatoPasta();
  try{ await salvarRetorno({ status }, id); avisoTopo(status === 'respondido' ? 'Retorno marcado como respondido.' : 'Retorno atualizado.'); }
  catch(e){ r.status = antes; avisoTopo('Não foi possível salvar. Tente de novo.'); }
  renderRetornos(); if(document.body.dataset.tela === 'orc') renderContatoPasta();
  if(typeof renderInicio === 'function' && document.body.dataset.tela === 'inicio') renderInicio(false);
}

// ── lançar / editar (janela) ──
let RET_FORM = {};
function novoRetorno(base){
  const eu = meuNome();
  RET_FORM = Object.assign({ id: null, cliente: '', telefone: '', orcamento_id: null, assunto: '', responsavel: RET_QUEM.includes(eu) ? eu : 'Bruna', prazoTipo: 'hoje', prazoData: '' }, base || {});
  abrirFormRetorno('Novo retorno');
}
function editarRetorno(id){
  const r = RETORNOS.find(x => x.id === id); if(!r) return;
  RET_FORM = { id: r.id, cliente: r.cliente, telefone: r.telefone || '', orcamento_id: r.orcamento_id, assunto: r.assunto, responsavel: r.responsavel,
    prazoTipo: r.prazo ? 'data' : 'sem', prazoData: r.prazo ? isoData(r.prazo) : '' };
  abrirFormRetorno('Editar retorno');
}
// Orçamento aberto na pasta → retorno já ligado a ele
function novoRetornoDaPasta(){
  const c = STATE.cliente || {};
  novoRetorno({ cliente: c.nome || '', telefone: c.tel || '', orcamento_id: EDITING_ORC_ID || null });
}

function abrirFormRetorno(titulo){
  const f = RET_FORM;
  const clientes = (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).filter(e => e.client);
  const prazos = [['hoje','Hoje'],['amanha','Amanhã'],['2dias','Em 2 dias úteis'],['data','Escolher data'],['sem','Sem prazo']];
  abrirModal(titulo, `
    <label class="novo-campo"><span>Cliente <b>*</b></span>
      <input type="text" id="ret-cliente" list="ret-clientes" autocomplete="off" placeholder="Nome ou nº do orçamento" value="${escHtml(f.cliente)}" oninput="retClienteDigitou()"></label>
    <datalist id="ret-clientes">${clientes.map(e => `<option value="${escHtml(e.client)}">${escHtml([numCDP(e.numero), e.bairro && e.bairro !== '-' ? e.bairro : ''].filter(Boolean).join(' · '))}</option>`).join('')}</datalist>
    <div class="ret-ligado" id="ret-ligado">${f.orcamento_id ? retTextoLigado(f.orcamento_id) : ''}</div>
    <label class="novo-campo"><span>O que precisa ser respondido? <b>*</b></span>
      <input type="text" id="ret-assunto" autocomplete="off" maxlength="200" placeholder="Ex.: confirmar prazo com a Decore" value="${escHtml(f.assunto)}"></label>
    <div class="novo-campo"><span>Quem precisa agir</span>
      <div class="ret-chips" id="ret-quem">${RET_QUEM.map(q => `<button type="button" class="hist-chip${f.responsavel===q?' on':''}" onclick="retEscolher('quem','${q}',this)">${q}</button>`).join('')}</div></div>
    <div class="novo-campo"><span>Responder ao cliente até</span>
      <div class="ret-chips" id="ret-prazo">${prazos.map(([k,t]) => `<button type="button" class="hist-chip${f.prazoTipo===k?' on':''}" onclick="retEscolher('prazo','${k}',this)">${t}</button>`).join('')}</div>
      <input type="date" id="ret-data" class="ret-data" value="${escHtml(f.prazoData)}" ${f.prazoTipo==='data'?'':'hidden'}></div>`,
    ic('ok',16) + ' Salvar retorno', confirmarRetorno);
}
function retTextoLigado(id){
  const e = (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).find(x => x.id === id);
  return e ? ic('orcamentos',14) + ' Ligado ao ' + escHtml(numCDP(e.numero) || 'orçamento') + (e.etapa ? ' · ' + escHtml(ETAPA_NOME[e.etapa] || e.etapa) : '') : '';
}
function retClienteDigitou(){
  const v = $('ret-cliente').value.trim();
  const lista = typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [];
  const dig = v.replace(/\D/g, '');
  const e = lista.find(x => x.client && x.client.trim().toLowerCase() === v.toLowerCase()) || (dig && lista.find(x => String(x.numero) === String(parseInt(dig, 10))));
  RET_FORM.orcamento_id = e ? e.id : null;
  RET_FORM.telefone = e ? (e.telefone || '') : RET_FORM.telefone;
  if(e && dig && $('ret-cliente').value !== e.client) $('ret-cliente').value = e.client;
  $('ret-ligado').innerHTML = e ? retTextoLigado(e.id) : '';
}
function retEscolher(campo, valor, btn){
  btn.parentNode.querySelectorAll('.hist-chip').forEach(b => b.classList.remove('on')); btn.classList.add('on');
  if(campo === 'quem') RET_FORM.responsavel = valor;
  else { RET_FORM.prazoTipo = valor; const d = $('ret-data'); d.hidden = valor !== 'data'; if(valor === 'data'){ if(!d.value) d.value = isoData(maisDiasUteis(3)); d.focus(); } }
}
async function confirmarRetorno(){
  const f = RET_FORM, erro = $('modal-erro');
  const cliente = $('ret-cliente').value.trim(), assunto = $('ret-assunto').value.trim();
  if(!cliente || !assunto){ erro.textContent = !cliente ? 'Informe o cliente.' : 'Escreva o que precisa ser respondido.'; return; }
  let prazo = null;
  if(f.prazoTipo === 'hoje') prazo = fimDoDia(new Date());
  else if(f.prazoTipo === 'amanha') prazo = fimDoDia(maisDiasUteis(1));
  else if(f.prazoTipo === '2dias') prazo = fimDoDia(maisDiasUteis(2));
  else if(f.prazoTipo === 'data'){ const v = $('ret-data').value; if(!v){ erro.textContent = 'Escolha a data.'; return; } prazo = fimDoDia(new Date(v + 'T12:00:00')); }
  const corpo = { cliente, assunto, responsavel: f.responsavel, prazo: prazo ? prazo.toISOString() : null, orcamento_id: f.orcamento_id || null, telefone: f.telefone || null };
  try{ await salvarRetorno(corpo, f.id); }
  catch(e){ erro.textContent = 'Não foi possível salvar. Verifique a conexão e tente de novo.'; return; }
  fecharModal();
  avisoTopo(f.id ? 'Retorno atualizado.' : 'Retorno lançado' + (f.responsavel !== meuNome() ? ' para ' + escHtml(f.responsavel) : '') + '.');
  renderRetornos(); if(document.body.dataset.tela === 'orc') renderContatoPasta();
  if(document.body.dataset.tela === 'inicio' && typeof renderInicio === 'function') renderInicio(false);
}

// ── na pasta do orçamento: follow-up e retornos deste cliente ──
async function renderContatoPasta(){
  const box = $('pasta-contato'); if(!box) return;
  const e = (typeof orcEmEdicao === 'function') ? orcEmEdicao() : null;
  if(!EDITING_ORC_ID || !e){ box.innerHTML = ''; return; }
  if(!RET_CARREGADO){ try{ await carregarRetornos(); }catch(err){} }
  const pend = retornosDoOrc(EDITING_ORC_ID);
  const fechado = e.etapa === 'fechado' || e.etapa === 'perdido';
  const ult = e.ultimoContato ? new Date(e.ultimoContato).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
  const prox = e.proximoContato ? new Date(e.proximoContato + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null;
  box.innerHTML = `<div class="card pasta-card pasta-contato">
    <div class="pasta-contato-topo">
      <div><strong>Contato com o cliente</strong>
        <span>${ult ? 'Último: ' + ult + (e.qtdContatos ? ' · ' + e.qtdContatos + 'º contato' : '') : 'Nenhum contato registrado ainda'}${prox ? ' · Próximo: <b>' + prox + '</b>' : ''}</span></div>
      ${fechado ? '' : `<button type="button" class="btn-outline" onclick="registrarContato()">${ic('chat',15)} Registrei contato</button>`}
    </div>
    ${pend.length ? `<div class="pasta-ret-lista">${pend.map(r => `<div class="pasta-ret ret-${situacaoPrazo(r)}"><span>${escHtml(r.assunto)}</span><em>${escHtml(r.responsavel)} · ${escHtml(textoPrazo(r))}</em><button type="button" class="ret-acao ret-ok" onclick="mudarStatusRetorno(${r.id},'respondido')">${ic('ok',14)}</button></div>`).join('')}</div>` : ''}
    <button type="button" class="ret-novo-pasta" onclick="novoRetornoDaPasta()">${ic('mais',15)} Retorno para este cliente</button>
  </div>`;
}

function registrarContato(){
  const e = orcEmEdicao(); if(!e) return;
  const n = (e.qtdContatos || 0) + 1;
  const opcoes = [['3','Em 3 dias'],['7','Em 1 semana'],['data','Escolher data'],['sem','Sem próximo']];
  abrirModal('Registrei contato', `
    <p>Fica marcado o <b>${n}º contato</b> com ${escHtml(e.client)} hoje. O Início só volta a lembrar na data do próximo contato.</p>
    <div class="novo-campo"><span>Próximo contato</span>
      <div class="ret-chips" id="ctt-prox">${opcoes.map(([k,t], i) => `<button type="button" class="hist-chip${i===0?' on':''}" data-v="${k}" onclick="this.parentNode.querySelectorAll('.hist-chip').forEach(b=>b.classList.remove('on'));this.classList.add('on');$('ctt-data').hidden=this.dataset.v!=='data'">${t}</button>`).join('')}</div>
      <input type="date" id="ctt-data" class="ret-data" hidden value="${isoData(maisDiasUteis(5))}"></div>`,
    ic('ok',16) + ' Registrar', async () => {
      const v = document.querySelector('#ctt-prox .on').dataset.v;
      let prox = null;
      if(v === '3') prox = isoData(new Date(Date.now() + 3 * 86400000));
      else if(v === '7') prox = isoData(new Date(Date.now() + 7 * 86400000));
      else if(v === 'data'){ prox = $('ctt-data').value || null; if(!prox){ $('modal-erro').textContent = 'Escolha a data.'; return; } }
      const corpo = { ultimo_contato: new Date().toISOString(), proximo_contato: prox, qtd_contatos: n };
      try{
        const r = await sbFetch('/rest/v1/orcamentos?id=eq.' + EDITING_ORC_ID, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(corpo) });
        if(!r.ok) throw new Error(r.status);
      }catch(err){ $('modal-erro').textContent = 'Não foi possível registrar. Tente de novo.'; return; }
      Object.assign(e, { ultimoContato: corpo.ultimo_contato, proximoContato: prox, qtdContatos: n });
      fecharModal(); avisoTopo('Contato registrado' + (prox ? '. Próximo: ' + new Date(prox + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '') + '.');
      renderContatoPasta();
    });
}

// ── para o Início ──
function retornosParaHoje(){
  const eu = meuNome();
  return retornosAbertos().filter(r => { const s = situacaoPrazo(r); return s === 'atrasado' || s === 'hoje'; })
    .sort((a, b) => (b.responsavel === eu) - (a.responsavel === eu) || new Date(a.prazo) - new Date(b.prazo));
}
