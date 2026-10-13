// ═══════════════════════════════════════════════════════
// CIDADES → ESTADO (UF)
// Ao digitar a cidade aparece uma lista com as cidades parecidas; ao escolher, o estado (UF) é preenchido sozinho.
// Lista: todos os municípios do Brasil (js/municipios.js), com Pernambuco e vizinhos primeiro.
// Cidade fora da lista (ex.: distrito): é só escolher o estado à mão.
// ═══════════════════════════════════════════════════════
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const CIDADES_UF = {
  PE: ['Recife','Jaboatão dos Guararapes','Olinda','Paulista','Camaragibe','São Lourenço da Mata','Abreu e Lima','Igarassu',
       'Cabo de Santo Agostinho','Ipojuca','Moreno','Ilha de Itamaracá','Itapissuma','Araçoiaba','Goiana','Vitória de Santo Antão',
       'Caruaru','Gravatá','Bezerros','Chã Grande','Pombos','Escada','Sirinhaém','Rio Formoso','Tamandaré','Barreiros',
       'São José da Coroa Grande','Palmares','Carpina','Paudalho','Nazaré da Mata','Limoeiro','Timbaúba','Surubim',
       'Santa Cruz do Capibaribe','Toritama','Belo Jardim','Pesqueira','Arcoverde','Garanhuns','Serra Talhada','Salgueiro',
       'Petrolina','Ouricuri','Araripina','Fernando de Noronha'],
  PB: ['João Pessoa','Cabedelo','Bayeux','Santa Rita','Conde','Campina Grande'],
  AL: ['Maceió','Maragogi','Japaratinga','Porto de Pedras','São Miguel dos Milagres','Arapiraca'],
  RN: ['Natal','Parnamirim','Mossoró'], CE: ['Fortaleza'], PI: ['Teresina'], MA: ['São Luís'], SE: ['Aracaju'],
  BA: ['Salvador'], PA: ['Belém'], AM: ['Manaus'], AP: ['Macapá'], RR: ['Boa Vista'], RO: ['Porto Velho'],
  AC: ['Rio Branco'], TO: ['Palmas'], GO: ['Goiânia'], DF: ['Brasília'], MT: ['Cuiabá'], MS: ['Campo Grande'],
  MG: ['Belo Horizonte'], ES: ['Vitória','Vila Velha'], RJ: ['Rio de Janeiro','Niterói'], SP: ['São Paulo','Campinas'],
  PR: ['Curitiba'], SC: ['Florianópolis'], RS: ['Porto Alegre']
};

const _normCidade = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Todas as cidades (lista curta acima + todos os municípios do IBGE em js/municipios.js).
// Ordem de preferência quando o nome existe em mais de um estado: PE, vizinhos, resto.
const _PRIO_UF = { PE: 0, PB: 1, AL: 1, RN: 1 };
const _CIDADES = [];            // [{ nome, uf, n (nome sem acento), prio }]
const _MAPA_CIDADES = {};       // nome sem acento → [{ nome, uf }]
(function montarCidades(){
  const vistos = new Set();
  const add = (nome, uf) => {
    const n = _normCidade(nome), chave = n + '|' + uf;
    if(!n || vistos.has(chave)) return;
    vistos.add(chave);
    const c = { nome, uf, n, prio: _PRIO_UF[uf] ?? 2 };
    _CIDADES.push(c);
    (_MAPA_CIDADES[n] = _MAPA_CIDADES[n] || []).push(c);
  };
  Object.entries(CIDADES_UF).forEach(([uf, l]) => l.forEach(c => add(c, uf)));
  if(typeof MUNICIPIOS_BR === 'object') Object.entries(MUNICIPIOS_BR).forEach(([uf, l]) => l.split('|').forEach(c => add(c, uf)));
  Object.values(_MAPA_CIDADES).forEach(l => l.sort((a, b) => a.prio - b.prio));
})();

