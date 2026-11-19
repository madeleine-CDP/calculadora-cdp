# Painel de Gestão, com banco SIMULADO. Bruna (computador e celular); Mirelle não vê.
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today(); iso=lambda d: d.isoformat()
def dias(n): return (agora-dt.timedelta(days=n)).isoformat()
ORCS=[{'id':1,'client':'João Parado','etapa':'orcamento','numero':52,'criado_por':'Mirelle','total_avista':2000,'created_at':dias(6),'updated_at':dias(5),
       'items':[{'fab':'dec','tabelaVer':'Outubro/2026'}]},
      {'id':2,'client':'Paula Enviado','etapa':'enviado','numero':44,'criado_por':'Mirelle','total_avista':1500,'created_at':dias(9),'updated_at':dias(6),'items':[{'fab':'real','tabelaVer':'Agosto/2026'}]},
      {'id':3,'client':'Fechou Teste','etapa':'fechado','numero':40,'criado_por':'Bruna','total_avista':3000,'created_at':dias(3),'fechado_em':dias(1),'updated_at':dias(1),'items':[]}]
RET=[{'id':1,'cliente':'A','assunto':'Mandar foto','responsavel':'Mirelle','prazo':dias(2),'status':'aberto','criado_em':dias(3)},
     {'id':2,'cliente':'B','assunto':'Prazo Real','responsavel':'Fábrica','prazo':dias(1),'status':'aguardando','criado_em':dias(3)},
     {'id':3,'cliente':'C','assunto':'Feito','responsavel':'Bruna','prazo':dias(2),'status':'respondido','respondido_em':dias(1),'criado_em':dias(4)}]
OS=[{'pedido_id':1,'numero':'1497','cliente':'X','valor':2000,'situacao':4,'situacao_desde':dias(10),'data_prevista':iso(hoje-dt.timedelta(days=2)),'numero_fabrica':'D2321','data_venda':iso(hoje-dt.timedelta(days=20)),'lido_em':agora.isoformat()},
    {'pedido_id':2,'numero':'1500','cliente':'Y','valor':1800,'situacao':7,'situacao_desde':dias(1),'numero_fabrica':'R2300','lido_em':agora.isoformat()},
    {'pedido_id':3,'numero':'1490','cliente':'Z','valor':1500,'situacao':6,'situacao_desde':dias(3),'numero_fabrica':'D2310','data_venda':iso(hoje-dt.timedelta(days=15)),'data_entrega':iso(hoje-dt.timedelta(days=3)),'avaliacao_em':dias(2),'lido_em':agora.isoformat()},
    {'pedido_id':4,'numero':'1491','cliente':'W','valor':1500,'situacao':6,'situacao_desde':dias(3),'numero_fabrica':'R2299','data_venda':iso(hoje-dt.timedelta(days=12)),'data_entrega':iso(hoje-dt.timedelta(days=4)),'lido_em':agora.isoformat()}]
GAR=[{'id':1,'cliente':'G','status':'aguardando','criado_em':dias(4),'primeiro_retorno_em':dias(4),'prazo_retorno':dias(4)},
     {'id':2,'cliente':'H','status':'aberto','criado_em':dias(1),'primeiro_retorno_em':None,'prazo_retorno':dias(0.5)}]
PV=[{'pedido_id':9,'numero':'900','cliente':'P','data_entrega':iso(hoje-dt.timedelta(days=200)),'contato_em':None}]
CONF=[{'id':1,'fabrica':'decore','conferido_em':agora.isoformat(),'conferido_por':'Mirelle'}]
def rest(route):
    u=route.request.url
    for k,v in (('/orcamentos',ORCS),('/retornos',RET),('/os_acompanhamento',OS),('/garantias',GAR),('/posvenda',PV),('/conferencias_fabrica',CONF)):
        if k in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(v))
    route.fulfill(status=200, content_type='application/json', body='[]')
def fn(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[],'lidas':0,'detalhes':0,'lidos':0,'faltam':0,'pedidos':[]}))
def abrir(b, nome, papel, w):
    pg=b.new_page(viewport={'width':w,'height':900},service_workers='block'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', fn)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))"%(nome,papel))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2200); return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=abrir(b,'Bruna','admin',1280)
    print('1 abas:', pg.locator('#tab-inicio .painel-abas button').all_inner_texts())
    pg.click('#tab-inicio .painel-abas >> text=Gestão'); pg.wait_for_timeout(1500)
    print('2 tela:', pg.evaluate('document.body.dataset.tela'))
    print('  fora do prazo:', pg.inner_text('.ges-als').replace('\n',' / '))
    print('  equipe:', pg.inner_text('.ges-tab tbody').replace('\n',' / ').replace('\t',' '))
    print('  parados:', pg.locator('.fin-q', has_text='Orçamentos parados').inner_text().replace('\n',' / ')[:200])
    print('  pedidos:', pg.locator('.fin-q', has_text='Conferência das fábricas').inner_text().replace('\n',' / ')[:330])
    print('  garantia:', pg.locator('.fin-q', has_text='Garantia e pós-venda').inner_text().replace('\n',' / ')[:260])
    print('  tabelas:', pg.locator('.fin-q', has_text='Tabelas de preço').inner_text().replace('\n',' / ')[:260])
    pg.screenshot(path=f'{S}/shotsT/gestao_1280.png', full_page=True)
    pg.locator('.ges-tab tbody tr', has_text='Mirelle').click(); pg.wait_for_timeout(800)
    print('3 tocar na Mirelle → tela:', pg.evaluate('document.body.dataset.tela'), '| filtro:', pg.evaluate('RET_PESSOA'))
    pg.close()
    pg=abrir(b,'Bruna','admin',360); pg.evaluate('abrirGestao()'); pg.wait_for_timeout(1500)
    print('4 celular largura:', pg.evaluate('document.documentElement.scrollWidth'))
    pg.screenshot(path=f'{S}/shotsT/gestao_360.png', full_page=True); pg.close()
    pg=abrir(b,'Mirelle','atendimento',360)
    print('5 Mirelle abrirGestao:', pg.evaluate("abrirGestao(), document.body.dataset.tela"))
    b.close()
print('ERROS JS:', errs)
