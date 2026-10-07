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
  if(!PROPOSTA_VISUAL_NOVO) return html;
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
