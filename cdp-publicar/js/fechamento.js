// ═══════════════════════════════════════════════════════
// FECHAMENTO (cliente aprovou → OS → pagamento validado) — Etapa 4 do Guia de Processos
// Checklist na pasta do orçamento FECHADO + bloco no Início. Tabela fechamentos (um registro por orçamento).
// Passos: 1 dados p/ OS · 2 OS no Tiny (confere valor no Olist) · 3 OS + pagamento enviados · 4 aguardando
// pagamento (follow-up, comprovante) · 5 validação no extrato (só a Madeleine) · 6 pagamento confirmado.
// O banco grava quem e quando em cada passo; desmarcar = desfazer. Os dados do cliente ficam só no Olist.
// ═══════════════════════════════════════════════════════

const PIX_CHAVE = '11.360.869/0001-63';
let FECH_MAPA = {}, FECH_CARREGADO = false;
const FECH_ABERTO = new Set();          // mensagens abertas
let FECH_OLIST = {};                    // cadastro/OS lidos do Olist, por orçamento (só na tela)

const fechEhDona = () => { const a = (typeof AUTH !== 'undefined' && AUTH) || {}; return a.papel === 'dona'; };
const reais = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── banco ──
async function carregarFechamentos(){
  const r = await sbFetch('/rest/v1/fechamentos?select=*');
  if(!r.ok) throw new Error('fechamentos');
  FECH_MAPA = {}; (await r.json()).forEach(f => FECH_MAPA[f.orcamento_id] = f);
  FECH_CARREGADO = true;
}
async function gravarFechamento(orcId, campos){
  const atual = FECH_MAPA[orcId];
  const r = atual
    ? await sbFetch('/rest/v1/fechamentos?orcamento_id=eq.' + orcId, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(campos) })
    : await sbFetch('/rest/v1/fechamentos', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(Object.assign({ orcamento_id: orcId }, campos)) });
  if(!r.ok){
    const t = await r.text().catch(() => '');
    avisoTopo(/Madeleine/.test(t) ? 'Só a Madeleine confere o pagamento no extrato.' : 'Não foi possível salvar agora. Tente de novo.');
    throw new Error('fechamento');
  }
  const linha = (await r.json())[0]; if(linha) FECH_MAPA[orcId] = linha;
  return linha;
}
async function fechMarcar(orcId, passo, feito, extra){
  const campos = Object.assign({ [passo + '_em']: feito ? new Date().toISOString() : null }, extra || {});
  try{ await gravarFechamento(orcId, campos); }catch(e){ return; }
  [...FECH_ABERTO].filter(k => k.startsWith(orcId + ':')).forEach(k => FECH_ABERTO.delete(k));   // fecha as mensagens abertas deste orçamento
  redesenharFechamento();
}
async function fechCampo(orcId, campos){ try{ await gravarFechamento(orcId, campos); }catch(e){ return; } redesenharFechamento(); }
function redesenharFechamento(){
  if(document.body.dataset.tela === 'orc' || document.body.classList.contains('lado-a-lado')){ if(typeof renderStatus === 'function') renderStatus(); else renderFechamentoPasta(); }
  if(document.body.dataset.tela === 'inicio') desenharFechamentosInicio();
}

// ── 4h úteis (seg–sex 8h–12h e 14h–18h; sábado 8h–12h) ──
function somarHorasUteis(inicio, horas){
  const turnos = (d) => { const s = d.getDay(); if(s === 0) return []; if(s === 6) return [[8, 12]]; return [[8, 12], [14, 18]]; };
  let resta = horas * 60, d = new Date(inicio);
  for(let i = 0; i < 400 && resta > 0; i++){
    for(const [a, b] of turnos(d)){
      const ini = new Date(d); ini.setHours(a, 0, 0, 0); const fim = new Date(d); fim.setHours(b, 0, 0, 0);
      const de = d > ini ? d : ini; if(de >= fim) continue;
      const min = (fim - de) / 60000;
      if(min >= resta) return new Date(de.getTime() + resta * 60000);
      resta -= min; d = new Date(fim);
    }
    d = new Date(d); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
  }
  return d;
}

