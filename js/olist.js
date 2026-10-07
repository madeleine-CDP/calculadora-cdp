// ═══════════════════════════════════════════════════════
// OLIST (Tiny) — busca de cliente no "Novo orçamento". Só leitura.
// Tudo passa pela função "olist" no servidor do Supabase; a chave do Olist nunca chega aqui.
// ═══════════════════════════════════════════════════════
let OLIST_STATUS = null;      // { configurado, conectado, conectadoPor }
let OLIST_TIMER = null, OLIST_SEQ = 0, OLIST_RES = [];

async function olistChamar(rota, corpo){
  const tk = (typeof tokenValido === 'function') ? await tokenValido() : null;
  const r = await fetch(SB_URL_LOGIN + '/functions/v1/olist/' + rota, {
    method: 'POST',
    headers: { 'apikey': SB_KEY_LOGIN, 'Authorization': 'Bearer ' + (tk || SB_KEY_LOGIN), 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {})
  });
  const d = await r.json().catch(() => ({}));
  if(!r.ok){ const e = new Error(d.erro || ('HTTP ' + r.status)); e.codigo = d.erro; throw e; }
  return d;
}

const olistEhAdmin = () => { const a = (typeof AUTH !== 'undefined' && AUTH) || {}; return a.papel === 'admin' || a.papel === 'dona'; };

// Mostra (no Novo orçamento) se a busca está pronta, ou o botão de conectar para a Bruna/Madeleine
async function olistPrepararNovo(){
  const box = $('olist-aviso'); if(!box) return;
  box.innerHTML = '';
  try{ OLIST_STATUS = await olistChamar('status'); }catch(e){ OLIST_STATUS = null; }
  const s = OLIST_STATUS;
  const busca = $('olist-busca-wrap');
  if(s && s.conectado){ if(busca) busca.hidden = false; return; }
  if(busca) busca.hidden = true;
  if(!s) return;
  if(olistEhAdmin()){
    box.innerHTML = s.configurado
      ? `<div class="olist-aviso">${ic('info',15)} <span>Busca de clientes do Olist desligada.</span> <button type="button" class="btn-outline" onclick="olistConectar()">Conectar ao Olist</button></div>`
      : `<div class="olist-aviso">${ic('info',15)} <span>Busca do Olist: falta cadastrar a chave do aplicativo no Supabase.</span></div>`;
  }
}

async function olistConectar(){
  try{
    const d = await olistChamar('iniciar', { voltar: location.origin + location.pathname });
    location.href = d.url;
  }catch(e){ avisoTopo('Não foi possível iniciar a conexão com o Olist.'); }
}

