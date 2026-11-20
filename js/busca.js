// ═══════════════════════════════════════════════════════
// BUSCA ÚNICA + HISTÓRICO DO CLIENTE (pedido da Bru, 19/11/2026; protótipo aprovado)
// Busca no topo: nome, telefone, CPF/CNPJ, nº CDP, nº da OS ou nº da fábrica (D/R).
// Acha no sistema (orçamentos, OS, retornos, garantias) na hora e, um pouco depois, também no Olist.
// Histórico (tela "cli"): junta o sistema, o Olist (rota "historico": cadastro e todos os pedidos de venda)
// e a Agenda. Só leitura: nada é gravado no Olist.
// ═══════════════════════════════════════════════════════
let BUSCA_DADOS = null, BUSCA_DADOS_EM = 0, BUSCA_SEQ = 0, BUSCA_TIMER = null, BUSCA_OLIST_TIMER = null;
let BUSCA_CLIENTES = [], BUSCA_OLIST = [], BUSCA_OLIST_EST = '', BUSCA_TERMO = '';
let CLI_ATUAL = null, CLI_FILTRO = 'tudo', CLI_SEQ = 0;

const bNorm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const bDig = (t) => String(t || '').replace(/\D/g, '');
const bFone8 = (t) => { const d = bDig(t); return d.length >= 8 ? d.slice(-8) : ''; };
const bIniciais = (n) => bNorm(n).split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '?';
const bData = (iso) => { if(!iso) return null; const s = String(iso); const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s); return isNaN(d) ? null : d; };
const bDiaMes = (d) => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const bDia = (d) => d ? d.toLocaleDateString('pt-BR') : '';
const bReais = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bReaisCurto = (v) => 'R$ ' + Math.round(Number(v || 0)).toLocaleString('pt-BR');
const B_ETAPA = { pre: 'pré-orçamento', pre_orcamento: 'pré-orçamento', pre_enviado: 'pré enviado', visita: 'visita agendada', orcamento: 'pós-visita', enviado: 'pós enviado', fechado: 'fechado', perdido: 'perdido' };

// ── dados do sistema (lidos uma vez e guardados por 2 minutos) ──
async function buscaCarregar(forcar){
  if(BUSCA_DADOS && !forcar && Date.now() - BUSCA_DADOS_EM < 120000) return BUSCA_DADOS;
  const ler = async (u) => { try{ const r = await sbFetch(u); return r.ok ? await r.json() : []; }catch(e){ return []; } };
  const [orcs, os, ret, gar, pos] = await Promise.all([
    (async () => { try{ if(typeof HIST_CARREGADO !== 'undefined' && !HIST_CARREGADO){ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; } }catch(e){} return typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []; })(),
    ler('/rest/v1/os_acompanhamento?select=*&order=data_venda.desc.nullslast&limit=1000'),
    ler('/rest/v1/retornos?select=*&order=criado_em.desc&limit=1000'),
    ler('/rest/v1/garantias?select=*&order=criado_em.desc&limit=500'),
    ler('/rest/v1/posvenda?select=*&limit=1000'),
  ]);
  if(typeof carregarFechamentos === 'function' && typeof FECH_CARREGADO !== 'undefined' && !FECH_CARREGADO){ try{ await carregarFechamentos(); }catch(e){} }
  BUSCA_DADOS = { orcs: orcs || [], os, ret, gar, pos }; BUSCA_DADOS_EM = Date.now();
  return BUSCA_DADOS;
}

