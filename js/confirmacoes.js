// ═══════════════════════════════════════════════════════
// CONFIRMAÇÃO DO DIA SEGUINTE (Fase 3 · 3C)
// Lista os compromissos de cliente do próximo dia útil (na sexta: sábado + segunda; dia com FERIADO é pulado)
// e abre o WhatsApp do cliente com a mensagem do Guia de Mensagens já preenchida.
// O controle (lembrete enviado / confirmou / quer reagendar) fica na tabela agenda_confirmacoes.
// A agenda do Google NÃO é alterada.
// ═══════════════════════════════════════════════════════
let CONF_MAPA = {};          // evento_id → linha de agenda_confirmacoes
let CONF_EVENTOS = [];       // compromissos de cliente dos dias a confirmar
let CONF_DIAS = [];          // datas (Date) a confirmar

// Compromisso com cliente (fica de fora: curso, buscar mostruário, feriado, "Entrega Jones"...)
function ehCompromissoDeCliente(ev, p){
  p = p || lerTitulo(ev.titulo);
  if(!p.cliente || p.tipo === 'Feriado') return false;
  if(/^entrega\s+jones\b/i.test(String(ev.titulo).trim())) return false;
  return /visita|instala|manuten|entrega|lavagem|retir|desinstal|conserto|reparo/i.test(p.tipo);
}

// Celulares da linha "Contato:" (ou de qualquer lugar da descrição). Sem DDD → 81.
function contatosDoEvento(ev){
  const desc = String(ev.descricao || '');
  const linha = (desc.match(/contato\s*:\s*([^\n]+)/i) || [])[1] || desc;
  const lista = [];
  const re = /(\+?55\s*)?(\(?\d{2}\)?\s*)?(9\s?\d{4})[-\s.]?(\d{4})(\s*\(([^)]{1,30})\))?/g;
  let m;
  while((m = re.exec(linha))){
    const ddd = (m[2] || '').replace(/\D/g, '') || '81';
    const num = '55' + ddd + (m[3] + m[4]).replace(/\D/g, '');
    if(!lista.some(c => c.num === num)) lista.push({ num, rotulo: (m[6] || '').trim() });
  }
  if(!lista.length){   // sem número na agenda: tenta o orçamento ligado
    const orc = typeof orcDoEvento === 'function' ? orcDoEvento(ev, lerTitulo(ev.titulo)) : null;
    const t = orc && String(orc.telefone || '').replace(/\D/g, '');
    if(t && t.length >= 10) lista.push({ num: t.startsWith('55') ? t : '55' + t, rotulo: '' });
  }
  return lista;
}