// Voltando da autorização do Olist (?olist=conectado / ?olist=erro)
(function olistRetorno(){
  const u = new URL(location.href); const v = u.searchParams.get('olist');
  if(!v) return;
  u.searchParams.delete('olist'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  setTimeout(() => { if(typeof avisoTopo === 'function') avisoTopo(v === 'conectado' ? 'Olist conectado! A busca de clientes já está ligada.' : 'A conexão com o Olist não foi concluída. Tente de novo.'); }, 600);
})();

function olistDigitou(){
  clearTimeout(OLIST_TIMER);
  const termo = $('olist-busca').value.trim();
  const res = $('olist-res');
  const dig = termo.replace(/\D/g,'');
  if(termo.length < 3 && dig.length < 8){ res.innerHTML = ''; return; }
  res.innerHTML = '<div class="olist-msg">Buscando no Olist…</div>';
  OLIST_TIMER = setTimeout(() => olistBuscar(termo), 450);
}

async function olistBuscar(termo){
  const seq = ++OLIST_SEQ, res = $('olist-res');
  try{
    const d = await olistChamar('buscar', { termo });
    if(seq !== OLIST_SEQ) return;
    OLIST_RES = d.clientes || [];
    if(!OLIST_RES.length){ res.innerHTML = '<div class="olist-msg">Nenhum cliente encontrado no Olist. Pode preencher à mão abaixo.</div>'; return; }
    res.innerHTML = OLIST_RES.map((c, i) => `
      <button type="button" class="olist-item" onclick="olistEscolher(${i})">
        <strong>${escHtml(c.nome)}</strong>
        <span>${[c.celular || c.telefone, c.bairro, c.cidade].filter(Boolean).map(escHtml).join(' · ')}</span>
        ${c.cpfCnpj ? `<em>${escHtml(c.cpfCnpj)}</em>` : ''}
      </button>`).join('');
  }catch(e){
    if(seq !== OLIST_SEQ) return;
    res.innerHTML = `<div class="olist-msg erro">${e.codigo === 'desconectado' ? 'O Olist está desconectado. Peça para a Bruna reconectar.' : 'Olist indisponível agora. Preencha à mão abaixo.'}</div>`;
  }
}

async function olistEscolher(i){
  let c = OLIST_RES[i]; if(!c) return;
  const res = $('olist-res');
  res.innerHTML = '<div class="olist-msg">Puxando o cadastro completo…</div>';
  // a lista do Olist vem resumida (sem celular): o cadastro completo vem numa segunda consulta
  try{ const d = await olistChamar('contato', { id: c.id }); if(d && d.cliente) c = Object.assign({}, c, Object.fromEntries(Object.entries(d.cliente).filter(([k, v]) => v))); }
  catch(e){ /* segue com o que veio na lista */ }
  const por = (id, v) => { const el = $(id); if(el && v) el.value = v; };
  por('novo-nome', c.nome);
  const cel = c.celular || c.telefone;
  if(cel){ $('novo-tel').value = cel; if(typeof mascaraTel === 'function') mascaraTel($('novo-tel')); }
  por('novo-bairro', c.bairro);
  const loc = (typeof separarCidadeUf === 'function') ? separarCidadeUf(c.cidade) : { cidade: '', uf: '' };
  if(loc.cidade){ const k = (typeof cidadeConhecida === 'function') && cidadeConhecida(loc.cidade); por('novo-cidade', k ? k.nome : loc.cidade); }
  por('novo-uf', loc.uf);
  por('novo-end', c.endereco);
  por('novo-cpf', c.cpfCnpj); por('novo-email', c.email);
  if(!cel) avisoTopo('Esse cliente está sem celular no Olist. Preencha o WhatsApp à mão.');
  if(c.endereco || c.cpfCnpj || c.email){ const m = document.querySelector('#tab-novo .novo-mais'); if(m) m.open = true; }
  const chip = document.querySelector('#tab-novo [data-origem="Já é cliente"]');
  if(chip && typeof escolherOrigem === 'function' && !chip.classList.contains('on')) escolherOrigem(chip);
  if(typeof limparAvisoRepetido === 'function') limparAvisoRepetido();
  $('olist-busca').value = ''; $('olist-res').innerHTML = '';
  const box = $('olist-pedidos');
  box.innerHTML = `<div class="olist-ped"><div class="olist-ped-tit">${ic('ok',15)} Dados puxados do Olist · ${escHtml(c.nome)}</div><div class="olist-msg">Buscando pedidos anteriores…</div></div>`;
  try{
    const d = await olistChamar('pedidos', { cpfCnpj: c.cpfCnpj, nome: c.nome });
    const l = d.pedidos || [];
    box.querySelector('.olist-msg').outerHTML = l.length
      ? `<div class="olist-ped-lista">${l.map(p => `<div><span>Pedido ${escHtml(p.numero)}</span><span>${escHtml(olistData(p.data))}</span><span>${'R$ ' + Number(p.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><em>${escHtml(p.situacao)}</em></div>`).join('')}</div>`
      : '<div class="olist-msg">Nenhum pedido anterior no Tiny.</div>';
  }catch(e){ const m = box.querySelector('.olist-msg'); if(m) m.textContent = 'Não deu para ver os pedidos agora.'; }
}

function olistData(s){
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s || '');
}

function olistLimparNovo(){
  ['olist-res','olist-pedidos'].forEach(id => { const el = $(id); if(el) el.innerHTML = ''; });
  const b = $('olist-busca'); if(b) b.value = '';
}