// ── o que bate com o termo ──
function buscaCasar(termo, D){
  const t = bNorm(termo), dig = bDig(termo), soNum = dig.length && dig.length === String(termo).replace(/[\s().\-\/+]/g, '').length;
  const palavras = t.split(' ').filter(Boolean);
  const nomeBate = (n) => { const x = bNorm(n); return palavras.length && palavras.every(p => x.includes(p)); };
  const foneBate = (f) => dig.length >= 4 && bDig(f).includes(dig);
  const fab = /^[dr]\s?-?\d{3,5}$/i.test(String(termo).trim()) ? String(termo).toUpperCase().replace(/[\s-]/g, '') : '';
  const orcs = D.orcs.filter(e => nomeBate(e.client) || foneBate(e.telefone) || (soNum && dig.length <= 5 && Number(dig) === Number(e.numero)) || (/^cdp/i.test(t) && dig && Number(dig) === Number(e.numero)));
  const os = D.os.filter(o => nomeBate(o.cliente) || foneBate(o.celular) || (soNum && dig.length <= 6 && String(o.numero) === dig) || (fab && String(o.numero_fabrica || '').toUpperCase().includes(fab)));
  const ret = D.ret.filter(r => nomeBate(r.cliente) || foneBate(r.telefone));
  const gar = D.gar.filter(g => nomeBate(g.cliente) || foneBate(g.telefone));
  return { orcs, os, ret, gar };
}
// junta tudo por cliente (mesmo telefone = mesmo cliente; sem telefone, mesmo nome)
function buscaAgrupar(m){
  const grupos = [];
  const achar = (nome, fone) => {
    const f8 = bFone8(fone), n = bNorm(nome);
    let g = f8 ? grupos.find(x => x.fones.has(f8)) : null;
    if(!g && n) g = grupos.find(x => x.nomes.has(n));
    if(!g){ g = { nome: nome || '', telefone: fone || '', bairro: '', cidade: '', fones: new Set(), nomes: new Set(), orcs: [], os: [], ret: [], gar: [] }; grupos.push(g); }
    if(f8) g.fones.add(f8); if(n) g.nomes.add(n);
    if(!g.telefone && fone) g.telefone = fone;
    return g;
  };
  m.orcs.forEach(e => { const g = achar(e.client, e.telefone); g.orcs.push(e); if(!g.bairro && e.bairro && e.bairro !== '-') g.bairro = e.bairro; if(!g.cidade && e.cidade && e.cidade !== '-') g.cidade = e.cidade; });
  m.os.forEach(o => achar(o.cliente, o.celular).os.push(o));
  m.ret.forEach(r => achar(r.cliente, r.telefone).ret.push(r));
  m.gar.forEach(x => achar(x.cliente, x.telefone).gar.push(x));
  return grupos;
}
function buscaSaldoPendente(g){ return typeof pedPagamento === 'function' && g.os.some(o => [0, 3, 4, 7, 5, 1].includes(Number(o.situacao)) && !pedPagamento(o).instalacao && pedPagamento(o).entradaOk); }

