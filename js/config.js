// ═══════════════════════════════════════════════════════
// CONFIGURAÇÕES + LINKS ÚTEIS + AGENDA DE HOJE (Etapa A)
// • Configurações: abre tocando no nome, no topo. Minha conta (todos); Tabelas de preço, Links úteis
//   e Conexões (Olist e Agenda Google) só para Bruna e Madeleine (admin/dona).
// • Links úteis: tabela links_uteis. Todos veem (rodapé do Início); só a gestora inclui/muda/tira.
// • Agenda de hoje: lista curta dos compromissos do dia no Início (lê a Agenda CLIENTES CDP).
// ═══════════════════════════════════════════════════════

const LINK_GRUPOS = [['sistemas', '🖥️', 'Sistemas'], ['guias', '📚', 'Guias'], ['pastas', '📁', 'Pastas do Drive'], ['cliente', '🤝', 'Para o cliente']];
let LINKS = [], LINKS_CARREGADO = false, CFG_EDITANDO_LINKS = false;
const cfgEhGestora = () => { const a = (typeof AUTH !== 'undefined' && AUTH) || {}; return a.papel === 'admin' || a.papel === 'dona'; };

// ── links: banco ──
async function carregarLinks(){
  const r = await sbFetch('/rest/v1/links_uteis?select=*&order=grupo.asc,ordem.asc,id.asc');
  if(!r.ok) throw new Error('links');
  LINKS = await r.json(); LINKS_CARREGADO = true;
}
async function copiarLink(id, botao){
  const l = LINKS.find(x => x.id === id); if(!l) return;
  const ok = await copiarTexto(l.url);
  avisoTopo(ok ? 'Link copiado: ' + escHtml(l.titulo) + '.' : 'Não consegui copiar sozinho.');
  if(ok && botao){ botao.textContent = 'copiado ✓'; setTimeout(() => { botao.textContent = 'copiar'; }, 2000); }
}