// ── mensagens (Guia de Mensagens, Etapa 4) ──
function fechMsgDados(e){
  return `*🎉 Vamos lá, ${primeiroNome(e.client)}! Para montar a sua Ordem de Serviço, preciso de alguns dados rápidos:*\n\n*Pessoa Física:*\nNome completo:\nCPF:\nE-mail:\n\n*Pessoa Jurídica:*\nRazão Social:\nCNPJ:\nE-mail:\nInscrição Estadual (se tiver):\n\n> Só confirmando: qual a forma de pagamento desejada?`;
}
function fechTotal(e, f){ return Number(f && f.os_valor ? f.os_valor : (f && f.forma_pagamento === 'cartao' ? e.totalCartao : e.totalAvista)) || 0; }
function fechMsgOS(e, f){
  const tot = fechTotal(e, f);
  let pg = '';
  if(f.forma_pagamento === 'pix'){
    const ent = Math.round(tot * 50) / 100, saldo = Math.round((tot - ent) * 100) / 100;
    pg = `\n\n💠 *Pagamento via PIX (15% de desconto):* total ${reais(tot)}\n• Entrada (50%): *${reais(ent)}*\n• Saldo (50%): *${reais(saldo)}*, até 1 dia útil antes da instalação\n\nA chave PIX vai na mensagem a seguir. 👇`;
  } else if(f.forma_pagamento === 'cartao'){
    pg = `\n\n💳 Segue o *link online* para pagamento em *cartão de crédito* 8x sem juros: ${f.link_cartao || '[inserir link gerado]'}\nTotal: *${reais(tot)}* (100% na entrada)`;
  }
  return `*Pronto, ${primeiroNome(e.client)}!*\n\n📄 Segue acima a *ordem de serviço* de acordo com as opções escolhidas para cada ambiente!${pg}\n\n> ✅ No aguardo da *sua conferência e OK*, bem como do *comprovante de pagamento*, para *prosseguirmos com o pedido na produção.*\n\n> *⚠️ Atenção especial: verifique em cada ambiente o que está sendo contemplado e contratado. Qualquer dúvida ou solicitação, é o momento de ajustar antes da produção!*`;
}
function fechMsgPix(){ return `💠 CENTRAL DAS PERSIANAS - CHAVE PIX 💠\nCNPJ: *${PIX_CHAVE}*`; }
function fechMsgFollowup(e){
  return `Olá, ${primeiroNome(e.client)}! Passando para confirmar se a Ordem de Serviço chegou certinho?\n\n*Antes de efetuar o pagamento, dá uma lida com calma em cada detalhe — ambiente, modelo, medidas. Se algo não estiver correto, é o momento de ajustar! Queremos que tudo saia perfeito para você. 🎯*\n\n> *Com dúvida em algum item, ou tudo certo e já pronto para o pagamento? Me avise!*`;
}
function fechMsgConfirmado(e){
  return `*✅ Pagamento confirmado com sucesso, ${primeiroNome(e.client)}! Muito obrigada.*\n\n🚀 Pedido será encaminhado para produção: em até 12 dias úteis (ou antes disso), estaremos realizando a entrega e instalação da sua cortina/persiana!\n\n> Assim que chegar em nosso showroom, entraremos em contato para agendar o melhor dia/horário! Lembrando que: o pagamento do saldo residual deverá ser realizado até 1 dia útil antes da instalação. (O agendamento da instalação será confirmado somente após a quitação do saldo residual).\n\nAté lá! ✨`;
}

// ── qual é o próximo passo ──
function fechProximo(e, f){
  f = f || {};
  if(!f.dados_ok_em) return { n: 1, txt: f.dados_pedidos_em ? 'Aguardando dados do cliente para a OS' : 'Pedir os dados para a OS' };
  if(!f.os_conferida_em) return { n: 2, txt: e.pedidoTiny ? 'Conferir a OS #' + e.pedidoTiny + ' no Tiny' : 'Gerar a OS no Tiny e informar o nº' };
  if(!f.os_enviada_em) return { n: 3, txt: 'Enviar a OS e a forma de pagamento' };
  if(!f.comprovante_em) return { n: 4, txt: 'Aguardando o pagamento do cliente' };
  if(!f.validado_em) return { n: 5, txt: 'Madeleine conferir o pagamento no extrato' };
  if(!f.confirmado_em) return { n: 6, txt: 'Avisar o cliente: pagamento confirmado' };
  return { n: 7, txt: 'Fechamento concluído · acompanhe em Pedidos' };
}

