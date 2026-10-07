// ═══════════════════════════════════════════════════════
// INÍCIO — PAINEL DO DIA (Etapa E1)
// Lê os mesmos orçamentos da lista (HISTORY_CACHE) e aplica as regras da loja:
//  • pré-orçamento sem movimento há 3+ dias → follow-up (até 3 lembretes; depois sugere "Perdido · sem retorno")
//  • orçamento pós-visita: enviar em 1 dia útil (limite 2)
//  • enviado aguardando o cliente há 3+ dias
// "Sem movimento" = dias desde a última alteração salva (updated_at).
// ═══════════════════════════════════════════════════════

function diasCorridos(iso){
  if(!iso) return 0;
  const d = new Date(iso); if(isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function diasUteis(iso){
  if(!iso) return 0;
  const ini = new Date(iso); if(isNaN(ini)) return 0;
  const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate());
  const hoje = new Date(); const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let n = 0;
  while(d < fim){ d.setDate(d.getDate() + 1); const s = d.getDay(); if(s !== 0 && s !== 6) n++; }
  return n;
}
function saudacao(){ const h = new Date().getHours(); return h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite'); }

// O que precisa de atenção hoje (mais urgente primeiro)
function pendenciasDoDia(){
  const lista = [];
  HISTORY_CACHE.forEach(e => {
    if(e.etapa === 'fechado' || e.etapa === 'perdido' || evoluidoPara(e.id)) return;
    const ref = e.updatedAt || e.createdAt;
    if(e.etapa === 'pre_orcamento'){
      const d = diasCorridos(ref);
      if(d >= 3){
        const lembrete = Math.min(Math.floor(d / 3), 3);
        lista.push({ e, peso: d >= 9 ? 3 : 2, tipo: d >= 9 ? 'perdido' : 'follow',
          titulo: d >= 9 ? 'Sem retorno há ' + d + ' dias' : 'Follow-up do pré-orçamento',
          sub: d >= 9 ? 'Já passou dos 3 lembretes: considere marcar como Perdido · sem retorno.' : 'Sem movimento há ' + d + ' dias · ' + lembrete + 'º lembrete' });
      }
    } else if(e.etapa === 'orcamento'){
      const u = diasUteis(ref);
      if(u >= 1) lista.push({ e, peso: u >= 2 ? 3 : 2, tipo: u >= 2 ? 'atrasado' : 'enviar',
        titulo: u >= 2 ? 'Orçamento atrasado' : 'Enviar orçamento hoje',
        sub: 'Parado há ' + u + (u > 1 ? ' dias úteis' : ' dia útil') + ' · o combinado é enviar em 1 dia útil (limite 2).' });
    } else if(e.etapa === 'enviado'){
      const d = diasCorridos(ref);
      if(d >= 3) lista.push({ e, peso: 1, tipo: 'aguardando', titulo: 'Aguardando o cliente', sub: 'Enviado há ' + d + ' dias sem resposta registrada.' });
    }
  });
  return lista.sort((a,b) => b.peso - a.peso || diasCorridos(b.e.updatedAt) - diasCorridos(a.e.updatedAt));
}

async function renderInicio(atualizar){
  const box = $('inicio-conteudo');
  if(atualizar && HIST_CARREGADO){ try{ HISTORY_CACHE = await sbFetchHistory(); }catch(err){} }
  if(!HIST_CARREGADO){
    try{ HISTORY_CACHE = await sbFetchHistory(); HIST_CARREGADO = true; }
    catch(err){ box.innerHTML = '<div class="hist-empty" style="color:var(--red)">' + ic('alerta',16) + ' Não foi possível carregar. Verifique a conexão.</div>'; return; }
  }
  const nome = (typeof getUsuarioLogado === 'function' && getUsuarioLogado()) || '';
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
  const ativos = HISTORY_CACHE.filter(e => e.etapa !== 'fechado' && e.etapa !== 'perdido' && !evoluidoPara(e.id));
  const etapasAbertas = ETAPAS.filter(([id]) => id !== 'fechado' && id !== 'perdido');
  const porEtapa = etapasAbertas.map(([id, nomeE]) => {
    const l = ativos.filter(e => e.etapa === id);
    return { id, nome: nomeE, n: l.length, valor: l.reduce((s,e) => s + (e.totalAvista||0), 0) };
  });
  const totalAberto = ativos.reduce((s,e) => s + (e.totalAvista||0), 0);

  // mês atual
  const agora = new Date(), mes = agora.getMonth(), ano = agora.getFullYear();
  const doMes = iso => { if(!iso) return false; const d = new Date(iso); return d.getMonth() === mes && d.getFullYear() === ano; };
  const fechados = HISTORY_CACHE.filter(e => e.etapa === 'fechado' && doMes(e.fechadoEm || e.updatedAt));
  const perdidos = HISTORY_CACHE.filter(e => e.etapa === 'perdido' && doMes(e.updatedAt));
  const motivos = {}; perdidos.forEach(e => { const m = (e.motivoPerda || 'Sem motivo').replace(/^Outro: .*/, 'Outro'); motivos[m] = (motivos[m]||0) + 1; });
  const criadosMes = HISTORY_CACHE.filter(e => doMes(e.createdAt)).length;
  const nomeMes = agora.toLocaleDateString('pt-BR', { month:'long' });

  const pend = pendenciasDoDia();

  box.innerHTML = `
    <div class="inicio-topo">
      <div class="inicio-data">${escHtml(hoje)}</div>
      <div class="hist-titulo">${saudacao()}${nome ? ', ' + escHtml(nome) : ''}</div>
    </div>
    <div class="inicio-atalhos">
      <button type="button" class="btn" onclick="novoOrcamento()">${ic('mais',18)} Novo orçamento</button>
      <button type="button" class="btn-outline" onclick="switchTab('calc')">${ic('calculadora',18)} Cálculo rápido</button>
    </div>

    <section class="inicio-bloco">
      <div class="inicio-bloco-tit"><span>Em aberto</span><strong>${ativos.length} · ${fmt(totalAberto)} à vista</strong></div>
      <div class="inicio-etapas">${porEtapa.map(x => `
        <button type="button" class="inicio-etapa etapa-borda-${x.id}" onclick="abrirListaEtapa('${x.id}')">
          <span class="inicio-etapa-n">${x.n}</span>
          <span class="inicio-etapa-nome">${x.nome}</span>
          <span class="inicio-etapa-valor">${x.n ? fmt(x.valor) : '—'}</span>
        </button>`).join('')}
      </div>
    </section>

    <section class="inicio-bloco">
      <div class="inicio-bloco-tit"><span>Precisa de atenção</span><strong>${pend.length ? pend.length + (pend.length > 1 ? ' orçamentos' : ' orçamento') : ''}</strong></div>
      ${pend.length ? `<div class="inicio-pend">${pend.map(p => `
        <button type="button" class="inicio-pend-item pend-${p.tipo}" onclick="reopenOrc(${p.e.id})">
          <span class="inicio-pend-ic">${ic(p.tipo === 'aguardando' ? 'info' : 'alerta', 16)}</span>
          <span class="inicio-pend-txt"><strong>${escHtml(p.titulo)}</strong><span>${escHtml(p.e.client)} · ${numCDP(p.e.numero)} · ${fmt(p.e.totalAvista||0)}</span><em>${escHtml(p.sub)}</em></span>
          <span class="inicio-pend-seta">›</span>
        </button>`).join('')}</div>`
      : `<div class="inicio-ok">${ic('ok',18)} Tudo em dia. Nenhum orçamento parado.</div>`}
    </section>

    <section class="inicio-bloco">
      <div class="inicio-bloco-tit"><span>Resumo de ${escHtml(nomeMes)}</span></div>
      <div class="inicio-mes">
        <div><span>Novos orçamentos</span><strong>${criadosMes}</strong></div>
        <div class="mes-fechado"><span>Fechados</span><strong>${fechados.length}</strong><em>${fmt(fechados.reduce((s,e)=>s+(e.totalAvista||0),0))} à vista</em></div>
        <div class="mes-perdido"><span>Perdidos</span><strong>${perdidos.length}</strong><em>${Object.entries(motivos).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([m,n]) => escHtml(m) + ' (' + n + ')').join(' · ') || '—'}</em></div>
      </div>
    </section>`;
}

function abrirListaEtapa(etapa){
  HIST_ETAPA = etapa;
  switchTab('hist');
}
