// ═══════════════════════════════════════════════════════
// PAINEL DE GESTÃO (etapa 3 dos painéis; pedido da Bru, 19/11/2026; protótipo aprovado). Só gestora (Bruna e Madeleine).
// Junta o que já existe no sistema: retornos, orçamentos parados (pendenciasDoDia), pedidos (os_acompanhamento),
// garantia e pós-venda, e as tabelas de preço (TABELAS_INFO x item.tabelaVer). Nada novo no banco.
// ═══════════════════════════════════════════════════════
let GES_SEQ = 0;

async function abrirGestao(){
  if(!(typeof finPode === 'function' && finPode())) return;
  if(typeof orcamentoAberto === 'function' && orcamentoAberto()){ if(!(await confirmarSairOrc())) return; limparOrcamentoEmAndamento(); }
  irParaTab('ges'); window.scrollTo({ top: 0 });
  renderGestao();
}
async function renderGestao(){
  const seq = ++GES_SEQ, box = $('ges-conteudo'); if(!box) return;
  desenharGestao(true);
  const t = [];
  if(typeof HIST_CARREGADO !== 'undefined' && !HIST_CARREGADO) t.push((async () => { try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }catch(e){} })());
  if(typeof carregarRetornos === 'function') t.push(carregarRetornos().catch(() => {}));
  if(typeof carregarPedidos === 'function') t.push(carregarPedidos().catch(() => {}));
  if(typeof carregarGarantias === 'function') t.push(carregarGarantias().catch(() => {}));
  if(typeof carregarPosvenda === 'function') t.push(carregarPosvenda().catch(() => {}));
  await Promise.all(t);
  if(seq === GES_SEQ) desenharGestao(false);
}

