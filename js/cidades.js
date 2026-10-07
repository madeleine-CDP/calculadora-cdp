// ═══════════════════════════════════════════════════════
// CIDADES → ESTADO (UF)
// Ao digitar a cidade, o estado é preenchido sozinho quando a cidade está na lista.
// Lista: Pernambuco (Grande Recife e principais do interior), cidades vizinhas e todas as capitais.
// Cidade fora da lista: é só escolher o estado à mão.
// ═══════════════════════════════════════════════════════
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const CIDADES_UF = {
  PE: ['Recife','Jaboatão dos Guararapes','Olinda','Paulista','Camaragibe','São Lourenço da Mata','Abreu e Lima','Igarassu',
       'Cabo de Santo Agostinho','Ipojuca','Moreno','Ilha de Itamaracá','Itapissuma','Araçoiaba','Goiana','Vitória de Santo Antão',
       'Caruaru','Gravatá','Bezerros','Chã Grande','Pombos','Escada','Sirinhaém','Rio Formoso','Tamandaré','Barreiros',
       'São José da Coroa Grande','Palmares','Carpina','Paudalho','Nazaré da Mata','Limoeiro','Timbaúba','Surubim',
       'Santa Cruz do Capibaribe','Toritama','Belo Jardim','Pesqueira','Arcoverde','Garanhuns','Serra Talhada','Salgueiro',
       'Petrolina','Ouricuri','Araripina','Fernando de Noronha'],
  PB: ['João Pessoa','Cabedelo','Bayeux','Santa Rita','Conde','Campina Grande'],
  AL: ['Maceió','Maragogi','Japaratinga','Porto de Pedras','São Miguel dos Milagres','Arapiraca'],
  RN: ['Natal','Parnamirim','Mossoró'], CE: ['Fortaleza'], PI: ['Teresina'], MA: ['São Luís'], SE: ['Aracaju'],
  BA: ['Salvador'], PA: ['Belém'], AM: ['Manaus'], AP: ['Macapá'], RR: ['Boa Vista'], RO: ['Porto Velho'],
  AC: ['Rio Branco'], TO: ['Palmas'], GO: ['Goiânia'], DF: ['Brasília'], MT: ['Cuiabá'], MS: ['Campo Grande'],
  MG: ['Belo Horizonte'], ES: ['Vitória','Vila Velha'], RJ: ['Rio de Janeiro','Niterói'], SP: ['São Paulo','Campinas'],
  PR: ['Curitiba'], SC: ['Florianópolis'], RS: ['Porto Alegre']
};

const _normCidade = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const _MAPA_CIDADES = {};
Object.entries(CIDADES_UF).forEach(([uf, l]) => l.forEach(c => { _MAPA_CIDADES[_normCidade(c)] = { nome: c, uf }; }));

// "jaboatao dos guararapes" → { nome: 'Jaboatão dos Guararapes', uf: 'PE' }
function cidadeConhecida(t){ return _MAPA_CIDADES[_normCidade(t)] || null; }

// Liga um campo de cidade a um campo de UF: escolheu/digitou cidade conhecida → acerta a grafia e o estado
function ligarCidadeUf(idCidade, idUf){
  const c = document.getElementById(idCidade), u = document.getElementById(idUf);
  if(!c || !u) return;
  const aplicar = (acertarGrafia) => {
    const k = cidadeConhecida(c.value);
    if(!k) return;
    if(acertarGrafia && c.value !== k.nome) c.value = k.nome;
    if(u.value !== k.uf){ u.value = k.uf; u.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  c.addEventListener('input', () => aplicar(false));
  c.addEventListener('change', () => aplicar(true));
}

// "Recife/PE" (como vem do Olist) → { cidade: 'Recife', uf: 'PE' }
function separarCidadeUf(t){
  const m = String(t || '').match(/^(.*?)\s*[\/\-]\s*([A-Za-z]{2})$/);
  if(m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  if(/^[A-Za-z]{2}$/.test(String(t || '').trim())) return { cidade: '', uf: String(t).trim().toUpperCase() };
  return { cidade: String(t || '').trim(), uf: '' };
}

// Endereço para a proposta: "Rua X, 10 - Boa Viagem - Recife/PE" (sem repetir o que já está escrito)
function enderecoCompleto(c){
  const end = String(c.end || '').trim(), n = _normCidade(end);
  const ja = v => !!v && n.includes(_normCidade(v));
  const partes = [end];
  if(c.bairro && !ja(c.bairro)) partes.push(String(c.bairro).trim());
  const cid = [c.cidade, c.uf].filter(Boolean).join('/');
  if(cid && !ja(c.cidade || c.uf)) partes.push(cid);
  return partes.filter(Boolean).join(' - ');
}

// Monta as opções (estados e sugestões de cidade) nos formulários
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('select.sel-uf').forEach(s => {
    s.innerHTML = '<option value="">UF</option>' + UFS.map(u => `<option value="${u}">${u}</option>`).join('');
  });
  const dl = document.getElementById('lista-cidades');
  if(dl) dl.innerHTML = Object.values(_MAPA_CIDADES).map(c => `<option value="${c.nome}">${c.uf}</option>`).join('');
  ligarCidadeUf('novo-cidade', 'novo-uf');
  ligarCidadeUf('cli-cidade', 'cli-uf');
});
