// ═══════════════════════════════════════════════════════
// GARANTIA E PÓS-VENDA (Fase 3 · 3D)
// A data da instalação vem do Olist (OS "Entregue", com a data real): o sistema não pede de novo.
// • Chamados de garantia (tabela garantias): relato, dentro/fora da garantia, prazo do 1º retorno
//   (mesmo dia útil), quem foi acionado (fábrica/ateliê/técnico) e a solução.
// • Pós-venda de 6 meses (tabela posvenda, preenchida pela função "olist"): mensagem para COPIAR,
//   e só o "Já enviei" registra. Toda ação tem desfazer.
// Garantia: 1 ano para produto novo, 3 meses para serviço. Fora da garantia ou sem cadastro: taxa de visita R$ 80,00.
// ═══════════════════════════════════════════════════════

const GAR_TAXA = 'R$ 80,00';
const GAR_STATUS = { aberto: 'Aberto', aguardando: 'Aguardando fábrica/ateliê', resolvido: 'Resolvido', nao_defeito: 'Não era defeito' };
const GAR_ACIONADO = { decore: 'Decore', real: 'Real', atelie: 'Ateliê', tecnico: 'Técnico' };
let GAR_LISTA = [], GAR_CARREGADO = false, GAR_FILTRO = 'abertos';
let PV_LISTA = [], PV_SINCRONIZADO = false;
const PV_ABERTO = new Set();