// ── contas ──
function gesForaDoPrazo(){
  const hojeIsoStr = (typeof hojeIso === 'function') ? hojeIso() : new Date().toISOString().slice(0, 10);
  const retAtras = (typeof retornosAbertos === 'function' ? retornosAbertos() : []).filter(r => situacaoPrazo(r) === 'atrasado');
  const porQuem = {}; retAtras.forEach(r => { porQuem[r.responsavel || '—'] = (porQuem[r.responsavel || '—'] || 0) + 1; });
  const posVisita = (typeof pendenciasDoDia === 'function' ? pendenciasDoDia() : []).filter(p => p.e.etapa === 'orcamento' && p.tipo === 'atrasado');
  const prodAtras = (typeof PED_OS !== 'undefined' ? PED_OS : []).filter(o => Number(o.situacao) === 4 && o.data_prevista && o.data_prevista < hojeIsoStr);
  const garAtras = (typeof GAR_LISTA !== 'undefined' ? GAR_LISTA : []).filter(g => typeof garAtrasado === 'function' && garAtrasado(g));
  return { retAtras, porQuem, posVisita, prodAtras, garAtras };
}
function gesEquipe(){
  const orcs = typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : [];
  const hoje = new Date(), doMes = (iso) => { if(!iso) return false; const d = new Date(iso); return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear(); };
  const pend = typeof pendenciasDoDia === 'function' ? pendenciasDoDia() : [];
  const pr = typeof painelRetornos === 'function' ? painelRetornos() : { linhas: [] };
  const nomes = [...new Set(['Bruna', 'Mirelle', 'Madeleine'].concat(pr.linhas.map(l => l.nome)))];
  return nomes.map(n => {
    const r = pr.linhas.find(l => l.nome === n) || { atrasados: 0, hoje: 0, abertos: 0, feitos: 0 };
    const pessoa = ['Fábrica', 'Cícero'].includes(n) ? null : n;
    return {
      nome: n, ret: r,
      orcAbertos: pessoa ? orcs.filter(e => e.criadoPor === pessoa && !['fechado', 'perdido'].includes(e.etapa) && !(typeof evoluidoPara === 'function' && evoluidoPara(e.id))).length : null,
      follow: pessoa ? pend.filter(p => p.e.criadoPor === pessoa && p.peso >= 2).length : null,
      fechados: pessoa ? orcs.filter(e => e.criadoPor === pessoa && e.etapa === 'fechado' && doMes(e.fechadoEm || e.updatedAt)).length : null,
    };
  });
}
function gesPedidos(){
  const os = typeof PED_OS !== 'undefined' ? PED_OS : [];
  const conta = (s) => os.filter(o => s.includes(Number(o.situacao))).length;
  const entregues = os.filter(o => Number(o.situacao) === 6);
  const nfEmitir = entregues.filter(o => nfEstado(o) === 'emitir').length, nfEnviar = entregues.filter(o => nfEstado(o) === 'enviar').length;
  const avalBase = entregues.filter(o => o.data_entrega && Date.now() - new Date(o.data_entrega + 'T12:00:00') <= 30 * 864e5);
  const avalFeitas = avalBase.filter(o => o.avaliacao_em).length;
  // prazo médio do pedido (data da venda) até a entrega, por fábrica, nos entregues que o sistema acompanha
  const prazo = (letra) => { const l = entregues.filter(o => o.data_venda && o.data_entrega && new RegExp('\\b' + letra + '\\d').test(String(o.numero_fabrica || '')))
      .map(o => (new Date(o.data_entrega) - new Date(o.data_venda)) / 864e5).filter(d => d >= 0 && d < 120);
    return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null; };
  const conf = (typeof PED_FABRICAS !== 'undefined' ? PED_FABRICAS : []).map(([k, nome]) => {
    const emProd = os.some(o => Number(o.situacao) === 4 && fabricasDaOS(o).includes(k));
    const u = ultimaConferencia(k), dias = u ? pedDias(u.conferido_em) : null;
    return { nome, emProd, dias, atrasada: emProd && (dias === null || dias >= 2) };
  });
  return { producao: conta([4]), pronto: conta([7]), agendado: conta([5, 1]), nfEmitir, nfEnviar, aval: { feitas: avalFeitas, base: avalBase.length }, prazoD: prazo('D'), prazoR: prazo('R'), conf };
}
function gesTabelas(){
  const orcs = (typeof HISTORY_CACHE !== 'undefined' ? HISTORY_CACHE : []).filter(e => !['fechado', 'perdido'].includes(e.etapa) && !(typeof evoluidoPara === 'function' && evoluidoPara(e.id)));
  const desatualizados = orcs.filter(e => (Array.isArray(e.items) ? e.items : []).some(i => {
    const fab = i.fab || (i.fabrica === 'Decore' ? 'dec' : i.fabrica === 'Real' ? 'real' : null);
    const atual = fab && TABELAS_INFO[fab] ? TABELAS_INFO[fab].tabela : null;
    return (i.tabelaVer && atual && i.tabelaVer !== atual) || (typeof campItemVencida === 'function' && campItemVencida(i));
  }));
  return { desatualizados };
}

