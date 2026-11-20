// ═══════════════════════════════════════════════════════
// MEU DIA (Início) — mural da equipe, minhas tarefas e bloco de notas (pedido da Bru, 19/11/2026; protótipo aprovado)
// As tarefas do sistema continuam nos blocos de "Para fazer hoje" e somem sozinhas quando a coisa é feita.
// Tabelas: tarefas (só a própria pessoa), mural (todos veem; autor ou gestora muda/apaga), notas (só a própria pessoa).
// SQL em sql/2026-11-meu-dia.sql.
// ═══════════════════════════════════════════════════════
let MD_TAREFAS = [], MD_MURAL = [], MD_NOTA = null, MD_CARREGADO = false;
let MD_MURAL_TODOS = false, MD_FORM_RECADO = false, MD_NOTA_TIMER = null, MD_NOTA_EST = '';

const mdHoje = () => (typeof hojeIso === 'function' ? hojeIso() : new Date().toISOString().slice(0, 10));
const mdEmail = () => ((typeof AUTH !== 'undefined' && AUTH) || {}).email || '';
const mdGestora = () => { const a = (typeof AUTH !== 'undefined' && AUTH) || {}; return a.papel === 'admin' || a.papel === 'dona'; };
const mdDia = (iso) => { if(!iso) return ''; const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };
const mdHora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

async function carregarMeuDia(){
  const ini = new Date(); ini.setHours(0, 0, 0, 0);
  const [rt, rm, rn] = await Promise.all([
    sbFetch('/rest/v1/tarefas?select=*&or=(feita_em.is.null,feita_em.gte.' + ini.toISOString() + ')&order=criada_em.asc'),
    sbFetch('/rest/v1/mural?select=*&order=fixado.desc,criado_em.desc&limit=40'),
    sbFetch('/rest/v1/notas?select=*'),
  ]);
  MD_TAREFAS = rt.ok ? await rt.json() : [];
  MD_MURAL = rm.ok ? await rm.json() : [];
  MD_NOTA = rn.ok ? ((await rn.json())[0] || { texto: '' }) : { texto: '' };
  MD_CARREGADO = true;
}
async function carregarMeuDiaInicio(){
  if(MD_CARREGADO){ desenharMeuDia(); desenharNotas(); }
  try{ await carregarMeuDia(); }catch(e){ return; }
  desenharMeuDia(); desenharNotas();
}

