// ═══════════════════════════════════════════════════════
// PROPOSTA · utilidades (nº CDP, ordem por ambiente, tipo pela etapa)
// "Veste" o documento gerado por gerarProposta() com as cores e fontes da marca
// e troca os emojis por ícones de traço. NÃO muda nenhum texto nem valor.
// ═══════════════════════════════════════════════════════

const PROPOSTA_EMOJIS = {
  '🏷️':'etiqueta', '💳':'cartao', '💵':'dinheiro', '⚠️':'alerta', '🚚':'caminhao', '🗓️':'calendario',
  '✅':'ok', '📝':'nota', '🛡️':'escudo', '⭐':'estrela', '🪪':'documento', '☎️':'telefone', '✉️':'email',
  '📍':'local', '👤':'usuario', '💻':'globo', '📱':'celular', '⏳':'relogio', '🔘':'info', '🎁':'presente',
  '💬':'chat', '💎':'gema', '🧭':'bussola'
};

const PROPOSTA_TROCAS = [
  // fontes: texto em Figtree, títulos em Cormorant
  ["font-family:'Gill Sans','Gill Sans MT',Poppins,sans-serif", "font-family:Figtree,'Gill Sans','Gill Sans MT',sans-serif"],
  ["font-family:'EB Garamond',Garamond,serif", "font-family:'Cormorant Garamond','EB Garamond',Garamond,serif"],
  // cores antigas → paleta da marca
  ['#F0EEE9', '#F6EBD9'],   // faixas de título e cabeçalhos → areia
  ['#F5F5F0', '#F7F4F1'],   // fundo do logo → fundo
  ['#6B5D4F', '#5A1524'],   // marrom → vinho
  ['#B68235', '#5A1524'],   // dourado de destaque → vinho
  ['#E3ECF7', '#EEDFCB'],   // coluna cartão (azul) → linho
  ['#E5F0E3', '#F2EAEC'],   // coluna à vista (verde) → vinho suave
  ['color:#333', 'color:#201F1D'],
  ['border:1px solid #DDD', 'border:1px solid #DED8D3']
];

// A Bru pediu a proposta FIEL ao modelo do Word (cores, fontes e emojis originais).
// Por isso o "vestir" está desligado: devolve o documento como ele é.
// As trocas acima ficam guardadas caso um dia se queira o visual novo.
const PROPOSTA_VISUAL_NOVO = false;
function vestirProposta(html){
  if(!PROPOSTA_VISUAL_NOVO) return fielAoWord(html);
  let h = html;
  PROPOSTA_TROCAS.forEach(([de, para]) => { h = h.split(de).join(para); });
  // ícones grandes dos blocos de condição (eram emojis em 22px)
  h = h.replace(/(<div style="font-size:22px">)(💵|💳)(<\/div>)/g, (m, a, e, b) =>
    a.replace('font-size:22px', 'color:#5A1524;line-height:0') + ic(PROPOSTA_EMOJIS[e], 28) + b);
  // demais emojis → ícone de traço do tamanho do texto
  Object.keys(PROPOSTA_EMOJIS).forEach(e => {
    const svg = '<span style="display:inline-flex;vertical-align:-2px;margin-right:4px">' + ic(PROPOSTA_EMOJIS[e], 14) + '</span>';
    h = h.split(e).join(svg);
  });
  return h;
}

// Itens agrupados por ambiente, na ordem em que os ambientes aparecem
function ordenarPorAmbiente(items){
  const ordem = [];
  items.forEach(i => { const a = (i.ambiente || '').trim().toLowerCase(); if(!ordem.includes(a)) ordem.push(a); });
  return [...items].sort((x, y) => ordem.indexOf((x.ambiente||'').trim().toLowerCase()) - ordem.indexOf((y.ambiente||'').trim().toLowerCase()));
}

// Número CDP do orçamento aberto (para o cabeçalho da proposta)
function numeroDaProposta(){
  const e = (typeof orcEmEdicao === 'function') ? orcEmEdicao() : null;
  return e && e.numero ? numCDP(e.numero) : '—';
}

// Ao abrir a proposta pela pasta, o tipo já vem conforme a etapa
function prepararTipoProposta(){
  const e = (typeof orcEmEdicao === 'function') ? orcEmEdicao() : null;
  const sel = $('p-tipo'); if(!sel || !e) return;
  sel.value = e.etapa === 'pre_orcamento' ? 'PRÉ-ORÇAMENTO' : 'ORÇAMENTO PÓS-VISITA';
  if(typeof onPTipo === 'function') onPTipo();
}


// ── Fidelidade ao modelo do Word (MODELO PRÉ-ORÇAMENTO / ORÇAMENTO PÓS-VISITA) ──
// Valores como no Word: R$ 1.575,00
function fmtCent(v){
  return 'R$ ' + (Math.round(Number(v)||0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fielAoWord(html){
  let h = html;
  const isPos = h.includes('PÓS-VISITA</span>') || h.includes("Observações <span style=\"color:#BF8F00\">importantes</span> · <span style=\"color:#BF8F00;text-decoration:underline\">PÓS-VISITA");
  // 1) capa do Word (já traz "PRÉ ORÇAMENTO"/"ORÇAMENTO PÓS-VISITA" e "PROPOSTA EXCLUSIVA · 2026" na foto)
  const capa = new URL('assets/proposta-capa-' + (isPos ? 'pos' : 'pre') + '.jpg', location.href).href;
  h = h.replace(/(<!-- CAPA -->\s*<div[^>]*>\s*<img src=")data:image\/[a-z]+;base64,[^"]+(")/, '$1' + capa + '$2');
  // 2) faixas com o logo entre as seções, como no Word
  const m = h.match(/<!-- LOGO TOPO -->\s*(<div[^>]*>\s*<img[^>]*>\s*<\/div>)/);
  if(m){
    const faixa = m[1].replace(/margin:-32px -40px 24px -40px/, 'margin:26px 0 18px 0').replace('<div ', '<div class="pp-logo" ');
    ['<!-- PRODUTOS & SERVIÇOS -->', '<!-- INVESTIMENTO & VALORES -->', '<!-- A JORNADA COMPLETA -->', '<!-- OBSERVAÇÕES IMPORTANTES -->']
      .forEach(marca => { h = h.replace(marca, marca + '\n' + faixa); });
  }
  // 3) Site e Instagram como os cartões de link do Word (clicáveis)
  const cartao = (img, alt) => '<img src="' + new URL('assets/' + img, location.href).href + '" alt="' + alt + '" style="display:block;width:100%;max-width:340px;border-radius:8px;border:1px solid #E3E0DC">';
  h = h.replace(/(<a href="https:\/\/centraldaspersianas\.com"[^>]*>)centraldaspersianas\.com(<\/a>)/, '$1' + cartao('proposta-site.png', 'Site da Central das Persianas') + '$2');
  h = h.replace(/(<a href="https:\/\/instagram\.com\/centraldaspersianas"[^>]*>)@centraldaspersianas(<\/a>)/, '$1' + cartao('proposta-instagram.png', 'Instagram @centraldaspersianas') + '$2');
  return h;
}