// ── dias a confirmar ──
function chaveDia(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function diasAConfirmar(eventos){
  const feriado = new Set(eventos.filter(e => /^\s*feriado\b/i.test(e.titulo)).map(e => String(e.inicio).slice(0, 10)));
  const dias = []; const d = inicioDoDia(new Date());
  for(let i = 0; i < 7; i++){
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if(dow === 0 || feriado.has(chaveDia(d))) continue;   // domingo e feriado: pula
    dias.push(new Date(d));
    if(dow !== 6) break;                                   // achou um dia de semana: para (sábado continua até segunda)
  }
  return dias;
}

// ── mensagem (Guia de Mensagens · Confirmação e lembretes) ──
function primeiroNome(cliente){
  const s = String(cliente || '').trim();
  if(/^(dra?|sra?|srta)\.?\s/i.test(s)) return s.split(/\s+/).slice(0, 2).join(' ');
  return s.split(/\s+/)[0] || s;
}
function horaFalada(iso){
  const d = new Date(iso); const h = d.getHours(), m = d.getMinutes();
  return h + 'h' + (m ? String(m).padStart(2, '0') : '');
}
function mensagemConfirmacao(ev, p){
  p = p || lerTitulo(ev.titulo);
  const nome = primeiroNome(p.cliente);
  const data = new Date(ev.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const hora = ev.diaInteiro ? '' : horaFalada(ev.inicio);
  const tecnicos = p.execs.filter(x => x !== '?' && x !== 'B').map(x => EXECUTORES[x] || x);
  const linhas = () => [
    `🗓️  Data:  ${data}`,
    hora ? `⏰  Horário:  por volta de ${hora}` : '',
    tecnicos.length ? `⚙️  ${tecnicos.length > 1 ? 'Técnicos' : 'Técnico'}:  ${tecnicos.join(' e ')}` : ''
  ].filter(Boolean).join('\n');
  const aviso = (traco) => `> *⚠️  Por favor, certifique-se de que haverá alguém para receber nosso técnico neste dia/horário. Caso precise reagendar, nos avise o quanto antes${traco ? ' — ' : ', '}agradecemos! 🙏*`;
  const tipo = p.tipo.toLowerCase();
  // "amanhã" só quando é mesmo amanhã (na sexta, o de segunda vira "segunda-feira")
  const amanha = inicioDoDia(new Date()); amanha.setDate(amanha.getDate() + 1);
  const ehAmanha = chaveDia(amanha) === chaveDia(new Date(ev.inicio));
  const quando = ehAmanha ? 'amanhã' : new Date(ev.inicio).toLocaleDateString('pt-BR', { weekday: 'long' });
  let oQue, traco = false;
  if(/visita/.test(tipo) && !/manuten|lavagem|servi|conserto|reparo|verific/.test(tipo)) oQue = 'a visita técnica gratuita está agendada para ' + quando;
  else if(/visita/.test(tipo)) oQue = 'a visita técnica está agendada para ' + quando;
  else if(/instala|entrega/.test(tipo) && !/manuten|lavagem/.test(tipo)){ oQue = 'a entrega e instalação da sua cortina/persiana está agendada para ' + quando; traco = true; }
  else oQue = 'o atendimento (' + p.tipo.toLowerCase() + ') está agendado para ' + quando;
  return `*🎉  ${ehAmanha ? 'Amanhã é o dia' : 'Está chegando o dia'}, ${nome}!*\n\n*Só passando para lembrar e confirmar que ${oQue}.*\n\n${linhas()}\n\n${aviso(traco)}`;
}

// ── banco ──
async function carregarConfirmacoes(diaIni){
  const r = await sbFetch('/rest/v1/agenda_confirmacoes?select=*&dia=gte.' + chaveDia(diaIni));
  if(!r.ok) throw new Error('confirmacoes');
  CONF_MAPA = {}; (await r.json()).forEach(c => CONF_MAPA[c.evento_id] = c);
}
async function gravarConfirmacao(ev, status){
  const p = lerTitulo(ev.titulo);
  const atual = CONF_MAPA[ev.id];
  let r;
  if(!atual){
    r = await sbFetch('/rest/v1/agenda_confirmacoes', { method: 'POST', headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ evento_id: ev.id, dia: String(ev.inicio).slice(0, 10), cliente: p.cliente, status }) });
    if(r.status === 409){ await carregarConfirmacoes(inicioDoDia(new Date())); return gravarConfirmacao(ev, status); }   // outra pessoa registrou junto
  } else {
    if(atual.status === status) return atual;
    r = await sbFetch('/rest/v1/agenda_confirmacoes?evento_id=eq.' + encodeURIComponent(ev.id), { method: 'PATCH', headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ status }) });
  }
  if(!r.ok){ avisoTopo('Não foi possível registrar agora. Tente de novo.'); throw new Error('gravar'); }
  const linha = (await r.json())[0];
  if(linha) CONF_MAPA[ev.id] = linha;
  return linha;
}