// "jaboatao dos guararapes" → { nome: 'Jaboatão dos Guararapes', uf: 'PE' }
// Nome que existe em vários estados: só responde se um deles for PE ou vizinho (senão a pessoa escolhe na lista)
function cidadeConhecida(t, uf){
  const l = _MAPA_CIDADES[_normCidade(t)];
  if(!l) return null;
  if(uf){ const m = l.find(c => c.uf === uf); if(m) return m; }
  if(l.length === 1 || (l[0].prio < 2 && l[1].prio > l[0].prio)) return l[0];
  return null;
}

// Sugestões enquanto digita: nome exato, depois PE e vizinhos, depois as que começam com o texto
function buscarCidades(t, max = 8){
  const q = _normCidade(t);
  if(q.length < 2) return [];
  const res = [];
  _CIDADES.forEach(c => {
    let r = -1;
    if(c.n === q) r = 0;
    else if(c.n.startsWith(q)) r = 1;
    else if((' ' + c.n).includes(' ' + q)) r = 2;
    if(r >= 0) res.push([r, c]);
  });
  res.sort((a, b) => (a[0] > 0) - (b[0] > 0) || a[1].prio - b[1].prio || a[0] - b[0] || a[1].n.length - b[1].n.length || a[1].n.localeCompare(b[1].n));
  return res.slice(0, max).map(x => x[1]);
}

// Lista suspensa de cidades (no lugar da lista do navegador, que no celular quase não aparece)
let _CID_LISTA = null;
function _cidListaEl(){
  if(!_CID_LISTA){
    _CID_LISTA = document.createElement('div');
    _CID_LISTA.className = 'cid-lista';
    _CID_LISTA.setAttribute('role', 'listbox');
    _CID_LISTA.hidden = true;
    document.body.appendChild(_CID_LISTA);
  }
  return _CID_LISTA;
}

// Liga um campo de cidade a um campo de UF: escolheu cidade da lista → acerta a grafia e o estado
function ligarCidadeUf(idCidade, idUf){
  const c = document.getElementById(idCidade), u = document.getElementById(idUf);
  if(!c || !u) return;
  c.removeAttribute('list');
  c.setAttribute('autocomplete', 'off');
  c.setAttribute('role', 'combobox');
  c.setAttribute('aria-autocomplete', 'list');
  let itens = [], ativo = -1;
  const lista = _cidListaEl();
  const avisar = el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  const escolher = cid => {
    c.value = cid.nome;
    if(u.value !== cid.uf){ u.value = cid.uf; avisar(u); }
    c.dispatchEvent(new Event('input', { bubbles: true }));
    fechar();
  };
  const fechar = () => { if(lista.dono === c){ lista.hidden = true; lista.dono = null; } itens = []; ativo = -1; };
  const posicionar = () => {
    const r = c.getBoundingClientRect();
    lista.style.left = Math.max(8, r.left) + 'px';
    lista.style.top = (r.bottom + 4) + 'px';
    lista.style.width = Math.max(r.width, 220) + 'px';
  };
  const desenhar = () => {
    itens = buscarCidades(c.value);
    if(!itens.length || document.activeElement !== c){ fechar(); return; }
    if(itens.length === 1 && itens[0].nome === c.value && itens[0].uf === u.value){ fechar(); return; }
    ativo = Math.min(ativo, itens.length - 1);
    lista.innerHTML = itens.map((x, i) => `<div class="cid-op${i === ativo ? ' on' : ''}" role="option" data-i="${i}"><span>${x.nome}</span><b>${x.uf}</b></div>`).join('');
    lista.dono = c;
    lista.hidden = false;
    posicionar();
  };
  c.addEventListener('input', e => {
    if(e.isTrusted === false && lista.dono !== c) return;
    ativo = -1;
    // digitou o nome inteiro de uma cidade conhecida → estado preenchido sem precisar escolher
    const k = cidadeConhecida(c.value);
    if(k && k.nome.length === c.value.trim().length && u.value !== k.uf){ u.value = k.uf; avisar(u); }
    desenhar();
  });
  c.addEventListener('focus', () => { if(c.value.trim().length >= 2) desenhar(); });
  c.addEventListener('keydown', e => {
    if(lista.hidden || lista.dono !== c) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); ativo = (ativo + 1) % itens.length; desenhar(); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); ativo = ativo <= 0 ? itens.length - 1 : ativo - 1; desenhar(); }
    else if(e.key === 'Enter'){ const x = itens[ativo >= 0 ? ativo : 0]; if(x){ e.preventDefault(); escolher(x); } }
    else if(e.key === 'Escape'){ fechar(); }
  });
  c.addEventListener('blur', () => {
    setTimeout(() => {
      if(lista.dono === c) fechar();
      const k = cidadeConhecida(c.value, u.value);   // saiu do campo: acerta grafia ("recife" → "Recife")
      if(k){ if(c.value !== k.nome){ c.value = k.nome; c.dispatchEvent(new Event('input', { bubbles: true })); } if(u.value !== k.uf){ u.value = k.uf; avisar(u); } }
    }, 150);
  });
  // toque/clique numa opção (mousedown para não perder o foco antes)
  lista.addEventListener('mousedown', e => {
    if(lista.dono !== c) return;
    const op = e.target.closest('.cid-op');
    if(op){ e.preventDefault(); escolher(itens[+op.dataset.i]); }
  });
  window.addEventListener('resize', () => { if(lista.dono === c) posicionar(); });
  window.addEventListener('scroll', () => { if(lista.dono === c) posicionar(); }, true);
}

