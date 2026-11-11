// Compara a calculadora original (arquivo único) com a versão separada em arquivos.
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

async function carregar(arquivo) {
  const erros = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const msg = String(e && (e.message || e));
    if (/Could not load link|fonts\.googleapis|Could not parse CSS/i.test(msg)) return;
    erros.push(msg);
  });
  vc.on('error', (m) => erros.push('console.error: ' + m));
  const dom = await JSDOM.fromFile(arquivo, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    url: 'file://' + path.resolve(arquivo),
    beforeParse(w) {
      w.alert = (m) => erros.push('alert: ' + m);
      w.fetch = async () => ({ ok: true, json: async () => [], text: async () => '' });
      w.navigator.serviceWorker = undefined;
    },
  });
  await new Promise((r) => dom.window.addEventListener('load', r));
  await new Promise((r) => setTimeout(r, 300));
  return { w: dom.window, erros };
}

function casos(w) {
  // Monta casos a partir das próprias tabelas: as 3 primeiras coleções de cada produto de cada fábrica.
  return JSON.parse(w.eval(`(() => {
    const out = [];
    for (const [fab, db] of [['real', DB_REAL], ['decore', DB_DECORE]]) {
      for (const key of Object.keys(db)) {
        const [cat, prod, fam] = key.split('|');
        const d = db[key];
        const cols = d.cols ? (Array.isArray(d.cols) ? d.cols : Object.keys(d.cols)) : [];
        for (const c of cols.slice(0, 3)) {
          const col = typeof c === 'string' ? c : (c.v || c.id || c.l || c.name);
          if (col) out.push({ fab, cat, prod, fam, col });
        }
      }
    }
    return JSON.stringify(out);
  })()`));
}

function calcula(w, c, medidas) {
  return w.eval(`(() => {
    Object.assign(STATE, ${JSON.stringify(c)}, { w: ${medidas[0]}, h: ${medidas[1]}, qty: 1, ambiente: 'Teste' });
    STATE.lastResult = null;
    try { calcular(); } catch (e) { return 'ERRO: ' + e.message; }
    const r = STATE.lastResult;
    return r ? JSON.stringify({ avista: r.avista, tabela: r.tabela, cartao: r.cartao }) : 'sem resultado';
  })()`);
}

(async () => {
  const [orig, nova] = process.argv.slice(2);
  const A = await carregar(orig), B = await carregar(nova);
  console.log('Erros de JavaScript — original:', A.erros.length, '| nova:', B.erros.length);
  [...A.erros, ...B.erros].slice(0, 10).forEach((e) => console.log('  ', e.slice(0, 200)));

  const dados = ['DB_REAL', 'DB_DECORE', 'ACC_REAL', 'ACC_DECORE', 'CDP_TRAD', 'IMPOSTOS_PE', 'TUBOS_REAL', 'FABRIC_W_DECORE', 'FABRIC_W_REAL'];
  for (const d of dados) {
    const igual = A.w.eval(`JSON.stringify(${d})`) === B.w.eval(`JSON.stringify(${d})`);
    console.log(`Tabela ${d}: ${igual ? 'idêntica' : 'DIFERENTE'}`);
  }

  const lista = casos(A.w);
  const medidas = [[1.2, 1.5], [2.4, 2.6], [0.8, 1.1]];
  let iguais = 0, difs = 0, comValor = 0;
  const exemplos = [];
  for (const c of lista) for (const m of medidas) {
    A.erros.length = 0; B.erros.length = 0;
    const ra = calcula(A.w, c, m), rb = calcula(B.w, c, m);
    if (ra === rb) iguais++; else { difs++; if (difs < 5) console.log('DIF', c, m, ra, rb); }
    if (ra.startsWith('{')) { comValor++; if (exemplos.length < 6) exemplos.push([c.fab, c.prod, c.fam, c.col, m.join('×'), ra]); }
  }
  console.log(`Cálculos comparados: ${iguais + difs} (iguais: ${iguais}, diferentes: ${difs}, com valor calculado: ${comValor})`);
  exemplos.forEach((e) => console.log('  ex:', e.join(' | ')));
  process.exit(0);
})();