// ── ações ──
function eventoPorId(id){ return CONF_EVENTOS.find(e => e.id === id) || (typeof AG_EVENTOS !== 'undefined' ? AG_EVENTOS.find(e => e.id === id) : null); }
// A mensagem não vai mais por link (o WhatsApp estragava os emojis e o sistema marcava "enviado" só por abrir):
// a pessoa vê a mensagem, copia, cola no WhatsApp, envia e volta para tocar em "Já enviei".
const CONF_ABERTO = new Set();
function verMensagem(id){
  if(CONF_ABERTO.has(id)) CONF_ABERTO.delete(id); else CONF_ABERTO.add(id);
  redesenharConfirmacoes();
}
async function copiarTexto(texto){
  try{ await navigator.clipboard.writeText(texto); return true; }
  catch(e){
    const t = document.createElement('textarea'); t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); let ok = false; try{ ok = document.execCommand('copy'); }catch(_){}
    t.remove(); return ok;
  }
}
async function copiarLembrete(id, botao){
  const ev = eventoPorId(id); if(!ev) return;
  const ok = await copiarTexto(mensagemConfirmacao(ev));
  if(ok){
    avisoTopo('Mensagem copiada. Cole no WhatsApp do cliente, envie e volte aqui para tocar em "Já enviei".');
    if(botao){ botao.innerHTML = ic('ok',15) + ' Copiada'; botao.classList.add('ok'); }
  } else avisoTopo('Não consegui copiar sozinho: selecione o texto da mensagem e copie.');
}
async function copiarNumero(num, botao){
  const ok = await copiarTexto(num.replace(/^55/, ''));
  if(ok && botao){ botao.textContent = 'copiado'; }
}
async function jaEnviei(id){
  const ev = eventoPorId(id); if(!ev) return;
  try{ await gravarConfirmacao(ev, 'enviado'); }catch(e){ return; }
  CONF_ABERTO.delete(id);
  redesenharConfirmacoes();
}
function foneLegivel(num){
  const n = num.replace(/^55/, '');
  return '(' + n.slice(0, 2) + ') ' + n.slice(2, n.length - 4) + '-' + n.slice(-4);
}
function painelMensagem(ev, idJs, contatos){
  const msg = mensagemConfirmacao(ev);
  const fones = contatos.length
    ? contatos.map(ct => `<span class="conf-fone">${escHtml(foneLegivel(ct.num))}${ct.rotulo ? ' · ' + escHtml(ct.rotulo) : ''} <button type="button" class="conf-link" onclick="copiarNumero('${ct.num}', this)">copiar nº</button></span>`).join('')
    : '<span class="conf-nota">sem WhatsApp na agenda: procure o cliente no WhatsApp pelo nome</span>';
  return `<div class="conf-painel">
      <div class="conf-fones">${fones}</div>
      <textarea class="conf-msg" readonly rows="13">${escHtml(msg)}</textarea>
      <div class="conf-acoes">
        <button type="button" class="conf-btn" onclick="copiarLembrete(${idJs}, this)">${ic('copiar',15)} Copiar mensagem</button>
        <button type="button" class="conf-btn ok" onclick="jaEnviei(${idJs})">${ic('ok',15)} Já enviei</button>
        <button type="button" class="conf-link" onclick="verMensagem(${idJs})">fechar</button>
      </div>
    </div>`;
}
async function desfazerEnvio(id){
  const ev = eventoPorId(id); if(!ev) return;
  const r = await sbFetch('/rest/v1/agenda_confirmacoes?evento_id=eq.' + encodeURIComponent(ev.id), { method: 'DELETE' });
  if(!r.ok){ avisoTopo('Não foi possível desfazer agora. Tente de novo.'); return; }
  delete CONF_MAPA[ev.id];
  avisoTopo('Desfeito: o compromisso voltou para "sem lembrete".');
  redesenharConfirmacoes();
}
async function marcarConfirmacao(id, status){
  const ev = eventoPorId(id); if(!ev) return;
  try{ await gravarConfirmacao(ev, status); }catch(e){ return; }
  if(status === 'reagendar') avisoTopo('Anotado. Lembre de ajustar o compromisso no Google Agenda.');
  redesenharConfirmacoes();
}
function redesenharConfirmacoes(){
  if(document.body.dataset.tela === 'agenda' && typeof renderAgenda === 'function') renderAgenda();
  const box = document.getElementById('inicio-confirmar'); if(box) desenharBlocoConfirmar(box);
}

