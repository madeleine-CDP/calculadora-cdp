const { JSDOM, VirtualConsole } = require('jsdom'); const path = require('path');
async function carregar(arquivo){ const erros=[]; const vc=new VirtualConsole(); vc.on('jsdomError',e=>{const m=String(e&&(e.message||e)); if(!/Could not load link|fonts|CSS/i.test(m)) erros.push(m);});
  const dom=await JSDOM.fromFile(arquivo,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,virtualConsole:vc,url:'file://'+path.resolve(arquivo),
    beforeParse(w){ w.alert=()=>{}; w.fetch=async()=>({ok:true,json:async()=>[],text:async()=>''}); w.navigator.serviceWorker=undefined; }});
  await new Promise(r=>dom.window.addEventListener('load',r)); await new Promise(r=>setTimeout(r,300)); return {w:dom.window,erros}; }
(async()=>{
  const [orig,nova]=process.argv.slice(2); const A=await carregar(orig), B=await carregar(nova);
  const casos=JSON.parse(A.w.eval(`JSON.stringify(Object.keys(DB_DECORE).filter(k=>/ROLÔ|ELEGANCE/.test(k)).slice(0,40).map(k=>{const d=DB_DECORE[k]; const cols=Array.isArray(d.cols)?d.cols:Object.keys(d.cols||{}); const c=cols[0]; return {k, col: typeof c==='string'?c:(c.v||c.id||c.l||c.name)};}))`));
  const medidas=[[1.79,1.50],[1.80,1.50],[1.50,2.00],[1.80,2.00],[1.81,1.50],[1.50,2.01]];
  const calc=(w,c,m)=>w.eval(`(()=>{const [cat,prod,fam]=${JSON.stringify(c.k)}.split('|'); Object.assign(STATE,{fab:'dec',cat,prod,fam,col:${JSON.stringify(c.col)},w:${m[0]},h:${m[1]},qty:1,ambiente:'T'}); try{updateChips();}catch(e){} STATE.lastResult=null; try{calcular();}catch(e){return 'ERRO '+e.message} const r=STATE.lastResult; return r? r.avista : null;})()`);
  const linhas=[]; const vistos=new Set();
  for(const c of casos){ const prod=c.k.split('|')[1]; if(vistos.has(prod)) continue; vistos.add(prod);
    for(const m of medidas){ const a=calc(A.w,c,m), b=calc(B.w,c,m); linhas.push([prod+' · '+c.col, m.join('×'), a, b, a===b?'igual':'MUDOU'].join(' | ')); } }
  console.log(linhas.join('\n')); console.log('erros', A.erros.length, B.erros.length);
})();