// ── links: rodapé do Início ──
function desenharLinksInicio(){
  const box = document.getElementById('inicio-links'); if(!box) return;
  if(!LINKS.length){ box.innerHTML = ''; return; }
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>🔗 Links úteis</span>${cfgEhGestora() ? `<button type="button" class="conf-link" onclick="abrirConfig('links')">editar</button>` : ''}</div>
    ${LINK_GRUPOS.map(([g, em, nome]) => { const l = LINKS.filter(x => x.grupo === g); return l.length ? `
      <div class="lk-grupo"><div class="lk-grupo-tit">${em} ${nome}</div>
        <div class="lk-lista">${l.map(x => `<span class="lk-item"><a href="${escHtml(x.url)}" target="_blank" rel="noopener"><span class="lk-em">${escHtml(x.emoji || '🔗')}</span>${escHtml(x.titulo)}</a>${x.copiar ? `<button type="button" class="lk-copiar" onclick="copiarLink(${x.id}, this)">copiar</button>` : ''}</span>`).join('')}</div>
      </div>` : ''; }).join('')}
  </section>`;
}
async function carregarLinksInicio(){
  if(LINKS_CARREGADO) desenharLinksInicio();
  try{ await carregarLinks(); desenharLinksInicio(); }catch(e){}
}

// ── Agenda de hoje (Início) ──
let AG_HOJE = null, AG_HOJE_DIA = '';
async function carregarAgendaHoje(){
  const box = document.getElementById('inicio-agenda'); if(!box || typeof agendaChamar !== 'function') return;
  const ini = new Date(); ini.setHours(0, 0, 0, 0); const fim = new Date(ini); fim.setDate(fim.getDate() + 1);
  const dia = ini.toDateString();
  if(AG_HOJE && AG_HOJE_DIA === dia) desenharAgendaHoje();
  try{
    const s = await agendaChamar('status'); if(!s || !s.ok){ box.innerHTML = ''; return; }
    const d = await agendaChamar('eventos', { de: ini.toISOString(), ate: fim.toISOString() });
    AG_HOJE = (d.eventos || []).slice().sort((a, b) => String(a.inicio).localeCompare(String(b.inicio))); AG_HOJE_DIA = dia;
    desenharAgendaHoje();
  }catch(e){ if(!AG_HOJE) box.innerHTML = ''; }
}
function desenharAgendaHoje(){
  const box = document.getElementById('inicio-agenda'); if(!box || !AG_HOJE) return;
  const ev = AG_HOJE.filter(e => !/^\s*feriado\b/i.test(e.titulo));
  const agora = Date.now();
  box.innerHTML = `<section class="inicio-bloco">
    <div class="inicio-bloco-tit"><span>📅 Agenda de hoje</span><button type="button" class="conf-link" onclick="AG_DATA=new Date();AG_MODO='dia';switchTab('agenda')">ver agenda ›</button></div>
    ${ev.length ? `<div class="agh-lista">${ev.map(e => {
      const p = lerTitulo(e.titulo);
      const hora = e.diaInteiro ? 'dia todo' : new Date(e.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const passou = !e.diaInteiro && e.fim && new Date(e.fim).getTime() < agora;
      const quem = (p.execs.length ? p.execs : ['?']).map(x => EXECUTORES[x] || x).join(' e ');
      return `<button type="button" class="agh-item${passou ? ' passou' : ''}" onclick="AG_DATA=new Date();AG_MODO='dia';switchTab('agenda')">
        <span class="agh-hora">${escHtml(hora)}</span>
        <span class="agh-txt"><strong>${escHtml(p.cliente || p.tipo || e.titulo)}</strong><span>${escHtml([p.tipo && p.cliente ? p.tipo : '', quem, p.bairro].filter(Boolean).join(' · '))}</span></span>
        ${p.aConfirmar ? '<span class="ag-conf">A confirmar</span>' : ''}
      </button>`; }).join('')}</div>`
    : `<div class="inicio-ok">${ic('ok',18)} Nenhum compromisso na agenda hoje.</div>`}
  </section>`;
}

// ═════════ TELA CONFIGURAÇÕES ═════════
async function abrirConfig(secao){
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!confirmarSairOrc()) return; limparOrcamentoEmAndamento(); }
  CFG_EDITANDO_LINKS = secao === 'links';
  irParaTab('config'); window.scrollTo({ top: 0 });
  renderConfig();
  if(secao){ setTimeout(() => { const el = document.getElementById('cfg-' + secao); if(el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); }
}
async function renderConfig(){
  const box = $('cfg-conteudo'); if(!box) return;
  const a = (typeof AUTH !== 'undefined' && AUTH) || {};
  const papel = { dona: 'Dona', admin: 'Administradora', atendimento: 'Atendimento', vendas: 'Vendas' }[a.papel] || a.papel || '';
  const g = cfgEhGestora();
  box.innerHTML = `
    <section class="cfg-bloco">
      <div class="cfg-tit">👤 Minha conta</div>
      <div class="cfg-linha"><div><strong>${escHtml(a.nome || '')}</strong><span>${escHtml([papel, a.email].filter(Boolean).join(' · '))}</span></div></div>
      <div class="cfg-acoes">
        <button type="button" class="btn-outline" onclick="mostrarTrocaSenha(false)">🔑 Trocar minha senha</button>
        <button type="button" class="btn-outline" onclick="logout()">🚪 Sair do sistema</button>
      </div>
    </section>
    ${g ? `
    <section class="cfg-bloco">
      <div class="cfg-tit">🏷️ Tabelas de preço</div>
      <p class="cfg-sub">Reajuste das fábricas sem mexer no código. As fórmulas continuam as mesmas.</p>
      <div class="cfg-acoes"><button type="button" class="btn-outline" onclick="abrirTabelasPreco()">Abrir tabelas de preço ›</button></div>
    </section>
    <section class="cfg-bloco" id="cfg-links">
      <div class="cfg-tit">🔗 Links úteis <span class="cfg-tag">toda a equipe vê</span></div>
      <p class="cfg-sub">Aparecem no fim do Início. Só você e a Madeleine podem mudar.</p>
      <div id="cfg-links-lista"><div class="hist-empty">Carregando…</div></div>
      <div class="cfg-acoes"><button type="button" class="btn-outline" onclick="editarLink()">➕ Novo link</button></div>
    </section>
    <section class="cfg-bloco" id="cfg-conexoes">
      <div class="cfg-tit">🔌 Conexões</div>
      <div id="cfg-con-olist" class="cfg-linha"><div><strong>🧾 Olist Tiny</strong><span>Verificando…</span></div></div>
      <div id="cfg-con-agenda" class="cfg-linha"><div><strong>📅 Agenda CLIENTES CDP</strong><span>Verificando…</span></div></div>
    </section>` : ''}
    <p class="cfg-rodape">CDP Sistema · Central das Persianas</p>`;
  if(g){ renderCfgLinks(); renderCfgConexoes(); }
}

// ── links: edição (gestora) ──
async function renderCfgLinks(recarregar){
  const box = $('cfg-links-lista'); if(!box) return;
  if(recarregar || !LINKS_CARREGADO){ try{ await carregarLinks(); }catch(e){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">Não foi possível carregar os links.</div>'; return; } }
  box.innerHTML = LINK_GRUPOS.map(([gr, em, nome]) => {
    const l = LINKS.filter(x => x.grupo === gr);
    return `<div class="lk-grupo"><div class="lk-grupo-tit">${em} ${nome}</div>${l.length ? l.map((x, i) => `
      <div class="cfg-link-item">
        <span class="lk-em">${escHtml(x.emoji || '🔗')}</span>
        <span class="cfg-link-txt"><strong>${escHtml(x.titulo)}</strong><span>${escHtml(x.url.replace(/^https:\/\//, '').slice(0, 48))}${x.url.length > 56 ? '…' : ''}</span></span>
        <span class="cfg-link-bt">
          <button type="button" class="conf-link" ${i === 0 ? 'disabled' : ''} onclick="moverLink(${x.id}, -1)" aria-label="Subir">▲</button>
          <button type="button" class="conf-link" ${i === l.length - 1 ? 'disabled' : ''} onclick="moverLink(${x.id}, 1)" aria-label="Descer">▼</button>
          <button type="button" class="conf-link" onclick="editarLink(${x.id})">editar</button>
        </span>
      </div>`).join('') : '<div class="conf-nota">Nenhum link neste grupo.</div>'}</div>`;
  }).join('');
}
function editarLink(id){
  const x = id ? LINKS.find(l => l.id === id) : { grupo: 'guias', titulo: '', url: 'https://', emoji: '🔗', copiar: false };
  if(!x) return;
  abrirModal(id ? 'Editar link' : 'Novo link', `
    <label class="novo-campo"><span>Nome <b>*</b></span><input type="text" id="lk-titulo" maxlength="60" value="${escHtml(x.titulo)}" placeholder="Ex.: Guia de Processos"></label>
    <label class="novo-campo"><span>Endereço (link) <b>*</b></span><input type="url" id="lk-url" inputmode="url" value="${escHtml(x.url)}" placeholder="https://..."></label>
    <div class="novo-campo"><span>Grupo</span><div class="ret-chips" id="lk-grupo">${LINK_GRUPOS.map(([g, em, nome]) => `<button type="button" class="hist-chip${x.grupo === g ? ' on' : ''}" data-g="${g}" onclick="this.parentNode.querySelectorAll('.hist-chip').forEach(b=>b.classList.toggle('on', b===this))">${em} ${nome}</button>`).join('')}</div></div>
    <label class="novo-campo"><span>Emoji <em>(opcional)</em></span><input type="text" id="lk-emoji" maxlength="4" value="${escHtml(x.emoji || '')}" class="lk-emoji-in"></label>
    <label class="gar-check"><input type="checkbox" id="lk-copiar" ${x.copiar ? 'checked' : ''}> Mostrar botão "copiar" (para mandar o link ao cliente)</label>
    ${id ? `<button type="button" class="conf-link lk-apagar" onclick="apagarLink(${id})">🗑️ tirar este link</button>` : ''}`,
    ic('ok',16) + ' Salvar', async () => {
      const titulo = $('lk-titulo').value.trim(), url = $('lk-url').value.trim();
      const grupo = (document.querySelector('#lk-grupo .hist-chip.on') || {}).dataset?.g || 'guias';
      if(!titulo){ $('modal-erro').textContent = 'Dê um nome ao link.'; return; }
      if(!/^https:\/\/\S+\.\S+/.test(url)){ $('modal-erro').textContent = 'O link precisa começar com https:// (copie o endereço completo do navegador).'; return; }
      const corpo = { titulo, url, grupo, emoji: $('lk-emoji').value.trim() || null, copiar: $('lk-copiar').checked };
      if(!id) corpo.ordem = Math.max(0, ...LINKS.filter(l => l.grupo === grupo).map(l => l.ordem || 0)) + 1;
      const r = await sbFetch('/rest/v1/links_uteis' + (id ? '?id=eq.' + id : ''), { method: id ? 'PATCH' : 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(corpo) });
      if(!r.ok){ $('modal-erro').textContent = 'Não foi possível salvar. Tente de novo.'; return; }
      fecharModal(); avisoTopo(id ? 'Link atualizado.' : 'Link incluído. Já aparece para toda a equipe.');
      renderCfgLinks(true);
    });
}
async function apagarLink(id){
  const x = LINKS.find(l => l.id === id); if(!x) return;
  if(!confirm('Tirar o link "' + x.titulo + '" para toda a equipe?')) return;
  const r = await sbFetch('/rest/v1/links_uteis?id=eq.' + id, { method: 'DELETE' });
  if(!r.ok){ $('modal-erro').textContent = 'Não foi possível tirar agora.'; return; }
  fecharModal();
  // desfazer: recoloca o mesmo link
  const copia = { grupo: x.grupo, titulo: x.titulo, url: x.url, emoji: x.emoji, ordem: x.ordem, copiar: x.copiar };
  window._linkDesfazer = copia;
  avisoTopo('Link tirado. <button type="button" class="aviso-desfazer" onclick="desfazerApagarLink()">desfazer</button>');
  clearTimeout(avisoTopo._t); avisoTopo._t = setTimeout(() => $('aviso-topo').classList.remove('on'), 9000);
  renderCfgLinks(true);
}
async function desfazerApagarLink(){
  const c = window._linkDesfazer; if(!c) return; window._linkDesfazer = null;
  const r = await sbFetch('/rest/v1/links_uteis', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(c) });
  avisoTopo(r.ok ? 'Link de volta.' : 'Não foi possível desfazer.');
  renderCfgLinks(true);
}
async function moverLink(id, dir){
  const x = LINKS.find(l => l.id === id); if(!x) return;
  const l = LINKS.filter(k => k.grupo === x.grupo);
  const i = l.indexOf(x), j = i + dir; if(j < 0 || j >= l.length) return;
  const y = l[j];
  // reordena o grupo inteiro (1, 2, 3...) já com a troca
  const nova = l.slice(); nova[i] = y; nova[j] = x;
  await Promise.all(nova.map((k, n) => (k.ordem !== n + 1) ? sbFetch('/rest/v1/links_uteis?id=eq.' + k.id, { method: 'PATCH', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify({ ordem: n + 1 }) }) : null));
  renderCfgLinks(true);
}

// ── conexões (gestora) ──
async function renderCfgConexoes(){
  const bo = $('cfg-con-olist'), ba = $('cfg-con-agenda');
  try{
    const s = await olistChamar('status');
    const quando = s.atualizadoEm ? new Date(s.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    bo.innerHTML = s.conectado
      ? `<div><strong>🧾 Olist Tiny</strong><span>✅ Conectado${s.conectadoPor ? ' por ' + escHtml(s.conectadoPor) : ''}${quando ? ' · renovado em ' + quando : ''}</span></div><button type="button" class="conf-link" onclick="olistConectar()">reconectar</button>`
      : `<div><strong>🧾 Olist Tiny</strong><span>⚠️ ${s.configurado ? 'Desconectado: a busca de clientes, a garantia e o pós-venda param.' : 'Falta cadastrar a chave do aplicativo no Supabase.'}</span></div>${s.configurado ? '<button type="button" class="btn-outline" onclick="olistConectar()">Conectar</button>' : ''}`;
  }catch(e){ bo.innerHTML = '<div><strong>🧾 Olist Tiny</strong><span>⚠️ Não foi possível verificar agora.</span></div>'; }
  try{
    const s = await agendaChamar('status');
    ba.innerHTML = `<div><strong>📅 Agenda CLIENTES CDP</strong><span>${s.ok ? '✅ Lendo a agenda "' + escHtml(s.nome || 'CLIENTES CDP') + '" (conta da Madeleine)' : '⚠️ ' + (!s.configurado ? 'Não ligada: faltam AGENDA_URL e AGENDA_SEGREDO no Supabase.' : s.erro === 'segredo_diferente' ? 'O segredo do script e o do Supabase não são iguais.' : 'Não foi possível ler a agenda agora.')}</span></div>`;
  }catch(e){ ba.innerHTML = '<div><strong>📅 Agenda CLIENTES CDP</strong><span>⚠️ Não foi possível verificar agora.</span></div>'; }
}