// ── tela ──
function desenharGestao(carregando){
  const box = $('ges-conteudo'); if(!box) return;
  const abas = typeof abasPainel === 'function' ? abasPainel('ges') : '';
  const topo = `<div class="fin-topo"><div><div class="inicio-data">${escHtml(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><div class="hist-titulo">Gestão</div></div>
    <button type="button" class="btn-outline" onclick="renderGestao()">Atualizar</button></div>`;
  if(carregando && !(typeof HIST_CARREGADO !== 'undefined' && HIST_CARREGADO)){ box.innerHTML = abas + topo + '<div class="hist-empty">Carregando…</div>'; return; }
  const F = gesForaDoPrazo(), E = gesEquipe(), P = gesPedidos(), T = gesTabelas();
  const pend = (typeof pendenciasDoDia === 'function' ? pendenciasDoDia() : []).slice(0, 8);
  const gar = typeof GAR_LISTA !== 'undefined' ? GAR_LISTA : [];
  const garAbertos = gar.filter(g => ['aberto', 'aguardando'].includes(g.status)), garAguard = gar.filter(g => g.status === 'aguardando');
  const hoje = new Date(), doMes = (iso) => { if(!iso) return false; const d = new Date(iso); return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear(); };
  const garMes = gar.filter(g => doMes(g.criado_em) && ['resolvido', 'nao_defeito'].includes(g.status));
  const pvPend = (typeof PV_LISTA !== 'undefined' ? PV_LISTA : []).filter(p => !p.contato_em).length;
  const card = (cls, rot, n, sub, on) => `<${on ? 'button type="button" onclick="' + on + '"' : 'div'} class="ges-al${n && cls ? ' ' + cls : ''}"><span>${rot}</span><b>${n}</b><em>${sub}</em></${on ? 'button' : 'div'}>`;
  const quemTxt = Object.entries(F.porQuem).map(([q, n]) => n + ' ' + (q === 'Fábrica' ? 'da Fábrica' : q === 'Cícero' ? 'do Cícero' : 'da ' + q)).join(' · ');
  const tag = (t) => ({ atrasado: ['t-r', 'atrasado'], perdido: ['t-o', 'sugerir perdido'], follow: ['t-o', 'follow-up'], enviar: ['t-o', 'para hoje'], aguardando: ['t-c', 'aguardando'] }[t] || ['t-c', '']);
  box.innerHTML = abas + topo + `
  <section class="ges-als" aria-label="O que está fora do prazo">
    ${card('r', 'Retornos atrasados', F.retAtras.length, quemTxt || 'nenhum', "abrirRetornos('', 'todos')")}
    ${card('r', 'Orçamento pós-visita fora do prazo', F.posVisita.length, 'mais de 1 dia útil sem enviar', "switchTab('inicio')")}
    ${card('r', 'Pedidos com previsão vencida', F.prodAtras.length, F.prodAtras.slice(0, 2).map(o => 'OS ' + o.numero + (o.numero_fabrica ? ' · ' + o.numero_fabrica : '')).join(' · ') || 'nenhum em produção atrasado', "abrirPedidos('producao')")}
    ${card('r', 'Garantia sem 1º retorno no prazo', F.garAtras.length, F.garAtras.length ? 'responder hoje' : 'tudo respondido no prazo', 'abrirGarantias()')}
  </section>

  <section class="fin-q">
    <div class="fin-q-tit"><h2>Equipe</h2><span>tocar no nome abre os retornos da pessoa</span></div>
    <div class="fin-tabela-wrap"><table class="fin-tabela ges-tab">
      <thead><tr><th rowspan="2">Pessoa</th><th class="n ges-grp" colspan="4">Retornos</th><th class="n ges-grp" colspan="3">Orçamentos</th></tr><tr><th class="n">atrasados</th><th class="n">hoje</th><th class="n">em aberto</th><th class="n">feitos 7 dias</th><th class="n">em aberto</th><th class="n">follow-up hoje</th><th class="n">fechados no mês</th></tr></thead>
      <tbody>${E.map(x => `<tr onclick="abrirRetornos('${escHtml(x.nome)}', 'todos')">
        <td><b>${escHtml(x.nome)}</b></td><td class="n${x.ret.atrasados ? ' st-pend' : ''}">${x.ret.atrasados}</td><td class="n">${x.ret.hoje}</td><td class="n">${x.ret.abertos}</td><td class="n">${x.ret.feitos}</td>
        <td class="n">${x.orcAbertos ?? '—'}</td><td class="n">${x.follow ?? '—'}</td><td class="n">${x.fechados ?? '—'}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="fin-sub">Orçamentos contam por quem criou. Fábrica e Cícero aparecem só nos retornos.</div>
  </section>

  <div class="fin-grade">
    <section class="fin-q">
      <div class="fin-q-tit"><h2>Orçamentos parados</h2><button type="button" class="conf-link" onclick="switchTab('inicio')">ver no Início ›</button></div>
      ${pend.length ? pend.map(p => { const [c, t] = tag(p.tipo); return `<button type="button" class="ges-item" onclick="reopenOrc(${p.e.id})">
        <span><b>${escHtml(numCDP(p.e.numero))} · ${escHtml(p.e.client)}</b><em>${escHtml(p.titulo)}${p.e.criadoPor ? ' · ' + escHtml(p.e.criadoPor) : ''}</em></span><span class="ges-tag ${c}">${escHtml(t)}</span></button>`; }).join('')
        : `<div class="inicio-ok">${ic('ok',18)} Nenhum orçamento parado.</div>`}
    </section>

    <section class="fin-q">
      <div class="fin-q-tit"><h2>Pedidos</h2><button type="button" class="conf-link" onclick="abrirPedidos('todos')">ver pedidos ›</button></div>
      <div class="fin-funil ges-3">
        <div><span>Em produção</span><b>${P.producao}</b></div><div><span>Prontos p/ agendar</span><b>${P.pronto}</b></div><div><span>Agendados</span><b>${P.agendado}</b></div>
      </div>
      <div class="fin-fase"><span>Conferência das fábricas</span><span class="ges-dir">${P.conf.map(c => escHtml(c.nome) + ' ' + (c.dias === null ? 'nunca' : c.dias === 0 ? 'hoje' : 'há ' + c.dias + (c.dias === 1 ? ' dia' : ' dias')) + (c.atrasada ? ' <span class="ges-tag t-o">conferir</span>' : '')).join(' · ')}</span></div>
      <div class="fin-fase"><span>Notas fiscais</span><span class="ges-dir">${P.nfEmitir} para emitir · ${P.nfEnviar} para enviar</span></div>
      <div class="fin-fase"><span>Avaliação no Google pedida</span><span class="ges-dir">${P.aval.base ? P.aval.feitas + ' de ' + P.aval.base + ' entregues em 30 dias (' + Math.round(P.aval.feitas / P.aval.base * 100) + '%)' : '—'}</span></div>
      <div class="fin-fase"><span>Prazo médio da venda à entrega</span><span class="ges-dir">${[P.prazoD !== null ? 'Decore ' + P.prazoD + ' dias' : '', P.prazoR !== null ? 'Real ' + P.prazoR + ' dias' : ''].filter(Boolean).join(' · ') || '—'}</span></div>
    </section>
  </div>

  <div class="fin-grade">
    <section class="fin-q">
      <div class="fin-q-tit"><h2>Garantia e pós-venda</h2><button type="button" class="conf-link" onclick="abrirGarantias()">ver garantias ›</button></div>
      <div class="fin-fase"><span>Chamados abertos</span><b>${garAbertos.length}</b></div>
      <div class="fin-fase"><span>Aguardando a fábrica ou o ateliê</span><span class="ges-dir">${garAguard.length ? garAguard.length + ' · o mais antigo há ' + Math.max(...garAguard.map(g => pedDias(g.criado_em))) + ' dias' : '0'}</span></div>
      <div class="fin-fase"><span>Pós-venda de 6 meses para mandar</span><b>${pvPend}</b></div>
      <div class="fin-fase"><span>Chamados fechados no mês: defeito × não era defeito</span><span class="ges-dir">${garMes.filter(g => g.status === 'resolvido').length} × ${garMes.filter(g => g.status === 'nao_defeito').length}</span></div>
    </section>

    <section class="fin-q">
      <div class="fin-q-tit"><h2>Tabelas de preço</h2>${typeof abrirTabelasPreco === 'function' ? `<button type="button" class="conf-link" onclick="abrirTabelasPreco()">abrir tabelas ›</button>` : ''}</div>
      ${['dec', 'real', 'cdp'].map(k => { const t = TABELAS_INFO[k]; const sem = !t.data && k === 'cdp'; return `<div class="fin-fase"><span>${escHtml(t.nome)}${k === 'cdp' ? ' (tradicional)' : ''}</span><span class="ges-tag ${sem ? 't-o' : 't-v'}">${sem ? 'sem data registrada' : escHtml(t.tabela)}</span></div>`; }).join('')}
      ${T.desatualizados.length ? `<div class="ges-desat"><b>${T.desatualizados.length} ${T.desatualizados.length === 1 ? 'orçamento em aberto calculado' : 'orçamentos em aberto calculados'} com tabela antiga ou campanha que já acabou</b>
        <div class="ges-desat-l">${T.desatualizados.slice(0, 12).map(e => `<button type="button" class="conf-link" onclick="reopenOrc(${e.id})">${escHtml(numCDP(e.numero))} · ${escHtml(e.client)}</button>`).join('')}</div>
        <div class="fin-sub">Abra, edite o item e adicione de novo para recalcular antes de gerar a OS.</div></div>`
        : `<div class="inicio-ok">${ic('ok',18)} Todos os orçamentos em aberto usam as tabelas vigentes.</div>`}
    </section>
  </div>`;
}