// "Recife/PE" (como vem do Olist) → { cidade: 'Recife', uf: 'PE' }
function separarCidadeUf(t){
  const m = String(t || '').match(/^(.*?)\s*[\/\-]\s*([A-Za-z]{2})$/);
  if(m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  if(/^[A-Za-z]{2}$/.test(String(t || '').trim())) return { cidade: '', uf: String(t).trim().toUpperCase() };
  return { cidade: String(t || '').trim(), uf: '' };
}

// Endereço para a proposta: "Rua X, 10 - Boa Viagem - Recife/PE" (sem repetir o que já está escrito)
// "-" = cliente não informou (o campo é obrigatório, mas às vezes o cliente não passa)
const semInfo = v => /^[\s\-–—.]*$/.test(String(v || ''));
function enderecoCompleto(c){
  c = Object.fromEntries(Object.entries(c || {}).map(([k, v]) => [k, semInfo(v) ? '' : v]));
  const end = String(c.end || '').trim(), n = _normCidade(end);
  const ja = v => !!v && n.includes(_normCidade(v));
  const partes = [end];
  if(c.bairro && !ja(c.bairro)) partes.push(String(c.bairro).trim());
  const cid = [c.cidade, c.uf].filter(Boolean).join('/');
  if(cid && !ja(c.cidade || c.uf)) partes.push(cid);
  return partes.filter(Boolean).join(' - ');
}

// Botão "Cliente não informou": preenche bairro, cidade e UF com "-" para poder seguir
function localNaoInformado(){
  [['novo-bairro','-'],['novo-cidade','-'],['novo-uf','-']].forEach(([id, v]) => { const el = document.getElementById(id); if(el) el.value = v; });
  const e = document.getElementById('novo-erro'); if(e) e.textContent = '';
}

// Monta as opções (estados e sugestões de cidade) nos formulários
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('select.sel-uf').forEach(s => {
    s.innerHTML = '<option value="">UF</option>' + UFS.map(u => `<option value="${u}">${u}</option>`).join('') + '<option value="-">—</option>';
  });
  ligarCidadeUf('novo-cidade', 'novo-uf');
  ligarCidadeUf('cli-cidade', 'cli-uf');
});
