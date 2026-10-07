// ═══════════════════════════════════════════════════════
// LOGIN (Fase 1) — contas do Supabase Auth, uma por pessoa.
// • Entra por usuário (como no Olist); o e-mail fica por trás.
// • A sessão fica guardada no aparelho e é renovada sozinha.
// • Todo acesso ao banco passa por sbFetch(), que manda o "crachá" (token) de quem está logado.
// • No primeiro acesso (senha provisória criada pela Bru no painel), a pessoa cria a própria senha.
// A senha nunca é guardada nem aparece no código: vai direto para o Supabase.
// ═══════════════════════════════════════════════════════
const SB_URL_LOGIN = 'https://hvgtbwkpavrclndacder.supabase.co';
const SB_KEY_LOGIN = 'sb_publishable_N2iBuXbs2V4eFrl0UzHjew_Dvm2-oSO';
const AUTH_CHAVE = 'cdp_auth';

// usuário → e-mail da conta (também dá para digitar o próprio e-mail)
const USUARIOS_EMAIL = {
  'cdaspersianas': 'contato@centraldaspersianas.com',
  'bru': 'contato@centraldaspersianas.com',
  'bruna': 'contato@centraldaspersianas.com',
  'operacao@cdaspersianas': 'operacao.centraldaspersianas@gmail.com',
  'mirelle': 'operacao.centraldaspersianas@gmail.com',
  'madeleine@cdaspersianas': 'madeleine@centraldaspersianas.com',
  'madeleine': 'madeleine@centraldaspersianas.com'
};

let AUTH = null;           // { access_token, refresh_token, expires_at, email, nome, papel, provisoria }
let RENOVANDO = null;      // promessa de renovação em andamento (evita renovar duas vezes ao mesmo tempo)

function lerAuth(){ try{ return JSON.parse(localStorage.getItem(AUTH_CHAVE) || 'null'); }catch(e){ return null; } }
function gravarAuth(a){ AUTH = a; try{ a ? localStorage.setItem(AUTH_CHAVE, JSON.stringify(a)) : localStorage.removeItem(AUTH_CHAVE); }catch(e){} }

function emailDoUsuario(u){
  const t = String(u || '').trim().toLowerCase();
  return USUARIOS_EMAIL[t] || (t.includes('.') && t.includes('@') ? t : null);
}