// ── datas ──
function diaLocal(iso){ return iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00') : null; }
function diaBR(iso){ const d = diaLocal(iso); return d ? d.toLocaleDateString('pt-BR') : ''; }
function fimGarantia(dataEntrega, tipo){
  const d = diaLocal(dataEntrega); if(!d) return null;
  if(tipo === 'servico') d.setMonth(d.getMonth() + 3); else d.setFullYear(d.getFullYear() + 1);
  return d;
}
// situação da garantia: 'dentro' | 'fora' | 'sem_cadastro' | 'sem_data'
function situacaoGarantia(g){
  if(g.sem_cadastro) return 'sem_cadastro';
  const fim = fimGarantia(g.data_entrega, g.tipo);
  if(!fim) return 'sem_data';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return fim >= hoje ? 'dentro' : 'fora';
}
// Primeiro retorno ao cliente: no mesmo dia útil (seg–sex até 18h, sábado até 12h).
// Chamado aberto depois das 17h (ou 11h no sábado), ou no domingo: até as 12h do próximo dia útil.
function prazoPrimeiroRetorno(agora){
  const d = new Date(agora || Date.now()), dow = d.getDay(), h = d.getHours();
  const proximoUtil = () => { const x = new Date(d); do { x.setDate(x.getDate() + 1); } while(x.getDay() === 0); x.setHours(12, 0, 0, 0); return x; };
  if(dow === 0) return proximoUtil();
  if(dow === 6){ if(h >= 11) return proximoUtil(); const x = new Date(d); x.setHours(12, 0, 0, 0); return x; }
  if(h >= 17) return proximoUtil();
  const x = new Date(d); x.setHours(18, 0, 0, 0); return x;
}
function textoPrazoRetorno(g){
  const p = new Date(g.prazo_retorno), agora = new Date();
  const hora = p.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const mesmoDia = p.toDateString() === agora.toDateString();
  const quando = mesmoDia ? 'hoje às ' + hora : p.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' às ' + hora;
  return (p < agora ? 'Atrasado: era até ' : 'Primeiro retorno até ') + quando;
}
const garAtrasado = (g) => !g.primeiro_retorno_em && g.prazo_retorno && new Date(g.prazo_retorno) < new Date() && ['aberto', 'aguardando'].includes(g.status);

// ── banco ──
async function carregarGarantias(){
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const r = await sbFetch('/rest/v1/garantias?select=*&or=(status.in.(aberto,aguardando),resolvido_em.gte.' + encodeURIComponent(desde) + ')&order=criado_em.desc');
  if(!r.ok) throw new Error('garantias');
  GAR_LISTA = await r.json(); GAR_CARREGADO = true;
}
async function salvarGarantia(corpo, id){
  const r = await sbFetch('/rest/v1/garantias' + (id ? '?id=eq.' + id : ''), {
    method: id ? 'PATCH' : 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(corpo) });
  if(!r.ok) throw new Error('salvar garantia');
  const linha = (await r.json())[0];
  if(linha){ const i = GAR_LISTA.findIndex(g => g.id === linha.id); if(i >= 0) GAR_LISTA[i] = linha; else GAR_LISTA.unshift(linha); }
  return linha;
}
const garAbertos = () => GAR_LISTA.filter(g => ['aberto', 'aguardando'].includes(g.status));

// ── mensagens (Guia de Mensagens) ──
function garMensagemTaxa(g){
  const nome = primeiroNome(g.cliente);
  const motivo = g.sem_cadastro
    ? '⚠️ Como não localizamos cadastro de compra em nosso sistema, a visita técnica será realizada para diagnóstico e conferência. *Caso se confirme que o produto não foi vendido/instalado pela Central das Persianas, ou não se enquadre em garantia, será cobrada uma taxa de visita técnica de ' + GAR_TAXA + ' (pix, ou cartão em 1x).*'
    : '⚠️ Como o prazo de garantia do seu pedido já se encerrou (garantia até ' + fimGarantia(g.data_entrega, g.tipo).toLocaleDateString('pt-BR') + '), a visita técnica será realizada para diagnóstico e conferência. *Será cobrada uma taxa de visita técnica de ' + GAR_TAXA + ' (pix, ou cartão em 1x).*';
  return `${nome ? nome + ', v' : 'V'}amos agendar a visita técnica para verificar a situação no local!\n\n*Só preciso deixar uma informação importante antes de agendarmos:*\n\n${motivo}\n\n✅ Caso opte por contratar algum serviço conosco (manutenção, reinstalação etc.), o valor da visita é *abatido integralmente* no valor do serviço, se for o caso, enviaremos aqui o valor do orçamento do serviço pra sua avaliação.\n\n> Podemos seguir com o agendamento nessas condições acima, você autoriza? 🗓`;
}
function pvMensagem(p){
  const nome = primeiroNome(p.cliente);
  return `*Olá${nome ? ', ' + nome : ''}! Tudo bem? 😊*\n\nJá faz 6 meses que instalamos suas cortinas/persianas e passamos para saber: está tudo funcionando direitinho?\n\nSe precisar de algum ajuste, limpeza ou manutenção, é só nos chamar por aqui. Será um prazer cuidar do seu espaço de novo! 🤝\n\n*Equipe Central das Persianas*`;
}

// ═════════ TELA "Garantia e pós-venda" ═════════
async function abrirGarantias(filtro){
  if(filtro) GAR_FILTRO = filtro;
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!confirmarSairOrc()) return; limparOrcamentoEmAndamento(); }
  irParaTab('gar'); window.scrollTo({ top: 0 });
  renderGarantias(true);
}
async function renderGarantias(recarregar){
  const box = $('gar-lista'); if(!box) return;
  if(recarregar || !GAR_CARREGADO){
    box.innerHTML = '<div class="hist-empty">Carregando…</div>';
    try{ await carregarGarantias(); }catch(e){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">' + ic('alerta',16) + ' Não foi possível carregar os chamados.</div>'; return; }
  }
  const ab = garAbertos(), atras = ab.filter(garAtrasado).length;
  $('gar-contagem').textContent = ab.length ? ab.length + (ab.length > 1 ? ' chamados abertos' : ' chamado aberto') + (atras ? ' · ' + atras + ' com retorno atrasado' : '') : 'Nenhum chamado aberto';
  const filtros = [['abertos', 'Abertos', ab.length], ['aguardando', 'Aguardando fábrica/ateliê', GAR_LISTA.filter(g => g.status === 'aguardando').length], ['resolvidos', 'Resolvidos (30 dias)', GAR_LISTA.filter(g => !['aberto', 'aguardando'].includes(g.status)).length]];
  $('gar-filtros').innerHTML = filtros.map(([k, t, n]) => `<button type="button" class="hist-chip${GAR_FILTRO === k ? ' on' : ''}" onclick="GAR_FILTRO='${k}';renderGarantias()">${t} <span>${n}</span></button>`).join('');
  let l = GAR_FILTRO === 'abertos' ? ab : GAR_FILTRO === 'aguardando' ? GAR_LISTA.filter(g => g.status === 'aguardando') : GAR_LISTA.filter(g => !['aberto', 'aguardando'].includes(g.status));
  l = l.slice().sort((a, b) => (garAtrasado(b) - garAtrasado(a)) || String(a.prazo_retorno || '').localeCompare(String(b.prazo_retorno || '')));
  box.innerHTML = l.length ? l.map(cardGarantia).join('') : `<div class="hist-empty">${GAR_FILTRO === 'resolvidos' ? 'Nenhum chamado resolvido nos últimos 30 dias.' : 'Nenhum chamado aqui. ' + ic('ok',16)}</div>`;
}
function seloGarantia(g){
  const s = situacaoGarantia(g);
  if(s === 'dentro') return `<span class="gar-selo ok">${ic('escudo',13)} Na garantia até ${fimGarantia(g.data_entrega, g.tipo).toLocaleDateString('pt-BR')}</span>`;
  if(s === 'fora') return `<span class="gar-selo fora">${ic('alerta',13)} Fora da garantia (até ${fimGarantia(g.data_entrega, g.tipo).toLocaleDateString('pt-BR')}) · taxa ${GAR_TAXA}</span>`;
  if(s === 'sem_cadastro') return `<span class="gar-selo fora">${ic('alerta',13)} Cadastro não localizado · taxa ${GAR_TAXA} se não for nosso</span>`;
  return `<span class="gar-selo">Sem data de instalação</span>`;
}
function cardGarantia(g){
  const aberto = ['aberto', 'aguardando'].includes(g.status), atras = garAtrasado(g);
  const quem = [g.criado_por, new Date(g.criado_em).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ');
  return `<div class="gar-card${atras ? ' atrasado' : ''}${aberto ? '' : ' fechado'}">
    <div class="gar-topo"><strong>${escHtml(g.cliente)}</strong><span class="gar-st st-${g.status}">${escHtml(GAR_STATUS[g.status])}</span></div>
    <div class="gar-meta">${[g.pedido_numero ? 'OS ' + escHtml(g.pedido_numero) : '', g.data_entrega ? 'instalado em ' + diaBR(g.data_entrega) : '', g.tipo === 'servico' ? 'serviço' : 'produto novo', g.telefone ? escHtml(g.telefone) : ''].filter(Boolean).join(' · ')}</div>
    <div>${seloGarantia(g)}</div>
    <p class="gar-relato">${escHtml(g.relato)}${g.fotos ? ' <span class="gar-foto">📸 fotos no WhatsApp</span>' : ''}</p>
    ${aberto ? `<div class="gar-retorno">${g.primeiro_retorno_em
        ? `<span class="conf-st ok">✅ 1º retorno dado</span><span class="conf-nota">${new Date(g.primeiro_retorno_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><button type="button" class="conf-link" onclick="garRetorno(${g.id}, false)">desfazer</button>`
        : `<span class="gar-prazo${atras ? ' atrasado' : ''}">${ic('relogio',14)} ${escHtml(textoPrazoRetorno(g))}</span><button type="button" class="conf-btn ok" onclick="garRetorno(${g.id}, true)">${ic('ok',15)} Já dei o 1º retorno</button>`}</div>
      <div class="gar-linha"><span class="gar-rot">Acionado:</span>${Object.entries(GAR_ACIONADO).map(([k, t]) => `<button type="button" class="hist-chip${g.acionado === k ? ' on' : ''}" onclick="garAcionar(${g.id}, '${k}')">${t}</button>`).join('')}</div>
      ${situacaoGarantia(g) === 'fora' || situacaoGarantia(g) === 'sem_cadastro' ? `<button type="button" class="conf-link" onclick="garVerTaxa(${g.id})">mensagem da taxa de visita</button>` : ''}
      <div class="conf-acoes gar-acoes">
        <button type="button" class="conf-btn ok" onclick="garResolver(${g.id}, 'resolvido')">${ic('ok',15)} Resolvido</button>
        <button type="button" class="conf-btn" onclick="garResolver(${g.id}, 'nao_defeito')">Não era defeito</button>
        <button type="button" class="conf-link" onclick="editarGarantia(${g.id})">editar</button>
      </div>`
    : `<div class="gar-solucao"><b>${escHtml(GAR_STATUS[g.status])}${g.resolvido_em ? ' em ' + new Date(g.resolvido_em).toLocaleDateString('pt-BR') : ''}:</b> ${escHtml(g.solucao || '—')}</div>
      <button type="button" class="conf-link" onclick="garReabrir(${g.id})">reabrir (desfazer)</button>`}
    <div class="gar-quem">Aberto por ${escHtml(quem)}</div>
  </div>`;
}

// ── ações do cartão ──
async function garAtualizar(id, corpo, aviso){
  try{ await salvarGarantia(corpo, id); }catch(e){ avisoTopo('Não foi possível salvar agora. Tente de novo.'); return; }
  if(aviso) avisoTopo(aviso);
  renderGarantias(); garAtualizarInicio();
}
function garRetorno(id, feito){ garAtualizar(id, { primeiro_retorno_em: feito ? new Date().toISOString() : null }, feito ? 'Primeiro retorno registrado.' : 'Desfeito.'); }
function garAcionar(id, k){
  const g = GAR_LISTA.find(x => x.id === id); if(!g) return;
  const novo = g.acionado === k ? null : k;
  garAtualizar(id, { acionado: novo, status: novo && ['decore', 'real', 'atelie'].includes(novo) ? 'aguardando' : (g.status === 'aguardando' && !novo ? 'aberto' : g.status) });
}
function garResolver(id, status){
  const g = GAR_LISTA.find(x => x.id === id); if(!g) return;
  abrirModal(status === 'resolvido' ? 'Chamado resolvido' : 'Não era defeito', `
    <p class="gar-modal-cli"><strong>${escHtml(g.cliente)}</strong></p>
    <label class="novo-campo"><span>${status === 'resolvido' ? 'O que foi feito? <b>*</b>' : 'O que era? <b>*</b>'}</span>
      <textarea id="gar-solucao" rows="3" maxlength="500" placeholder="${status === 'resolvido' ? 'Ex.: Decore trocou o tecido; reinstalado pelo Cícero' : 'Ex.: mau uso, cordão enrolado; ajustado na visita (taxa cobrada)'}"></textarea></label>
    ${status === 'nao_defeito' && situacaoGarantia(g) !== 'dentro' ? `<p class="conf-nota">Lembrete: visita que não é defeito cobra a taxa de ${GAR_TAXA}.</p>` : ''}`,
    ic('ok',16) + ' Salvar', async () => {
      const sol = $('gar-solucao').value.trim();
      if(!sol){ $('modal-erro').textContent = 'Escreva em uma frase o que foi feito.'; return; }
      try{ await salvarGarantia({ status, solucao: sol }, id); }catch(e){ $('modal-erro').textContent = 'Não foi possível salvar. Tente de novo.'; return; }
      fecharModal(); avisoTopo('Chamado fechado. Se precisar, use "reabrir".'); renderGarantias(); garAtualizarInicio();
    });
}
function garReabrir(id){ garAtualizar(id, { status: 'aberto' }, 'Chamado reaberto.'); }
function garVerTaxa(id){
  const g = GAR_LISTA.find(x => x.id === id); if(!g) return;
  abrirModal('Mensagem da taxa de visita', `
    <p class="conf-nota">Copie, cole no WhatsApp do cliente e envie. (Guia de Mensagens: "Confirmação do agendamento, sempre avisando a taxa".)</p>
    <textarea class="conf-msg" id="gar-taxa-msg" readonly rows="12">${escHtml(garMensagemTaxa(g))}</textarea>`,
    ic('copiar',16) + ' Copiar mensagem', async () => {
      const ok = await copiarTexto($('gar-taxa-msg').value);
      fecharModal(); avisoTopo(ok ? 'Mensagem copiada. Cole no WhatsApp do cliente.' : 'Não consegui copiar sozinho: selecione o texto e copie.');
    });
}

// ═════════ NOVO CHAMADO (janela) ═════════
let GAR_FORM = {}, GAR_BUSCA_SEQ = 0, GAR_BUSCA_T = null, GAR_OLIST_RES = [];
function novaGarantia(base){
  GAR_FORM = Object.assign({ id: null, cliente: '', telefone: '', olist_contato_id: null, orcamento_id: null, pedido_numero: '', data_entrega: null,
    tipo: 'produto', sem_cadastro: false, relato: '', fotos: false, pedidos: null }, base || {});
  abrirFormGarantia('Garantia / problema');
}
function editarGarantia(id){
  const g = GAR_LISTA.find(x => x.id === id); if(!g) return;
  GAR_FORM = Object.assign({}, g, { pedidos: null });
  abrirFormGarantia('Editar chamado');
}
function abrirFormGarantia(titulo){
  const f = GAR_FORM;
  abrirModal(titulo, `
    ${f.id ? '' : `<div class="novo-campo"><span>Buscar o cliente no Olist <em>(nome, celular ou CPF)</em></span>
      <input type="search" id="gar-busca" autocomplete="off" placeholder="Ex.: Maria Souza ou 81 99999-0000" oninput="garDigitou(this.value)">
      <div id="gar-busca-res" class="olist-res"></div></div>`}
    <label class="novo-campo"><span>Cliente <b>*</b></span>
      <input type="text" id="gar-cliente" autocomplete="off" value="${escHtml(f.cliente)}" placeholder="Nome do cliente"></label>
    <label class="novo-campo"><span>WhatsApp</span>
      <input type="tel" id="gar-tel" inputmode="tel" autocomplete="off" value="${escHtml(f.telefone || '')}" placeholder="(81) 9 0000-0000" oninput="mascaraTel(this)"></label>
    <div id="gar-os"></div>
    <div class="novo-campo"><span>O que foi instalado</span>
      <div class="ret-chips"><button type="button" class="hist-chip${f.tipo === 'produto' ? ' on' : ''}" onclick="garTipo('produto', this)">Produto novo · 1 ano</button><button type="button" class="hist-chip${f.tipo === 'servico' ? ' on' : ''}" onclick="garTipo('servico', this)">Serviço · 3 meses</button></div></div>
    <div id="gar-situacao" class="gar-situacao"></div>
    <label class="novo-campo"><span>O que o cliente relatou? <b>*</b></span>
      <textarea id="gar-relato" rows="3" maxlength="600" placeholder="Ex.: rolô da sala não sobe; motor faz barulho">${escHtml(f.relato)}</textarea></label>
    <label class="gar-check"><input type="checkbox" id="gar-fotos" ${f.fotos ? 'checked' : ''}> Cliente já mandou fotos no WhatsApp</label>`,
    ic('ok',16) + (f.id ? ' Salvar' : ' Abrir chamado'), confirmarGarantia);
  garDesenharOS(); garDesenharSituacao();
}
function garDigitou(v){
  clearTimeout(GAR_BUSCA_T);
  const res = $('gar-busca-res'); const t = v.trim();
  if(t.length < 3){ res.innerHTML = ''; return; }
  res.innerHTML = '<div class="olist-msg">Buscando no Olist…</div>';
  GAR_BUSCA_T = setTimeout(async () => {
    const seq = ++GAR_BUSCA_SEQ;
    try{
      const d = await olistChamar('buscar', { termo: t }); if(seq !== GAR_BUSCA_SEQ) return;
      GAR_OLIST_RES = d.clientes || [];
      res.innerHTML = (GAR_OLIST_RES.length ? GAR_OLIST_RES.map((c, i) => `<button type="button" class="olist-item" onclick="garEscolher(${i})"><strong>${escHtml(c.nome)}</strong><span>${[c.celular || c.telefone, c.bairro, c.cidade].filter(Boolean).map(escHtml).join(' · ')}</span></button>`).join('') : '<div class="olist-msg">Nenhum cliente com esse nome no Olist.</div>')
        + `<button type="button" class="olist-item gar-semcad" onclick="garSemCadastro()"><strong>Cadastro não localizado</strong><span>O cliente não está no Olist (pode não ser produto nosso)</span></button>`;
    }catch(e){
      if(seq !== GAR_BUSCA_SEQ) return;
      res.innerHTML = '<div class="olist-msg">Busca do Olist indisponível agora. Preencha à mão.</div>';
    }
  }, 450);
}
async function garEscolher(i){
  let c = GAR_OLIST_RES[i]; if(!c) return;
  $('gar-busca-res').innerHTML = '<div class="olist-msg">Puxando as OS do cliente…</div>';
  try{ const d = await olistChamar('contato', { id: c.id }); if(d && d.cliente) c = Object.assign({}, c, Object.fromEntries(Object.entries(d.cliente).filter(([k, v]) => v))); }catch(e){}
  GAR_FORM.cliente = c.nome; GAR_FORM.olist_contato_id = c.id; GAR_FORM.sem_cadastro = false;
  $('gar-cliente').value = c.nome;
  const cel = c.celular || c.telefone; if(cel){ $('gar-tel').value = cel; mascaraTel($('gar-tel')); }
  const orc = (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).find(e => e.client && e.client.trim().toLowerCase() === c.nome.trim().toLowerCase());
  GAR_FORM.orcamento_id = orc ? orc.id : null;
  GAR_FORM.pedidos = 'carregando'; garDesenharOS();
  try{ GAR_FORM.pedidos = (await olistChamar('pedidos', { cpfCnpj: c.cpfCnpj || '', nome: c.nome })).pedidos || []; }
  catch(e){ GAR_FORM.pedidos = []; }
  const entregues = GAR_FORM.pedidos.filter(p => p.entregue && p.entrega).sort((a, b) => String(b.entrega).localeCompare(String(a.entrega)));   // a instalação mais recente primeiro
  if(entregues.length) garEscolherOS(entregues[0].numero, entregues[0].entrega);
  $('gar-busca-res').innerHTML = ''; $('gar-busca').value = '';
  garDesenharOS(); garDesenharSituacao();
}
function garSemCadastro(){
  GAR_FORM.sem_cadastro = true; GAR_FORM.olist_contato_id = null; GAR_FORM.pedidos = null; GAR_FORM.pedido_numero = ''; GAR_FORM.data_entrega = null;
  const t = $('gar-busca').value.trim(); if(t && !/\d{6,}/.test(t.replace(/\D/g, '')) && !$('gar-cliente').value) $('gar-cliente').value = t;
  $('gar-busca-res').innerHTML = ''; garDesenharOS(); garDesenharSituacao();
}
function garEscolherOS(numero, entrega){
  GAR_FORM.pedido_numero = String(numero || ''); GAR_FORM.data_entrega = entrega || null; GAR_FORM.sem_cadastro = false;
  garDesenharOS(); garDesenharSituacao();
}
function garTipo(t, btn){
  GAR_FORM.tipo = t; btn.parentNode.querySelectorAll('.hist-chip').forEach(b => b.classList.toggle('on', b === btn));
  garDesenharSituacao();
}
function garDesenharOS(){
  const box = $('gar-os'); if(!box) return;
  const f = GAR_FORM;
  if(f.sem_cadastro){ box.innerHTML = `<div class="gar-aviso">${ic('alerta',15)} Cadastro não localizado. <button type="button" class="conf-link" onclick="GAR_FORM.sem_cadastro=false;garDesenharOS();garDesenharSituacao()">desfazer</button></div>`; return; }
  if(f.pedidos === 'carregando'){ box.innerHTML = '<div class="olist-msg">Buscando as OS no Olist…</div>'; return; }
  if(Array.isArray(f.pedidos)){
    const l = f.pedidos;
    box.innerHTML = `<div class="novo-campo"><span>Qual OS? <em>(data de instalação vem do Olist)</em></span>${l.length
      ? `<div class="gar-os-lista">${l.map(p => `<button type="button" class="gar-os-item${String(p.numero) === f.pedido_numero ? ' on' : ''}" ${p.entregue && p.entrega ? `onclick="garEscolherOS('${escHtml(String(p.numero))}','${escHtml(p.entrega)}')"` : 'disabled'}>
          <strong>OS ${escHtml(String(p.numero))}</strong><span>${escHtml(p.situacao)}${p.entrega ? ' · instalado em ' + diaBR(p.entrega) : ''}</span></button>`).join('')}</div>`
      : '<div class="olist-msg">Nenhuma OS desse cliente no Olist.</div>'}</div>`;
    return;
  }
  box.innerHTML = f.pedido_numero || f.data_entrega
    ? `<div class="conf-nota">${f.pedido_numero ? 'OS ' + escHtml(f.pedido_numero) : ''}${f.data_entrega ? ' · instalado em ' + diaBR(f.data_entrega) : ''}</div>`
    : `<label class="novo-campo"><span>Data da instalação <em>(se não achou no Olist)</em></span><input type="date" id="gar-data" value="" onchange="GAR_FORM.data_entrega=this.value||null;garDesenharSituacao()"></label>`;
}
function garDesenharSituacao(){
  const box = $('gar-situacao'); if(!box) return;
  const s = situacaoGarantia(GAR_FORM);
  if(s === 'dentro') box.innerHTML = `<div class="gar-aviso ok">${ic('escudo',15)} <span><b>Dentro da garantia</b> (até ${fimGarantia(GAR_FORM.data_entrega, GAR_FORM.tipo).toLocaleDateString('pt-BR')}). Visita sem custo.</span></div>`;
  else if(s === 'fora') box.innerHTML = `<div class="gar-aviso fora">${ic('alerta',15)} <span><b>Fora da garantia</b> (venceu em ${fimGarantia(GAR_FORM.data_entrega, GAR_FORM.tipo).toLocaleDateString('pt-BR')}). Avise a <b>taxa de visita de ${GAR_TAXA}</b> antes de agendar. A mensagem pronta fica no chamado.</span></div>`;
  else if(s === 'sem_cadastro') box.innerHTML = `<div class="gar-aviso fora">${ic('alerta',15)} <span>Sem cadastro de compra: se não for produto nosso, ou não for defeito, cobra a <b>taxa de visita de ${GAR_TAXA}</b>. Avise antes de agendar.</span></div>`;
  else box.innerHTML = '';
}
async function confirmarGarantia(){
  const f = GAR_FORM, erro = $('modal-erro');
  const cliente = $('gar-cliente').value.trim(), relato = $('gar-relato').value.trim();
  if(!cliente || !relato){ erro.textContent = !cliente ? 'Informe o cliente (busque no Olist ou digite o nome).' : 'Escreva o que o cliente relatou.'; return; }
  const corpo = { cliente, relato, telefone: $('gar-tel').value.trim() || null, fotos: $('gar-fotos').checked, tipo: f.tipo,
    sem_cadastro: !!f.sem_cadastro, olist_contato_id: f.olist_contato_id || null, orcamento_id: f.orcamento_id || null,
    pedido_numero: f.pedido_numero || null, data_entrega: f.data_entrega || null };
  if(!f.id) corpo.prazo_retorno = prazoPrimeiroRetorno().toISOString();
  try{ await salvarGarantia(corpo, f.id); }
  catch(e){ erro.textContent = 'Não foi possível salvar. Verifique a conexão e tente de novo.'; return; }
  fecharModal();
  avisoTopo(f.id ? 'Chamado atualizado.' : 'Chamado aberto. Primeiro retorno ao cliente: ' + textoPrazoRetorno({ prazo_retorno: corpo.prazo_retorno }).replace(/^Primeiro retorno até /, 'até ') + '.');
  if(document.body.dataset.tela === 'gar') renderGarantias(); else garAtualizarInicio();
}

// ═════════ PÓS-VENDA DE 6 MESES ═════════
// Lista: instalados há 6 a 9 meses (data real do Olist), ainda sem contato; os marcados há pouco ficam visíveis para desfazer.
async function carregarPosvenda(){
  const hoje = new Date();
  const m6 = new Date(hoje); m6.setMonth(m6.getMonth() - 6);
  const m9 = new Date(hoje); m9.setMonth(m9.getMonth() - 9);
  const recente = new Date(Date.now() - 2 * 864e5).toISOString();
  const r = await sbFetch('/rest/v1/posvenda?select=*&data_entrega=lte.' + isoData(m6) + '&data_entrega=gte.' + isoData(m9) +
    '&or=(contato_em.is.null,contato_em.gte.' + encodeURIComponent(recente) + ')&order=data_entrega.asc');
  if(!r.ok) throw new Error('posvenda');
  PV_LISTA = await r.json();
}
async function sincronizarPosvenda(){
  if(PV_SINCRONIZADO) return;
  PV_SINCRONIZADO = true;
  try{ for(let i = 0; i < 2; i++){ const d = await olistChamar('posvenda'); if(!d || !d.faltam) break; } }catch(e){ /* sem Olist: usa o que já foi lido */ }
}
async function pvJaEnviei(id, feito){
  const r = await sbFetch('/rest/v1/posvenda?pedido_id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({ contato_em: feito ? new Date().toISOString() : null }) });
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); return; }
  const linha = (await r.json())[0]; const i = PV_LISTA.findIndex(p => p.pedido_id === id); if(linha && i >= 0) PV_LISTA[i] = linha;
  PV_ABERTO.delete(id);
  avisoTopo(feito ? 'Contato de 6 meses registrado.' : 'Desfeito: o cliente voltou para a lista.');
  desenharPosvenda();
}
function pvVer(id){ if(PV_ABERTO.has(id)) PV_ABERTO.delete(id); else PV_ABERTO.add(id); desenharPosvenda(); }
async function pvCopiar(id, botao){
  const p = PV_LISTA.find(x => x.pedido_id === id); if(!p) return;
  const ok = await copiarTexto(pvMensagem(p));
  if(ok){ avisoTopo('Mensagem copiada. Cole no WhatsApp do cliente, envie e volte aqui para tocar em "Já enviei".'); if(botao){ botao.innerHTML = ic('ok',15) + ' Copiada'; botao.classList.add('ok'); } }
  else avisoTopo('Não consegui copiar sozinho: selecione o texto da mensagem e copie.');
}
function itemPosvenda(p){
  const meses = Math.round((Date.now() - diaLocal(p.data_entrega)) / (30.44 * 864e5));
  const cel = String(p.celular || '').replace(/\D/g, '');
  const aberto = PV_ABERTO.has(p.pedido_id);
  const ctrl = p.contato_em
    ? `<div class="conf-ctrl"><span class="conf-st ok">✅ Contato feito</span><span class="conf-nota">${escHtml((p.contato_por || '') + ' · ' + horaCurta(p.contato_em))}</span><button type="button" class="conf-link" onclick="pvJaEnviei(${p.pedido_id}, false)">desfazer</button></div>`
    : `<div class="conf-ctrl"><button type="button" class="conf-btn conf-wa${aberto ? ' on' : ''}" onclick="pvVer(${p.pedido_id})">${ic('chat',15)} Mensagem de 6 meses</button></div>
      ${aberto ? `<div class="conf-painel">
        <div class="conf-fones">${cel ? `<span class="conf-fone">${escHtml(p.celular)} <button type="button" class="conf-link" onclick="copiarNumero('${cel}', this)">copiar nº</button></span>` : '<span class="conf-nota">sem celular no Olist</span>'}</div>
        <textarea class="conf-msg" readonly rows="9">${escHtml(pvMensagem(p))}</textarea>
        <div class="conf-acoes"><button type="button" class="conf-btn" onclick="pvCopiar(${p.pedido_id}, this)">${ic('copiar',15)} Copiar mensagem</button>
          <button type="button" class="conf-btn ok" onclick="pvJaEnviei(${p.pedido_id}, true)">${ic('ok',15)} Já enviei</button>
          <button type="button" class="conf-link" onclick="pvVer(${p.pedido_id})">fechar</button></div></div>` : ''}`;
  return `<div class="conf-item pv-item"><div class="conf-linha"><strong>${escHtml(p.cliente || 'Cliente')}</strong></div>
    <div class="conf-sub">Instalado em ${diaBR(p.data_entrega)} · ${meses} meses${p.numero ? ' · OS ' + escHtml(p.numero) : ''}</div>${ctrl}</div>`;
}
function desenharPosvenda(){
  const box = document.getElementById('inicio-posvenda'); if(!box) return;
  const pend = PV_LISTA.filter(p => !p.contato_em);
  if(!PV_LISTA.length){ box.innerHTML = ''; return; }
  const mostrar = PV_LISTA.slice(0, 8);
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>Pós-venda · 6 meses</span><strong>${pend.length ? pend.length + (pend.length > 1 ? ' para contatar' : ' para contatar') : 'tudo em dia'}</strong></div>
    <div class="conf-lista">${mostrar.map(itemPosvenda).join('')}</div>
    ${PV_LISTA.length > 8 ? `<div class="conf-nota pv-mais">E mais ${PV_LISTA.length - 8}. Conforme forem contatados, aparecem aqui.</div>` : ''}
  </section>`;
}

// ═════════ INÍCIO ═════════
function desenharGarantiasInicio(){
  const box = document.getElementById('inicio-garantia'); if(!box) return;
  const ab = garAbertos(); if(!ab.length){ box.innerHTML = ''; return; }
  const l = ab.slice().sort((a, b) => (garAtrasado(b) - garAtrasado(a)) || String(a.prazo_retorno || '').localeCompare(String(b.prazo_retorno || '')));
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>Garantia</span><strong>${ab.length} ${ab.length > 1 ? 'chamados abertos' : 'chamado aberto'}</strong></div>
    <div class="inicio-pend">${l.slice(0, 5).map(g => `
      <button type="button" class="inicio-pend-item pend-${garAtrasado(g) ? 'atrasado' : 'enviar'}" onclick="abrirGarantias('abertos')">
        <span class="inicio-pend-ic">${ic('escudo', 16)}</span>
        <span class="inicio-pend-txt"><strong>${escHtml(g.cliente)}</strong><span>${escHtml(g.relato)}</span><em>${escHtml(g.primeiro_retorno_em ? GAR_STATUS[g.status] : textoPrazoRetorno(g))}</em></span>
        <span class="inicio-pend-seta">›</span>
      </button>`).join('')}</div>
  </section>`;
}
async function garAtualizarInicio(){
  if(document.body.dataset.tela !== 'inicio') return;
  desenharGarantiasInicio(); desenharPosvenda();
}
async function carregarBlocosGarantia(){
  if(GAR_CARREGADO) desenharGarantiasInicio();
  if(PV_LISTA.length) desenharPosvenda();
  try{ await carregarGarantias(); desenharGarantiasInicio(); }catch(e){}
  try{ await carregarPosvenda(); desenharPosvenda(); }catch(e){}
  if(!PV_SINCRONIZADO){ await sincronizarPosvenda(); try{ await carregarPosvenda(); desenharPosvenda(); }catch(e){} }
}
