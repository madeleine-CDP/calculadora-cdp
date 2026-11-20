// ═══════════════════════════════════════════════════════
// PEDIDOS (Fase 4) — acompanha as OS do Tiny pelo status, sem registro em dobro.
// O status continua sendo mudado NO TINY; o sistema lê (função "olist", rota os → tabela os_acompanhamento)
// e diz o que fazer em cada fase:
//   0 Em aberto → aguardando pagamento (ver Fechamento)        3 Aprovado → fazer pedido na fábrica (próximo nº D/R)
//   4 Preparando envio → em produção: conferir as fábricas a cada 2 dias (uma vez por fábrica, tabela conferencias_fabrica)
//   7 Pronto para envio → conferir em mãos + agendar instalação (mensagem do Guia)
//   5 Enviado / 1 Faturado → instalação agendada            6 Entregue → pedir avaliação no Google (até 12 dias)
//   e NOTA FISCAL (últimos 30 dias): sem NF no Tiny → "Emitir NF"; com NF → "Enviar NF ao cliente" (Já enviei, com desfazer);
//   NF de serviço emitida fora do Tiny (Tinus) → "NF emitida fora do Tiny". A NF pode ter sido emitida antes da entrega.
// ═══════════════════════════════════════════════════════

const PED_FASES = [
  { k: 'pagar',    sit: [0],    em: ic('cartao', 16), tit: 'Aguardando pagamento' },
  { k: 'fabrica',  sit: [3],    em: ic('etiqueta', 16), tit: 'Fazer pedido na fábrica' },
  { k: 'producao', sit: [4],    em: ic('ferramenta', 16), tit: 'Em produção' },
  { k: 'pronto',   sit: [7],    em: ic('caixa', 16), tit: 'Pronto · agendar instalação' },
  { k: 'agendado', sit: [5, 1], em: ic('caminhao', 16), tit: 'Instalação agendada' },
  { k: 'entregue', sit: [6],    em: ic('ok', 16), tit: 'Entregues · avaliação e nota fiscal' },
];
const PED_FABRICAS = [['decore', 'Decore', 'D'], ['real', 'Real', 'R']];
let PED_OS = [], PED_NUMS = [], PED_CONF = [], SVC_MAPA = {}, PED_CARREGADO = false, PED_SINC_EM = 0, PED_FILTRO = 'todos', PED_AGENDA = null;
const PED_ABERTO = new Set();
const PED_MARCADAS = new Set();   // marcadas agora: continuam na tela (com desfazer) até recarregar a página