// ── campo de busca (topo) ──
function buscaDigitou(el){
  BUSCA_TERMO = el.value;
  clearTimeout(BUSCA_TIMER); clearTimeout(BUSCA_OLIST_TIMER);
  const termo = el.value.trim();
  if(termo.length < 2){ buscaFecharLista(); return; }
  BUSCA_TIMER = setTimeout(() => buscaRodar(termo), 180);
}
async function buscaRodar(termo){
  const seq = ++BUSCA_SEQ;
  buscaMostrar('<div class="bs-vazio">Procurando…</div>');
  const D = await buscaCarregar();
  if(seq !== BUSCA_SEQ) return;
  const m = buscaCasar(termo, D);
  BUSCA_CLIENTES = buscaAgrupar(m);
  BUSCA_OLIST = []; BUSCA_OLIST_EST = termo.length >= 3 ? 'procurando' : '';
  buscaDesenhar(m);
  if(termo.length >= 3) BUSCA_OLIST_TIMER = setTimeout(() => buscaOlist(termo, seq, m), 450);
}
async function buscaOlist(termo, seq, m){
  try{
    const d = await olistChamar('buscar', { termo });
    if(seq !== BUSCA_SEQ) return;
    const ja8 = new Set(BUSCA_CLIENTES.flatMap(g => [...g.fones])), jaN = new Set(BUSCA_CLIENTES.flatMap(g => [...g.nomes]));
    BUSCA_OLIST = (d.clientes || []).filter(c => { const f8 = bFone8(c.celular || c.telefone); return !(f8 && ja8.has(f8)) && !jaN.has(bNorm(c.nome)); });
    // quem também está no Olist ganha o id do cadastro (o histórico fica mais certeiro)
    (d.clientes || []).forEach(c => { const f8 = bFone8(c.celular || c.telefone); const g = BUSCA_CLIENTES.find(x => (f8 && x.fones.has(f8)) || x.nomes.has(bNorm(c.nome))); if(g && !g.olist) g.olist = c; });
    BUSCA_OLIST_EST = 'ok';
  }catch(e){ if(seq !== BUSCA_SEQ) return; BUSCA_OLIST_EST = e.codigo === 'desconectado' ? 'desconectado' : 'erro'; }
  buscaDesenhar(m);
}
const B_IC = {
  orc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  os: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  ped: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>',
  ok: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  pag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/></svg>',
  ag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  gar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  perdido: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
function buscaDesenhar(m){
  const cli = BUSCA_CLIENTES.slice(0, 6).map((g, i) => {
    const tags = [g.orcs.length && g.orcs.length + (g.orcs.length > 1 ? ' orçamentos' : ' orçamento'), g.os.length && g.os.length + (g.os.length > 1 ? ' pedidos' : ' pedido'), g.gar.length && g.gar.length + ' garantia'].filter(Boolean);
    return `<button type="button" class="bs-res" onclick="abrirCliente('b',${i})">
      <span class="bs-av">${escHtml(bIniciais(g.nome))}</span>
      <span class="bs-txt"><b>${escHtml(g.nome || 'Cliente')}</b><span>${escHtml([typeof pedvFone === 'function' ? pedvFone(g.telefone) : g.telefone, g.bairro || g.cidade].filter(Boolean).join(' · '))}</span></span>
      <span class="bs-tags">${tags.map(t => `<span class="bs-mini">${t}</span>`).join('')}${buscaSaldoPendente(g) ? '<span class="bs-mini alerta">saldo pendente</span>' : ''}</span></button>`;
  }).join('');
  const olist = BUSCA_OLIST.slice(0, 5).map((c, i) => `<button type="button" class="bs-res" onclick="abrirCliente('o',${i})">
      <span class="bs-av olist">${escHtml(bIniciais(c.nome))}</span>
      <span class="bs-txt"><b>${escHtml(c.nome)}</b><span>${escHtml([c.celular || c.telefone, c.bairro, c.cidade].filter(Boolean).join(' · '))}</span></span>
      <span class="bs-tags"><span class="bs-mini olist">só no Olist</span></span></button>`).join('');
  const orcs = m.orcs.slice(0, 4).map(e => `<button type="button" class="bs-res" onclick="buscaFecharLista();reopenOrc(${e.id})">
      <span class="bs-ic orc">${B_IC.orc}</span>
      <span class="bs-txt"><b>${escHtml(numCDP(e.numero))} · ${escHtml(e.client || '')}</b><span>${escHtml([B_ETAPA[e.etapa] || e.etapa, bReais(e.totalAvista)].join(' · '))}</span></span>
      <span class="bs-mini">${escHtml(bDia(bData(e.createdAt)))}</span></button>`).join('');
  const os = m.os.slice(0, 4).map(o => `<button type="button" class="bs-res" onclick="buscaFecharLista();abrirPedidoVendaBusca(${o.pedido_id})">
      <span class="bs-ic os">${B_IC.os}</span>
      <span class="bs-txt"><b>OS ${escHtml(o.numero)} · ${escHtml(o.cliente || '')}</b><span>${escHtml([buscaSituacao(o.situacao), o.numero_fabrica].filter(Boolean).join(' · '))}</span></span>
      <span class="bs-mini">${escHtml(bDia(bData(o.data_venda)))}</span></button>`).join('');
  const olEst = BUSCA_OLIST_EST === 'procurando' ? '<div class="bs-vazio">Procurando também no Olist…</div>'
    : BUSCA_OLIST_EST === 'desconectado' ? '<div class="bs-vazio">Olist desconectado: mostrando só o que está no sistema.</div>'
    : BUSCA_OLIST_EST === 'erro' ? '<div class="bs-vazio">O Olist não respondeu agora: mostrando só o que está no sistema.</div>' : '';
  const html = (cli ? `<div class="bs-g">Clientes</div>${cli}` : '')
    + (olist ? `<div class="bs-g">No Olist</div>${olist}` : '')
    + (orcs ? `<div class="bs-g">Orçamentos</div>${orcs}` : '')
    + (os ? `<div class="bs-g">Pedidos (OS)</div>${os}` : '')
    + olEst;
  buscaMostrar(html || '<div class="bs-vazio">Nada encontrado no sistema.</div>');
}
const BUSCA_SIT = { 0: 'Aguardando pagamento', 3: 'Fazer pedido na fábrica', 4: 'Em produção', 7: 'Pronto', 5: 'Instalação agendada', 1: 'Faturada', 6: 'Entregue', 2: 'Cancelada', 9: 'Não entregue', 8: 'Dados incompletos', 10: 'Em devolução' };
const buscaSituacao = (s) => BUSCA_SIT[Number(s)] || '';
function buscaMostrar(html){
  const box = $('busca-lista'); if(!box) return;
  box.innerHTML = html; box.hidden = false;
  const tela = $('busca-tela-lista'); if(tela && document.body.dataset.tela === 'busca') tela.innerHTML = html;
}
function buscaFecharLista(){ const box = $('busca-lista'); if(box){ box.hidden = true; } }
// celular: a busca vira uma tela própria
function abrirBuscaTela(){
  irParaTab('busca'); window.scrollTo({ top: 0 });
  const el = $('busca-tela-in'); if(el){ el.value = BUSCA_TERMO; setTimeout(() => el.focus(), 30); }
  const box = $('busca-tela-lista'); if(box && !BUSCA_TERMO) box.innerHTML = '<div class="bs-vazio">Nome, telefone, CPF/CNPJ, nº CDP, nº da OS ou nº da fábrica (D/R).</div>';
}
function buscaTeclas(ev){
  if(ev.key === 'Escape'){ buscaFecharLista(); ev.target.blur(); }
  if(ev.key === 'Enter'){ const b = document.querySelector((document.body.dataset.tela === 'busca' ? '#busca-tela-lista' : '#busca-lista') + ' .bs-res'); if(b) b.click(); }
}
document.addEventListener('click', (ev) => { if(!ev.target.closest('.busca-topo')) buscaFecharLista(); });
async function abrirPedidoVendaBusca(id){
  if(typeof PED_CARREGADO !== 'undefined' && !PED_CARREGADO){ try{ await carregarPedidos(); }catch(e){} }
  if(!PED_OS.find(o => Number(o.pedido_id) === Number(id)) && BUSCA_DADOS){ const o = BUSCA_DADOS.os.find(x => Number(x.pedido_id) === Number(id)); if(o) PED_OS.push(o); }
  abrirPedidoVenda(id);
}

// ═════════ HISTÓRICO DO CLIENTE (tela "cli") ═════════
async function abrirCliente(origem, i){
  buscaFecharLista();
  let base;
  if(origem === 'b'){ const g = BUSCA_CLIENTES[i]; if(!g) return; base = { nome: g.nome, telefone: g.telefone, bairro: g.bairro, cidade: g.cidade, olist: g.olist || null }; }
  else if(origem === 'o'){ const c = BUSCA_OLIST[i]; if(!c) return; base = { nome: c.nome, telefone: c.celular || c.telefone, bairro: c.bairro, cidade: c.cidade, olist: c }; }
  else base = origem;   // objeto { nome, telefone } (ex.: vindo da pasta)
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!(await confirmarSairOrc())) return; limparOrcamentoEmAndamento(); }
  const seq = ++CLI_SEQ; CLI_FILTRO = 'tudo';
  CLI_ATUAL = { base, local: null, olist: null, olistEst: 'procurando', agenda: null };
  irParaTab('cli'); window.scrollTo({ top: 0 });
  desenharCliente();
  const D = await buscaCarregar();
  if(seq !== CLI_SEQ) return;
  CLI_ATUAL.local = cliDadosLocais(base, D);
  desenharCliente();
  const c = base.olist || {};
  olistChamar('historico', { id: c.id || null, cpfCnpj: c.cpfCnpj || '', celular: base.telefone || '', nome: base.nome || '' })
    .then(d => { if(seq !== CLI_SEQ) return; CLI_ATUAL.olist = d; CLI_ATUAL.olistEst = 'ok'; cliJuntarOlist(); desenharCliente(); })
    .catch(e => { if(seq !== CLI_SEQ) return; CLI_ATUAL.olistEst = e.codigo === 'desconectado' ? 'desconectado' : 'erro'; desenharCliente(); });
  if(typeof agendaChamar === 'function'){
    const ini = new Date(); ini.setDate(ini.getDate() - 120); const fim = new Date(); fim.setDate(fim.getDate() + 60);
    agendaChamar('eventos', { de: ini.toISOString(), ate: fim.toISOString() })
      .then(d => { if(seq !== CLI_SEQ) return; CLI_ATUAL.agenda = cliEventosDaAgenda(d.eventos || [], base.nome); desenharCliente(); })
      .catch(() => { if(seq !== CLI_SEQ) return; CLI_ATUAL.agenda = []; desenharCliente(); });
  }
}
function abrirClienteDaPasta(){
  const c = (typeof STATE !== 'undefined' && STATE.cliente) || {};
  if(!c.nome) return;
  abrirCliente({ nome: c.nome, telefone: c.tel || '', bairro: c.bairro || '', cidade: c.cidade || '' });
}
function cliDadosLocais(base, D){
  const f8 = bFone8(base.telefone), n = bNorm(base.nome);
  const mesmo = (nome, fone) => (f8 && bFone8(fone) === f8) || (n && bNorm(nome) === n);
  return {
    orcs: D.orcs.filter(e => mesmo(e.client, e.telefone)),
    os: D.os.filter(o => mesmo(o.cliente, o.celular)),
    ret: D.ret.filter(r => mesmo(r.cliente, r.telefone)),
    gar: D.gar.filter(g => mesmo(g.cliente, g.telefone)),
    pos: D.pos.filter(p => mesmo(p.cliente, p.celular)),
  };
}
// pedidos do Olist que o sistema ainda não tinha (ex.: antigos) entram na lista de OS do cliente
function cliJuntarOlist(){
  const L = CLI_ATUAL.local, O = CLI_ATUAL.olist; if(!L || !O) return;
  const c = O.cliente; if(c){ const b = CLI_ATUAL.base; b.cpfCnpj = c.cpfCnpj; b.email = c.email; b.endereco = [c.endereco, c.bairro, c.cidade].filter(Boolean).join(' – '); if(!b.telefone) b.telefone = c.celular || c.telefone; if(!b.bairro) b.bairro = c.bairro; }
}
function cliEventosDaAgenda(evs, nome){
  const ch = (typeof pedNomeChave === 'function' ? pedNomeChave(nome) : bNorm(nome).split(' ').filter(x => x.length > 2)).slice(0, 2);
  if(!ch.length) return [];
  return evs.filter(ev => { const t = (typeof pedNomeChave === 'function' ? pedNomeChave(ev.titulo) : bNorm(ev.titulo).split(' ')).join(' '); return ch.every(p => t.includes(p)); });
}

