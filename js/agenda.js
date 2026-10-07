// ═══════════════════════════════════════════════════════
// AGENDA (Fase 3 · etapa 3A — só leitura)
// Mostra a Agenda CLIENTES CDP (Google) no sistema: hoje ou a semana, por executor.
// Título no padrão do SOP: "[A CONFIRMAR] C/M/J/? - Tipo - Nome do Cliente (Bairro)".
// C = Cícero, M = Madeleine, J = Jones, ? = a definir. Linha "Itens:" na descrição.
// Liga o compromisso ao orçamento pelo nº CDP na descrição, pelo WhatsApp ou pelo nome do cliente.
// Tudo vem da função "agenda" no servidor; o site nunca fala direto com o Google.
// ═══════════════════════════════════════════════════════
const EXECUTORES = { C: 'Cícero', M: 'Madeleine', J: 'Jones', '?': 'A definir' };
const COR_GOOGLE = { 1:'#7986CB', 2:'#33B679', 3:'#8E24AA', 4:'#E67C73', 5:'#F6BF26', 6:'#F4511E', 7:'#039BE5', 8:'#616161', 9:'#3F51B5', 10:'#0B8043', 11:'#D50000' };
let AG_MODO = 'dia', AG_DATA = new Date(), AG_EVENTOS = [], AG_STATUS = null, AG_EXEC = 'todos';

async function agendaChamar(rota, corpo){
  const tk = (typeof tokenValido === 'function') ? await tokenValido() : null;
  const r = await fetch(SB_URL_LOGIN + '/functions/v1/agenda/' + rota, {
    method: 'POST',
    headers: { 'apikey': SB_KEY_LOGIN, 'Authorization': 'Bearer ' + (tk || SB_KEY_LOGIN), 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {})
  });
  const d = await r.json().catch(() => ({}));
  if(!r.ok){ const e = new Error(d.erro || ('HTTP ' + r.status)); e.codigo = d.erro; throw e; }
  return d;
}

// "[A CONFIRMAR] C/J - Instalação - Maria Souza (Boa Viagem)" → partes
function lerTitulo(t){
  let s = String(t || '').trim();
  const aConfirmar = /\[\s*a\s*confirmar\s*\]/i.test(s);
  s = s.replace(/\[\s*a\s*confirmar\s*\]/ig, '').trim();
  const partes = s.split(/\s+[-–—]\s+/);
  let execs = [], tipo = '', cliente = s, bairro = '';
  if(partes.length >= 3 && /^[CMJ?](\s*[\/+,]\s*[CMJ?])*$/i.test(partes[0].trim())){
    execs = partes[0].toUpperCase().split(/\s*[\/+,]\s*/).filter(Boolean);
    tipo = partes[1].trim();
    cliente = partes.slice(2).join(' - ').trim();
  } else if(partes.length >= 2 && /^[CMJ?](\s*[\/+,]\s*[CMJ?])*$/i.test(partes[0].trim())){
    execs = partes[0].toUpperCase().split(/\s*[\/+,]\s*/).filter(Boolean);
    cliente = partes.slice(1).join(' - ').trim();
  }
  if(!execs.length){   // ex.: "Entrega Jones" (evento-par do SOP)
    if(/\bjones\b/i.test(s)) execs.push('J'); if(/c[íi]cero/i.test(s)) execs.push('C'); if(/madeleine/i.test(s)) execs.push('M');
    if(!tipo && /^entrega\b/i.test(s)) tipo = 'Entrega';
  }
  const m = cliente.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if(m){ cliente = m[1].trim(); bairro = m[2].trim(); }
  return { aConfirmar, execs, tipo, cliente, bairro };
}
function itensDaDescricao(d){
  const m = String(d || '').match(/itens\s*:\s*([^\n]+)/i);
  return m ? m[1].trim() : '';
}
// Liga ao orçamento: nº CDP na descrição → WhatsApp → nome igual
function orcDoEvento(ev, p){
  const lista = typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [];
  const txt = (ev.descricao || '') + ' ' + (ev.titulo || '');
  const n = txt.match(/CDP[-\s]?0*(\d{1,6})/i);
  if(n){ const e = lista.find(x => String(x.numero) === String(parseInt(n[1], 10))); if(e) return e; }
  const tels = (txt.match(/\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/g) || []).map(t => t.replace(/\D/g, '').slice(-8));
  if(tels.length){ const e = lista.find(x => x.telefone && tels.includes(String(x.telefone).replace(/\D/g, '').slice(-8))); if(e) return e; }
  if(p.cliente){ const alvo = semAcento(p.cliente); const e = lista.find(x => x.client && semAcento(x.client) === alvo); if(e) return e; }
  return null;
}

