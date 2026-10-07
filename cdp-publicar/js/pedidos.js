// ═══════════════════════════════════════════════════════
// PEDIDOS (Fase 4) — acompanha as OS do Tiny pelo status, sem registro em dobro.
// O status continua sendo mudado NO TINY; o sistema lê (função "olist", rota os → tabela os_acompanhamento)
// e diz o que fazer em cada fase:
//   0 Em aberto → aguardando pagamento (ver Fechamento)        3 Aprovado → fazer pedido na fábrica (próximo nº D/R)
//   4 Preparando envio → em produção: conferir as fábricas a cada 2 dias (uma vez por fábrica, tabela conferencias_fabrica)
//   7 Pronto para envio → conferir em mãos + agendar instalação (mensagem do Guia)
//   5 Enviado / 1 Faturado → instalação agendada            6 Entregue (últimos 10 dias) → pedir avaliação no Google
// ═══════════════════════════════════════════════════════

const PED_FASES = [
  { k: 'pagar',    sit: [0],    em: '💳', tit: 'Aguardando pagamento' },
  { k: 'fabrica',  sit: [3],    em: '🏭', tit: 'Fazer pedido na fábrica' },
  { k: 'producao', sit: [4],    em: '⚙️', tit: 'Em produção' },
  { k: 'pronto',   sit: [7],    em: '📦', tit: 'Pronto · agendar instalação' },
  { k: 'agendado', sit: [5, 1], em: '🚚', tit: 'Instalação agendada' },
  { k: 'entregue', sit: [6],    em: '✅', tit: 'Entregues · pedir avaliação' },
];
const PED_FABRICAS = [['decore', 'Decore', 'D'], ['real', 'Real', 'R']];
let PED_OS = [], PED_CONF = [], PED_CARREGADO = false, PED_SINC_EM = 0, PED_FILTRO = 'todos', PED_AGENDA = null;
const PED_ABERTO = new Set();

// ── dados ──
async function sincronizarPedidos(forcar){
  if(!forcar && Date.now() - PED_SINC_EM < 10 * 60000) return;   // lê o Olist no máximo a cada 10 min
  PED_SINC_EM = Date.now();
  try{ await olistChamar('os'); }catch(e){ PED_SINC_EM = 0; throw e; }
}
async function carregarPedidos(){
  const desde = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const [r1, r2] = await Promise.all([
    sbFetch('/rest/v1/os_acompanhamento?select=*&or=(situacao.in.(0,3,4,7,5,1),and(situacao.eq.6,data_entrega.gte.' + desde + '))&order=situacao_desde.asc'),
    sbFetch('/rest/v1/conferencias_fabrica?select=*&order=conferido_em.desc&limit=30'),
  ]);
  if(!r1.ok) throw new Error('os');
  PED_OS = await r1.json(); PED_CONF = r2.ok ? await r2.json() : [];
  PED_CARREGADO = true;
}
async function carregarAgendaPedidos(){
  if(PED_AGENDA || typeof agendaChamar !== 'function') return;
  try{
    const ini = new Date(); ini.setHours(0, 0, 0, 0); const fim = new Date(ini); fim.setDate(fim.getDate() + 45);
    const d = await agendaChamar('eventos', { de: ini.toISOString(), ate: fim.toISOString() });
    PED_AGENDA = d.eventos || [];
  }catch(e){ PED_AGENDA = []; }
}
const pedFase = (o) => PED_FASES.find(f => f.sit.includes(Number(o.situacao)));
const pedDias = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : 0;
const pedNomeChave = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(x => x.length > 2);
// compromisso na agenda para o cliente (nome e sobrenome no título)
function pedNaAgenda(o){
  if(!PED_AGENDA) return null;
  const ch = pedNomeChave(o.cliente); if(!ch.length) return null;
  const alvo = ch.slice(0, 2);
  return PED_AGENDA.find(ev => { const t = pedNomeChave(ev.titulo).join(' '); return alvo.every(p => t.includes(p)); }) || null;
}
// próximo nº de pedido na fábrica: maior nº usado + 1 (a sequência da CDP é a mesma para D e R)
function proximoNumeroFabrica(){
  const nums = PED_OS.flatMap(o => String(o.numero_fabrica || '').match(/[DR]\d{3,5}/g) || []).map(x => Number(x.slice(1)));
  return nums.length ? Math.max(...nums) + 1 : null;
}
function fabricasDaOS(o){ const t = String(o.numero_fabrica || ''); return PED_FABRICAS.filter(([, , l]) => new RegExp('\\b' + l + '\\d').test(t)).map(([k]) => k); }
function ultimaConferencia(fab){ return PED_CONF.find(c => c.fabrica === fab) || null; }
function orcDaOS(o){ return (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).find(e => e.pedidoTiny && String(e.pedidoTiny) === String(o.numero)) || null; }