// ── pedaço de tela usado no Início e na Agenda ──
function horaCurta(iso){ return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function controleConfirmacao(ev){
  const c = CONF_MAPA[ev.id], contatos = contatosDoEvento(ev);
  const idJs = escHtml(JSON.stringify(ev.id));
  const aberto = CONF_ABERTO.has(ev.id);
  const botaoVer = (rotulo) => `<button type="button" class="conf-btn conf-wa${aberto ? ' on' : ''}" onclick="verMensagem(${idJs})">${ic('chat',15)} ${escHtml(rotulo)}</button>`;
  const painel = aberto ? painelMensagem(ev, idJs, contatos) : '';
  if(!c) return `<div class="conf-ctrl">${botaoVer('Mensagem de confirmação')}</div>${painel}`;
  const quem = (c.atualizado_por || c.enviado_por || '') + (c.atualizado_em ? ' · ' + horaCurta(c.atualizado_em) : '');
  if(c.status === 'confirmado') return `<div class="conf-ctrl"><span class="conf-st ok">✅ Confirmado</span><span class="conf-nota">${escHtml(quem)}</span>
      <button type="button" class="conf-link" onclick="marcarConfirmacao(${idJs},'enviado')">desfazer</button></div>`;
  if(c.status === 'reagendar') return `<div class="conf-ctrl"><span class="conf-st reag">↺ Quer reagendar</span><span class="conf-nota">${escHtml(quem)} · ajuste no Google Agenda</span>
      <button type="button" class="conf-link" onclick="marcarConfirmacao(${idJs},'confirmado')">confirmou</button>
      <button type="button" class="conf-link" onclick="marcarConfirmacao(${idJs},'enviado')">desfazer</button></div>`;
  return `<div class="conf-ctrl"><span class="conf-st env">📨 Lembrete enviado</span><span class="conf-nota">${escHtml((c.enviado_por || '') + ' · ' + horaCurta(c.enviado_em))}</span>
      <span class="conf-acoes"><button type="button" class="conf-btn ok" onclick="marcarConfirmacao(${idJs},'confirmado')">Confirmou</button>
      <button type="button" class="conf-btn" onclick="marcarConfirmacao(${idJs},'reagendar')">Quer reagendar</button>
      <button type="button" class="conf-link" onclick="verMensagem(${idJs})">${aberto ? 'fechar mensagem' : 'ver mensagem'}</button>
      <button type="button" class="conf-link" onclick="desfazerEnvio(${idJs})">desfazer envio</button></span></div>${painel}`;
}

// ── bloco do Início ──
async function carregarConfirmarAmanha(){
  const box = document.getElementById('inicio-confirmar'); if(!box) return;
  try{
    if(!AG_STATUS){ AG_STATUS = await agendaChamar('status'); }
    if(!AG_STATUS.ok){ box.innerHTML = ''; return; }
    const ini = inicioDoDia(new Date()); ini.setDate(ini.getDate() + 1);
    const fim = new Date(ini); fim.setDate(fim.getDate() + 8);
    const [d] = await Promise.all([agendaChamar('eventos', { de: ini.toISOString(), ate: fim.toISOString() }), carregarConfirmacoes(ini)]);
    CONF_DIAS = diasAConfirmar(d.eventos || []);
    const chaves = new Set(CONF_DIAS.map(chaveDia));
    CONF_EVENTOS = (d.eventos || []).filter(e => chaves.has(String(e.inicio).slice(0, 10)) && ehCompromissoDeCliente(e))
      .sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
    desenharBlocoConfirmar(box);
  }catch(e){ box.innerHTML = ''; }
}
function desenharBlocoConfirmar(box){
  if(!CONF_DIAS.length) { box.innerHTML = ''; return; }
  const nomeDias = CONF_DIAS.map(d => d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })).join(' e ');
  if(!CONF_EVENTOS.length){
    box.innerHTML = `<section class="inicio-bloco"><div class="inicio-bloco-tit"><span>Confirmar · ${escHtml(nomeDias)}</span></div>
      <div class="inicio-ok">${ic('ok',18)} Nenhuma visita ou instalação marcada.</div></section>`;
    return;
  }
  const conf = CONF_EVENTOS.filter(e => (CONF_MAPA[e.id] || {}).status === 'confirmado').length;
  const falta = CONF_EVENTOS.filter(e => !CONF_MAPA[e.id]).length;
  const varios = CONF_DIAS.length > 1;
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>Confirmar · ${escHtml(nomeDias)}</span><strong>${conf} de ${CONF_EVENTOS.length} confirmados${falta ? ' · ' + falta + ' sem lembrete' : ''}</strong></div>
    <div class="conf-lista">${CONF_EVENTOS.map(ev => {
      const p = lerTitulo(ev.titulo);
      const quando = (varios ? new Date(ev.inicio).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + ' ' : '') + (ev.diaInteiro ? 'dia todo' : horaCurta(ev.inicio));
      return `<div class="conf-item${CONF_MAPA[ev.id] ? ' st-' + CONF_MAPA[ev.id].status : ''}">
        <div class="conf-topo"><span class="conf-hora">${escHtml(quando)}</span><strong>${escHtml(p.cliente)}</strong></div>
        <div class="conf-sub">${escHtml([p.tipo, p.execs.map(x => EXECUTORES[x] || x).join(' e '), p.bairro].filter(Boolean).join(' · '))}</div>
        ${controleConfirmacao(ev)}
      </div>`; }).join('')}</div>
  </section>`;
}
