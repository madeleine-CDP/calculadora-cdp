// ═════════ CAMPANHAS DE DESCONTO DAS FÁBRICAS (pedido da Bru, 21/11/2026) ═════════
// Ex.: Black November da Real = 40% (no lugar dos 20%) na Celular e na Horizontal de Bambu, até 30/11.
// Guardadas em configuracoes (chave 'campanhas', valor {lista:[...]}) — sem tabela nova; toda a equipe lê, só a gestora muda.
// Campanha: {id, nome, fab:'real'|'dec', desconto (%), inicio 'AAAA-MM-DD', fim 'AAAA-MM-DD', ativo, regras:[{prod, fam?, col?}]}
//   regra: produto obrigatório; família opcional (vazia = todas); col = texto que o nome da coleção contém (vazio = todas).
// No cálculo (calcular() e a comparação entre fábricas) o desconto da campanha SUBSTITUI o desconto principal da fábrica
// (Real: os 20%; Decore: os 12%, mantendo os 3% do site). O desconto é repassado ao cliente (à vista = custo × 2), decisão da Bru.
// Acessórios continuam com o desconto normal. Fora do período, volta sozinho ao normal.
let CAMPANHAS = [];
const campHoje = () => (typeof hojeIso === 'function' ? hojeIso() : new Date().toISOString().slice(0, 10));
const campDiaBR = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
const campDiaCurto = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

async function carregarCampanhas(){
  try{
    const r = await sbFetch('/rest/v1/configuracoes?select=*&chave=eq.campanhas');
    if(!r.ok) return false;
    const l = await r.json();
    CAMPANHAS = (l[0] && l[0].valor && Array.isArray(l[0].valor.lista)) ? l[0].valor.lista : [];
    return true;
  }catch(e){ return false; }
}
function campSituacao(c, hoje){
  hoje = hoje || campHoje();
  if(c.ativo === false) return 'encerrada';
  if(c.inicio && hoje < c.inicio) return 'agendada';
  if(c.fim && hoje > c.fim) return 'encerrada';
  return 'ativa';
}
function campRegraServe(r, prod, fam, col){
  if(!r || !r.prod || r.prod !== prod) return false;
  if(r.fam && r.fam !== fam) return false;
  if(r.col && !String(col || '').toLowerCase().includes(String(r.col).toLowerCase())) return false;
  return true;
}
// campanha que vale hoje para este produto (a de maior desconto, se houver mais de uma)
function campanhaAtiva(fab, prod, fam, col){
  const l = CAMPANHAS.filter(c => c.fab === fab && campSituacao(c) === 'ativa' && (c.regras || []).some(r => campRegraServe(r, prod, fam, col)));
  return l.sort((a, b) => Number(b.desconto) - Number(a.desconto))[0] || null;
}
const campResumo = (c) => c ? { id: c.id, nome: c.nome, desconto: Number(c.desconto), fim: c.fim || null } : null;
// a campanha que o item usou já acabou? (para avisar na pasta e na Gestão)
function campItemVencida(item){
  const c = item && item.full && item.full.campanha;
  return !!(c && c.fim && campHoje() > c.fim);
}
function campEtiquetaItem(item){
  const c = item && item.full && item.full.campanha;
  if(!c) return '';
  if(campItemVencida(item)) return `<span class="camp-tag vencida" title="Recalcule o item: a campanha acabou">${ic('info',13)} ${escHtml(c.nome)} acabou em ${campDiaCurto(c.fim)} · recalcular</span>`;
  return `<span class="camp-tag" title="Desconto de campanha da fábrica">${ic('etiqueta',13)} ${escHtml(c.nome)}${c.fim ? ' · até ' + campDiaCurto(c.fim) : ''}</span>`;
}
// texto para a proposta (validade): só quando algum item usou campanha que ainda vale
function campTextoProposta(itens){
  const cs = {};
  (itens || []).forEach(i => { const c = i && i.full && i.full.campanha; if(c && !campItemVencida(i)) cs[c.nome + '|' + (c.fim || '')] = c; });
  const l = Object.values(cs);
  if(!l.length) return '';
  return ' ' + l.map(c => 'Condição especial ' + c.nome + (c.fim ? ' válida até ' + campDiaBR(c.fim) : '') + '.').join(' ');
}

