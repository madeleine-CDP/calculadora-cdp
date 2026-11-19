// ═══════════════════════════════════════════════════════
// PAINEL FINANCEIRO E VENDAS (etapa 2 dos painéis; pedido da Bru, 19/11/2026; protótipo aprovado)
// Só para a gestora (Madeleine e Bruna). A Madeleine abre o sistema direto aqui.
// Vendas = pedidos de venda do Olist (valor final, sem cancelados) pela rota "vendas" da função olist.
// Metas por mês na tabela configuracoes ('metas_vendas': mínima e ideal; padrão R$ 65 mil e R$ 85 mil).
// Conversão e funil = orçamentos do sistema. A receber / fases = Pedidos (os_acompanhamento) + Fechamento.
// ═══════════════════════════════════════════════════════
let FIN_VENDAS = null, FIN_VENDAS_EM = 0, FIN_METAS = { minima: 65000, ideal: 85000 }, FIN_EDITAR_META = false, FIN_SEQ = 0, FIN_AUTO = false, FIN_ERRO = '';
const finPode = () => typeof fechPodeConferir === 'function' && fechPodeConferir();
const finR = (v) => 'R$ ' + Math.round(Number(v || 0)).toLocaleString('pt-BR');
const finMil = (v) => (Math.round(Number(v || 0) / 100) / 10).toLocaleString('pt-BR') + ' mil';
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function abasPainel(atual){
  if(!finPode()) return '';
  return `<div class="painel-abas" role="tablist" aria-label="Painéis">
    <button type="button" role="tab" aria-selected="${atual === 'inicio'}" class="hist-chip${atual === 'inicio' ? ' on' : ''}" onclick="switchTab('inicio')">☀️ Meu dia</button>
    <button type="button" role="tab" aria-selected="${atual === 'ges'}" class="hist-chip${atual === 'ges' ? ' on' : ''}" onclick="abrirGestao()">🧭 Gestão</button>
    <button type="button" role="tab" aria-selected="${atual === 'fin'}" class="hist-chip${atual === 'fin' ? ' on' : ''}" onclick="abrirFinanceiro()">💰 Financeiro e vendas</button>
  </div>`;
}
// a Madeleine cai direto no Financeiro na primeira vez que o Início abre
function finAbrirSeDona(){
  const a = (typeof AUTH !== 'undefined' && AUTH) || {};
  if(FIN_AUTO || a.papel !== 'dona') return false;
  FIN_AUTO = true; abrirFinanceiro(); return true;
}

async function abrirFinanceiro(){
  if(!finPode()) return;
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!(await confirmarSairOrc())) return; limparOrcamentoEmAndamento(); }
  irParaTab('fin'); window.scrollTo({ top: 0 });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'inicio'));
  renderFinanceiro();
}
async function renderFinanceiro(forcar){
  const seq = ++FIN_SEQ, box = $('fin-conteudo'); if(!box) return;
  if(!FIN_VENDAS) box.innerHTML = abasPainel('fin') + '<div class="hist-empty">Lendo as vendas no Olist…</div>';
  else desenharFinanceiro();
  const tarefas = [];
  if(typeof HIST_CARREGADO !== 'undefined' && !HIST_CARREGADO) tarefas.push((async () => { try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }catch(e){} })());
  if(typeof carregarFechamentos === 'function') tarefas.push(carregarFechamentos().catch(() => {}));
  if(typeof carregarPedidos === 'function') tarefas.push(carregarPedidos().catch(() => {}));
  tarefas.push((async () => { try{ const r = await sbFetch('/rest/v1/configuracoes?select=*&chave=eq.metas_vendas'); const l = r.ok ? await r.json() : []; if(l[0] && l[0].valor) FIN_METAS = Object.assign({ minima: 65000, ideal: 85000 }, l[0].valor); }catch(e){} })());
  if(forcar || !FIN_VENDAS || Date.now() - FIN_VENDAS_EM > 10 * 60000){
    tarefas.push((async () => { try{ const d = await olistChamar('vendas', { meses: 6 }); FIN_VENDAS = d.pedidos || []; FIN_VENDAS_EM = Date.now(); FIN_ERRO = ''; }
      catch(e){ FIN_ERRO = e.codigo === 'desconectado' ? 'Olist desconectado (Configurações → Conexões): sem os números de venda.' : 'O Olist não respondeu agora: números de venda indisponíveis.'; if(!FIN_VENDAS) FIN_VENDAS = []; } })());
  }
  await Promise.all(tarefas);
  if(seq !== FIN_SEQ) return;
  desenharFinanceiro();
  if(typeof carregarAgendaPedidos === 'function'){ await carregarAgendaPedidos(); if(seq === FIN_SEQ) desenharFinanceiro(); }
}