// ── mensagens (Guia de Mensagens) ──
function pedMsgAgendar(o){
  return `Olá, ${primeiroNome(o.cliente)}! Bom dia/Boa tarde, tudo bem?\n\n*Boas notícias: as suas cortinas/persianas estão em fase final de produção! 🥳✨*\n\nPodemos deixar a entrega e instalação pré-agendadas? Sugerimos:\n\n*🗓 Dia:*\n*⏰ Horário:*\n\nPode ser? *Ficamos no aguardo da sua confirmação!*\n\n> ✅ OBS: Este agendamento será confirmado mediante envio do comprovante de pagamento do saldo residual, enviar aqui em até 1 dia útil antes do dia agendado para a instalação!\n\nMuito obrigada pela preferência. 🤝`;
}
function pedMsgAvaliacao(o){
  const link = (typeof LINKS !== 'undefined' && (LINKS.find(l => /avalia/i.test(l.titulo)) || {}).url) || 'https://g.page/CentraldasPersianas/review?gm';
  return `*✅ Entrega e instalação finalizadas com sucesso!*\n\nSe puder nos avaliar no Google agradecemos imensamente, ${primeiroNome(o.cliente)}!\n\nA sua opinião é muito importante para nós — e nos ajuda a continuar evoluindo! 🚀\nSe quiser compartilhar a sua experiência, é só clicar aqui no link do Google:\n\n👉 ${link}\n\n> Estamos sempre à disposição — foi um prazer cuidar do seu espaço! 🤝`;
}

// ── ações ──
async function pedMarcar(id, campo, feito){
  const r = await sbFetch('/rest/v1/os_acompanhamento?pedido_id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ [campo]: feito ? new Date().toISOString() : null }) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); return; }
  const l = (await r.json())[0]; const i = PED_OS.findIndex(o => o.pedido_id === id); if(l && i >= 0) PED_OS[i] = l;
  PED_ABERTO.delete(id + ':' + campo);
  if(!feito) avisoTopo('Desfeito.');
  pedRedesenhar();
}
async function conferirFabrica(fab){
  const r = await sbFetch('/rest/v1/conferencias_fabrica', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ fabrica: fab }) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora.'); return; }
  const l = (await r.json())[0]; if(l) PED_CONF.unshift(l);
  avisoTopo('Conferência da ' + (fab === 'decore' ? 'Decore' : 'Real') + ' registrada. Se algum pedido ficou pronto, mude no Tiny para "Pronto para envio".');
  pedRedesenhar();
}
async function desfazerConferencia(id){
  const r = await sbFetch('/rest/v1/conferencias_fabrica?id=eq.' + id, { method: 'DELETE' });
  if(!r.ok){ avisoTopo('Não foi possível desfazer.'); return; }
  PED_CONF = PED_CONF.filter(c => c.id !== id); avisoTopo('Desfeito.'); pedRedesenhar();
}
function pedVer(id, chave){ const k = id + ':' + chave; if(PED_ABERTO.has(k)) PED_ABERTO.delete(k); else PED_ABERTO.add(k); pedRedesenhar(); }
async function pedCopiar(botao){
  const ok = await copiarTexto(botao.closest('.conf-painel').querySelector('.conf-msg').value);
  if(ok){ botao.innerHTML = ic('ok',15) + ' Copiada'; botao.classList.add('ok'); avisoTopo('Mensagem copiada. Cole no WhatsApp do cliente.'); }
  else avisoTopo('Não consegui copiar sozinho: selecione o texto e copie.');
}
function pedRedesenhar(){
  if(document.body.dataset.tela === 'ped') desenharPedidos();
  if(document.body.dataset.tela === 'inicio') desenharPedidosInicio();
}

