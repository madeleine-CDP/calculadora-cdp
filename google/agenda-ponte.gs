// ═══════════════════════════════════════════════════════
// PONTE AGENDA ↔ CDP SISTEMA  (Google Apps Script, na conta madeleine@centraldaspersianas.com)
// Lê a agenda "CLIENTES CDP" e devolve os compromissos para o CDP Sistema.
// Etapa 3A: SÓ LEITURA (não cria nem altera nada na agenda).
//
// Como instalar (a Bru faz uma vez, guiada pelo Claude):
//  1. script.google.com (logada como madeleine@) → Novo projeto → nome "CDP Sistema - Agenda"
//  2. Apagar o que vier e colar ESTE arquivo inteiro → Salvar
//  3. Configurações do projeto (engrenagem) → Propriedades do script → Adicionar:
//       SEGREDO = uma senha longa inventada (a mesma vai no Supabase como AGENDA_SEGREDO)
//  4. Implantar → Nova implantação → tipo "App da Web" → Executar como: Eu · Quem pode acessar: Qualquer pessoa
//     → Autorizar (é a própria conta da Madeleine dando acesso à agenda dela para este script)
//  5. Copiar a "URL do app da Web" → Supabase, segredo AGENDA_URL
// Sem o SEGREDO certo, o script não devolve nada.
// ═══════════════════════════════════════════════════════
var NOME_AGENDA = 'CLIENTES CDP';

function doPost(e) {
  var corpo = {};
  try { corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { corpo = {}; }
  var segredo = PropertiesService.getScriptProperties().getProperty('SEGREDO');
  if (!segredo || corpo.segredo !== segredo) return resposta({ erro: 'nao_autorizado' });

  var agendas = CalendarApp.getCalendarsByName(NOME_AGENDA);
  if (!agendas.length) return resposta({ erro: 'agenda_nao_encontrada' });
  var agenda = agendas[0];
  var fuso = agenda.getTimeZone() || 'America/Sao_Paulo';

  if (corpo.acao === 'status') return resposta({ ok: true, nome: agenda.getName(), fuso: fuso });

  if (corpo.acao === 'eventos') {
    var de = new Date(corpo.de), ate = new Date(corpo.ate);
    if (isNaN(de) || isNaN(ate) || ate <= de || (ate - de) > 62 * 86400000) return resposta({ erro: 'periodo' });
    var lista = agenda.getEvents(de, ate).map(function (ev) {
      var diaTodo = ev.isAllDayEvent();
      var fmt = function (d) { return Utilities.formatDate(d, fuso, diaTodo ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ssXXX"); };
      return {
        id: ev.getId() + '|' + ev.getStartTime().getTime(),
        titulo: ev.getTitle() || '',
        inicio: fmt(diaTodo ? ev.getAllDayStartDate() : ev.getStartTime()),
        fim: fmt(diaTodo ? ev.getAllDayEndDate() : ev.getEndTime()),
        diaInteiro: diaTodo,
        descricao: String(ev.getDescription() || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').slice(0, 2000),
        local: ev.getLocation() || '',
        cor: ev.getColor() || null
      };
    });
    return resposta({ eventos: lista });
  }
  return resposta({ erro: 'acao' });
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Para testar dentro do editor (Executar → testar): mostra os compromissos de hoje no registro
function testar() {
  var a = CalendarApp.getCalendarsByName(NOME_AGENDA)[0];
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var amanha = new Date(hoje.getTime() + 86400000);
  Logger.log(a ? a.getName() + ': ' + a.getEvents(hoje, amanha).length + ' compromisso(s) hoje' : 'Agenda não encontrada');
}