// ── contas ──
function finVendasPorMes(){
  const osValor = new Map((typeof PED_OS !== 'undefined' ? PED_OS : []).map(o => [Number(o.pedido_id), Number(o.valor)]));
  const validos = (FIN_VENDAS || []).filter(p => p.situacao !== 2 && p.data);
  const valor = (p) => osValor.has(p.id) && osValor.get(p.id) > 0 ? osValor.get(p.id) : Number(p.valor || 0);
  const hoje = new Date(), meses = [];
  for(let i = 5; i >= 0; i--){ const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); meses.push({ ano: d.getFullYear(), mes: d.getMonth(), total: 0, n: 0 }); }
  validos.forEach(p => { const [a, m] = p.data.split('-').map(Number); const x = meses.find(z => z.ano === a && z.mes === m - 1); if(x){ x.total += valor(p); x.n++; } });
  // mês anterior até o mesmo dia (comparação justa)
  const dia = hoje.getDate(), ant = meses[4];
  const antAteHoje = validos.filter(p => { const [a, m, d] = p.data.split('-').map(Number); return a === ant.ano && m - 1 === ant.mes && d <= dia; });
  return { meses, atual: meses[5], ant, antAteHoje: { total: antAteHoje.reduce((t, p) => t + valor(p), 0), n: antAteHoje.length } };
}
function finAReceber(){
  const lista = (typeof PED_OS !== 'undefined' ? PED_OS : []).filter(o => [0, 3, 4, 7, 5, 1].includes(Number(o.situacao)));
  return lista.map(o => {
    const g = pedPagamento(o);
    const ag = typeof pedNaAgenda === 'function' ? pedNaAgenda(o) : null;
    const quando = ag ? new Date(ag.inicio) : (o.data_prevista ? new Date(o.data_prevista + 'T12:00:00') : null);
    return { o, g, quando, porAgenda: !!ag };
  }).filter(x => x.g.temSaldo && !x.g.saldoOk && x.g.saldoValor > 0);
}
function finConferirAgora(){
  const out = [];
  const orcs = typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [];
  Object.values(typeof FECH_MAPA !== 'undefined' ? FECH_MAPA : {}).forEach(f => {
    if(!f.comprovante_em || f.validado_em) return;
    const e = orcs.find(x => x.id === f.orcamento_id); if(!e) return;
    out.push({ tipo: 'Entrada', cliente: e.client, ref: numCDP(e.numero) + (e.pedidoTiny ? ' · OS ' + e.pedidoTiny : ''), valor: f.os_valor ? (f.forma_pagamento === 'pix' ? f.os_valor / 2 : f.os_valor) : null, desde: f.comprovante_em, por: f.comprovante_por, abrir: `reopenOrc(${e.id})` });
  });
  (typeof PED_OS !== 'undefined' ? PED_OS : []).forEach(o => {
    if(!o.saldo_comprovante_em || o.saldo_validado_em) return;
    const g = pedPagamento(o);
    out.push({ tipo: 'Saldo', cliente: o.cliente, ref: 'OS ' + o.numero, valor: g.saldoValor || null, desde: o.saldo_comprovante_em, por: o.saldo_comprovante_por, abrir: `abrirPedidoVenda(${o.pedido_id})` });
  });
  return out.map(x => Object.assign(x, { prazo: somarHorasUteis(x.desde, 4) })).sort((a, b) => a.prazo - b.prazo);
}
function finFunil(){
  const orcs = typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [];
  const hoje = new Date(), doMes = (iso) => { if(!iso) return false; const d = new Date(iso); return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear(); };
  const novos = orcs.filter(e => doMes(e.createdAt));
  const fechados = orcs.filter(e => e.etapa === 'fechado' && doMes(e.fechadoEm || e.updatedAt));
  const perdidos = orcs.filter(e => e.etapa === 'perdido' && doMes(e.updatedAt));
  const abertos = orcs.filter(e => !['fechado', 'perdido'].includes(e.etapa) && !(typeof evoluidoPara === 'function' && evoluidoPara(e.id)));
  const motivos = {}; perdidos.forEach(e => { const m = (e.motivoPerda || 'sem motivo').replace(/^Outro: .*/, 'outro'); motivos[m] = (motivos[m] || 0) + 1; });
  const dias = fechados.filter(e => e.createdAt && e.fechadoEm).map(e => (new Date(e.fechadoEm) - new Date(e.createdAt)) / 864e5);
  return { novos: novos.length, fechados: fechados.length, perdidos: perdidos.length, abertos: abertos.length, motivos, tempo: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null };
}