// ═════════ TELA ═════════
async function abrirPedidos(filtro){
  if(filtro) PED_FILTRO = filtro;
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!confirmarSairOrc()) return; limparOrcamentoEmAndamento(); }
  irParaTab('ped'); window.scrollTo({ top: 0 });
  renderPedidos();
}
async function renderPedidos(forcar){
  const box = $('ped-lista'); if(!box) return;
  if(PED_CARREGADO) desenharPedidos(); else box.innerHTML = '<div class="hist-empty">Lendo as OS do Olist…</div>';
  let aviso = '';
  try{ await sincronizarPedidos(forcar); }catch(e){ aviso = e.codigo === 'desconectado' ? 'Olist desconectado: mostrando a última leitura. (Configurações → Conexões)' : 'Olist indisponível agora: mostrando a última leitura.'; }
  try{ await carregarPedidos(); }catch(e){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">Não foi possível carregar os pedidos.</div>'; return; }
  if(typeof HIST_CARREGADO !== 'undefined' && !HIST_CARREGADO){ try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }catch(e){} }
  desenharPedidos(aviso);
  await carregarAgendaPedidos(); desenharPedidos(aviso);
}
function desenharPedidos(aviso){
  const box = $('ped-lista'); if(!box) return;
  const grupos = PED_FASES.map(f => ({ f, l: PED_OS.filter(o => f.sit.includes(Number(o.situacao))) }));
  const lido = PED_OS.reduce((m, o) => o.lido_em > m ? o.lido_em : m, '');
  $('ped-sub').textContent = (PED_OS.filter(o => Number(o.situacao) !== 6).length) + ' OS em andamento' + (lido ? ' · lido do Olist às ' + new Date(lido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  $('ped-filtros').innerHTML = [['todos', '📋 Tudo', PED_OS.length]].concat(grupos.map(g => [g.f.k, g.f.em + ' ' + g.f.tit.split(' · ')[0], g.l.length]))
    .map(([k, t, n]) => `<button type="button" class="hist-chip${PED_FILTRO === k ? ' on' : ''}" onclick="PED_FILTRO='${k}';desenharPedidos()">${t} <span>${n}</span></button>`).join('');
  const mostrar = grupos.filter(g => PED_FILTRO === 'todos' || g.f.k === PED_FILTRO);
  box.innerHTML = (aviso ? `<div class="ag-aviso">${ic('info',16)} <span>${escHtml(aviso)}</span></div>` : '') + mostrar.map(g => `
    <section class="ped-grupo">
      <div class="inicio-bloco-tit"><span>${g.f.em} ${g.f.tit}</span><strong>${g.l.length}</strong></div>
      ${g.f.k === 'fabrica' && g.l.length ? pedBlocoProximoNumero() : ''}
      ${g.f.k === 'producao' ? pedBlocoConferencia(g.l) : ''}
      ${g.l.length ? `<div class="ped-lista">${g.l.map(o => cardOS(o, g.f.k)).join('')}</div>` : `<div class="conf-nota ped-vazio">Nenhuma OS nesta fase.</div>`}
    </section>`).join('');
}
function pedBlocoProximoNumero(){
  const n = proximoNumeroFabrica();
  return n ? `<div class="ped-num">🔢 Próximo nº de pedido: <b>D${n}</b> (Decore) ou <b>R${n}</b> (Real) <span class="conf-nota">maior nº já usado: ${n - 1} · confira no Tiny se outra pessoa acabou de usar</span></div>` : '';
}
function pedBlocoConferencia(lista){
  return `<div class="ped-conf">${PED_FABRICAS.map(([k, nome]) => {
    const tem = lista.some(o => fabricasDaOS(o).includes(k));
    const u = ultimaConferencia(k);
    const dias = u ? pedDias(u.conferido_em) : null;
    const atrasada = tem && (dias === null || dias >= 2);
    return `<div class="ped-conf-f${atrasada ? ' atrasada' : ''}">
      <div><strong>🔎 ${nome}</strong><span>${tem ? lista.filter(o => fabricasDaOS(o).includes(k)).length + ' em produção · ' : 'nada em produção · '}${u ? 'conferida ' + (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias') + ' (' + escHtml(u.conferido_por || '') + ', ' + new Date(u.conferido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ')' : 'ainda não conferida'}</span></div>
      <div class="ped-conf-bt">${u && dias === 0 ? `<button type="button" class="conf-link" onclick="desfazerConferencia(${u.id})">desfazer</button>` : ''}
        <button type="button" class="conf-btn${atrasada ? ' ok' : ''}" onclick="conferirFabrica('${k}')">Conferi agora</button></div>
    </div>`; }).join('')}
    <div class="conf-nota">A cada 2 dias, veja no sistema da fábrica quais pedidos ficaram prontos (Decore: "término produção" · Real: "pronto/faturado"). As fábricas entregam às terças e quintas.</div></div>`;
}
function cardOS(o, fase){
  const desde = o.situacao_desde ? pedDias(o.situacao_desde) : 0;
  const prevista = o.data_prevista ? new Date(o.data_prevista + 'T12:00:00') : null;
  const atrasado = fase === 'producao' && prevista && prevista < new Date(new Date().toDateString());
  const orc = orcDaOS(o), fech = orc && typeof FECH_MAPA !== 'undefined' ? FECH_MAPA[orc.id] : null;
  const ag = ['pronto', 'agendado'].includes(fase) ? pedNaAgenda(o) : null;
  const cel = String(o.celular || '').replace(/\D/g, '');
  const msgPainel = (chave, texto, rotulo, campo) => PED_ABERTO.has(o.pedido_id + ':' + chave) ? `<div class="conf-painel">
      ${cel ? `<div class="conf-fones"><span class="conf-fone">${escHtml(o.celular)} <button type="button" class="conf-link" onclick="copiarNumero('${cel}', this)">copiar nº</button></span></div>` : ''}
      <textarea class="conf-msg" readonly rows="10">${escHtml(texto)}</textarea>
      <div class="conf-acoes"><button type="button" class="conf-btn" onclick="pedCopiar(this)">${ic('copiar',15)} Copiar mensagem</button>
        ${campo ? `<button type="button" class="conf-btn ok" onclick="pedMarcar(${o.pedido_id},'${campo}',true)">${ic('ok',15)} ${rotulo}</button>` : ''}
        <button type="button" class="conf-link" onclick="pedVer(${o.pedido_id},'${chave}')">fechar</button></div></div>` : '';
  let acoes = '';
  if(fase === 'pagar') acoes = orc ? `<button type="button" class="conf-link" onclick="reopenOrc(${orc.id})">ver fechamento ›</button>` : '';
  if(fase === 'fabrica') acoes = (fech && !fech.validado_em ? `<div class="ped-alerta">⚠️ Pagamento ainda não conferido no extrato pela Madeleine (Fechamento). Comprovante não é pagamento.</div>` : '') +
    `<div class="conf-nota">Faça o pedido no sistema da fábrica (Guia das Fábricas), anote o nº na OS do Tiny e mude para <b>"Preparando envio"</b>.</div>`;
  if(fase === 'producao') acoes = !o.numero_fabrica ? '<div class="ped-alerta">⚠️ OS sem nº da fábrica (D/R) no Tiny.</div>' : '';
  if(fase === 'pronto') acoes = `
    <div class="conf-ctrl">${o.em_maos_em
      ? `<span class="conf-st ok">🖐️ Conferido em mãos</span><span class="conf-nota">${escHtml((o.em_maos_por || '') + ' · ' + new Date(o.em_maos_em).toLocaleDateString('pt-BR'))}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'em_maos_em',false)">desfazer</button>`
      : `<button type="button" class="conf-btn" onclick="pedMarcar(${o.pedido_id},'em_maos_em',true)">🖐️ Itens conferidos em mãos</button>`}</div>
    <div class="conf-ctrl">${ag ? `<span class="conf-st env">📅 Na agenda: ${new Date(ag.inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>` : '<span class="conf-nota">Sem compromisso na agenda ainda.</span>'}
      <button type="button" class="conf-btn conf-wa" onclick="pedVer(${o.pedido_id},'agendar')">${ic('chat',15)} Mensagem: propor data</button></div>
    ${msgPainel('agendar', pedMsgAgendar(o), '', '')}
    <div class="conf-nota">Instalação só se confirma com o saldo pago (até 1 dia útil antes) e os itens conferidos em mãos. Agendado e confirmado → <b>"Enviado"</b> no Tiny.</div>`;
  if(fase === 'agendado') acoes = ag ? `<div class="conf-ctrl"><span class="conf-st env">📅 ${new Date(ag.inicio).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>` : '<span class="conf-nota">Não achei o compromisso na agenda dos próximos 45 dias.</span>';
  if(fase === 'entregue') acoes = o.avaliacao_em
    ? `<div class="conf-ctrl"><span class="conf-st ok">⭐ Avaliação pedida</span><span class="conf-nota">${escHtml((o.avaliacao_por || '') + ' · ' + new Date(o.avaliacao_em).toLocaleDateString('pt-BR'))}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'avaliacao_em',false)">desfazer</button></div>`
    : `<div class="conf-ctrl"><button type="button" class="conf-btn conf-wa" onclick="pedVer(${o.pedido_id},'avaliacao')">⭐ Mensagem: finalização e avaliação</button></div>${msgPainel('avaliacao', pedMsgAvaliacao(o), 'Já enviei', 'avaliacao_em')}
       <div class="conf-nota">Lembrete: nota fiscal (produto pelo Tiny, serviço pelo Tinus).</div>`;
  return `<div class="ped-card${atrasado ? ' atrasado' : ''}">
    <div class="gar-topo"><strong>${escHtml(o.cliente || 'Cliente')}</strong><span class="ped-os">OS ${escHtml(o.numero || '')}</span></div>
    <div class="gar-meta">${[o.numero_fabrica ? '🏷️ ' + escHtml(o.numero_fabrica) : '', o.valor ? reais(o.valor) : '', fase === 'entregue' && o.data_entrega ? 'instalado em ' + diaBR(o.data_entrega) : (desde ? 'nesta fase há ' + desde + (desde > 1 ? ' dias' : ' dia') : 'nesta fase desde hoje'),
      fase === 'producao' && prevista ? (atrasado ? '🔴 previsão ' + prevista.toLocaleDateString('pt-BR') + ' (atrasado)' : 'previsão ' + prevista.toLocaleDateString('pt-BR')) : '', orc ? numCDP(orc.numero) : ''].filter(Boolean).join(' · ')}</div>
    ${acoes}
  </div>`;
}

// ═════════ INÍCIO ═════════
function desenharPedidosInicio(){
  const box = document.getElementById('inicio-pedidos'); if(!box || !PED_CARREGADO) return;
  const n = (k) => PED_OS.filter(o => PED_FASES.find(f => f.k === k).sit.includes(Number(o.situacao)));
  const fabrica = n('fabrica'), producao = n('producao'), pronto = n('pronto'), entregue = n('entregue').filter(o => !o.avaliacao_em);
  const conferir = PED_FABRICAS.filter(([k]) => producao.some(o => fabricasDaOS(o).includes(k)) && (() => { const u = ultimaConferencia(k); return !u || pedDias(u.conferido_em) >= 2; })());
  const semMaos = pronto.filter(o => !o.em_maos_em);
  const linhas = [
    fabrica.length && ['fabrica', '🏭', fabrica.length + (fabrica.length > 1 ? ' OS para pedir na fábrica' : ' OS para pedir na fábrica'), 'próximo nº: ' + (proximoNumeroFabrica() || '—'), true],
    conferir.length && ['producao', '🔎', 'Conferir ' + conferir.map(c => c[1]).join(' e '), 'pedidos em produção · a cada 2 dias', true],
    pronto.length && ['pronto', '📦', pronto.length + (pronto.length > 1 ? ' prontos para agendar' : ' pronto para agendar'), semMaos.length ? semMaos.length + ' sem conferência em mãos' : 'itens conferidos', false],
    entregue.length && ['entregue', '⭐', entregue.length + (entregue.length > 1 ? ' pedidos de avaliação' : ' pedido de avaliação'), 'instalações dos últimos dias', false],
  ].filter(Boolean);
  if(!linhas.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>📦 Pedidos</span><button type="button" class="conf-link" onclick="abrirPedidos('todos')">ver todos ›</button></div>
    <div class="inicio-pend">${linhas.map(([k, em, tit, sub, urg]) => `
      <button type="button" class="inicio-pend-item pend-${urg ? 'atrasado' : 'enviar'}" onclick="abrirPedidos('${k}')">
        <span class="inicio-pend-ic">${em}</span>
        <span class="inicio-pend-txt"><strong>${escHtml(tit)}</strong><span>${escHtml(sub)}</span></span>
        <span class="inicio-pend-seta">›</span>
      </button>`).join('')}</div>
  </section>`;
}
async function carregarPedidosInicio(){
  if(PED_CARREGADO) desenharPedidosInicio();
  try{ await carregarPedidos(); desenharPedidosInicio(); }catch(e){ return; }
  try{ await sincronizarPedidos(); await carregarPedidos(); desenharPedidosInicio(); }catch(e){}
}