// ── dados ──
async function sincronizarPedidos(forcar){
  if(!forcar && Date.now() - PED_SINC_EM < 10 * 60000) return;   // lê o Olist no máximo a cada 10 min
  PED_SINC_EM = Date.now();
  try{ await olistChamar('os'); }catch(e){ PED_SINC_EM = 0; throw e; }
}
async function carregarPedidos(){
  const desde = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [r1, r2, r3, r4] = await Promise.all([
    sbFetch('/rest/v1/os_acompanhamento?select=*&or=(situacao.in.(0,3,4,7,5,1),and(situacao.eq.6,data_entrega.gte.' + desde + '))&order=situacao_desde.asc'),
    sbFetch('/rest/v1/conferencias_fabrica?select=*&order=conferido_em.desc&limit=30'),
    // todos os nºs de fábrica já usados (inclusive OS canceladas e entregues há mais tempo), para o próximo nº
    sbFetch('/rest/v1/os_acompanhamento?select=numero,numero_fabrica&numero_fabrica=not.is.null&order=data_venda.desc.nullslast&limit=400'),
    sbFetch('/rest/v1/servicos_os?select=*'),
  ]);
  if(!r1.ok) throw new Error('os');
  PED_OS = await r1.json(); PED_CONF = r2.ok ? await r2.json() : []; PED_NUMS = r3.ok ? await r3.json() : [];
  SVC_MAPA = {}; if(r4 && r4.ok) (await r4.json()).forEach(x => SVC_MAPA[x.pedido_id] = x);
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
// ── nota fiscal das entregues (situação da nota no Olist: 1 pendente, 3 cancelada, 5 rejeitada, 10 denegada = ainda não vale) ──
const NF_NAO_VALE = [1, 3, 5, 10];
function nfEstado(o){
  if(Number(o.situacao) !== 6) return null;
  const emitida = !!o.nf_fora_em || (!!o.nf_id && !NF_NAO_VALE.includes(Number(o.nf_situacao)));
  if(!emitida) return 'emitir';
  return o.nf_enviada_em ? 'ok' : 'enviar';
}
const NF_SIT_NOME = { 1: 'pendente', 3: 'cancelada', 5: 'rejeitada', 10: 'denegada' };
// avaliação: só para instalações dos últimos 12 dias
function avaliacaoPendente(o){
  if(Number(o.situacao) !== 6 || o.avaliacao_em) return false;
  const ref = o.data_entrega ? new Date(o.data_entrega + 'T12:00:00') : (o.situacao_desde ? new Date(o.situacao_desde) : null);
  return !ref || Date.now() - ref.getTime() <= 12 * 864e5;
}
// OS de cada fase; nas entregues, só as que ainda pedem alguma ação (avaliação ou nota fiscal)
function pedNaFase(f){
  return PED_OS.filter(o => f.sit.includes(Number(o.situacao)) && (f.k === 'entregue' || !svcSoServico(o)) && (f.k !== 'entregue' || avaliacaoPendente(o) || nfEstado(o) !== 'ok' || PED_MARCADAS.has(o.pedido_id)));
}
const pedDias = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : 0;
const pedNomeChave = (n) => String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(x => x.length > 2);
// compromisso na agenda para o cliente (nome e sobrenome no título)
function pedNaAgenda(o){
  if(!PED_AGENDA) return null;
  const ch = pedNomeChave(o.cliente); if(!ch.length) return null;
  const alvo = ch.slice(0, 2);
  return PED_AGENDA.find(ev => { const t = pedNomeChave(ev.titulo).join(' '); return alvo.every(p => t.includes(p)); }) || null;
}
// próximo nº de pedido na fábrica: maior nº já usado NAQUELA fábrica + 1. Decore (D) e Real (R) têm sequências separadas
// (conferido nos pedidos do Olist em 19/11/2026: D2325 e R2301 eram os últimos). Lê todas as OS, inclusive canceladas.
function maiorNumeroFabrica(letra){
  const fonte = (PED_NUMS.length ? PED_NUMS : PED_OS);
  const nums = fonte.flatMap(o => String(o.numero_fabrica || '').toUpperCase().match(new RegExp('\\b' + letra + '\\d{3,5}\\b', 'g')) || []).map(x => Number(x.slice(1)));
  return nums.length ? Math.max(...nums) : null;
}
function proximoNumeroFabrica(letra){ const m = maiorNumeroFabrica(letra); return m ? m + 1 : null; }
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

// ── pagamento de cada OS: entrada (ou total) libera a produção; saldo libera a instalação (pedido da Bru, 19/11/2026) ──
// Entrada conferida = passo 5 do Fechamento OU marcada aqui (OS sem Fechamento no sistema).
// Saldo: PIX/transferência/dinheiro = 50% + 50% (tem saldo); cartão = 100% na entrada (sem saldo). saldo_modo muda à mão ('tem'/'nao').
// Conferir no extrato: Madeleine, ou Bruna avisada por ela (o banco grava "Madeleine (marcado por Bruna)").
const pedPodeConferir = () => typeof fechPodeConferir === 'function' ? fechPodeConferir() : false;
function pedPagamento(o){
  const orc = orcDaOS(o), fech = orc && typeof FECH_MAPA !== 'undefined' ? FECH_MAPA[orc.id] : null;
  const forma = fech && fech.forma_pagamento || null;
  const daOS = !!o.entrada_validado_em;
  const entradaOk = daOS || !!(fech && fech.validado_em);
  const temSaldo = o.saldo_modo ? o.saldo_modo === 'tem' : forma !== 'cartao';
  const total = Number(o.valor) || 0;
  return {
    orc, fech, forma, entradaOk, entradaDaOS: daOS,
    entradaPor: daOS ? o.entrada_validado_por : fech && fech.validado_por, entradaEm: daOS ? o.entrada_validado_em : fech && fech.validado_em,
    comprovanteEntrada: !!(fech && fech.comprovante_em),
    temSaldo, saldoAuto: !o.saldo_modo, saldoValor: temSaldo && total ? Math.round(total / 2 * 100) / 100 : 0,
    saldoComp: !!o.saldo_comprovante_em, saldoOk: !!o.saldo_validado_em,
    producao: entradaOk, instalacao: entradaOk && (!temSaldo || !!o.saldo_validado_em),
  };
}
const pedQuando = (por, em) => escHtml([por, em ? new Date(em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''].filter(Boolean).join(' · '));
// faixa curta (uma linha) para os cartões
function pedFaixaPagamento(o){
  const g = pedPagamento(o);
  const ent = g.entradaOk ? `<span class="pg-ok">${g.temSaldo ? 'Entrada' : 'Total'}</span>` : `<span class="pg-pend">${g.temSaldo ? 'Entrada' : 'Total'}</span>`;
  const sal = !g.temSaldo ? '' : g.saldoOk ? '<span class="pg-ok">Saldo</span>' : g.saldoComp ? '<span class="pg-meio">Saldo · falta conferir</span>' : '<span class="pg-pend">Saldo</span>';
  return `<div class="pg-faixa">${ent}${sal}${g.forma ? `<span class="pg-forma">${g.forma === 'cartao' ? 'cartão' : 'PIX'}</span>` : ''}</div>`;
}
// bloco completo (fases em que o pagamento decide o próximo passo, e na tela do pedido)
function pedBlocoPagamento(o, fase){
  const g = pedPagamento(o), id = o.pedido_id, pode = pedPodeConferir();
  const rotConf = (typeof fechEhDona === 'function' && fechEhDona()) ? 'Conferi no extrato' : 'Madeleine conferiu';
  const nomeEnt = g.temSaldo ? 'Entrada' : 'Pagamento total';
  const linhaEnt = g.entradaOk
    ? `<div class="pg-linha ok"><span>${nomeEnt} conferid${g.temSaldo ? 'a' : 'o'} no extrato</span><em>${pedQuando(g.entradaPor, g.entradaEm)}${g.entradaDaOS ? '' : ' · pelo Fechamento'}</em>
        ${g.entradaDaOS && pode ? `<button type="button" class="conf-link" onclick="pedPag(${id},{entrada_validado_em:null},'Desfeito.')">desfazer</button>` : ''}</div>`
    : `<div class="pg-linha pend"><span>${nomeEnt} ainda não conferid${g.temSaldo ? 'a' : 'o'} no extrato</span>${g.comprovanteEntrada ? '<em>comprovante recebido (Fechamento)</em>' : ''}
        ${pode ? `<button type="button" class="conf-btn ok" onclick="pedPag(${id},{entrada_validado_em:new Date().toISOString()},'${g.temSaldo ? 'Entrada conferida' : 'Pagamento total conferido'}: pode ir para a produção.')">${ic('ok',15)} ${rotConf}</button>` : '<em>a Madeleine (ou a Bruna) marca</em>'}</div>`;
  let linhaSal;
  if(!g.temSaldo){
    linhaSal = `<div class="pg-linha neutro"><span>Sem saldo: ${g.forma === 'cartao' && g.saldoAuto ? 'cartão, 100% na entrada' : 'pago 100% na entrada'}</span>
      <button type="button" class="conf-link" onclick="pedPag(${id},{saldo_modo:'tem'},'Anotado: este pedido tem saldo a pagar.')">tem saldo a pagar?</button></div>`;
  } else if(g.saldoOk){
    linhaSal = `<div class="pg-linha ok"><span>Saldo conferido no extrato</span><em>${pedQuando(o.saldo_validado_por, o.saldo_validado_em)}</em>
      ${pode ? `<button type="button" class="conf-link" onclick="pedPag(${id},{saldo_validado_em:null},'Desfeito.')">desfazer</button>` : ''}</div>`;
  } else if(fase === 'fabrica' && !g.saldoComp){
    linhaSal = `<div class="pg-linha neutro"><span>Saldo${g.saldoValor ? ' de ' + reais(g.saldoValor) : ''}: cobrar antes da instalação</span>
      <button type="button" class="conf-link" onclick="pedPag(${id},{saldo_modo:'nao'},'Anotado: pago 100% na entrada.')">pago 100% na entrada?</button></div>`;
  } else {
    linhaSal = `<div class="pg-linha ${g.saldoComp ? 'meio' : 'pend'}"><span>${g.saldoComp ? 'Comprovante do saldo recebido · falta conferir' : 'Saldo' + (g.saldoValor ? ' de ' + reais(g.saldoValor) : '') + ' aguardando o cliente'}</span>
      ${g.saldoComp ? `<em>${pedQuando(o.saldo_comprovante_por, o.saldo_comprovante_em)}</em><button type="button" class="conf-link" onclick="pedPag(${id},{saldo_comprovante_em:null},'Desfeito.')">desfazer</button>`
        : `<button type="button" class="conf-btn" onclick="pedPag(${id},{saldo_comprovante_em:new Date().toISOString()},'Comprovante do saldo anotado. Agora a Madeleine confere no extrato.')">Cliente mandou o comprovante</button>`}
      ${pode ? `<button type="button" class="conf-btn ok" onclick="pedPag(${id},{saldo_validado_em:new Date().toISOString()},'Saldo conferido: pode confirmar a instalação.')">${ic('ok',15)} ${rotConf}</button>` : ''}
      ${g.saldoComp ? '' : `<button type="button" class="conf-link" onclick="pedPag(${id},{saldo_modo:'nao'},'Anotado: pago 100% na entrada.')">pago 100% na entrada?</button>`}</div>`;
  }
  let trava = '';
  if(fase === 'fabrica' && !g.producao) trava = `<div class="pg-trava">Não fazer o pedido na fábrica: ${nomeEnt.toLowerCase()} ainda não conferid${g.temSaldo ? 'a' : 'o'} no extrato. Comprovante não é pagamento.</div>`;
  if(['pronto', 'agendado'].includes(fase) || fase === 'detalhe') trava = g.instalacao
    ? (fase === 'detalhe' ? '' : '<div class="pg-livre">Pagamento completo: pode confirmar a instalação.</div>')
    : `<div class="pg-trava">Não confirmar a instalação: ${!g.entradaOk ? nomeEnt.toLowerCase() + ' ainda não conferid' + (g.temSaldo ? 'a' : 'o') : 'saldo' + (g.saldoValor ? ' de ' + reais(g.saldoValor) : '') + ' ainda não conferido'} no extrato.</div>`;
  return `<div class="pg-bloco">${trava}${linhaEnt}${linhaSal}</div>`;
}
async function pedPag(id, campos, msg){
  const r = await sbFetch('/rest/v1/os_acompanhamento?pedido_id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(campos) });
  if(!r.ok){ avisoTopo(r.status === 403 || r.status === 401 ? 'Só a Madeleine (ou a Bruna) marca o pagamento como conferido.' : 'Não foi possível registrar agora. Tente de novo.'); return; }
  const l = (await r.json())[0]; const i = PED_OS.findIndex(o => o.pedido_id === id); if(l && i >= 0) PED_OS[i] = l;
  PED_MARCADAS.add(id); avisoTopo(msg);
  pedRedesenhar();
  if(document.body.dataset.tela === 'pedv' && PEDV_ATUAL && Number(PEDV_ATUAL.id) === Number(id)){ const o = PED_OS.find(x => x.pedido_id === id); const box = $('pedv-conteudo'); if(box) box.innerHTML = desenharPedidoVenda(PEDV_ATUAL, o); }
  if(typeof redesenharConfirmacoes === 'function') redesenharConfirmacoes();
}
// instalação na agenda → OS do cliente (nome e sobrenome no título) e aviso de pagamento
function pedOSDoEvento(ev){
  const t = pedNomeChave(ev.titulo).join(' ');
  return PED_OS.find(o => Number(o.situacao) !== 6 && Number(o.situacao) !== 2 && (() => { const ch = pedNomeChave(o.cliente).slice(0, 2); return ch.length && ch.every(p => t.includes(p)); })()) || null;
}
function pedAvisoInstalacao(ev, tipo){
  if(!PED_CARREGADO || !/instala|entrega/i.test(tipo || '') || /manuten|lavagem/i.test(tipo || '')) return '';
  const o = pedOSDoEvento(ev);
  if(!o) return '<div class="pg-nota">Não achei a OS deste cliente para conferir o pagamento: confira no Tiny antes de confirmar.</div>';
  const g = pedPagamento(o);
  return g.instalacao ? `<div class="pg-livre">OS ${escHtml(o.numero)}: pagamento completo conferido.</div>`
    : `<div class="pg-trava">OS ${escHtml(o.numero)}: ${!g.entradaOk ? 'entrada não conferida' : 'saldo' + (g.saldoValor ? ' de ' + reais(g.saldoValor) : '') + (g.saldoComp ? ' com comprovante, falta a Madeleine conferir' : ' não conferido')}. Não confirmar a instalação.
       <button type="button" class="conf-link" onclick="abrirPedidoVenda(${o.pedido_id})">ver pedido ›</button></div>`;
}

// ═════════ OS DE SERVIÇO (acompanhamento; pedido urgente da Bru, 20/11/2026; sql/2026-11-servicos-os.sql) ═════════
// É OS de serviço: correção à mão (servicos_os.eh_servico) ou, automático, a tag "SERVIÇO" no Olist, ou item de serviço sem
// cortina/persiana nova (o servidor lê os itens: servico_tipos, tem_produto, marcado_servico). Com produto novo junto,
// a OS aparece nos dois lugares (fases de produto e Serviços); só serviço, sai das fases de produto (menos Entregues).
function svcEhServico(o){
  const s = SVC_MAPA[o.pedido_id];
  if(s && s.eh_servico !== null && s.eh_servico !== undefined) return !!s.eh_servico;
  return !!(o.marcado_servico || (o.servico_tipos && o.tem_produto === false));
}
const svcSoServico = (o) => svcEhServico(o) && !o.tem_produto;
const svcTipos = (o) => String(o.servico_tipos || '').split(',').map(t => t.trim()).filter(Boolean);
function svcEmAndamento(){
  return PED_OS.filter(o => svcEhServico(o) && Number(o.situacao) !== 2 && !(SVC_MAPA[o.pedido_id] || {}).concluido_em)
    .sort((a, b) => String(a.data_venda || '').localeCompare(String(b.data_venda || '')));
}
// etapas conforme as respostas (onde é feito; se precisa de peça)
function svcEtapas(s){
  const peca = s.precisa_peca ? [['peca_pedida', 'Peça pedida'], ['peca_chegou', 'Peça chegou na loja']] : [];
  if(s.local === 'loja') return [['retirada', 'Retirada (está na loja)'], ...peca, ['feito', 'Serviço feito na loja'], ['devolvido', 'Devolvido / instalado no cliente']];
  return [...peca, ['feito', 'Serviço feito no local']];
}
const svcDias = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : 0;
function svcSituacao(o){
  const s = SVC_MAPA[o.pedido_id] || {};
  if(!s.local || s.precisa_peca === null || s.precisa_peca === undefined) return { cls: 'novo', txt: '🆕 Responder: onde é feito e se precisa de peça' };
  const et = svcEtapas(s), prox = et.find(([k]) => !s[k + '_em']);
  if(!prox) return { cls: 'ok', txt: 'Tudo feito · falta concluir' };
  if(prox[0] === 'peca_chegou') return { cls: svcDias(s.peca_pedida_em) >= 7 ? 'atras' : 'espera', txt: 'Aguardando ' + (s.peca_desc || 'a peça') + (s.peca_fabrica ? ' (' + s.peca_fabrica + ')' : '') + (svcDias(s.peca_pedida_em) ? ' há ' + svcDias(s.peca_pedida_em) + (svcDias(s.peca_pedida_em) === 1 ? ' dia' : ' dias') : ' · pedida hoje') };
  if(prox[0] === 'peca_pedida') return { cls: 'agir', txt: 'Pedir a peça: ' + (s.peca_desc || 'definir qual') };
  if(prox[0] === 'retirada') return { cls: 'agir', txt: 'Agendar a retirada' };
  if(prox[0] === 'feito') return s.local === 'loja' ? { cls: 'agir', txt: 'Na loja: fazer o serviço' } : { cls: 'agir', txt: s.precisa_peca ? 'Peça chegou: agendar a visita' : 'Agendar a visita' };
  if(prox[0] === 'devolvido') return { cls: 'agir', txt: 'Pronto: agendar a devolução' };
  return { cls: 'agir', txt: prox[1] };
}
async function svcSalvar(id, campos, msg){
  const r = await sbFetch('/rest/v1/servicos_os?on_conflict=pedido_id', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(Object.assign({ pedido_id: id }, campos)) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); return false; }
  const l = (await r.json())[0]; if(l) SVC_MAPA[id] = l;
  PED_MARCADAS.add(id);
  if(msg) avisoTopo(msg);
  pedRedesenhar(); return true;
}
function svcMarcar(id, etapa, feito){
  const rot = (svcEtapas(SVC_MAPA[id] || {}).find(([k]) => k === etapa) || [, etapa])[1];
  svcSalvar(id, { [etapa + '_em']: feito ? new Date().toISOString() : null }, feito ? rot + ': registrado. <button type="button" class="aviso-desfazer" onclick="svcMarcar(' + id + ',\'' + etapa + '\',false)">desfazer</button>' : 'Desfeito.');
}
function svcSalvarPeca(id){
  const g = (k) => (($('svc-' + k + '-' + id) || {}).value || '').trim() || null;
  if(!g('desc')){ avisoTopo('Escreva qual peça, componente ou acessório.'); return; }
  svcSalvar(id, { precisa_peca: true, peca_desc: g('desc'), peca_fabrica: g('fab'), peca_pedido: g('ped') }, 'Peça anotada.');
}
function cardServico(o){
  const s = SVC_MAPA[o.pedido_id] || {}, id = o.pedido_id, sit = svcSituacao(o);
  const tipos = svcTipos(o), lavagem = tipos.includes('lavagem');
  const ag = typeof pedNaAgenda === 'function' ? pedNaAgenda(o) : null;
  const quando = (k) => escHtml([s[k + '_por'], s[k + '_em'] ? new Date(s[k + '_em']).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · '));
  // pergunta 1: onde
  const q1 = s.local
    ? `<div class="svc-resp"><span>${s.local === 'loja' ? 'Retirar e fazer na loja' : 'Feito no local (na casa do cliente)'}</span><button type="button" class="conf-link" onclick="svcSalvar(${id},{local:null})">mudar</button></div>`
    : `<div class="svc-perg"><b>Onde vai ser feito?</b><div class="svc-bts">
        <button type="button" class="conf-btn${lavagem ? '' : ' ok'}" onclick="svcSalvar(${id},{local:'local'})">No local</button>
        <button type="button" class="conf-btn${lavagem ? ' ok' : ''}" onclick="svcSalvar(${id},{local:'loja'})">Retirar e fazer na loja</button></div>
        ${lavagem ? '<span class="conf-nota">Lavagem: a cortina sempre é retirada.</span>' : ''}</div>`;
  // pergunta 2: peça
  let q2;
  if(s.precisa_peca === false) q2 = `<div class="svc-resp"><span>Não precisa de peça</span><button type="button" class="conf-link" onclick="svcSalvar(${id},{precisa_peca:null})">mudar</button></div>`;
  else if(s.precisa_peca === true && s.peca_desc && !s.editPeca) q2 = `<div class="svc-resp"><span>${escHtml(s.peca_desc)}${s.peca_fabrica ? ' · ' + escHtml(s.peca_fabrica) : ''}${s.peca_pedido ? ' · pedido ' + escHtml(s.peca_pedido) : ''}</span><button type="button" class="conf-link" onclick="SVC_MAPA[${id}].editPeca=true;pedRedesenhar()">editar</button></div>`;
  else if(s.precisa_peca === true) q2 = `<form class="svc-peca" onsubmit="event.preventDefault();svcSalvarPeca(${id})">
      <b>Qual peça, componente ou acessório?</b>
      <label class="sr-only" for="svc-desc-${id}">Peça</label><input id="svc-desc-${id}" maxlength="300" placeholder="Ex.: corda do mecanismo, suporte, motor" value="${escHtml(s.peca_desc || '')}">
      <div class="svc-peca-l"><label class="sr-only" for="svc-fab-${id}">De onde</label><select id="svc-fab-${id}">${['', 'Decore', 'Real', 'Ateliê', 'Outro fornecedor'].map(f => `<option value="${f}"${(s.peca_fabrica || '') === f ? ' selected' : ''}>${f || 'De onde?'}</option>`).join('')}</select>
        <label class="sr-only" for="svc-ped-${id}">Nº do pedido</label><input id="svc-ped-${id}" maxlength="60" placeholder="Nº do pedido (ex.: D2330)" value="${escHtml(s.peca_pedido || '')}">
        <button type="submit" class="conf-btn ok">Salvar</button><button type="button" class="conf-link" onclick="svcSalvar(${id},{precisa_peca:null})">cancelar</button></div></form>`;
  else q2 = `<div class="svc-perg"><b>Precisa de peça, componente ou acessório?</b><div class="svc-bts">
      <button type="button" class="conf-btn" onclick="svcSalvar(${id},{precisa_peca:false})">Não</button>
      <button type="button" class="conf-btn" onclick="svcSalvar(${id},{precisa_peca:true})">Sim</button></div></div>`;
  // etapas
  let etapas = '';
  if(s.local && (s.precisa_peca === false || (s.precisa_peca === true && s.peca_desc))){
    const et = svcEtapas(s), iProx = et.findIndex(([k]) => !s[k + '_em']);
    const precisaAgenda = (k) => (k === 'retirada' || k === 'devolvido' || (k === 'feito' && s.local === 'local'));
    etapas = `<div class="svc-etapas">${et.map(([k, rot], i) => {
      if(s[k + '_em']) return `<div class="svc-et ok"><span>${escHtml(rot)}</span><em>${quando(k)}</em><button type="button" class="conf-link" onclick="svcMarcar(${id},'${k}',false)">desfazer</button></div>`;
      if(i === iProx) return `<div class="svc-et prox"><button type="button" class="conf-btn ok" onclick="svcMarcar(${id},'${k}',true)">${escHtml(rot)}</button>
        ${precisaAgenda(k) ? (ag ? `<span class="conf-st env">Na agenda: ${escHtml(new Date(ag.inicio).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span>` : '<span class="conf-nota">Agende na Agenda CLIENTES CDP com o nome do cliente no título.</span>') : ''}</div>`;
      return `<div class="svc-et depois"><span>${escHtml(rot)}</span></div>`; }).join('')}
      ${iProx === -1 ? `<div class="svc-et prox"><button type="button" class="conf-btn ok" onclick="svcMarcar(${id},'concluido',true)">Concluir · garantia de 3 meses a partir de hoje</button></div>` : ''}</div>`;
  }
  return `<div class="ped-card svc-card svc-${sit.cls}">
    <div class="gar-topo"><strong>${escHtml(o.cliente || 'Cliente')}</strong><button type="button" class="ped-ver" onclick="abrirPedidoVenda(${id})">OS ${escHtml(o.numero || '')} · ver pedido ›</button></div>
    <div class="svc-tags">${(tipos.length ? tipos : ['serviço']).map(t => `<span>${escHtml(t)}</span>`).join('')}${o.tem_produto ? '<span class="prod">+ produto novo</span>' : ''}${o.marcado_servico ? '<span class="olist">tag SERVIÇO</span>' : ''}</div>
    ${o.itens_resumo ? `<div class="svc-itens">${escHtml(o.itens_resumo)}</div>` : ''}
    <div class="svc-sit">${escHtml(sit.txt)}</div>
    ${typeof pedFaixaPagamento === 'function' ? pedFaixaPagamento(o) : ''}
    ${q1}${q2}${etapas}
    <div class="svc-rodape"><span class="conf-nota">${escHtml(buscaSituacaoTiny(o))}${o.data_venda ? ' · OS de ' + escHtml(new Date(o.data_venda + 'T12:00:00').toLocaleDateString('pt-BR')) : ''}</span>
      <button type="button" class="conf-link" onclick="svcSalvar(${id},{eh_servico:false},'Tirado de Serviços. <button type=&quot;button&quot; class=&quot;aviso-desfazer&quot; onclick=&quot;svcSalvar(${id},{eh_servico:null})&quot;>desfazer</button>')">não é OS de serviço</button></div>
  </div>`;
}
const SIT_TINY = { 0: 'Em aberto no Tiny', 3: 'Aprovada no Tiny', 4: 'Preparando envio no Tiny', 7: 'Pronto para envio no Tiny', 5: 'Enviada no Tiny', 1: 'Faturada no Tiny', 6: 'Entregue no Tiny' };
const buscaSituacaoTiny = (o) => SIT_TINY[Number(o.situacao)] || '';
function pedBlocoServicos(){
  const l = svcEmAndamento();
  return `<section class="ped-grupo" id="ped-servicos">
    <div class="inicio-bloco-tit"><span>${ic('ferramenta',16)}Serviços em andamento</span><strong>${l.length}</strong></div>
    <div class="conf-nota svc-explica">OS com a tag SERVIÇO no Olist, ou com serviço e sem cortina/persiana nova. Responda onde é feito e se precisa de peça; o sistema monta as etapas.</div>
    ${l.length ? `<div class="ped-lista">${l.map(cardServico).join('')}</div>` : '<div class="conf-nota ped-vazio">Nenhuma OS de serviço em andamento.</div>'}
  </section>`;
}

// ── ações ──
async function pedMarcar(id, campo, feito){
  const r = await sbFetch('/rest/v1/os_acompanhamento?pedido_id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ [campo]: feito ? new Date().toISOString() : null }) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); return; }
  const l = (await r.json())[0]; const i = PED_OS.findIndex(o => o.pedido_id === id); if(l && i >= 0) PED_OS[i] = l;
  PED_ABERTO.delete(id + ':' + campo);
  if(feito){ PED_MARCADAS.add(id); avisoTopo('Registrado. <button type="button" class="aviso-desfazer" onclick="pedMarcar(' + id + ',\'' + campo + '\',false)">desfazer</button>'); }
  else avisoTopo('Desfeito.');
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
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!(await confirmarSairOrc())) return; limparOrcamentoEmAndamento(); }
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
  const grupos = PED_FASES.map(f => ({ f, l: pedNaFase(f) }));
  const lido = PED_OS.reduce((m, o) => o.lido_em > m ? o.lido_em : m, '');
  $('ped-sub').textContent = (PED_OS.filter(o => Number(o.situacao) !== 6).length) + ' OS em andamento' + (lido ? ' · lido do Olist às ' + new Date(lido).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  const nSvc = svcEmAndamento().length;
  $('ped-filtros').innerHTML = [['todos', 'Tudo', grupos.reduce((t, g) => t + g.l.length, 0) + nSvc], ['servicos', 'Serviços', nSvc]].concat(grupos.map(g => [g.f.k, g.f.em + ' ' + g.f.tit.split(' · ')[0], g.l.length]))
    .map(([k, t, n]) => `<button type="button" class="hist-chip${PED_FILTRO === k ? ' on' : ''}" onclick="PED_FILTRO='${k}';desenharPedidos()">${t} <span>${n}</span></button>`).join('');
  const mostrar = grupos.filter(g => PED_FILTRO === 'todos' || g.f.k === PED_FILTRO);
  box.innerHTML = (aviso ? `<div class="ag-aviso">${ic('info',16)} <span>${escHtml(aviso)}</span></div>` : '') + ((PED_FILTRO === 'todos' || PED_FILTRO === 'servicos') ? pedBlocoServicos() : '') + mostrar.map(g => `
    <section class="ped-grupo">
      <div class="inicio-bloco-tit"><span>${g.f.em} ${g.f.tit}</span><strong>${g.l.length}</strong></div>
      ${g.f.k === 'fabrica' && g.l.length ? pedBlocoProximoNumero() : ''}
      ${g.f.k === 'producao' ? pedBlocoConferencia(g.l) : ''}
      ${g.l.length ? `<div class="ped-lista">${g.l.map(o => cardOS(o, g.f.k)).join('')}</div>` : `<div class="conf-nota ped-vazio">Nenhuma OS nesta fase.</div>`}
    </section>`).join('');
}
function pedBlocoProximoNumero(){
  const d = proximoNumeroFabrica('D'), r = proximoNumeroFabrica('R');
  if(!d && !r) return '';
  return `<div class="ped-num">Próximo nº de pedido: ${d ? `<b>D${d}</b> (Decore)` : ''}${d && r ? ' · ' : ''}${r ? `<b>R${r}</b> (Real)` : ''}
    <span class="conf-nota">último usado: ${[d ? 'D' + (d - 1) : '', r ? 'R' + (r - 1) : ''].filter(Boolean).join(' e ')} · cada fábrica tem a sua sequência · confira no Tiny se outra pessoa acabou de usar</span></div>`;
}
function pedBlocoConferencia(lista){
  return `<div class="ped-conf">${PED_FABRICAS.map(([k, nome]) => {
    const tem = lista.some(o => fabricasDaOS(o).includes(k));
    const u = ultimaConferencia(k);
    const dias = u ? pedDias(u.conferido_em) : null;
    const atrasada = tem && (dias === null || dias >= 2);
    return `<div class="ped-conf-f${atrasada ? ' atrasada' : ''}">
      <div><strong>${nome}</strong><span>${tem ? lista.filter(o => fabricasDaOS(o).includes(k)).length + ' em produção · ' : 'nada em produção · '}${u ? 'conferida ' + (dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias') + ' (' + escHtml(u.conferido_por || '') + ', ' + new Date(u.conferido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ')' : 'ainda não conferida'}</span></div>
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
  if(fase === 'pagar'){
    const cb = (fech && typeof fechCobranca === 'function') ? fechCobranca(fech) : null;
    const st = !fech || !fech.os_enviada_em ? '<span class="conf-nota">OS ainda não marcada como enviada ao cliente (Fechamento, passo 3).</span>'
      : fech.comprovante_em ? '<span class="conf-st ok">Comprovante recebido · aguardando conferência da Madeleine</span>'
      : cb && cb.avisarDona ? `<span class="ped-alerta">${cb.dias} dias úteis sem pagamento: avisar a Madeleine</span>`
      : cb && cb.devida ? `<span class="conf-st env">Cobrar retorno do cliente hoje</span>`
      : `<span class="conf-nota">OS enviada · próxima cobrança ${cb ? fechDataCurta(cb.proxima) : ''}</span>`;
    acoes = pedFaixaPagamento(o) + (orc ? `<div class="conf-ctrl">${st}<button type="button" class="conf-link" onclick="reopenOrc(${orc.id})">ver fechamento ›</button></div>` : '');
  }
  if(fase === 'fabrica') acoes = pedBlocoPagamento(o, 'fabrica') +
    `<div class="conf-nota">Faça o pedido no sistema da fábrica (Guia das Fábricas), anote o nº na OS do Tiny e mude para <b>"Preparando envio"</b>.</div>`;
  if(fase === 'producao') acoes = pedFaixaPagamento(o) + (!o.numero_fabrica ? '<div class="pg-nota">Sem nº de fábrica (D/R): produção própria (tradicional em tecido) ou serviço.</div>' : '');
  if(fase === 'pronto') acoes = pedBlocoPagamento(o, 'pronto') + `
    <div class="conf-ctrl">${o.em_maos_em
      ? `<span class="conf-st ok">Conferido em mãos</span><span class="conf-nota">${escHtml((o.em_maos_por || '') + ' · ' + new Date(o.em_maos_em).toLocaleDateString('pt-BR'))}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'em_maos_em',false)">desfazer</button>`
      : `<button type="button" class="conf-btn" onclick="pedMarcar(${o.pedido_id},'em_maos_em',true)">Itens conferidos em mãos</button>`}</div>
    <div class="conf-ctrl">${ag ? `<span class="conf-st env">Na agenda: ${new Date(ag.inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>` : '<span class="conf-nota">Sem compromisso na agenda ainda.</span>'}
      <button type="button" class="conf-btn conf-wa" onclick="pedVer(${o.pedido_id},'agendar')">${ic('chat',15)} Mensagem: propor data</button></div>
    ${msgPainel('agendar', pedMsgAgendar(o), '', '')}
    <div class="conf-nota">Instalação só se confirma com o saldo pago (até 1 dia útil antes) e os itens conferidos em mãos. Agendado e confirmado → <b>"Enviado"</b> no Tiny.</div>`;
  if(fase === 'agendado') acoes = pedBlocoPagamento(o, 'agendado') + (ag ? `<div class="conf-ctrl"><span class="conf-st env">${new Date(ag.inicio).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>` : '<span class="conf-nota">Não achei o compromisso na agenda dos próximos 45 dias.</span>');
  if(fase === 'entregue'){
    const quando = (por, em) => escHtml([por, em ? new Date(em).toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' · '));
    const nf = nfEstado(o);
    const nfNome = o.nf_fora_em ? 'NF emitida fora do Tiny' : 'NF' + (o.nf_numero ? ' nº ' + escHtml(o.nf_numero) : '') + ' emitida';
    const nfBloco = nf === 'emitir'
      ? `<div class="ped-alerta">Nota fiscal ainda não emitida no Tiny${o.nf_id && NF_SIT_NOME[o.nf_situacao] ? ' (nota ' + NF_SIT_NOME[o.nf_situacao] + ')' : ''}: emitir e depois enviar ao cliente.</div>
         <div class="conf-ctrl"><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'nf_fora_em',true)">NF de serviço emitida fora do Tiny (Tinus)</button></div>`
      : `<div class="conf-ctrl"><span class="conf-st ok">${nfNome}</span>${o.nf_fora_em ? `<span class="conf-nota">${quando(o.nf_fora_por, o.nf_fora_em)}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'nf_fora_em',false)">desfazer</button>` : ''}</div>
         <div class="conf-ctrl">${o.nf_enviada_em
           ? (o.nf_enviada_por === 'Olist (e-mail)'
              ? `<span class="conf-st ok">NF enviada por e-mail pelo Olist</span><span class="conf-nota">cliente com e-mail no cadastro</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'nf_enviada_em',false)">não foi enviada</button>`
              : `<span class="conf-st ok">NF enviada ao cliente</span><span class="conf-nota">${quando(o.nf_enviada_por, o.nf_enviada_em)}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'nf_enviada_em',false)">desfazer</button>`)
           : `<span class="conf-st env">Enviar a NF ao cliente</span><button type="button" class="conf-btn ok" onclick="pedMarcar(${o.pedido_id},'nf_enviada_em',true)">${ic('ok',15)} Já enviei a NF</button>`}</div>`;
    const aval = o.avaliacao_em
      ? `<div class="conf-ctrl"><span class="conf-st ok">Avaliação pedida</span><span class="conf-nota">${quando(o.avaliacao_por, o.avaliacao_em)}</span><button type="button" class="conf-link" onclick="pedMarcar(${o.pedido_id},'avaliacao_em',false)">desfazer</button></div>`
      : avaliacaoPendente(o) ? `<div class="conf-ctrl"><button type="button" class="conf-btn conf-wa" onclick="pedVer(${o.pedido_id},'avaliacao')">Mensagem: finalização e avaliação</button></div>${msgPainel('avaliacao', pedMsgAvaliacao(o), 'Já enviei', 'avaliacao_em')}` : '';
    acoes = nfBloco + aval;
  }
  if(o.servico_tipos && !svcEhServico(o)) acoes += `<div class="conf-ctrl"><span class="conf-nota">Tem serviço (${escHtml(o.servico_tipos)}) junto</span><button type="button" class="conf-link" onclick="svcSalvar(${o.pedido_id},{eh_servico:true},'Agora aparece em Serviços.')">acompanhar como serviço</button></div>`;
  else if(svcEhServico(o)) acoes += `<div class="conf-ctrl"><span class="conf-nota">Também em Serviços</span><button type="button" class="conf-link" onclick="PED_FILTRO='servicos';desenharPedidos();window.scrollTo({top:0})">ver ›</button></div>`;
  return `<div class="ped-card${atrasado ? ' atrasado' : ''}">
    <div class="gar-topo"><strong>${escHtml(o.cliente || 'Cliente')}</strong><button type="button" class="ped-ver" onclick="abrirPedidoVenda(${o.pedido_id})">OS ${escHtml(o.numero || '')} · ver pedido ›</button></div>
    <div class="gar-meta">${[o.numero_fabrica ? '' + escHtml(o.numero_fabrica) : '', o.valor ? reais(o.valor) : '', fase === 'entregue' && o.data_entrega ? 'instalado em ' + diaBR(o.data_entrega) : (desde ? 'nesta fase há ' + desde + (desde > 1 ? ' dias' : ' dia') : 'nesta fase desde hoje'),
      fase === 'producao' && prevista ? (atrasado ? 'previsão ' + prevista.toLocaleDateString('pt-BR') + ' (atrasado)' : 'previsão ' + prevista.toLocaleDateString('pt-BR')) : '', orc ? numCDP(orc.numero) : ''].filter(Boolean).join(' · ')}</div>
    ${acoes}
  </div>`;
}

// ═════════ INÍCIO ═════════
function desenharPedidosInicio(){
  const box = document.getElementById('inicio-pedidos'); if(!box || !PED_CARREGADO) return;
  const n = (k) => PED_OS.filter(o => PED_FASES.find(f => f.k === k).sit.includes(Number(o.situacao)));
  const fabrica = n('fabrica'), producao = n('producao'), pronto = n('pronto'), entregue = n('entregue').filter(avaliacaoPendente);
  const nfEmitir = n('entregue').filter(o => nfEstado(o) === 'emitir'), nfEnviar = n('entregue').filter(o => nfEstado(o) === 'enviar');
  const conferir = PED_FABRICAS.filter(([k]) => producao.some(o => fabricasDaOS(o).includes(k)) && (() => { const u = ultimaConferencia(k); return !u || pedDias(u.conferido_em) >= 2; })());
  const semMaos = pronto.filter(o => !o.em_maos_em);
  const svc = svcEmAndamento(), svcSit = svc.map(svcSituacao);
  const svcN = (cls) => svcSit.filter(x => x.cls === cls).length;
  const travadas = PED_OS.filter(o => [7, 5, 1].includes(Number(o.situacao)) && !pedPagamento(o).instalacao);
  const saldoConferir = pedPodeConferir() ? PED_OS.filter(o => Number(o.situacao) !== 2 && o.saldo_comprovante_em && !o.saldo_validado_em) : [];
  const linhas = [
    svc.length && ['servicos', ic('ferramenta',16), svc.length + (svc.length > 1 ? ' OS de serviço em andamento' : ' OS de serviço em andamento'), [svcN('novo') && svcN('novo') + ' para responder', svcN('agir') && svcN('agir') + ' com próximo passo', svcN('espera') + svcN('atras') ? (svcN('espera') + svcN('atras')) + ' aguardando peça' : 0].filter(Boolean).join(' · ') || 'em dia', svcN('atras') + svcN('novo') > 0],
    saldoConferir.length && ['todos', ic('cartao',16), saldoConferir.length + (saldoConferir.length > 1 ? ' saldos para conferir no extrato' : ' saldo para conferir no extrato'), 'comprovante recebido · ' + saldoConferir.map(o => primeiroNome(o.cliente)).slice(0, 3).join(', '), true],
    travadas.length && ['todos', ic('alerta',16), travadas.length + (travadas.length > 1 ? ' instalações sem pagamento completo' : ' instalação sem pagamento completo'), 'não confirmar antes de conferir o saldo', true],
    fabrica.length && ['fabrica', ic('etiqueta',16), fabrica.length + (fabrica.length > 1 ? ' OS para pedir na fábrica' : ' OS para pedir na fábrica'), 'próximo nº: ' + ([proximoNumeroFabrica('D') && 'D' + proximoNumeroFabrica('D'), proximoNumeroFabrica('R') && 'R' + proximoNumeroFabrica('R')].filter(Boolean).join(' · ') || '—'), true],
    conferir.length && ['producao', ic('ver',16), 'Conferir ' + conferir.map(c => c[1]).join(' e '), 'pedidos em produção · a cada 2 dias', true],
    pronto.length && ['pronto', ic('caixa',16), pronto.length + (pronto.length > 1 ? ' prontos para agendar' : ' pronto para agendar'), semMaos.length ? semMaos.length + ' sem conferência em mãos' : 'itens conferidos', false],
    nfEmitir.length && ['entregue', ic('documento',16), nfEmitir.length + (nfEmitir.length > 1 ? ' notas fiscais para emitir' : ' nota fiscal para emitir'), 'pedidos entregues sem NF no Tiny', true],
    nfEnviar.length && ['entregue', ic('email',16), nfEnviar.length + (nfEnviar.length > 1 ? ' notas fiscais para enviar' : ' nota fiscal para enviar'), 'NF emitida · falta enviar ao cliente', false],
    entregue.length && ['entregue', ic('estrela',16), entregue.length + (entregue.length > 1 ? ' pedidos de avaliação' : ' pedido de avaliação'), 'instalações dos últimos dias', false],
  ].filter(Boolean);
  if(!linhas.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>${ic('caixa',16)}Pedidos</span><button type="button" class="conf-link" onclick="abrirPedidos('todos')">ver todos ›</button></div>
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

// ═════════ DETALHE DO PEDIDO DE VENDA (lido do Olist na hora, só leitura) ═════════
let PEDV_ATUAL = null, PEDV_SEQ = 0;
const PEDV_IC = { cliente: 'usuario', datas: 'calendario', itens: 'documento', pagamento: 'cartao', obs: 'chat' };
const pedvTit = (k, t, extra) => `<div class="pedv-tit"><span class="pedv-ic">${ic(PEDV_IC[k], 17)}</span><h2>${t}</h2>${extra || ''}</div>`;
const pedvFone = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.length === 11 ? `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}` : String(t || ''); };
const pedvQtd = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const pedvTxt = (t) => escHtml(String(t || '').trim()).replace(/\n/g, '<br>');
async function abrirPedidoVenda(id){
  const seq = ++PEDV_SEQ;
  irParaTab('pedv'); window.scrollTo({ top: 0 });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'ped'));
  const box = $('pedv-conteudo'); if(!box) return;
  const o = PED_OS.find(x => Number(x.pedido_id) === Number(id)) || null;
  box.innerHTML = pedvVoltar() + `<div class="hist-empty">Lendo o pedido${o && o.numero ? ' nº ' + escHtml(o.numero) : ''} no Olist…</div>`;
  try{
    const d = await olistChamar('pedido', { id });
    if(seq !== PEDV_SEQ) return;
    if(!d || !d.pedido){ box.innerHTML = pedvVoltar() + '<div class="hist-empty">Não achei este pedido no Olist.</div>'; return; }
    PEDV_ATUAL = d.pedido;
    box.innerHTML = desenharPedidoVenda(d.pedido, o);
  }catch(e){
    if(seq !== PEDV_SEQ) return;
    box.innerHTML = pedvVoltar() + `<div class="ag-aviso">${ic('info',16)} <span>${e.codigo === 'desconectado' ? 'Olist desconectado (Configurações → Conexões).' : 'O Olist não respondeu agora.'}</span></div>
      <div style="margin-top:10px"><button type="button" class="btn-outline" onclick="abrirPedidoVenda(${Number(id)})">Tentar de novo</button></div>`;
  }
}
function pedvVoltar(){ return `<button type="button" class="pedv-voltar" onclick="abrirPedidos()">‹ Pedidos</button>`; }
function desenharPedidoVenda(p, o){
  const c = p.cliente || {};
  const fase = o ? pedFase(o) : null;
  const orc = o ? orcDaOS(o) : null;
  const cel = String(c.celular || c.telefone || '').replace(/\D/g, '');
  const wa = cel ? 'https://wa.me/55' + (cel.length <= 9 ? '81' + cel : cel) : '';
  const fone = pedvFone(c.celular || c.telefone);
  const end = [c.endereco, c.bairro, c.cidade].filter(Boolean).join(' – ') + (c.cep ? ' · CEP ' + c.cep : '');
  const fab = p.numeroFabrica || (o && o.numero_fabrica) || '';
  const fech = orc && typeof FECH_MAPA !== 'undefined' ? FECH_MAPA[orc.id] : null;
  const parc = (p.pagamento && p.pagamento.parcelas) || [];
  const linhaCli = (r, v) => v ? `<dt>${r}</dt><dd>${v}</dd>` : '';
  const itens = p.itens || [];
  const descontoPct = p.subtotal > 0 && p.desconto > 0 ? Math.round(p.desconto / p.subtotal * 1000) / 10 : 0;
  return pedvVoltar() + `
  <div class="pedv-topo">
    <div class="pedv-cab">
      <div class="pedv-sobre">Pedido de venda · Olist</div>
      <h1>Pedido nº ${escHtml(p.numero)}</h1>
      <div class="pedv-chips">
        <span class="pedv-fase">${fase ? fase.em + ' ' + escHtml(fase.tit.split(' · ')[0]) : escHtml(p.situacao)}</span>
        ${fab ? `<span>Fábrica: <b>${escHtml(fab)}</b></span>` : ''}
        ${orc ? `<span>· Orçamento <button type="button" class="conf-link" onclick="reopenOrc(${orc.id})">${numCDP(orc.numero)}</button></span>` : ''}
      </div>
    </div>
    <div class="pedv-botoes">
      <button type="button" class="btn-outline pedv-bt" onclick="pedvCopiarResumo(this)">${ic('copiar',16)} Copiar resumo</button>
    </div>
  </div>
  <div class="pedv-total-cel"><div><span>Total do pedido</span><b>${reais(p.total)}</b></div><div><span>Previsão</span><b>${p.dataPrevista ? diaBR(p.dataPrevista) : '—'}</b></div></div>

  <div class="pedv-grade">
    <section class="pedv-q">
      ${pedvTit('cliente', 'Cliente')}
      <div class="pedv-nome">${escHtml(c.nome || (o && o.cliente) || 'Cliente')}</div>
      <dl class="pedv-dl">
        ${linhaCli(c.cpfCnpj && String(c.cpfCnpj).replace(/\D/g,'').length > 11 ? 'CNPJ' : 'CPF', escHtml(c.cpfCnpj))}
        ${linhaCli('WhatsApp', fone ? (wa ? `<a href="${wa}" target="_blank" rel="noopener">${escHtml(fone)}</a>` : escHtml(fone)) : '')}
        ${linhaCli('E-mail', escHtml(c.email))}
        ${linhaCli('Endereço', escHtml(end))}
      </dl>
    </section>
    <section class="pedv-q">
      ${pedvTit('datas', 'Datas')}
      <div class="pedv-datas">
        <div><span>Pedido</span><b>${p.data ? diaBR(p.data) : '—'}</b></div>
        <div class="dest"><span>Previsão de entrega</span><b>${p.dataPrevista ? diaBR(p.dataPrevista) : '—'}</b></div>
        <div><span>Entregue em</span><b>${p.dataEntrega ? diaBR(p.dataEntrega) : '—'}</b></div>
      </div>
      ${p.vendedor ? `<div class="pedv-nota">Vendedor(a): <b>${escHtml(p.vendedor)}</b></div>` : ''}
    </section>
  </div>

  <section class="pedv-q">
    ${pedvTit('itens', 'Itens', `<span class="pedv-cont">${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</span>`)}
    ${itens.length ? `<div class="pedv-tabela-wrap"><table class="pedv-tabela">
      <thead><tr><th>Produto ou serviço</th><th>Detalhamento</th><th class="n">Qtd.</th><th>Un.</th><th class="n">Preço unit.</th><th class="n">Total</th></tr></thead>
      <tbody>${itens.map(i => `<tr>
        <td class="pedv-prod"><b>${escHtml(i.descricao)}</b>${i.sku ? `<span>SKU ${escHtml(i.sku)}${i.tipo === 'S' ? ' · serviço' : ''}</span>` : ''}</td>
        <td class="pedv-det${i.detalhe ? '' : ' vazio'}">${pedvTxt(i.detalhe) || '<span class="pedv-nada">—</span>'}</td>
        <td class="n" data-r="Qtd.">${pedvQtd(i.quantidade)}</td><td data-r="Un.">${escHtml(i.unidade || '')}</td>
        <td class="n" data-r="Preço unit.">${reais(i.valorUnitario)}</td><td class="n pedv-tot" data-r="Total">${reais(i.total)}</td></tr>`).join('')}</tbody>
    </table></div>` : '<div class="pedv-nota">O pedido não tem itens no Olist.</div>'}
    <dl class="pedv-totais">
      <dt>Subtotal</dt><dd>${reais(p.subtotal)}</dd>
      ${p.desconto ? `<dt>Desconto${descontoPct ? ' (' + String(descontoPct).replace('.', ',') + '%)' : ''}</dt><dd class="desc">− ${reais(p.desconto)}</dd>` : '<dt>Desconto</dt><dd>R$ 0,00</dd>'}
      ${p.frete ? `<dt>Frete</dt><dd>${reais(p.frete)}</dd>` : ''}
      ${p.outras ? `<dt>Outras despesas</dt><dd>${reais(p.outras)}</dd>` : ''}
      <dt class="tot">Total</dt><dd class="tot">${reais(p.total)}</dd>
    </dl>
  </section>

  <div class="pedv-grade">
    <section class="pedv-q">
      ${pedvTit('pagamento', 'Pagamento')}
      <div class="pedv-forma">${[p.pagamento && p.pagamento.forma, p.pagamento && p.pagamento.meio].filter(Boolean).map(escHtml).join(' · ') || 'Forma de pagamento não informada no Olist'}${p.pagamento && p.pagamento.condicao ? ` <span class="pedv-nota">· ${escHtml(p.pagamento.condicao)}</span>` : ''}</div>
      ${parc.length ? `<div class="pedv-parcelas">${parc.map((x, n) => `
        <div class="pedv-parc${/\bok\b/i.test(x.obs || '') ? ' ok' : ''}">
          <span class="pedv-parc-n">${/\bok\b/i.test(x.obs || '') ? '✓' : (n + 1) + 'ª'}</span>
          <div><b>${x.data ? diaBR(x.data) : 'sem data'}${x.forma ? ' · ' + escHtml(x.forma) : ''}</b>${x.obs ? `<span>${escHtml(x.obs)}</span>` : ''}</div>
          <b class="pedv-parc-v">${reais(x.valor)}</b>
        </div>`).join('')}</div>` : '<div class="pedv-nota">Sem parcelas lançadas no Olist.</div>'}
      ${o ? pedBlocoPagamento(o, 'detalhe') : ''}
    </section>
    <section class="pedv-q">
      ${pedvTit('obs', 'Observações')}
      <div class="pedv-obs"><span>Observações do pedido</span><p>${pedvTxt(p.observacoes) || '<span class="pedv-nada">Nenhuma.</span>'}</p></div>
      <div class="pedv-obs"><span>Internas</span><p>${pedvTxt(p.observacoesInternas) || '<span class="pedv-nada">Nenhuma.</span>'}</p></div>
    </section>
  </div>
  <div class="pedv-rodape">Lido do Olist agora · para mudar algo, altere o pedido no Tiny.</div>`;
}
function pedvResumoTexto(p){
  const c = p.cliente || {};
  const l = [`*Pedido nº ${p.numero}*${p.numeroFabrica ? ' · Fábrica ' + p.numeroFabrica : ''}`, `Cliente: ${c.nome || ''}`];
  const fone = pedvFone(c.celular || c.telefone); if(fone) l.push('WhatsApp: ' + fone);
  const end = [c.endereco, c.bairro, c.cidade].filter(Boolean).join(' – '); if(end) l.push('Endereço: ' + end);
  l.push(`Pedido: ${p.data ? diaBR(p.data) : '—'} · Previsão: ${p.dataPrevista ? diaBR(p.dataPrevista) : '—'}`, '', '*Itens*');
  (p.itens || []).forEach(i => { l.push(`• ${pedvQtd(i.quantidade)} ${i.unidade || ''} ${i.descricao}`.replace(/\s+/g, ' ')); if(i.detalhe) l.push('  ' + String(i.detalhe).trim()); });
  l.push('', `Total: ${reais(p.total)}${p.desconto ? ' (desconto ' + reais(p.desconto) + ')' : ''}`);
  if(p.observacoes) l.push('', 'Obs.: ' + String(p.observacoes).trim());
  return l.join('\n');
}
async function pedvCopiarResumo(botao){
  if(!PEDV_ATUAL) return;
  const ok = await copiarTexto(pedvResumoTexto(PEDV_ATUAL));
  if(ok){ botao.innerHTML = ic('ok',16) + ' Copiado'; avisoTopo('Resumo copiado. Cole no grupo ou no WhatsApp.'); }
  else avisoTopo('Não consegui copiar sozinho.');
}