// ── mural ──
function mdDestaque(){
  const hoje = mdHoje();
  // no topo: fixados, os que pediram para lembrar hoje (ou já passou) e os dos últimos 3 dias; o resto em "ver todos"
  const recente = (r) => Date.now() - new Date(r.criado_em) < 3 * 864e5;
  return MD_MURAL.filter(r => r.fixado || (r.lembrar_em && r.lembrar_em <= hoje) || (!r.lembrar_em && recente(r)));
}
function cartaoRecado(r){
  const meu = r.autor_email === mdEmail(), pode = meu || mdGestora();
  const hoje = mdHoje();
  const lembrar = r.lembrar_em ? (r.lembrar_em > hoje ? 'lembrar em ' + mdDia(r.lembrar_em) : r.lembrar_em === hoje ? 'lembrete de hoje' : 'lembrete de ' + mdDia(r.lembrar_em)) : '';
  return `<div class="md-recado${r.fixado ? ' fixado' : ''}${r.lembrar_em && r.lembrar_em <= hoje ? ' lembrete' : ''}">
    <div class="md-recado-m"><span>${r.fixado ? 'fixado · ' : ''}${escHtml(r.autor || '')}${lembrar ? ' · ' + escHtml(lembrar) : ''}</span><span>${escHtml(mdDia(r.criado_em))}</span></div>
    <p>${escHtml(r.texto).replace(/\n/g, '<br>')}</p>
    ${pode ? `<div class="md-recado-acoes"><button type="button" class="conf-link" onclick="mdFixar(${r.id},${!r.fixado})">${r.fixado ? 'desafixar' : 'fixar'}</button><button type="button" class="conf-link" onclick="mdApagarRecado(${r.id})">apagar</button></div>` : ''}
  </div>`;
}
function blocoMural(){
  const dest = mdDestaque(), vis = MD_MURAL_TODOS ? MD_MURAL : dest;
  const resto = MD_MURAL.length - dest.length;
  return `<section class="inicio-bloco md-mural">
    <div class="inicio-bloco-tit"><span>${ic('pin',16)}Mural da equipe</span><button type="button" class="conf-link" onclick="MD_FORM_RECADO=!MD_FORM_RECADO;desenharMeuDia();if(MD_FORM_RECADO) setTimeout(()=>{const t=document.getElementById('md-recado-txt'); if(t) t.focus();},30)">${MD_FORM_RECADO ? 'cancelar' : '+ Recado'}</button></div>
    ${MD_FORM_RECADO ? `<form class="md-form-recado" onsubmit="event.preventDefault();mdSalvarRecado()">
      <label for="md-recado-txt" class="sr-only">Recado</label>
      <textarea id="md-recado-txt" rows="3" maxlength="1000" placeholder="Escreva o recado para a equipe"></textarea>
      <div class="md-form-linha">
        <label class="md-check"><input type="checkbox" id="md-recado-fixo"> Fixar no topo</label>
        <label class="md-data">Lembrar em <input type="date" id="md-recado-data" min="${mdHoje()}"></label>
        <button type="submit" class="btn">Publicar</button>
      </div></form>` : ''}
    ${vis.length ? `<div class="md-recados">${vis.map(cartaoRecado).join('')}</div>` : (MD_FORM_RECADO ? '' : '<div class="conf-nota">Nenhum recado por enquanto.</div>')}
    ${MD_MURAL.length && (MD_MURAL_TODOS || resto > 0) ? `<button type="button" class="conf-link" onclick="MD_MURAL_TODOS=!MD_MURAL_TODOS;desenharMeuDia()">${MD_MURAL_TODOS ? 'mostrar só os de agora' : 'ver todos os recados (' + MD_MURAL.length + ')'}</button>` : ''}
  </section>`;
}
async function mdSalvarRecado(){
  const t = ($('md-recado-txt') || {}).value || '';
  if(!t.trim()){ avisoTopo('Escreva o recado.'); return; }
  const corpo = { texto: t.trim(), fixado: !!($('md-recado-fixo') || {}).checked, lembrar_em: ($('md-recado-data') || {}).value || null };
  const r = await sbFetch('/rest/v1/mural', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify(corpo) });
  if(!r.ok){ avisoTopo('Não foi possível publicar agora. Tente de novo.'); return; }
  const l = (await r.json())[0]; if(l) MD_MURAL.unshift(l);
  MD_FORM_RECADO = false; avisoTopo('Recado publicado para a equipe.'); desenharMeuDia();
}
async function mdFixar(id, fixar){
  const r = await sbFetch('/rest/v1/mural?id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ fixado: fixar }) });
  const l = r.ok ? (await r.json())[0] : null;
  if(!l){ avisoTopo('Só quem escreveu (ou a Bruna/Madeleine) muda este recado.'); return; }
  MD_MURAL = MD_MURAL.map(x => x.id === id ? l : x).sort((a, b) => (b.fixado - a.fixado) || String(b.criado_em).localeCompare(String(a.criado_em)));
  desenharMeuDia();
}
async function mdApagarRecado(id){
  if(!confirm('Apagar este recado do mural para todos?')) return;
  const r = await sbFetch('/rest/v1/mural?id=eq.' + id, { method: 'DELETE', headers: { 'Prefer': 'return=representation' } });
  const l = r.ok ? await r.json() : [];
  if(!l.length){ avisoTopo('Só quem escreveu (ou a Bruna/Madeleine) apaga este recado.'); return; }
  MD_MURAL = MD_MURAL.filter(x => x.id !== id); avisoTopo('Recado apagado.'); desenharMeuDia();
}

// ── minhas tarefas ──
function mdOrdemTarefas(){
  const hoje = mdHoje();
  const peso = (t) => t.feita_em ? 9 : !t.para_dia ? 3 : t.para_dia < hoje ? 0 : t.para_dia === hoje ? 1 : 5;
  return [...MD_TAREFAS].sort((a, b) => peso(a) - peso(b) || String(a.para_dia || '').localeCompare(String(b.para_dia || '')) || String(a.criada_em).localeCompare(String(b.criada_em)));
}
function blocoTarefas(){
  const hoje = mdHoje();
  const lista = mdOrdemTarefas();
  const doDia = MD_TAREFAS.filter(t => !t.para_dia || t.para_dia <= hoje || t.feita_em);
  const feitas = doDia.filter(t => t.feita_em).length;
  const pct = doDia.length ? Math.round(feitas / doDia.length * 100) : 0;
  return `<section class="inicio-bloco md-tarefas">
    <div class="inicio-bloco-tit"><span>${ic('ok',16)}Minhas tarefas</span><strong>${doDia.length ? feitas + ' de ' + doDia.length + ' feitas hoje' : ''}</strong></div>
    ${doDia.length ? `<div class="md-barra" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tarefas feitas hoje"><div style="width:${pct}%"></div></div>` : ''}
    <form class="md-form-tarefa" onsubmit="event.preventDefault();mdNovaTarefa()">
      <label for="md-tarefa-txt" class="sr-only">Nova tarefa</label>
      <input id="md-tarefa-txt" maxlength="300" autocomplete="off" placeholder="+ Adicionar uma tarefa minha">
      <label for="md-tarefa-dia" class="sr-only">Para quando (opcional)</label>
      <input id="md-tarefa-dia" type="date" title="Para quando (opcional)">
      <button type="submit" class="btn">Adicionar</button>
    </form>
    ${lista.length ? `<div class="md-lista">${lista.map(t => {
      const atras = !t.feita_em && t.para_dia && t.para_dia < hoje, futura = !t.feita_em && t.para_dia && t.para_dia > hoje;
      const quando = t.feita_em ? 'feita ' + mdHora(t.feita_em) : t.para_dia ? (atras ? 'era para ' + mdDia(t.para_dia) : t.para_dia === hoje ? 'para hoje' : 'para ' + mdDia(t.para_dia)) : 'sem data';
      return `<div class="md-tarefa${t.feita_em ? ' feita' : ''}${atras ? ' atrasada' : ''}${futura ? ' futura' : ''}">
        <button type="button" class="md-ck${t.feita_em ? ' on' : ''}" onclick="mdMarcarTarefa(${t.id},${!t.feita_em})" aria-label="${t.feita_em ? 'Desmarcar' : 'Marcar como feita'}: ${escHtml(t.texto)}">${t.feita_em ? ic('ok', 14) : ''}</button>
        <span class="md-tarefa-txt"><b>${escHtml(t.texto)}</b><em>${escHtml(quando)}</em></span>
        <button type="button" class="md-x" onclick="mdApagarTarefa(${t.id})" aria-label="Excluir tarefa">×</button>
      </div>`; }).join('')}</div>` : '<div class="conf-nota">Suas tarefas pessoais aparecem aqui. As do sistema estão logo abaixo, em "Para fazer hoje".</div>'}
  </section>`;
}
async function mdNovaTarefa(){
  const el = $('md-tarefa-txt'), dia = $('md-tarefa-dia');
  const texto = (el && el.value || '').trim(); if(!texto) return;
  const r = await sbFetch('/rest/v1/tarefas', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ texto, para_dia: (dia && dia.value) || null }) });
  if(!r.ok){ avisoTopo('Não foi possível adicionar agora.'); return; }
  const l = (await r.json())[0]; if(l) MD_TAREFAS.push(l);
  desenharMeuDia(); const n = $('md-tarefa-txt'); if(n) n.focus();
}
async function mdMarcarTarefa(id, feita){
  const r = await sbFetch('/rest/v1/tarefas?id=eq.' + id, { method: 'PATCH', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ feita_em: feita ? new Date().toISOString() : null }) });
  if(!r.ok){ avisoTopo('Não foi possível marcar agora.'); return; }
  const l = (await r.json())[0]; MD_TAREFAS = MD_TAREFAS.map(t => t.id === id ? l : t); desenharMeuDia();
}
let MD_APAGADA = null;
async function mdApagarTarefa(id){
  const t = MD_TAREFAS.find(x => x.id === id); if(!t) return;
  const r = await sbFetch('/rest/v1/tarefas?id=eq.' + id, { method: 'DELETE' });
  if(!r.ok){ avisoTopo('Não foi possível excluir agora.'); return; }
  MD_APAGADA = t; MD_TAREFAS = MD_TAREFAS.filter(x => x.id !== id); desenharMeuDia();
  avisoTopo('Tarefa excluída. <button type="button" class="aviso-desfazer" onclick="mdDesfazerApagar()">desfazer</button>');
}
async function mdDesfazerApagar(){
  const t = MD_APAGADA; if(!t) return; MD_APAGADA = null;
  const r = await sbFetch('/rest/v1/tarefas', { method: 'POST', headers: { 'Prefer': 'return=representation' }, body: JSON.stringify({ texto: t.texto, para_dia: t.para_dia, feita_em: t.feita_em }) });
  if(!r.ok){ avisoTopo('Não foi possível desfazer.'); return; }
  const l = (await r.json())[0]; if(l) MD_TAREFAS.push(l); avisoTopo('Tarefa de volta.'); desenharMeuDia();
}

// ── bloco de notas (salva sozinho) ──
function desenharNotas(){
  const box = document.getElementById('inicio-notas'); if(!box) return;
  if(document.activeElement && document.activeElement.id === 'md-nota') return;   // não atrapalha quem está digitando
  box.innerHTML = `<section class="inicio-bloco md-notas">
    <div class="inicio-bloco-tit"><span>${ic('nota',16)}Meu bloco de notas</span><strong id="md-nota-est">${MD_NOTA_EST || 'só você vê · salva sozinho'}</strong></div>
    <label for="md-nota" class="sr-only">Bloco de notas</label>
    <textarea id="md-nota" rows="5" maxlength="20000" placeholder="Anote o que quiser: lembretes, recados de cliente, ideias…" oninput="mdNotaDigitou()" onblur="mdSalvarNota()">${escHtml((MD_NOTA && MD_NOTA.texto) || '')}</textarea>
  </section>`;
}
function mdNotaDigitou(){
  const est = $('md-nota-est'); if(est) est.textContent = 'digitando…';
  clearTimeout(MD_NOTA_TIMER); MD_NOTA_TIMER = setTimeout(mdSalvarNota, 900);
}
async function mdSalvarNota(){
  clearTimeout(MD_NOTA_TIMER);
  const el = $('md-nota'); if(!el) return;
  const texto = el.value;
  if(MD_NOTA && MD_NOTA.texto === texto) { const est = $('md-nota-est'); if(est && est.textContent === 'digitando…') est.textContent = 'salvo'; return; }
  const r = await sbFetch('/rest/v1/notas?on_conflict=dono', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ dono: mdEmail(), texto, atualizado_em: new Date().toISOString() }) });
  const est = $('md-nota-est');
  if(!r.ok){ if(est) est.textContent = 'não salvou: tente de novo'; return; }
  MD_NOTA = (await r.json())[0] || { texto };
  MD_NOTA_EST = 'salvo às ' + mdHora(new Date()); if(est) est.textContent = MD_NOTA_EST;
}
window.addEventListener('beforeunload', () => { if(MD_NOTA_TIMER) mdSalvarNota(); });

function desenharMeuDia(){
  const box = document.getElementById('inicio-meudia'); if(!box) return;
  box.innerHTML = blocoMural() + blocoTarefas();
}