async function pedirToken(corpo, tipo){
  const r = await fetch(SB_URL_LOGIN + '/auth/v1/token?grant_type=' + tipo, {
    method: 'POST', headers: { 'apikey': SB_KEY_LOGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
  });
  const d = await r.json().catch(() => ({}));
  if(!r.ok) { const e = new Error(d.error_description || d.msg || d.error || ('HTTP ' + r.status)); e.status = r.status; e.codigo = d.error_code || d.error; throw e; }
  return d;
}

function sessaoDe(d, anterior){
  return Object.assign({}, anterior || {}, {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || (Math.floor(Date.now()/1000) + (d.expires_in || 3600)),
    email: (d.user && d.user.email) || (anterior && anterior.email) || ''
  });
}

// Garante um token válido (renova se faltar menos de 2 minutos)
async function tokenValido(){
  if(!AUTH) AUTH = lerAuth();
  if(!AUTH || !AUTH.refresh_token) return null;
  if(AUTH.expires_at - Math.floor(Date.now()/1000) > 120) return AUTH.access_token;
  return renovarSessao();
}
async function renovarSessao(){
  if(RENOVANDO) return RENOVANDO;
  RENOVANDO = (async () => {
    try{
      const d = await pedirToken({ refresh_token: AUTH.refresh_token }, 'refresh_token');
      gravarAuth(sessaoDe(d, AUTH));
      return AUTH.access_token;
    }catch(e){
      if(e.status === 400 || e.status === 401){ sessaoExpirada(); }
      return null;
    }finally{ RENOVANDO = null; }
  })();
  return RENOVANDO;
}

function sessaoExpirada(){
  gravarAuth(null);
  mostrarLogin('Sua sessão expirou. Entre de novo.');
}

// Acesso ao banco: sbFetch('/rest/v1/orcamentos?...', { method, headers, body })
async function sbFetch(caminho, opcoes){
  const o = Object.assign({}, opcoes || {});
  const montar = tk => Object.assign({ 'apikey': SB_KEY_LOGIN, 'Authorization': 'Bearer ' + (tk || SB_KEY_LOGIN), 'Content-Type': 'application/json' }, o.headers || {}, { 'Authorization': 'Bearer ' + (tk || SB_KEY_LOGIN) });
  let tk = await tokenValido();
  let r = await fetch(SB_URL_LOGIN + caminho, Object.assign({}, o, { headers: montar(tk) }));
  if(r.status === 401 && AUTH && AUTH.refresh_token){
    tk = await renovarSessao();
    if(tk) r = await fetch(SB_URL_LOGIN + caminho, Object.assign({}, o, { headers: montar(tk) }));
  }
  return r;
}

// ── Tela ──
function $l(id){ return document.getElementById(id); }

function mostrarLogin(msg){
  const t = $l('login-screen'); if(!t) return;
  $l('login-form').hidden = false; $l('senha-form').hidden = true;
  t.style.display = 'flex';
  const e = $l('login-erro');
  if(msg){ e.textContent = msg; e.style.display = 'block'; } else e.style.display = 'none';
}
function esconderLogin(){
  const t = $l('login-screen'); if(t) t.style.display = 'none';
  const badge = $l('usuario-logado'); if(badge) badge.textContent = (AUTH && AUTH.nome) || '';
}

function checkLoginSession(){
  try{ localStorage.removeItem('cdp_sessao'); }catch(e){}   // login antigo: não vale mais
  AUTH = lerAuth();
  if(AUTH && AUTH.refresh_token){
    if(AUTH.provisoria){ mostrarTrocaSenha(true); return false; }
    esconderLogin(); return true;
  }
  mostrarLogin();
  return false;
}

async function carregarPerfil(){
  const r = await sbFetch('/rest/v1/perfis?select=nome,papel,senha_provisoria&email=eq.' + encodeURIComponent(AUTH.email));
  const l = r.ok ? await r.json() : [];
  const p = l[0] || {};
  gravarAuth(Object.assign({}, AUTH, { nome: p.nome || AUTH.email.split('@')[0], papel: p.papel || '', provisoria: !!p.senha_provisoria }));
}

async function doLogin(){
  const usuario = $l('login-user').value.trim();
  const senha = $l('login-pass').value;
  const btn = $l('login-btn'), erro = $l('login-erro');
  erro.style.display = 'none';
  if(!usuario || !senha){ erro.textContent = 'Preencha usuário e senha.'; erro.style.display = 'block'; return; }
  const email = emailDoUsuario(usuario);
  if(!email){ erro.textContent = 'Usuário não encontrado. Confira como está escrito.'; erro.style.display = 'block'; return; }
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try{
    const d = await pedirToken({ email, password: senha }, 'password');
    gravarAuth(sessaoDe(d));
    await carregarPerfil();
    $l('login-pass').value = '';
    if(AUTH.provisoria){ mostrarTrocaSenha(true); }
    else { esconderLogin(); aoEntrar(); }
  }catch(e){
    erro.textContent = (e.status === 400 || e.status === 401) ? 'Usuário ou senha incorretos.' : 'Erro de conexão. Tente de novo.';
    erro.style.display = 'block';
  }
  btn.textContent = 'Entrar'; btn.disabled = false;
}

// Depois de entrar: recarrega a tela inicial com os dados de quem entrou
function aoEntrar(){
  if(typeof carregarAjustesPreco === 'function') carregarAjustesPreco();
  if(typeof HIST_CARREGADO !== 'undefined') HIST_CARREGADO = false;
  if(typeof irParaTab === 'function') irParaTab('inicio');
  if(typeof renderInicio === 'function') renderInicio(true);
}

async function logout(){
  if(!confirm('Sair do sistema?')) return;
  try{ const tk = await tokenValido(); if(tk) await fetch(SB_URL_LOGIN + '/auth/v1/logout', { method: 'POST', headers: { 'apikey': SB_KEY_LOGIN, 'Authorization': 'Bearer ' + tk } }); }catch(e){}
  gravarAuth(null);
  location.reload();
}

// ── Criar / trocar a própria senha ──
function mostrarTrocaSenha(obrigatoria){
  const t = $l('login-screen'); if(!t) return;
  $l('login-form').hidden = true; $l('senha-form').hidden = false;
  $l('senha-titulo').textContent = obrigatoria ? 'Crie a sua senha' : 'Trocar minha senha';
  $l('senha-dica').textContent = obrigatoria
    ? 'Primeiro acesso, ' + ((AUTH && AUTH.nome) || '') + '! A senha que você recebeu é provisória. Crie uma só sua (diferente da do Olist).'
    : 'Digite a nova senha duas vezes.';
  $l('senha-cancelar').hidden = !!obrigatoria;
  $l('senha-nova').value = ''; $l('senha-conf').value = '';
  $l('senha-erro').style.display = 'none';
  t.style.display = 'flex';
  setTimeout(() => $l('senha-nova').focus(), 50);
}
function cancelarTrocaSenha(){ esconderLogin(); }

async function salvarNovaSenha(){
  const nova = $l('senha-nova').value, conf = $l('senha-conf').value;
  const erro = $l('senha-erro'), btn = $l('senha-btn');
  const falha = m => { erro.textContent = m; erro.style.display = 'block'; };
  erro.style.display = 'none';
  if(nova.length < 8) return falha('A senha precisa ter pelo menos 8 caracteres.');
  if(nova !== conf) return falha('As duas senhas não estão iguais.');
  btn.disabled = true; btn.textContent = 'Salvando...';
  try{
    const r = await sbFetch('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: nova }) });
    if(!r.ok){
      const d = await r.json().catch(() => ({}));
      const cod = d.error_code || d.code || '';
      falha(cod === 'same_password' ? 'A nova senha precisa ser diferente da atual.'
          : cod === 'weak_password' ? 'Senha fraca demais. Misture letras e números.'
          : 'Não foi possível salvar. Tente de novo.');
    } else {
      if(AUTH && AUTH.provisoria){
        await sbFetch('/rest/v1/perfis?email=eq.' + encodeURIComponent(AUTH.email), { method: 'PATCH', body: JSON.stringify({ senha_provisoria: false }) });
        gravarAuth(Object.assign({}, AUTH, { provisoria: false }));
        esconderLogin(); aoEntrar();
      } else {
        esconderLogin();
      }
      if(typeof avisoTopo === 'function') avisoTopo('Senha salva.');
    }
  }catch(e){ falha('Erro de conexão. Tente de novo.'); }
  btn.disabled = false; btn.textContent = 'Salvar senha';
}

// Nome de quem está logado (usado na saudação e na tela)
function getUsuarioLogado(){ const a = AUTH || lerAuth(); return (a && a.nome) || null; }

document.addEventListener('DOMContentLoaded', checkLoginSession);
