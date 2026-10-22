const { JSDOM, VirtualConsole } = require('jsdom');
(async () => {
  const erros = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = String(e.message||e); if (!/Could not load link|googleapis/.test(m)) erros.push(m); });
  const dom = await JSDOM.fromURL('http://localhost:8765/', { runScripts:'dangerously', resources:'usable', pretendToBeVisual:true, virtualConsole: vc,
    beforeParse(w){ w.alert = m => erros.push('alert: '+m); w.fetch = async () => ({ ok:true, json: async()=>[] }); } });
  await new Promise(r => dom.window.addEventListener('load', r)); await new Promise(r => setTimeout(r, 500));
  console.log('Erros servindo por http:', erros.length, erros.slice(0,3));
  console.log('Tela de login presente:', !!dom.window.document.getElementById('login-screen'));
  console.log('Logo carregado de:', dom.window.document.querySelector('#login-screen img').getAttribute('src'));
  process.exit(0);
})();