// ═════════ NA PASTA DO ORÇAMENTO FECHADO ═════════
async function renderFechamentoPasta(){
  const box = document.getElementById('pasta-fechamento'); if(!box) return;
  const e = (typeof orcEmEdicao === 'function') ? orcEmEdicao() : null;
  if(!e || e.etapa !== 'fechado'){ box.innerHTML = ''; return; }
  if(!FECH_CARREGADO){ box.innerHTML = '<div class="hist-empty">Carregando o fechamento…</div>'; try{ await carregarFechamentos(); }catch(err){ box.innerHTML = ''; return; } }
  const f = FECH_MAPA[e.id] || {};
  const prox = fechProximo(e, f);
  const id = e.id;
  const feito = (passo, rotulo) => `<div class="fc-feito">✅ ${rotulo} <span>${escHtml([f[passo + '_por'], f[passo + '_em'] ? new Date(f[passo + '_em']).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · '))}</span> <button type="button" class="conf-link" onclick="fechMarcar(${id},'${passo}',false)">desfazer</button></div>`;
  const msgBox = (chave, texto, rotuloEnviei, passo) => {
    const ab = FECH_ABERTO.has(id + ':' + chave);
    return `<button type="button" class="conf-btn conf-wa${ab ? ' on' : ''}" onclick="fechVer(${id},'${chave}')">${ic('chat',15)} ${ab ? 'Fechar mensagem' : 'Mensagem'}</button>
      ${ab ? `<div class="conf-painel">${e.telefone ? `<div class="conf-fones"><span class="conf-fone">${escHtml(e.telefone)} <button type="button" class="conf-link" onclick="copiarNumero('${escHtml(String(e.telefone).replace(/\D/g, ''))}', this)">copiar nº</button></span></div>` : ''}
        <textarea class="conf-msg" readonly rows="10">${escHtml(texto)}</textarea>
        <div class="conf-acoes"><button type="button" class="conf-btn" onclick="fechCopiar(this)">${ic('copiar',15)} Copiar mensagem</button>
        ${rotuloEnviei ? `<button type="button" class="conf-btn ok" onclick="fechMarcar(${id},'${passo}',true)">${ic('ok',15)} ${rotuloEnviei}</button>` : ''}</div></div>` : ''}`;
  };
  const passos = [];
  // 1 · dados
  const cad = FECH_OLIST[id] && FECH_OLIST[id].cadastro;
  passos.push(['🪪', 'Dados para a OS', !!f.dados_ok_em, f.dados_ok_em ? feito('dados_ok', 'Dados completos no Olist') : `
    <div class="fc-linha"><span class="gar-rot">Cliente é:</span>
      <button type="button" class="hist-chip${f.tipo_pessoa === 'pf' ? ' on' : ''}" onclick="fechCampo(${id},{tipo_pessoa:'pf'})">Pessoa física</button>
      <button type="button" class="hist-chip${f.tipo_pessoa === 'pj' ? ' on' : ''}" onclick="fechCampo(${id},{tipo_pessoa:'pj'})">Empresa (PJ)</button></div>
    <div class="fc-sub">${f.tipo_pessoa === 'pj' ? 'Precisa: razão social, CNPJ, e-mail, inscrição estadual (se tiver) e endereço completo com CEP.' : 'Precisa: nome completo, CPF, e-mail e endereço completo com CEP.'}</div>
    <div class="fc-olist" id="fc-olist-${id}">${cad ? fechTextoCadastro(cad, f.tipo_pessoa) : `<button type="button" class="conf-link" onclick="fechVerCadastro(${id})">🔎 ver o que já está no cadastro do Olist</button>`}</div>
    ${f.dados_pedidos_em ? feito('dados_pedidos', 'Dados pedidos ao cliente') : msgBox('dados', fechMsgDados(e), 'Já pedi os dados', 'dados_pedidos')}
    <div class="conf-acoes"><button type="button" class="conf-btn ok" onclick="fechMarcar(${id},'dados_ok',true)">${ic('ok',15)} Dados completos no Olist</button></div>`]);
  // 2 · OS no Tiny
  const os = FECH_OLIST[id] && FECH_OLIST[id].os;
  passos.push(['🧾', 'OS no Tiny', !!f.os_conferida_em, f.os_conferida_em ? feito('os_conferida', 'OS #' + escHtml(e.pedidoTiny || '') + (f.os_valor ? ' · ' + reais(f.os_valor) : '') + ' conferida') : `
    <div class="fc-sub">Gere a OS no Tiny a partir da proposta (Guia de Processos, Parte III) e salve o PDF na pasta IMPRESSÃO.</div>
    <div class="fc-linha"><input type="text" id="fc-os-${id}" class="fc-input" inputmode="numeric" placeholder="nº da OS no Tiny" value="${escHtml(e.pedidoTiny || '')}">
      <button type="button" class="conf-btn" onclick="fechConferirOS(${id})">🔎 Conferir no Olist</button></div>
    <div id="fc-os-res-${id}">${os ? fechTextoOS(e, os) : ''}</div>`]);
  // 3 · enviar OS + pagamento
  passos.push(['📤', 'Enviar OS e forma de pagamento', !!f.os_enviada_em, f.os_enviada_em ? feito('os_enviada', 'OS e pagamento enviados' + (f.forma_pagamento ? ' (' + (f.forma_pagamento === 'pix' ? 'PIX' : 'cartão') + ')' : '')) : `
    <div class="fc-linha"><span class="gar-rot">Pagamento:</span>
      <button type="button" class="hist-chip${f.forma_pagamento === 'pix' ? ' on' : ''}" onclick="fechCampo(${id},{forma_pagamento:'pix'})">💠 PIX · 15% (50% + 50%)</button>
      <button type="button" class="hist-chip${f.forma_pagamento === 'cartao' ? ' on' : ''}" onclick="fechCampo(${id},{forma_pagamento:'cartao'})">💳 Cartão · 5% (até 8x)</button></div>
    ${f.forma_pagamento ? `
      <div class="fc-linha"><span class="gar-rot">Total:</span><input type="text" class="fc-input fc-valor" inputmode="decimal" value="${fechTotal(e, f).toFixed(2).replace('.', ',')}" onchange="fechCampo(${id},{os_valor: Number(this.value.replace(/[^0-9,]/g,'').replace(',','.'))||null})">
        <span class="conf-nota">${f.os_valor ? 'valor da OS' : (f.forma_pagamento === 'pix' ? 'à vista do orçamento' : 'cartão do orçamento')}: confira com a OS</span></div>
      ${f.forma_pagamento === 'cartao' ? `<div class="fc-linha"><input type="url" class="fc-input" placeholder="cole aqui o link de pagamento do cartão (https://...)" value="${escHtml(f.link_cartao || '')}" onchange="fechCampo(${id},{link_cartao: this.value.trim() || null})"></div>` : ''}
      ${msgBox('os', fechMsgOS(e, f), f.forma_pagamento === 'pix' ? '' : 'Já enviei', 'os_enviada')}
      ${f.forma_pagamento === 'pix' ? `<div class="fc-sub">E a chave PIX numa mensagem separada (para o cliente copiar fácil):</div>${msgBox('pix', fechMsgPix(), 'Já enviei OS e chave', 'os_enviada')}` : ''}`
    : '<div class="fc-sub">Escolha a forma de pagamento para montar a mensagem com os valores.</div>'}`]);
  // 4 · aguardando pagamento
  passos.push(['⏳', 'Aguardando pagamento', !!f.comprovante_em, f.comprovante_em ? feito('comprovante', 'Cliente mandou o comprovante') : `
    <div class="fc-sub">${f.os_enviada_em ? 'OS enviada ' + fechHaQuanto(f.os_enviada_em) + '.' : ''} Sem resposta? Follow-up com a mensagem do Guia.</div>
    ${f.followup_em ? feito('followup', 'Follow-up feito') : msgBox('followup', fechMsgFollowup(e), 'Fiz o follow-up', 'followup')}
    <div class="conf-acoes"><button type="button" class="conf-btn ok" onclick="fechMarcar(${id},'comprovante',true)">${ic('ok',15)} Cliente mandou o comprovante</button></div>
    <div class="conf-nota">⚠️ Comprovante não é pagamento: a Madeleine confere no extrato antes da produção.</div>`]);
  // 5 · validação (só a Madeleine)
  const prazo = f.comprovante_em ? somarHorasUteis(f.comprovante_em, 4) : null;
  passos.push(['💳', 'Pagamento conferido no extrato', !!f.validado_em, f.validado_em ? (fechEhDona() ? feito('validado', 'Conferido no extrato') : `<div class="fc-feito">✅ Conferido no extrato <span>${escHtml([f.validado_por, new Date(f.validado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })].join(' · '))}</span></div>`) : `
    ${f.comprovante_em ? `<div class="fc-sub ${prazo < new Date() ? 'fc-atraso' : ''}">Prazo da Madeleine: até ${prazo.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })} (4h úteis).</div>` : '<div class="fc-sub">Depois do comprovante.</div>'}
    ${fechEhDona() ? `<div class="conf-acoes"><button type="button" class="conf-btn ok" ${f.comprovante_em ? '' : 'disabled'} onclick="fechMarcar(${id},'validado',true)">${ic('ok',15)} Conferi no extrato: pagamento entrou</button></div>` : '<div class="conf-nota">Só a Madeleine marca este passo.</div>'}`]);
  // 6 · confirmado
  passos.push(['✅', 'Pagamento confirmado ao cliente', !!f.confirmado_em, f.confirmado_em ? feito('confirmado', 'Cliente avisado') + '<div class="fc-sub">Agora: OS no grupo da equipe e status <b>"Aprovado"</b> no Tiny. A OS aparece em 📦 Pedidos → "Fazer pedido na fábrica".</div>' : `
    ${f.validado_em ? `${msgBox('confirmado', fechMsgConfirmado(e), 'Já enviei', 'confirmado')}
      <ul class="fc-lembrete"><li>📣 Publicar a OS no grupo de OS da equipe</li><li>🧾 Mudar a OS no Tiny para <b>"Aprovado"</b></li></ul>` : '<div class="fc-sub">Depois da conferência no extrato.</div>'}`]);

  box.innerHTML = `<section class="fc-card">
    <div class="fc-topo"><span>🤝 Fechamento</span><strong>${prox.n > 6 ? '✅ concluído' : 'passo ' + prox.n + ' de 6'}</strong></div>
    <div class="fc-prox">${prox.n > 6 ? '🎉 ' : '👉 '}${escHtml(prox.txt)}</div>
    <ol class="fc-passos">${passos.map(([em, tit, ok, corpo], i) => `
      <li class="fc-passo${ok ? ' ok' : ''}${i + 1 === prox.n ? ' atual' : ''}">
        <div class="fc-passo-tit"><span class="fc-n">${ok ? '✓' : i + 1}</span> ${em} ${escHtml(tit)}</div>
        ${ok || i + 1 === prox.n ? `<div class="fc-corpo">${corpo}</div>` : (i + 1 < prox.n ? `<div class="fc-corpo">${corpo}</div>` : '')}
      </li>`).join('')}</ol>
  </section>`;
}
function fechVer(id, chave){ const k = id + ':' + chave; if(FECH_ABERTO.has(k)) FECH_ABERTO.delete(k); else FECH_ABERTO.add(k); renderFechamentoPasta(); }
async function fechCopiar(botao){
  const t = botao.closest('.conf-painel').querySelector('.conf-msg').value;
  const ok = await copiarTexto(t);
  if(ok){ botao.innerHTML = ic('ok',15) + ' Copiada'; botao.classList.add('ok'); avisoTopo('Mensagem copiada. Cole no WhatsApp do cliente e volte para marcar.'); }
  else avisoTopo('Não consegui copiar sozinho: selecione o texto e copie.');
}
function fechHaQuanto(iso){
  const h = (Date.now() - new Date(iso)) / 36e5;
  return h < 1 ? 'há pouco' : h < 24 ? 'há ' + Math.round(h) + 'h' : 'há ' + Math.round(h / 24) + ' dia(s)';
}
// cadastro no Olist: o que já tem e o que falta
async function fechVerCadastro(id){
  const e = orcEmEdicao(); const box = $('fc-olist-' + id); if(!e || !box) return;
  box.innerHTML = '<span class="conf-nota">Procurando no Olist…</span>';
  try{
    const termo = String(e.telefone || '').replace(/\D/g, '').length >= 10 ? e.telefone : e.client;
    const d = await olistChamar('buscar', { termo }); const c0 = (d.clientes || [])[0];
    if(!c0){ box.innerHTML = '<span class="conf-nota">Cliente ainda não está no Olist: cadastre ao gerar a OS.</span>'; return; }
    const c = Object.assign({}, c0, ((await olistChamar('contato', { id: c0.id })) || {}).cliente || {});
    FECH_OLIST[id] = Object.assign(FECH_OLIST[id] || {}, { cadastro: c });
    if(!FECH_MAPA[id] || !FECH_MAPA[id].tipo_pessoa){ const tp = c.tipoPessoa === 'J' ? 'pj' : c.tipoPessoa === 'F' ? 'pf' : null; if(tp){ await fechCampo(id, { tipo_pessoa: tp }); return; } }
    box.innerHTML = fechTextoCadastro(c, (FECH_MAPA[id] || {}).tipo_pessoa);
  }catch(err){ box.innerHTML = '<span class="conf-nota">Olist indisponível agora.</span>'; }
}
function fechTextoCadastro(c, tipo){
  const doc = String(c.cpfCnpj || '').replace(/\D/g, '');
  const itens = [
    [tipo === 'pj' ? 'Razão social' : 'Nome completo', (c.nome || '').trim().split(/\s+/).length >= 2],
    [tipo === 'pj' ? 'CNPJ' : 'CPF', tipo === 'pj' ? doc.length === 14 : doc.length === 11],
    ['E-mail', /@/.test(c.email || '')],
    ['Endereço com número', !!(c.endereco && c.numero)],
    ['Bairro', !!c.bairro], ['CEP', String(c.cep || '').replace(/\D/g, '').length === 8],
  ];
  const falta = itens.filter(x => !x[1]).map(x => x[0]);
  return `<div class="fc-cad">${itens.map(([n, ok]) => `<span class="fc-cad-i ${ok ? 'ok' : 'falta'}">${ok ? '✓' : '✗'} ${n}</span>`).join('')}</div>
    <div class="conf-nota">${falta.length ? 'No Olist falta: ' + falta.join(', ') + '.' : 'Cadastro do Olist completo. 🎉'}</div>`;
}
// OS no Tiny: lê no Olist e compara o valor com o orçamento
async function fechConferirOS(id){
  const e = orcEmEdicao(); const n = ($('fc-os-' + id).value || '').replace(/\D/g, ''); const res = $('fc-os-res-' + id);
  if(!n){ res.innerHTML = '<span class="conf-nota">Informe o nº da OS (pedido de venda) do Tiny.</span>'; return; }
  res.innerHTML = '<span class="conf-nota">Lendo a OS no Olist…</span>';
  if(e.pedidoTiny !== n){ try{ await patchOrcamento({ pedido_tiny: n }); e.pedidoTiny = n; }catch(err){} }
  try{
    const d = await olistChamar('os_numero', { numero: n });
    if(!d.os){ res.innerHTML = '<span class="conf-nota">Não achei a OS #' + escHtml(n) + ' no Olist. Confira o número.</span>'; return; }
    FECH_OLIST[id] = Object.assign(FECH_OLIST[id] || {}, { os: d.os });
    res.innerHTML = fechTextoOS(e, d.os);
    if(typeof renderStatus === 'function') renderStatus();   // atualiza o nº da OS no aviso de fechado
  }catch(err){ res.innerHTML = '<span class="conf-nota">Olist indisponível agora.</span>'; }
}
function fechTextoOS(e, os){
  const v = Number(os.valor || 0);
  const perto = (a) => Math.abs(v - a) <= 1;
  const bate = perto(e.totalAvista) ? 'à vista' : perto(e.totalCartao) ? 'cartão' : perto(e.totalTabela) ? 'tabela' : '';
  const nomeOk = primeiroNome(os.cliente).toLowerCase() === primeiroNome(e.client).toLowerCase();
  return `<div class="fc-os ${bate && nomeOk ? 'ok' : 'alerta'}">
      <div><b>OS #${escHtml(os.numero)}</b> · ${escHtml(os.cliente)} · ${escHtml(os.situacao)}</div>
      <div>Valor da OS: <b>${reais(v)}</b> ${bate ? `✅ bate com o valor <b>${bate}</b> do orçamento` : `⚠️ não bate com o orçamento (à vista ${reais(e.totalAvista)} · cartão ${reais(e.totalCartao)} · tabela ${reais(e.totalTabela)})`}</div>
      ${nomeOk ? '' : '<div>⚠️ O nome do cliente na OS é diferente do orçamento.</div>'}
    </div>
    <div class="conf-acoes"><button type="button" class="conf-btn ok" onclick="fechMarcar(${e.id},'os_conferida',true,{os_valor:${v || 'null'}})">${ic('ok',15)} ${bate && nomeOk ? 'OS conferida' : 'Conferi, está certo assim'}</button></div>`;
}