// linha do tempo: cada acontecimento = { d (Date), tipo (filtro), fonte, ic, cor, t (título), x (detalhe html) }
function cliEventos(){
  const L = CLI_ATUAL.local || { orcs: [], os: [], ret: [], gar: [], pos: [] }, O = CLI_ATUAL.olist, ev = [];
  const add = (d, tipo, fonte, ic, cor, t, x) => { const dd = bData(d); if(dd) ev.push({ d: dd, tipo, fonte, ic, cor, t, x: x || '' }); };
  L.orcs.forEach(e => {
    const ab = `<button type="button" class="conf-link" onclick="reopenOrc(${e.id})">abrir orçamento ›</button>`;
    add(e.createdAt, 'orc', 'sis', 'chat', 'vinho', 'Pediu orçamento', `${escHtml(numCDP(e.numero))}${e.criadoPor ? ' · criado por ' + escHtml(e.criadoPor) : ''} · ${ab}`);
    if(e.etapa === 'fechado') add(e.fechadoEm || e.updatedAt, 'orc', 'sis', 'orc', 'vinho', `Orçamento ${numCDP(e.numero)} fechado`, `${bReais(e.totalAvista)} à vista · ${ab}`);
    else if(e.etapa === 'perdido') add(e.updatedAt, 'orc', 'sis', 'perdido', 'cinza', `Orçamento ${numCDP(e.numero)} perdido`, `${escHtml(e.motivoPerda || 'sem motivo anotado')} · ${ab}`);
    if(e.ultimoContato) add(e.ultimoContato, 'atend', 'sis', 'chat', 'vinho', 'Contato registrado', `${escHtml(numCDP(e.numero))} · ${e.qtdContatos || 1} contato(s) até aqui`);
    const f = typeof FECH_MAPA !== 'undefined' ? FECH_MAPA[e.id] : null;
    if(f && f.validado_em) add(f.validado_em, 'ped', 'sis', 'ok', 'verde', 'Entrada conferida no extrato', escHtml(f.validado_por || ''));
    if(f && f.comprovante_em && !f.validado_em) add(f.comprovante_em, 'ped', 'sis', 'pag', 'ouro', 'Comprovante da entrada recebido', escHtml(f.comprovante_por || ''));
  });
  const osLocal = new Map(L.os.map(o => [String(o.numero), o]));
  const pedidos = (O && O.pedidos) || [];
  const vistos = new Set();
  pedidos.forEach(p => {
    vistos.add(String(p.numero));
    const itens = (p.itens || []).filter(i => i.descricao).map(i => (i.quantidade && i.quantidade !== 1 ? String(i.quantidade).replace('.', ',') + '× ' : '') + i.descricao);
    const loc = osLocal.get(String(p.numero));
    const ver = loc ? ` · <button type="button" class="conf-link" onclick="abrirPedidoVendaBusca(${loc.pedido_id})">ver pedido ›</button>` : '';
    add(p.data, 'ped', 'olist', 'ped', 'azul', `Pedido de venda nº ${p.numero}`, `${bReais(p.valor)} · ${escHtml(p.situacao)}${p.numeroFabrica ? ' · ' + escHtml(p.numeroFabrica) : ''}${itens.length ? '<br>' + escHtml(itens.slice(0, 4).join(' · ')) + (itens.length > 4 ? ' …' : '') : ''}${ver}`);
    if(p.dataEntrega) add(p.dataEntrega, 'ped', 'olist', 'os', 'azul', `OS ${p.numero} entregue`, `${p.nf ? 'com nota fiscal' : 'sem nota fiscal no Tiny'}`);
  });
  L.os.forEach(o => {
    if(!vistos.has(String(o.numero))) add(o.data_venda, 'ped', 'olist', 'ped', 'azul', `Pedido de venda nº ${o.numero}`, `${bReais(o.valor)} · ${escHtml(buscaSituacao(o.situacao))} · <button type="button" class="conf-link" onclick="abrirPedidoVendaBusca(${o.pedido_id})">ver pedido ›</button>`);
    if(!vistos.has(String(o.numero)) && o.data_entrega) add(o.data_entrega, 'ped', 'olist', 'os', 'azul', `OS ${o.numero} entregue`, '');
    if(o.entrada_validado_em) add(o.entrada_validado_em, 'ped', 'sis', 'ok', 'verde', `Entrada conferida · OS ${o.numero}`, escHtml(o.entrada_validado_por || ''));
    if(o.saldo_comprovante_em) add(o.saldo_comprovante_em, 'ped', 'sis', 'pag', 'ouro', `Comprovante do saldo recebido · OS ${o.numero}`, escHtml(o.saldo_comprovante_por || ''));
    if(o.saldo_validado_em) add(o.saldo_validado_em, 'ped', 'sis', 'ok', 'verde', `Saldo conferido · OS ${o.numero}`, escHtml(o.saldo_validado_por || ''));
  });
  L.ret.forEach(r => {
    add(r.criado_em, 'atend', 'sis', 'chat', 'vinho', `Retorno: ${r.assunto || ''}`, `${escHtml(r.responsavel || '')}${r.criado_por ? ' · lançado por ' + escHtml(r.criado_por) : ''}${r.obs ? ' · ' + escHtml(r.obs) : ''}`);
    if(r.respondido_em) add(r.respondido_em, 'atend', 'sis', 'ok', 'verde', `Retorno respondido: ${r.assunto || ''}`, escHtml(r.responsavel || ''));
  });
  L.gar.forEach(g => {
    add(g.criado_em, 'gar', 'sis', 'gar', 'ouro', `Chamado de garantia${g.status === 'resolvido' ? ' · resolvido' : g.status === 'nao_defeito' ? ' · não era defeito' : ''}`, `${g.pedido_numero ? 'OS ' + escHtml(g.pedido_numero) + ' · ' : ''}${escHtml(g.relato || '')}${g.solucao ? ' · ' + escHtml(g.solucao) : ''}`);
  });
  L.pos.forEach(p => { if(p.contato_em) add(p.contato_em, 'atend', 'sis', 'chat', 'vinho', 'Pós-venda de 6 meses', `Mensagem enviada${p.contato_por ? ' por ' + escHtml(p.contato_por) : ''}`); });
  (CLI_ATUAL.agenda || []).forEach(e => {
    const p = typeof lerTitulo === 'function' ? lerTitulo(e.titulo) : { tipo: e.titulo, execs: [] };
    const quem = (p.execs || []).map(x => (typeof EXECUTORES !== 'undefined' && EXECUTORES[x]) || x).join(' e ');
    add(e.inicio, 'agenda', 'ag', 'ag', 'verde', p.tipo || 'Compromisso', escHtml([quem, e.diaInteiro ? 'dia todo' : new Date(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')));
  });
  return ev.sort((a, b) => b.d - a.d);
}
function cliEmAberto(){
  const L = CLI_ATUAL.local; if(!L) return [];
  const out = [];
  L.os.filter(o => [0, 3, 4, 7, 5, 1].includes(Number(o.situacao))).forEach(o => {
    const g = typeof pedPagamento === 'function' ? pedPagamento(o) : null;
    if(g && !g.instalacao && [7, 5, 1].includes(Number(o.situacao))) out.push({ cls: 'alerta', rot: 'Pagamento', t: `OS ${o.numero} · ${!g.entradaOk ? 'entrada não conferida' : 'saldo' + (g.saldoValor ? ' ' + bReais(g.saldoValor) : '')}`, x: g.entradaOk && g.saldoComp ? 'Comprovante recebido · falta a Madeleine conferir' : 'Não confirmar a instalação antes de conferir' });
    else if(g && !g.entradaOk) out.push({ cls: 'alerta', rot: 'Pagamento', t: `OS ${o.numero} · entrada não conferida`, x: 'Não vai para a produção antes de conferir' });
    out.push({ cls: '', rot: 'Pedido', t: `OS ${o.numero} · ${buscaSituacao(o.situacao)}`, x: [o.numero_fabrica, o.data_prevista ? 'previsão ' + bDiaMes(bData(o.data_prevista)) : ''].filter(Boolean).join(' · '), on: `abrirPedidoVendaBusca(${o.pedido_id})` });
  });
  L.orcs.filter(e => !['fechado', 'perdido'].includes(e.etapa)).forEach(e => out.push({ cls: '', rot: 'Orçamento', t: `${numCDP(e.numero)} · ${B_ETAPA[e.etapa] || e.etapa}`, x: bReais(e.totalAvista) + (e.proximoContato ? ' · próximo contato ' + bDiaMes(bData(e.proximoContato)) : ''), on: `reopenOrc(${e.id})` }));
  L.ret.filter(r => r.status !== 'respondido').forEach(r => out.push({ cls: r.prazo && bData(r.prazo) < new Date() ? 'alerta' : '', rot: 'Retorno', t: r.assunto || 'Retorno', x: [r.responsavel, r.prazo ? 'prazo ' + bDiaMes(bData(r.prazo)) : ''].filter(Boolean).join(' · ') }));
  L.gar.filter(g => !['resolvido', 'nao_defeito'].includes(g.status)).forEach(g => out.push({ cls: 'alerta', rot: 'Garantia', t: 'Chamado em aberto', x: g.relato || '' }));
  const agora = new Date();
  (CLI_ATUAL.agenda || []).filter(e => bData(e.inicio) >= agora).slice(0, 2).forEach(e => { const p = typeof lerTitulo === 'function' ? lerTitulo(e.titulo) : { tipo: e.titulo }; out.push({ cls: 'verde', rot: 'Agenda', t: `${p.tipo || 'Compromisso'} · ${bData(e.inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}`, x: e.diaInteiro ? 'dia todo' : bData(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }); });
  return out;
}
function cliEmCasa(){
  const pedidos = ((CLI_ATUAL.olist && CLI_ATUAL.olist.pedidos) || []).filter(p => p.dataEntrega && p.itens);
  const out = [];
  pedidos.forEach(p => p.itens.filter(i => i.descricao && i.tipo !== 'S' && !/instala|servi[cç]o|frete|m[aã]o de obra/i.test(i.descricao)).forEach(i => {
    const ate = bData(p.dataEntrega); ate.setFullYear(ate.getFullYear() + 1);
    out.push({ t: i.descricao, ate, os: p.numero });
  }));
  return out;
}
function desenharCliente(){
  const box = $('cli-conteudo'); if(!box || !CLI_ATUAL) return;
  const b = CLI_ATUAL.base, L = CLI_ATUAL.local, O = CLI_ATUAL.olist;
  const fone = b.telefone || '', cel = bDig(fone), wa = cel ? 'https://wa.me/55' + (cel.length <= 9 ? '81' + cel : cel.replace(/^55/, '')) : '';
  const pedidos = (O && O.pedidos) || [];
  const validos = pedidos.filter(p => ![2, 8].includes(p.situacaoCod));
  const desde = [...validos.map(p => bData(p.data)), ...((L && L.orcs) || []).map(e => bData(e.createdAt))].filter(Boolean).sort((a, z) => a - z)[0];
  const evs = L ? cliEventos() : [];
  const filtros = [['tudo', 'Tudo'], ['orc', 'Orçamentos'], ['ped', 'Pedidos'], ['atend', 'Atendimento'], ['agenda', 'Agenda'], ['gar', 'Garantia']];
  const lista = evs.filter(e => CLI_FILTRO === 'tudo' || e.tipo === CLI_FILTRO);
  let anoAtual = null;
  const linhas = lista.map(e => { const ano = e.d.getFullYear(); const cab = ano !== anoAtual ? `<div class="cli-ano">${ano}</div>` : ''; anoAtual = ano;
    return cab + `<div class="cli-ev"><div class="cli-ev-data">${bDiaMes(e.d)}</div><div class="cli-ev-ic c-${e.cor}">${B_IC[e.ic] || ''}</div>
      <div><div class="cli-ev-t">${escHtml(e.t)} <span class="cli-fonte f-${e.fonte}">${e.fonte === 'olist' ? 'Olist' : e.fonte === 'ag' ? 'Agenda' : 'Sistema'}</span></div><div class="cli-ev-m">${bDiaMes(e.d)}</div>${e.x ? `<div class="cli-ev-d">${e.x}</div>` : ''}</div></div>`; }).join('');
  const abertos = cliEmAberto();
  const emCasa = cliEmCasa();
  const est = CLI_ATUAL.olistEst === 'procurando' ? '<div class="cli-nota">Buscando os pedidos no Olist…</div>'
    : CLI_ATUAL.olistEst === 'desconectado' ? '<div class="cli-nota">Olist desconectado: o histórico mostra só o que está no sistema.</div>'
    : CLI_ATUAL.olistEst === 'erro' ? `<div class="cli-nota">O Olist não respondeu agora. <button type="button" class="conf-link" onclick="abrirCliente(CLI_ATUAL.base)">tentar de novo</button></div>`
    : (O && !O.cliente && !pedidos.length ? '<div class="cli-nota">Não achei este cliente no Olist (ainda sem pedido de venda).</div>' : '');
  const orcs = (L && L.orcs) || [];
  box.innerHTML = `
  <button type="button" class="pedv-voltar cli-voltar" onclick="abrirBuscaTela()">‹ Busca</button>
  <section class="cli-cab">
    <div class="cli-cab-pessoa">
      <div class="cli-av">${escHtml(bIniciais(b.nome))}</div>
      <div class="cli-cab-txt">
        ${desde ? `<div class="pedv-sobre">Cliente desde ${desde.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>` : ''}
        <h1>${escHtml(b.nome || 'Cliente')}</h1>
        <div class="cli-contatos">
          ${fone ? (wa ? `<a href="${wa}" target="_blank" rel="noopener"><b>WhatsApp ${escHtml(typeof pedvFone === 'function' ? pedvFone(fone) : fone)}</b></a>` : `<span>${escHtml(fone)}</span>`) : ''}
          ${b.cpfCnpj ? `<span>${bDig(b.cpfCnpj).length > 11 ? 'CNPJ' : 'CPF'} ${escHtml(b.cpfCnpj)}</span>` : ''}
          ${b.email ? `<span>${escHtml(b.email)}</span>` : ''}
          ${b.endereco ? `<span>${escHtml(b.endereco)}</span>` : (b.bairro || b.cidade ? `<span>${escHtml([b.bairro, b.cidade].filter(x => x && x !== '-').join(', '))}</span>` : '')}
        </div>
      </div>
    </div>
    <div class="cli-acoes">
      <button type="button" class="cli-bt principal" onclick="cliNovoOrcamento()">+ Novo orçamento</button>
      <button type="button" class="cli-bt" onclick="novoRetorno({ cliente: CLI_ATUAL.base.nome || '', telefone: CLI_ATUAL.base.telefone || '' })">+ Retorno</button>
      <button type="button" class="cli-bt" onclick="abrirGarantias()">Chamado de garantia</button>
    </div>
  </section>
  ${abertos.length ? `<section class="cli-abertos" aria-label="Em aberto agora">${abertos.map(a => `<${a.on ? 'button type="button" onclick="' + a.on + '"' : 'div'} class="cli-aberto ${a.cls}"><span>${escHtml(a.rot)}</span><b>${escHtml(a.t)}</b>${a.x ? `<em>${escHtml(a.x)}</em>` : ''}</${a.on ? 'button' : 'div'}>`).join('')}</section>` : ''}
  <div class="cli-corpo">
    <section class="cli-hist">
      <div class="cli-hist-topo"><h2>Histórico</h2>
        <div class="cli-filtros" role="group" aria-label="Filtrar">${filtros.map(([k, t]) => `<button type="button" class="hist-chip${CLI_FILTRO === k ? ' on' : ''}" onclick="CLI_FILTRO='${k}';desenharCliente()">${t}</button>`).join('')}</div>
      </div>
      ${est}
      ${!L ? '<div class="cli-nota">Carregando…</div>' : (linhas || '<div class="cli-nota">Nada registrado aqui ainda.</div>')}
    </section>
    <aside class="cli-lado">
      <section class="cli-q"><h2>Resumo</h2>
        <div class="cli-nums">
          <div><span>Total comprado</span><b>${O ? bReaisCurto(validos.reduce((t, p) => t + Number(p.valor || 0), 0)) : '…'}</b></div>
          <div><span>Pedidos</span><b>${O ? validos.length : '…'}</b></div>
          <div><span>Orçamentos</span><b>${orcs.length}${orcs.filter(e => e.etapa === 'perdido').length ? ` <small>· ${orcs.filter(e => e.etapa === 'perdido').length} perdido</small>` : ''}</b></div>
          <div><span>Último contato</span><b>${(() => { const u = evs.find(e => e.fonte !== 'olist' && e.d <= new Date()); if(!u) return '—'; const dias = Math.floor((Date.now() - u.d) / 864e5); return dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias'; })()}</b></div>
        </div>
      </section>
      ${emCasa.length ? `<section class="cli-q"><h2>O que já tem em casa</h2><div class="cli-nota">Dos pedidos entregues no Olist</div>
        <ul class="cli-casa">${emCasa.slice(0, 10).map(i => `<li><span>${escHtml(i.t)}</span><em class="${i.ate >= new Date() ? 'ok' : ''}">${i.ate >= new Date() ? 'garantia até ' + i.ate.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : 'fora da garantia'}</em></li>`).join('')}</ul></section>` : ''}
      ${orcs.length ? `<section class="cli-q"><h2>Orçamentos</h2>${orcs.map(e => `<button type="button" class="cli-orc" onclick="reopenOrc(${e.id})"><span><b>${escHtml(numCDP(e.numero))}</b> · ${bReais(e.totalAvista)}</span><em class="e-${e.etapa}">${escHtml(B_ETAPA[e.etapa] || e.etapa)}${e.etapa === 'perdido' && e.motivoPerda ? ' · ' + escHtml(e.motivoPerda) : ''}</em></button>`).join('')}</section>` : ''}
    </aside>
  </div>`;
}
function cliNovoOrcamento(){
  const b = CLI_ATUAL && CLI_ATUAL.base; if(!b) return;
  Promise.resolve(novoOrcamento()).then(() => {
    const set = (id, v) => { const el = $(id); if(el && v && v !== '-') el.value = v; };
    set('novo-nome', b.nome); set('novo-tel', b.telefone); set('novo-bairro', b.bairro);
    const cid = String(b.cidade || '').split('/'); set('novo-cidade', cid[0]); if(cid[1]) set('novo-uf', cid[1]);
    set('novo-cpf', b.cpfCnpj); set('novo-email', b.email);
  });
}
