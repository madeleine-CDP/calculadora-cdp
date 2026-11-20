// ═══════════════════════════════════════════════════════
// AJUSTES DE CELULAR (pedido da Bru, 19/11/2026)
// 1) Botão fixo "+" de novo orçamento no canto (o CSS mostra só no celular e só nas telas de lista/painel).
// 2) Blocos do Início que abrem e fecham tocando no título (só no celular); o aparelho lembra (localStorage).
// 3) Faixa "⚠️ N itens urgentes · ver" no topo do Início, que rola até o primeiro.
// ═══════════════════════════════════════════════════════
const CEL_CHAVE = 'cdp_blocos_fechados';
const celEhCelular = () => window.matchMedia('(max-width: 720px)').matches;
function celFechados(){ try{ return new Set(JSON.parse(localStorage.getItem(CEL_CHAVE) || '[]')); }catch(e){ return new Set(); } }
function celGuardar(s){ try{ localStorage.setItem(CEL_CHAVE, JSON.stringify([...s])); }catch(e){} }
// nome estável do bloco: o texto do título, sem números e contagens
function celChaveBloco(sec){
  const t = sec.querySelector('.inicio-bloco-tit > span, .inicio-bloco-tit');
  return t ? t.textContent.replace(/[\d.,]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
}
function celPrepararBlocos(raiz){
  const fechados = celFechados();
  raiz.querySelectorAll('.inicio-bloco').forEach(sec => {
    const tit = sec.querySelector(':scope > .inicio-bloco-tit'); if(!tit) return;
    const chave = celChaveBloco(sec); if(!chave) return;
    if(sec.dataset.dobra !== chave){
      sec.dataset.dobra = chave; sec.classList.add('dobravel');
      tit.setAttribute('role', 'button'); tit.tabIndex = 0;
    }
    const fechado = fechados.has(chave);
    sec.classList.toggle('fechado', fechado);
    tit.setAttribute('aria-expanded', String(!fechado));
  });
}
function celAlternar(sec){
  const s = celFechados(), chave = sec.dataset.dobra;
  if(s.has(chave)) s.delete(chave); else s.add(chave);
  celGuardar(s); celPrepararBlocos(sec.parentElement || document);
}
document.addEventListener('click', (ev) => {
  const tit = ev.target.closest('.dobravel > .inicio-bloco-tit');
  if(!tit || !celEhCelular() || ev.target.closest('button, a, input, select, textarea, label')) return;
  celAlternar(tit.parentElement);
});
document.addEventListener('keydown', (ev) => {
  if(ev.key !== 'Enter' && ev.key !== ' ') return;
  const tit = ev.target.closest && ev.target.closest('.dobravel > .inicio-bloco-tit');
  if(!tit || ev.target !== tit || !celEhCelular()) return;
  ev.preventDefault(); celAlternar(tit.parentElement);
});

// faixa de urgentes no topo do Início
function celFaixaUrgentes(){
  const box = document.getElementById('inicio-conteudo'); if(!box) return;
  const itens = box.querySelectorAll('.inicio-pend-item.pend-atrasado, .md-tarefa.atrasada');
  let faixa = document.getElementById('inicio-urgentes');
  if(!itens.length){ if(faixa) faixa.remove(); return; }
  if(!faixa){
    faixa = document.createElement('button'); faixa.type = 'button'; faixa.id = 'inicio-urgentes'; faixa.className = 'cel-urgentes';
    faixa.addEventListener('click', celIrUrgente);
    const ref = box.querySelector('.inicio-atalhos'); if(ref) ref.before(faixa); else box.prepend(faixa);
  }
  const html = `${ic('alerta',16)} <b>${itens.length} ${itens.length === 1 ? 'item urgente' : 'itens urgentes'}</b> <span>ver o primeiro ›</span>`;
  if(faixa.innerHTML !== html) faixa.innerHTML = html;   // só mexe se mudou (evita repetir sem fim com o observador)
}
function celIrUrgente(){
  const box = document.getElementById('inicio-conteudo'); if(!box) return;
  const alvo = box.querySelector('.inicio-pend-item.pend-atrasado, .md-tarefa.atrasada'); if(!alvo) return;
  const sec = alvo.closest('.inicio-bloco.fechado'); if(sec) celAlternar(sec);
  alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  alvo.classList.add('cel-piscar'); setTimeout(() => alvo.classList.remove('cel-piscar'), 1600);
}

// o Início é montado aos poucos (cada bloco carrega sozinho): reaplica a cada mudança
let CEL_TIMER = null;
function celObservar(){
  const box = document.getElementById('inicio-conteudo'); if(!box || box.dataset.celObs) return;
  box.dataset.celObs = '1';
  new MutationObserver(() => { clearTimeout(CEL_TIMER); CEL_TIMER = setTimeout(() => { celPrepararBlocos(box); celFaixaUrgentes(); }, 80); })
    .observe(box, { childList: true, subtree: true });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', celObservar); else celObservar();

// ═══════════════════════════════════════════════════════
// MENU (visual profissional, etapa 2 — aprovado pela Bru em 20/11/2026)
// Computador: o menu de abas vira um menu lateral fixo, com a logo, os itens de gestão e quem está logado.
// Celular: barra fixa embaixo (Início · Orçamentos · + · Pedidos · Agenda); o "+" abre o menu de criar.
// Quase tudo é CSS (visual.css); aqui só o nome de quem está logado e o menu do "+".
// ═══════════════════════════════════════════════════════
const NAV_PAPEL = { dona: 'Dona', admin: 'Administradora', atendimento: 'Atendimento', vendas: 'Vendas' };
function navPreencher(){
  const a = (typeof AUTH !== 'undefined' && AUTH) || {};
  const nome = a.nome || '', ini = nome.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const set = (id, v) => { const el = document.getElementById(id); if(el && el.textContent !== v) el.textContent = v; };
  set('nav-nome', nome); set('nav-av', ini); set('nav-papel', NAV_PAPEL[a.papel] || '');
  const gestora = typeof fechPodeConferir === 'function' && fechPodeConferir();
  document.querySelectorAll('.tabs-nav .so-gestora').forEach(el => { el.hidden = !gestora; });
}
(function navObservar(){
  const ligar = () => {
    navPreencher();
    const alvo = document.getElementById('usuario-logado');
    if(alvo) new MutationObserver(navPreencher).observe(alvo, { childList: true, characterData: true, subtree: true });
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();

// menu do "+" (celular): criar orçamento, cálculo rápido, retorno, chamado de garantia ou tarefa
function abrirMenuCriar(){
  fecharMenuCriar();
  const op = (icone, tit, sub, acao) => `<button type="button" class="criar-op" data-acao="${acao}"><span class="criar-ic">${ic(icone, 20)}</span><span><b>${tit}</b><span>${sub}</span></span></button>`;
  const m = document.createElement('div'); m.id = 'menu-criar'; m.className = 'menu-criar';
  m.innerHTML = `<div class="criar-fundo" data-acao="fechar"></div>
    <div class="criar-folha" role="dialog" aria-label="Criar">
      <div class="criar-puxa"></div>
      ${op('novo', 'Novo orçamento', 'Busca o cliente no Olist', 'orc')}
      ${op('calculadora', 'Cálculo rápido', 'Calcular sem abrir orçamento', 'calc')}
      ${op('chat', 'Retorno', 'Algo para responder a um cliente', 'ret')}
      ${typeof novaGarantia === 'function' ? op('escudo', 'Chamado de garantia', 'Defeito ou problema em produto', 'gar') : ''}
      ${op('ok', 'Tarefa minha', 'Só você vê', 'tarefa')}
    </div>`;
  m.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]'); if(!b) return;
    const acao = b.dataset.acao; fecharMenuCriar();
    if(acao === 'orc') novoOrcamento();
    else if(acao === 'calc') switchTab('calc');
    else if(acao === 'ret') novoRetorno();
    else if(acao === 'gar') novaGarantia();
    else if(acao === 'tarefa'){
      switchTab('inicio');
      setTimeout(() => { const i = document.getElementById('md-tarefa-txt'); if(i){ const sec = i.closest('.inicio-bloco.fechado'); if(sec) celAlternar(sec); i.scrollIntoView({ block: 'center' }); i.focus(); } }, 400);
    }
  });
  document.body.appendChild(m);
}
function fecharMenuCriar(){ const m = document.getElementById('menu-criar'); if(m) m.remove(); }
document.addEventListener('keydown', (ev) => { if(ev.key === 'Escape') fecharMenuCriar(); });