// ── período ──
function inicioDoDia(d){ const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function periodoAgenda(){
  const ini = inicioDoDia(AG_DATA);
  if(AG_MODO === 'semana'){ const dow = (ini.getDay() + 6) % 7; ini.setDate(ini.getDate() - dow); }   // segunda
  const fim = new Date(ini); fim.setDate(fim.getDate() + (AG_MODO === 'semana' ? 7 : 1));
  return { ini, fim };
}
function moverAgenda(n){
  if(n === 0) AG_DATA = new Date();
  else AG_DATA.setDate(AG_DATA.getDate() + n * (AG_MODO === 'semana' ? 7 : 1));
  renderAgenda(true);
}

async function renderAgenda(recarregar){
  const box = $('ag-lista'); if(!box) return;
  if(!AG_STATUS || recarregar === 'status'){
    box.innerHTML = '<div class="hist-empty">Conectando à agenda…</div>';
    try{ AG_STATUS = await agendaChamar('status'); }catch(e){ AG_STATUS = { configurado: false, ok: false, erro: e.codigo }; }
  }
  const s = AG_STATUS;
  const { ini, fim } = periodoAgenda();
  const fimMenos = new Date(fim - 1);
  const fmtD = d => d.toLocaleDateString('pt-BR', { weekday: AG_MODO === 'dia' ? 'long' : undefined, day: '2-digit', month: '2-digit' });
  $('ag-periodo').textContent = AG_MODO === 'dia' ? fmtD(ini) : fmtD(ini) + ' a ' + fmtD(fimMenos);
  document.querySelectorAll('#ag-modo .hist-chip').forEach(b => b.classList.toggle('on', b.dataset.m === AG_MODO));
  if(!s.configurado || !s.ok){
    const admin = (typeof AUTH !== 'undefined' && AUTH && (AUTH.papel === 'admin' || AUTH.papel === 'dona'));
    box.innerHTML = `<div class="ag-aviso">${ic('info',16)} <span>${!s.configurado
      ? 'A agenda do Google ainda não está ligada ao sistema.' + (admin ? ' Falta cadastrar o robô do Google e o ID da agenda nos segredos do Supabase.' : ' A Bruna está configurando.')
      : 'Não foi possível ler a Agenda CLIENTES CDP.' + (s.erro === 'sem_acesso' ? ' Confira se a agenda foi compartilhada com o robô' + (s.robo ? ' (' + escHtml(s.robo) + ')' : '') + '.' : ' Tente de novo em instantes.')}</span></div>`;
    return;
  }
  if(recarregar || !AG_EVENTOS._chave || AG_EVENTOS._chave !== +ini + '|' + +fim){
    box.innerHTML = '<div class="hist-empty">Carregando compromissos…</div>';
    try{
      if(typeof HIST_CARREGADO !== 'undefined' && !HIST_CARREGADO){ try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }catch(e){} }
      const d = await agendaChamar('eventos', { de: ini.toISOString(), ate: fim.toISOString() });
      AG_EVENTOS = d.eventos || []; AG_EVENTOS._chave = +ini + '|' + +fim;
    }catch(e){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">' + ic('alerta',16) + ' Não foi possível carregar a agenda agora.</div>'; return; }
  }
  const evs = AG_EVENTOS.slice().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))).map(ev => Object.assign({}, ev, { p: lerTitulo(ev.titulo) }))
    .filter(ev => AG_EXEC === 'todos' || ev.p.execs.includes(AG_EXEC) || (AG_EXEC === '?' && !ev.p.execs.length));
  const cont = {}; AG_EVENTOS.forEach(ev => { const p = lerTitulo(ev.titulo); (p.execs.length ? p.execs : ['?']).forEach(x => cont[x] = (cont[x] || 0) + 1); });
  $('ag-exec').innerHTML = [['todos', 'Todos', AG_EVENTOS.length]].concat(Object.keys(EXECUTORES).filter(k => cont[k]).map(k => [k, EXECUTORES[k], cont[k]]))
    .map(([k, n, c]) => `<button type="button" class="hist-chip${AG_EXEC===k?' on':''}" onclick="AG_EXEC='${k}';renderAgenda()">${escHtml(n)} <span>${c}</span></button>`).join('');
  const aConf = evs.filter(ev => ev.p.aConfirmar).length;
  $('ag-resumo').textContent = evs.length ? evs.length + ' compromisso' + (evs.length > 1 ? 's' : '') + (aConf ? ' · ' + aConf + ' a confirmar' : '') : '';
  if(!evs.length){ box.innerHTML = `<div class="ret-vazio">${ic('calendario',18)} Nenhum compromisso ${AG_MODO === 'dia' ? 'neste dia' : 'nesta semana'}.</div>`; return; }
  // agrupa por dia
  const dias = new Map();
  evs.forEach(ev => { const k = String(ev.inicio).slice(0, 10); if(!dias.has(k)) dias.set(k, []); dias.get(k).push(ev); });
  const hoje = new Date(); const kHoje = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0') + '-' + String(hoje.getDate()).padStart(2,'0');
  box.innerHTML = [...dias.entries()].map(([k, l]) => `
    ${AG_MODO === 'semana' ? `<div class="ag-dia${k === kHoje ? ' hoje' : ''}">${escHtml(new Date(k + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }))}${k === kHoje ? ' · hoje' : ''}</div>` : ''}
    ${l.map(cardEvento).join('')}`).join('');
}

