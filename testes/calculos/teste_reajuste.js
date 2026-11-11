// Reajuste pela tela: +10% em todas as coleções → à vista sobe ~10%; desfazer → volta exatamente ao original.
const { JSDOM, VirtualConsole } = require('jsdom'); const path = require('path');
(async () => {
  const arq = process.argv[2]; const erros = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = String(e && (e.message || e)); if(!/Could not load link|fonts\.googleapis|Could not parse CSS/i.test(m)) erros.push(m); });
  const dom = await JSDOM.fromFile(arq, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc, url: 'file://' + path.resolve(arq),
    beforeParse(w){ w.alert = () => {}; w.fetch = async () => ({ ok: true, json: async () => [], text: async () => '' }); w.navigator.serviceWorker = undefined; } });
  const w = dom.window; await new Promise(r => w.addEventListener('load', r)); await new Promise(r => setTimeout(r, 300));
  const casos = JSON.parse(w.eval(`(() => { const out=[]; for (const [fab, db] of [['real', DB_REAL], ['decore', DB_DECORE]]) for (const key of Object.keys(db)) { const [cat, prod, fam] = key.split('|'); const d = db[key]; for (const col of Object.keys(d.cols||{}).slice(0,3)) out.push({fab,cat,prod,fam,col}); } return JSON.stringify(out); })()`));
  const calc = (c, m) => w.eval(`(() => { Object.assign(STATE, ${JSON.stringify(c)}, { w: ${m[0]}, h: ${m[1]}, qty: 1, ambiente: 'T' }); STATE.lastResult = null; try { calcular(); } catch(e){ return null; } const r = STATE.lastResult; return r ? r.avista : null; })()`);
  const med = [[1.2,1.5],[1.6,1.8]];
  const rodar = () => casos.map(c => med.map(m => calc(c, m)));
  const antes = rodar();
  w.eval(`PRECOS_AJUSTES = []; ['real','dec'].forEach(fab => pontosDePreco(fab).filter(p => p.tipo==='colecao').forEach(p => { const b = PRECO_BASE[chavePonto(p)]; PRECOS_AJUSTES.push({ fabrica: fab, tipo: p.tipo, chave: p.chave, item: p.item, valor_base: b, valor_novo: Math.round(b*1.1*100)/100, versao: 'Teste/2026', vigencia: '01/11/2026' }); })); aplicarAjustesPreco();`);
  const depois = rodar();
  const ratios = { real: [], decore: [] };
  casos.forEach((c, i) => med.forEach((m, j) => { if(antes[i][j] && depois[i][j]) ratios[c.fab].push(depois[i][j] / antes[i][j]); }));
  for (const f of ['real','decore']) { const r = ratios[f]; console.log(f, 'casos:', r.length, '| à vista subiu entre', ((Math.min(...r)-1)*100).toFixed(2)+'%', 'e', ((Math.max(...r)-1)*100).toFixed(2)+'%', '| média', ((r.reduce((a,b)=>a+b,0)/r.length-1)*100).toFixed(2)+'%'); }
  console.log('versão no botão:', w.eval('TABELAS_INFO.dec.tabela + " · " + TABELAS_INFO.dec.data'), '| texto:', w.eval("textoTabela('real')"));
  w.eval(`PRECOS_AJUSTES = []; aplicarAjustesPreco();`);
  const volta = rodar();
  console.log('desfazer → igual ao original:', JSON.stringify(volta) === JSON.stringify(antes), '| versão:', w.eval('TABELAS_INFO.dec.tabela'));
  // ajuste obsoleto (base diferente) é ignorado
  w.eval(`PRECOS_AJUSTES = [{ fabrica:'dec', tipo:'colecao', chave:'CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA', item:'Delta', valor_base: 1, valor_novo: 999 }]; aplicarAjustesPreco();`);
  console.log('ajuste obsoleto ignorado:', w.eval(`DB_DECORE['CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA'].cols.Delta.p`), '| obsoletos:', w.eval('PRECOS_OBSOLETOS'));
  console.log('pontos de preço → real:', w.eval("pontosDePreco('real').length"), '| decore:', w.eval("pontosDePreco('dec').length"));
  console.log('ERROS JS:', erros);
})();
