// ═══════════════════════════════════════════════════════
// FILA ÚNICA "PARA FAZER HOJE" (visual profissional, etapa 6 — pedido da Bru, 20/11/2026)
// Junta numa lista só, por urgência, as pendências que cada assunto já calcula:
// orçamentos (pendenciasDoDia), fechamentos, retornos, garantia, pedidos, confirmações de amanhã e pós-venda.
// Não cria regra nova nem grava nada: cada linha abre o lugar de sempre. Os blocos de cada assunto continuam abaixo.
// ═══════════════════════════════════════════════════════
const FILA_ORDEM = { atr: 0, hoje: 1, esp: 2 };
function filaItens(){
  const L = [];
  const add = (cls, quem, oque, origem, acao, valor) => L.push({ cls, quem: quem || '', oque: oque || '', origem, acao, valor: valor || 0 });
  // orçamentos parados / follow-up
  if(typeof pendenciasDoDia === 'function'){
    const pend = pendenciasDoDia();
    if(typeof ORC_PEND_CACHE !== 'undefined') ORC_PEND_CACHE = new Map(pend.map(p => [p.e.id, p]));
    pend.forEach(p => {
      const st = typeof orcSituacao === 'function' ? orcSituacao(p.e) : { cls: 'hoje', prox: p.titulo };
      add(st.cls === 'neu' ? 'esp' : st.cls, p.e.client, st.prox, 'Orçamento ' + numCDP(p.e.numero), `reopenOrc(${p.e.id})`, p.e.totalAvista);
    });
  }
  // fechamentos (OS, pagamento, cobrança)
  if(typeof fechamentosEmAndamento === 'function' && typeof FECH_MAPA !== 'undefined'){
    fechamentosEmAndamento().forEach(e => {
      const f = FECH_MAPA[e.id] || {}, p = fechProximo(e, f);
      const atrasoVal = (p.n === 5 && f.comprovante_em && somarHorasUteis(f.comprovante_em, 4) < new Date()) || p.alerta;
      const cls = atrasoVal ? 'atr' : (p.cobrar || p.n === 5 || p.n <= 3 ? 'hoje' : 'esp');
      add(cls, e.client, p.txt, 'Fechamento · passo ' + p.n + ' de 6', `reopenOrc(${e.id})`, e.totalAvista);
    });
  }
  // retornos de hoje e atrasados
  if(typeof retornosParaHoje === 'function'){
    retornosParaHoje().forEach(r => {
      const s = situacaoPrazo(r);
      add(s === 'atrasado' ? 'atr' : 'hoje', r.cliente, r.assunto, 'Retorno · ' + (r.responsavel || ''), `abrirRetornos('${String(r.responsavel || '').replace(/'/g, '')}','todos')`);
    });
  }
  // garantia
  if(typeof garAbertos === 'function'){
    garAbertos().forEach(g => {
      const cls = garAtrasado(g) ? 'atr' : (!g.primeiro_retorno_em ? 'hoje' : 'esp');
      add(cls, g.cliente, g.primeiro_retorno_em ? 'Acompanhar o chamado' : 'Dar o 1º retorno', 'Garantia', `abrirGarantias('abertos')`);
    });
  }
  // pedidos (OS): uma linha por assunto, como no bloco
  if(typeof pedLinhasInicio === 'function'){
    pedLinhasInicio().forEach(([k, , tit, sub, urg]) => add(urg ? 'atr' : 'hoje', tit, sub, 'Pedidos', `abrirPedidos('${k}')`));
  }
  // confirmar os compromissos do próximo dia útil
  if(typeof CONF_EVENTOS !== 'undefined' && typeof CONF_MAPA !== 'undefined' && typeof lerTitulo === 'function'){
    CONF_EVENTOS.forEach(ev => {
      const st = (CONF_MAPA[ev.id] || {}).status;
      if(st === 'confirmado') return;
      const p = lerTitulo(ev.titulo);
      add(st === 'reagendar' ? 'atr' : (st ? 'esp' : 'hoje'), p.cliente,
        st === 'reagendar' ? 'Reagendar o compromisso' : st ? 'Esperando o cliente confirmar' : 'Mandar a confirmação de ' + (p.tipo || 'amanhã').toLowerCase(),
        'Agenda · ' + new Date(ev.inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''), `filaIrPara('inicio-confirmar')`);
    });
  }
  // pós-venda (uma linha só, com a quantidade)
  if(typeof PV_LISTA !== 'undefined'){
    const n = PV_LISTA.filter(p => !p.contato_em).length;
    if(n) add('esp', n + (n > 1 ? ' clientes' : ' cliente') + ' com 6 meses de instalação', 'Mandar a mensagem de pós-venda', 'Pós-venda', `filaIrPara('inicio-posvenda')`);
  }
  return L.sort((a, b) => FILA_ORDEM[a.cls] - FILA_ORDEM[b.cls]);
}
function filaIrPara(id){
  const el = document.getElementById(id); if(!el) return;
  const sec = el.querySelector('.inicio-bloco.fechado'); if(sec && typeof celAlternar === 'function') celAlternar(sec);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const FILA_SELO = { atr: 'Atrasado', hoje: 'Hoje', esp: 'Esperando' };
let FILA_TUDO = false, FILA_ULTIMO = null;
function filaDesenhar(){
  const box = document.getElementById('inicio-fila'); if(!box) return;
  const L = filaItens();
  const urg = L.filter(x => x.cls !== 'esp').length, atr = L.filter(x => x.cls === 'atr').length;
  const mostrar = FILA_TUDO ? L : L.slice(0, 12);
  const linha = x => `<button type="button" class="fila-l" onclick="${x.acao}">
      <span class="selo s-${x.cls}">${FILA_SELO[x.cls]}</span>
      <span class="fila-q"><b>${escHtml(x.quem)}</b><span>${escHtml(x.origem)}</span></span>
      <span class="fila-o">${escHtml(x.oque)}</span>
      <span class="fila-v">${x.valor ? fmt(x.valor) : ''}</span>
      <span class="fila-seta" aria-hidden="true">›</span>
    </button>`;
  const html = !L.length ? '' : `<section class="fila-bloco" aria-label="Para fazer hoje">
      <div class="fila-cab"><b>Para fazer hoje</b><span class="cont">${L.length}</span><span class="fila-resumo">${atr ? `<span class="fila-atr">${atr} atrasad${atr > 1 ? 'os' : 'o'}</span> · ` : ''}${urg} para hoje · ${L.length - urg} esperando</span></div>
      <div class="fila-lista">${mostrar.map(linha).join('')}</div>
      ${L.length > mostrar.length ? `<button type="button" class="fila-mais" onclick="FILA_TUDO=true;filaDesenhar()">Ver mais ${L.length - mostrar.length}</button>` : ''}
    </section>`;
  if(FILA_ULTIMO !== html || !box.isConnected || box.innerHTML === '' && html){ FILA_ULTIMO = html; box.innerHTML = html; }   // só mexe se mudou (o Início é observado; evita repetir sem fim)
}