// ── Tela (Configurações → Tabelas de preço) ──
let CAMP_EDIT = null;   // campanha sendo criada/editada (cópia)
function campProdutos(fab){
  const db = fab === 'real' ? DB_REAL : DB_DECORE, m = {};
  Object.keys(db).forEach(k => { const [, prod, fam] = k.split('|'); (m[prod] = m[prod] || []).push(fam); });
  return m;
}
function campRegraTexto(r){
  return [r.prod, r.fam || 'todas as famílias', r.col ? 'coleções com "' + r.col + '"' : ''].filter(Boolean).join(' · ');
}
function blocoCampanhas(fab){
  const l = CAMPANHAS.filter(c => c.fab === fab).sort((a, b) => String(b.inicio || '').localeCompare(String(a.inicio || '')));
  const SIT = { ativa: ['s-ok', 'Ativa'], agendada: ['s-esp', 'Agendada'], encerrada: ['s-neu', 'Encerrada'] };
  return `<div class="card tp-card camp-card" id="camp-bloco">
    <div class="tp-tit">Campanhas da fábrica <span>(desconto especial por um período, ex.: Black November)</span></div>
    <div class="conf-nota">No período, os produtos da campanha calculam com o desconto dela no lugar do desconto normal, e o desconto vai para o preço do cliente. No dia seguinte ao fim, volta sozinho.</div>
    ${l.length ? `<div class="camp-lista">${l.map(c => { const [cls, rot] = SIT[campSituacao(c)];
      return `<div class="camp-l"><div class="camp-l-tx"><b>${escHtml(c.nome)}</b> <span class="selo ${cls}">${rot}</span>
        <div class="conf-nota">${Number(c.desconto).toLocaleString('pt-BR')}% · ${c.inicio ? campDiaCurto(c.inicio) : '—'} a ${c.fim ? campDiaBR(c.fim) : 'sem fim'}</div>
        <div class="conf-nota">${(c.regras || []).map(r => escHtml(campRegraTexto(r))).join('<br>')}</div></div>
        <div class="camp-l-bts"><button type="button" class="conf-link" onclick="campEditar('${c.id}')">editar</button>
        ${campSituacao(c) !== 'encerrada' ? `<button type="button" class="conf-link" onclick="campEncerrar('${c.id}')">encerrar agora</button>` : `<button type="button" class="conf-link" onclick="campExcluir('${c.id}')">excluir</button>`}</div></div>`; }).join('')}</div>` : '<div class="conf-nota">Nenhuma campanha cadastrada.</div>'}
    ${CAMP_EDIT ? campFormulario(fab) : `<button type="button" class="btn-outline camp-nova" onclick="campNova('${fab}')">${ic('mais',15)} Nova campanha</button>`}
  </div>`;
}
function campNova(fab){ CAMP_EDIT = { id: 'c' + Date.now(), nome: '', fab, desconto: '', inicio: campHoje(), fim: '', ativo: true, regras: [{ prod: '', fam: '', col: '' }], nova: true }; campRedesenhar(); }
function campEditar(id){ const c = CAMPANHAS.find(x => x.id === id); if(!c) return; CAMP_EDIT = JSON.parse(JSON.stringify(c)); if(!CAMP_EDIT.regras.length) CAMP_EDIT.regras.push({ prod: '', fam: '', col: '' }); campRedesenhar(); }
function campRedesenhar(){ const b = $('camp-bloco'); if(b) b.outerHTML = blocoCampanhas(TP_FAB); }
function campFormulario(fab){
  const c = CAMP_EDIT, prods = campProdutos(fab);
  return `<form class="camp-form" onsubmit="event.preventDefault();campSalvar()">
    <div class="novo-linha">
      <label class="novo-campo"><span>Nome</span><input id="camp-nome" maxlength="60" value="${escHtml(c.nome)}" placeholder="Ex.: Black November"></label>
      <label class="novo-campo"><span>Desconto da fábrica (%)</span><input id="camp-desc" inputmode="decimal" value="${escHtml(String(c.desconto || ''))}" placeholder="${fab === 'real' ? 'Ex.: 40 (normal: 20)' : 'Ex.: 20 (normal: 12, + os 3% do site)'}"></label>
    </div>
    <div class="novo-linha">
      <label class="novo-campo"><span>Começa em</span><input type="date" id="camp-ini" value="${escHtml(c.inicio || '')}"></label>
      <label class="novo-campo"><span>Termina em (último dia)</span><input type="date" id="camp-fim" value="${escHtml(c.fim || '')}"></label>
    </div>
    <div class="camp-regras-tit">Produtos da campanha</div>
    ${c.regras.map((r, i) => `<div class="camp-regra">
      <select onchange="CAMP_EDIT.regras[${i}].prod=this.value;CAMP_EDIT.regras[${i}].fam='';campLerCampos();campRedesenhar()" aria-label="Produto"><option value="">Produto…</option>${Object.keys(prods).map(p => `<option${r.prod === p ? ' selected' : ''}>${escHtml(p)}</option>`).join('')}</select>
      <select onchange="CAMP_EDIT.regras[${i}].fam=this.value" aria-label="Família"><option value="">Todas as famílias</option>${(prods[r.prod] || []).map(f => `<option${r.fam === f ? ' selected' : ''}>${escHtml(f)}</option>`).join('')}</select>
      <input value="${escHtml(r.col || '')}" placeholder="Só coleções com… (opcional)" oninput="CAMP_EDIT.regras[${i}].col=this.value" aria-label="Texto da coleção">
      <button type="button" class="conf-link" onclick="campLerCampos();CAMP_EDIT.regras.splice(${i},1);campRedesenhar()">tirar</button>
    </div>`).join('')}
    <button type="button" class="conf-link" onclick="campLerCampos();CAMP_EDIT.regras.push({prod:'',fam:'',col:''});campRedesenhar()">+ outro produto</button>
    <div class="camp-form-bts"><button type="submit" class="btn">${ic('ok',16)} Salvar campanha</button><button type="button" class="btn-outline" onclick="CAMP_EDIT=null;campRedesenhar()">Cancelar</button></div>
  </form>`;
}
function campLerCampos(){
  if(!CAMP_EDIT) return;
  const v = (id) => ($(id) || {}).value;
  if($('camp-nome')) CAMP_EDIT.nome = v('camp-nome').trim();
  if($('camp-desc')) CAMP_EDIT.desconto = v('camp-desc');
  if($('camp-ini')) CAMP_EDIT.inicio = v('camp-ini');
  if($('camp-fim')) CAMP_EDIT.fim = v('camp-fim');
}
async function campGravar(lista, msg){
  const r = await sbFetch('/rest/v1/configuracoes?on_conflict=chave', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ chave: 'campanhas', valor: { lista } }) });
  if(!r.ok){ avisoTopo('Não foi possível salvar a campanha agora.'); return false; }
  CAMPANHAS = lista; CAMP_EDIT = null; campRedesenhar();
  if(msg) avisoTopo(msg);
  return true;
}
async function campSalvar(){
  campLerCampos();
  const c = CAMP_EDIT; if(!c) return;
  const desc = typeof numDoTexto === 'function' ? numDoTexto(c.desconto) : Number(String(c.desconto).replace(',', '.'));
  const regras = c.regras.filter(r => r.prod).map(r => ({ prod: r.prod, fam: r.fam || '', col: (r.col || '').trim() }));
  if(!c.nome){ avisoTopo('Dê um nome à campanha.'); return; }
  if(!(desc > 0 && desc < 100)){ avisoTopo('Informe o desconto da fábrica em % (ex.: 40).'); return; }
  if(!c.fim){ avisoTopo('Informe o último dia da campanha.'); return; }
  if(c.inicio && c.fim < c.inicio){ avisoTopo('O fim está antes do começo.'); return; }
  if(!regras.length){ avisoTopo('Escolha pelo menos um produto.'); return; }
  const nova = { id: c.id, nome: c.nome, fab: c.fab, desconto: desc, inicio: c.inicio || campHoje(), fim: c.fim, ativo: true, regras };
  const lista = CAMPANHAS.filter(x => x.id !== c.id).concat([nova]);
  await campGravar(lista, 'Campanha salva. Os próximos cálculos já usam o desconto dela.');
}
async function campEncerrar(id){
  const antes = CAMPANHAS.map(x => ({ ...x }));
  const lista = CAMPANHAS.map(x => x.id === id ? { ...x, ativo: false } : x);
  CAMP_DESFAZER = antes;
  await campGravar(lista, 'Campanha encerrada. <button type="button" class="aviso-desfazer" onclick="campGravar(CAMP_DESFAZER,\'Desfeito.\')">desfazer</button>');
}
async function campExcluir(id){
  CAMP_DESFAZER = CAMPANHAS.map(x => ({ ...x }));
  await campGravar(CAMPANHAS.filter(x => x.id !== id), 'Campanha excluída. <button type="button" class="aviso-desfazer" onclick="campGravar(CAMP_DESFAZER,\'Desfeito.\')">desfazer</button>');
}
let CAMP_DESFAZER = null;