// ── tela ──
function desenharFinanceiro(){
  const box = $('fin-conteudo'); if(!box) return;
  const V = finVendasPorMes(), hoje = new Date();
  const diasMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate(), dia = hoje.getDate();
  const vend = V.atual.total, nAtual = V.atual.n, ticket = nAtual ? vend / nAtual : 0;
  const comp = V.antAteHoje.total ? Math.round((vend - V.antAteHoje.total) / V.antAteHoje.total * 100) : null;
  const ticketAnt = V.ant.n ? V.ant.total / V.ant.n : 0;
  const proj = dia ? vend / dia * diasMes : 0;
  const M = FIN_METAS, falta = Math.max(0, M.minima - vend);
  const F = finFunil(), R = finAReceber(), C = finConferirAgora();
  const em7 = R.filter(x => x.quando && x.quando - hoje <= 7 * 864e5).sort((a, b) => a.quando - b.quando);
  const aReceber = R.reduce((t, x) => t + x.g.saldoValor, 0), aReceber7 = em7.reduce((t, x) => t + x.g.saldoValor, 0);
  const temVendas = !FIN_ERRO || (FIN_VENDAS && FIN_VENDAS.length);
  const escala = Math.max(M.ideal, proj, vend, 1);
  const pct = (v) => Math.min(100, v / escala * 100).toFixed(1) + '%';
  const maxMes = Math.max(...V.meses.map(m => m.total), 1);
  const fases = (typeof PED_FASES !== 'undefined' ? PED_FASES : []).filter(f => f.k !== 'entregue').map(f => { const l = PED_OS.filter(o => f.sit.includes(Number(o.situacao))); return { t: f.tit.split(' · ')[0], em: f.em, n: l.length, v: l.reduce((s, o) => s + Number(o.valor || 0), 0) }; });
  const semSaldo = (typeof PED_OS !== 'undefined' ? PED_OS : []).filter(o => [7, 5, 1].includes(Number(o.situacao)) && !pedPagamento(o).instalacao);
  box.innerHTML = abasPainel('fin') + `
  <div class="fin-topo"><div><div class="inicio-data">${escHtml(hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))}</div><div class="hist-titulo">Financeiro e vendas</div></div>
    <button type="button" class="btn-outline" onclick="renderFinanceiro(true)">🔄 Atualizar</button></div>
  ${FIN_ERRO ? `<div class="ag-aviso">${ic('info',16)} <span>${escHtml(FIN_ERRO)}</span></div>` : ''}

  <section class="fin-kpis" aria-label="Números do mês">
    <div class="fin-kpi"><span>Vendido no mês (Olist)</span><b>${temVendas ? finR(vend) : '—'}</b><em>${comp === null ? 'sem base no mês anterior' : (comp >= 0 ? '▲ ' : '▼ ') + Math.abs(comp) + '% em relação a ' + MESES_CURTO[V.ant.mes] + ', até o dia ' + dia}</em></div>
    <div class="fin-kpi"><span>Pedidos · ticket médio</span><b>${nAtual} · ${finR(ticket)}</b><em>${MESES_CURTO[V.ant.mes]}: ${V.ant.n} · ${finR(ticketAnt)}</em></div>
    <div class="fin-kpi"><span>Orçamentos fechados no mês</span><b>${F.fechados}</b><em>de ${F.novos} orçamentos novos no mês${F.novos ? ' · ' + Math.round(F.fechados / F.novos * 100) + '%' : ''}</em></div>
    <div class="fin-kpi ouro"><span>A receber (saldos)</span><b>${finR(aReceber)}</b><em>${R.length} ${R.length === 1 ? 'pedido' : 'pedidos'}${aReceber7 ? ' · ' + finR(aReceber7) + ' com instalação nos próximos 7 dias' : ''}</em></div>
  </section>

  <section class="fin-q ${C.length ? 'alerta' : ''}">
    <div class="fin-q-tit"><h2>Conferir no extrato agora</h2><span>prazo de 4h úteis a partir do comprovante</span></div>
    ${C.length ? C.map(x => { const venc = x.prazo < hoje; return `<button type="button" class="fin-linha${venc ? ' venc' : ''}" onclick="${x.abrir}">
      <span><b>${escHtml(x.tipo)} · ${escHtml(x.cliente || '')}</b><em>${escHtml(x.ref)} · comprovante ${escHtml(fechDataCurta(new Date(x.desde)))}${x.por ? ' (' + escHtml(x.por) + ')' : ''}</em></span>
      <b>${x.valor ? reais(x.valor) : ''}</b><span class="fin-prazo">${venc ? 'atrasado' : 'até ' + escHtml(fechDataCurta(x.prazo))}</span></button>`; }).join('')
      : `<div class="inicio-ok">${ic('ok',18)} Nenhum comprovante esperando conferência.</div>`}
  </section>

  <div class="fin-grade">
    <section class="fin-q">
      <div class="fin-q-tit"><h2>Meta do mês</h2>${finPode() ? `<button type="button" class="conf-link" onclick="FIN_EDITAR_META=!FIN_EDITAR_META;desenharFinanceiro()">${FIN_EDITAR_META ? 'cancelar' : 'editar metas'}</button>` : ''}</div>
      ${FIN_EDITAR_META ? `<form class="fin-meta-form" onsubmit="event.preventDefault();finSalvarMetas()">
        <label>Mínima (R$) <input id="fin-meta-min" type="number" min="0" step="1000" value="${M.minima}"></label>
        <label>Ideal (R$) <input id="fin-meta-ideal" type="number" min="0" step="1000" value="${M.ideal}"></label>
        <button type="submit" class="btn">Salvar</button></form>` : ''}
      <div class="fin-meta-num"><b>${temVendas ? finR(vend) : '—'}</b><span>${vend >= M.ideal ? '🎉 meta ideal batida' : vend >= M.minima ? '✅ meta mínima batida · faltam ' + finR(M.ideal - vend) + ' para a ideal' : Math.round(vend / M.minima * 100) + '% da mínima · faltam ' + finR(falta) + ' em ' + (diasMes - dia) + (diasMes - dia === 1 ? ' dia' : ' dias')}</span></div>
      <figure class="fin-meta-barra" role="img" aria-label="Vendido ${finR(vend)}; meta mínima ${finR(M.minima)}; meta ideal ${finR(M.ideal)}; projeção do mês ${finR(proj)}">
        <div class="fin-trilho">
          <div class="fin-proj" style="width:${pct(proj)}"></div>
          <div class="fin-feito" style="width:${pct(vend)}"></div>
          <div class="fin-marca" style="left:${pct(M.minima)}"></div>
          <div class="fin-marca" style="left:${pct(M.ideal)}"></div>
        </div>
        <div class="fin-regua"><span style="left:${pct(M.minima)}"><b>${finMil(M.minima)}</b> mínima</span><span style="left:${pct(M.ideal)}"><b>${finMil(M.ideal)}</b> ideal</span></div>
      </figure>
      <div class="fin-legenda"><span><i class="fin-l-feito"></i>vendido</span><span><i class="fin-l-proj"></i>projeção no ritmo atual: <b>${finR(proj)}</b></span></div>
    </section>

    <section class="fin-q">
      <div class="fin-q-tit"><h2>Vendas por mês</h2><span>pedidos do Olist · valor final</span></div>
      <figure class="fin-meses" role="img" aria-label="${V.meses.map(m => MESES_CURTO[m.mes] + ' ' + finR(m.total)).join(', ')}">
        <div class="fin-barras">${V.meses.map((m, i) => `<div class="fin-col${i === 5 ? ' atual' : ''}" title="${MESES_CURTO[m.mes]}: ${finR(m.total)} · ${m.n} pedidos"><span>${finMil(m.total)}</span><div style="height:${(m.total / maxMes * 100).toFixed(1)}%"></div></div>`).join('')}</div>
        <div class="fin-rotulos">${V.meses.map((m, i) => `<span>${MESES_CURTO[m.mes]}${i === 5 ? '<small>até dia ' + dia + '</small>' : ''}</span>`).join('')}</div>
      </figure>
    </section>
  </div>

  <div class="fin-grade">
    <section class="fin-q">
      <div class="fin-q-tit"><h2>Orçamentos do mês</h2></div>
      <div class="fin-funil">
        <div><span>Novos</span><b>${F.novos}</b></div>
        <div class="ok"><span>Fechados</span><b>${F.fechados}</b></div>
        <div><span>Perdidos</span><b>${F.perdidos}</b></div>
        <div><span>Em aberto agora</span><b>${F.abertos}</b></div>
      </div>
      <div class="fin-sub">Motivos da perda: ${Object.entries(F.motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => escHtml(m) + ' ' + n).join(' · ') || '—'}</div>
      ${F.tempo !== null ? `<div class="fin-sub">Tempo médio do pedido de orçamento ao fechamento: ${F.tempo} ${F.tempo === 1 ? 'dia' : 'dias'}</div>` : ''}
    </section>

    <section class="fin-q">
      <div class="fin-q-tit"><h2>Dinheiro em cada fase</h2><button type="button" class="conf-link" onclick="abrirPedidos('todos')">ver pedidos ›</button></div>
      ${fases.map(f => `<div class="fin-fase"><span>${f.em} ${escHtml(f.t)} <em>· ${f.n} OS</em></span><b>${finR(f.v)}</b></div>`).join('')}
      ${semSaldo.length ? `<div class="fin-fase alerta"><span>⛔ Instalação sem pagamento completo <em>· ${semSaldo.length} OS</em></span><b>${finR(semSaldo.reduce((t, o) => t + (pedPagamento(o).saldoValor || 0), 0))}</b></div>` : ''}
    </section>
  </div>

  <section class="fin-q">
    <div class="fin-q-tit"><h2>Saldos a receber · próximos 7 dias</h2><span>pela data na agenda (ou a previsão do Olist)</span></div>
    ${em7.length ? `<div class="fin-tabela-wrap"><table class="fin-tabela"><thead><tr><th>Instalação</th><th>Cliente</th><th>OS</th><th class="n">Saldo</th><th>Situação</th></tr></thead><tbody>
      ${em7.map(x => `<tr onclick="abrirPedidoVenda(${x.o.pedido_id})"><td>${escHtml(x.quando.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }))}${x.porAgenda ? '' : ' <em>(previsão)</em>'}</td><td>${escHtml(x.o.cliente || '')}</td><td>${escHtml(x.o.numero)}</td><td class="n">${reais(x.g.saldoValor)}</td>
        <td class="${x.g.saldoComp ? 'st-meio' : 'st-pend'}">${x.g.saldoComp ? 'comprovante · conferir' : 'sem comprovante'}</td></tr>`).join('')}
    </tbody></table></div>` : `<div class="inicio-ok">${ic('ok',18)} Nenhum saldo pendente com instalação nos próximos 7 dias.</div>`}
  </section>`;
}
async function finSalvarMetas(){
  const min = Number(($('fin-meta-min') || {}).value), ideal = Number(($('fin-meta-ideal') || {}).value);
  if(!(min > 0) || !(ideal >= min)){ avisoTopo('A meta ideal precisa ser maior ou igual à mínima.'); return; }
  const r = await sbFetch('/rest/v1/configuracoes?on_conflict=chave', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ chave: 'metas_vendas', valor: { minima: min, ideal } }) });
  if(!r.ok){ avisoTopo('Não foi possível salvar as metas.'); return; }
  FIN_METAS = { minima: min, ideal }; FIN_EDITAR_META = false; avisoTopo('Metas salvas.'); desenharFinanceiro();
}