function cardEvento(ev){
  const p = ev.p, orc = orcDoEvento(ev, p), itens = itensDaDescricao(ev.descricao);
  const hora = ev.diaInteiro ? 'dia todo' : new Date(ev.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + (ev.fim ? '–' + new Date(ev.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
  const cor = COR_GOOGLE[ev.cor] || 'var(--vinho,#5A1524)';
  return `<div class="ag-card${p.aConfirmar ? ' a-confirmar' : ''}" style="--ag-cor:${cor}">
    <div class="ag-hora">${escHtml(hora)}</div>
    <div class="ag-corpo">
      <div class="ag-topo">
        ${(p.execs.length ? p.execs : ['?']).map(x => `<span class="ag-exec" title="${escHtml(EXECUTORES[x] || x)}">${escHtml(EXECUTORES[x] || x)}</span>`).join('')}
        ${p.tipo ? `<span class="ag-tipo">${escHtml(p.tipo)}</span>` : ''}
        ${p.aConfirmar ? '<span class="ag-conf">A confirmar</span>' : ''}
      </div>
      <strong>${escHtml(p.cliente || ev.titulo || '(sem título)')}</strong>
      <div class="ag-meta">${[p.bairro, ev.local && ev.local !== p.bairro ? ev.local : ''].filter(Boolean).map(escHtml).join(' · ')}</div>
      ${itens ? `<div class="ag-itens"><b>Itens:</b> ${escHtml(itens)}</div>` : ''}
      <div class="ag-links">
        ${orc ? `<button type="button" class="ret-link" onclick="reopenOrc(${orc.id})">${escHtml(numCDP(orc.numero) || 'Orçamento')} ›</button>` : ''}
        ${ev.link ? `<a class="ret-link" href="${escHtml(ev.link)}" target="_blank" rel="noopener">Abrir no Google ›</a>` : ''}
      </div>
    </div>
  </div>`;
}
