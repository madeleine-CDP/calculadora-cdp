const SB_URL_LOGIN = 'https://hvgtbwkpavrclndacder.supabase.co';
const SB_KEY_LOGIN = 'sb_publishable_N2iBuXbs2V4eFrl0UzHjew_Dvm2-oSO';

function checkLoginSession(){
  const sess = localStorage.getItem('cdp_sessao');
  if(sess){
    try{
      const obj = JSON.parse(sess);
      if(obj && obj.nome){
        document.getElementById('login-screen').style.display = 'none';
        const badge = document.getElementById('usuario-logado');
        if(badge) badge.textContent = obj.nome;
        return true;
      }
    } catch(e){}
  }
  return false;
}

async function doLogin(){
  const login = document.getElementById('login-user').value.trim();
  const senha = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const erro = document.getElementById('login-erro');
  erro.style.display = 'none';
  if(!login || !senha){ erro.textContent='Preencha usuário e senha.'; erro.style.display='block'; return; }
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try{
    const resp = await fetch(SB_URL_LOGIN + '/rest/v1/rpc/verificar_login', {
      method: 'POST',
      headers: { 'apikey': SB_KEY_LOGIN, 'Authorization': 'Bearer '+SB_KEY_LOGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_login: login, p_senha: senha })
    });
    const data = await resp.json();
    const r = Array.isArray(data) ? data[0] : data;
    if(r && r.ok){
      localStorage.setItem('cdp_sessao', JSON.stringify({nome: r.nome, login: login}));
      document.getElementById('login-screen').style.display = 'none';
      const badge = document.getElementById('usuario-logado');
      if(badge) badge.textContent = r.nome;
    } else {
      erro.textContent = 'Usuário ou senha incorretos.'; erro.style.display = 'block';
    }
  } catch(e){
    erro.textContent = 'Erro de conexão. Tente de novo.'; erro.style.display = 'block';
  }
  btn.textContent = 'Entrar'; btn.disabled = false;
}

function logout(){
  if(!confirm('Sair da calculadora?')) return;
  localStorage.removeItem('cdp_sessao');
  location.reload();
}

document.addEventListener('DOMContentLoaded', checkLoginSession);