// ═════════ INÍCIO ═════════
function fechamentosEmAndamento(){
  const lim = Date.now() - 45 * 864e5;
  return (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [])
    .filter(e => e.etapa === 'fechado' && (FECH_MAPA[e.id] ? !FECH_MAPA[e.id].confirmado_em : (e.fechadoEm && new Date(e.fechadoEm).getTime() > lim)));
}
function desenharFechamentosInicio(){
  const box = document.getElementById('inicio-fechamento'); if(!box) return;
  const l = fechamentosEmAndamento();
  const validar = l.filter(e => { const f = FECH_MAPA[e.id]; return f && f.comprovante_em && !f.validado_em; });
  if(!l.length){ box.innerHTML = ''; return; }
  const item = (e) => {
    const f = FECH_MAPA[e.id] || {}, p = fechProximo(e, f);
    const atrasoVal = p.n === 5 && somarHorasUteis(f.comprovante_em, 4) < new Date();
    return `<button type="button" class="inicio-pend-item pend-${atrasoVal ? 'atrasado' : 'enviar'}" onclick="reopenOrc(${e.id})">
      <span class="inicio-pend-ic">${p.n === 5 ? '💳' : '🤝'}</span>
      <span class="inicio-pend-txt"><strong>${escHtml(e.client)}</strong><span>${escHtml(numCDP(e.numero))} · passo ${p.n} de 6</span><em>${escHtml(p.txt)}${p.n === 5 ? ' · até ' + somarHorasUteis(f.comprovante_em, 4).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</em></span>
      <span class="inicio-pend-seta">›</span></button>`;
  };
  box.innerHTML = `${fechEhDona() && validar.length ? `<section class="inicio-bloco">
      <div class="inicio-bloco-tit"><span>💳 Validar pagamentos</span><strong>${validar.length} · prazo 4h úteis</strong></div>
      <div class="inicio-pend">${validar.map(item).join('')}</div></section>` : ''}
    <section class="inicio-bloco">
      <div class="inicio-bloco-tit"><span>🤝 Fechamentos em andamento</span><strong>${l.length}</strong></div>
      <div class="inicio-pend">${l.filter(e => !(fechEhDona() && validar.includes(e))).slice(0, 6).map(item).join('') || '<div class="conf-nota">Os que dependem de você estão acima.</div>'}</div>
    </section>`;
}
async function carregarFechamentosInicio(){
  if(FECH_CARREGADO) desenharFechamentosInicio();
  try{ await carregarFechamentos(); desenharFechamentosInicio(); }catch(e){}
}
