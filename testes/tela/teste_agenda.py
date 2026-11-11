import json, datetime as dt
from playwright.sync_api import sync_playwright
errs=[]; chamadas=[]
hoje=dt.date.today().isoformat(); amanha=(dt.date.today()+dt.timedelta(days=1)).isoformat()
EV=[{'id':'a','titulo':'[A CONFIRMAR] C - Visita técnica - Ana Pré (Boa Viagem)','inicio':hoje+'T09:00:00-03:00','fim':hoje+'T10:00:00-03:00','diaInteiro':False,'descricao':'Tel: (81) 98888-1111\nItens: 2 rolôs sala','local':'','cor':'7','link':'https://calendar.google.com/x'},
    {'id':'b','titulo':'C/J - Instalação - Beto Enviado (Casa Forte)','inicio':hoje+'T14:00:00-03:00','fim':hoje+'T16:00:00-03:00','diaInteiro':False,'descricao':'CDP-0006\nItens: 1 romana, 1 vertical','local':'Rua X, 10','cor':'10','link':''},
    {'id':'c','titulo':'Entrega Jones','inicio':hoje+'T13:00:00-03:00','fim':hoje+'T13:30:00-03:00','diaInteiro':False,'descricao':'','local':'','cor':None,'link':''},
    {'id':'d','titulo':'M - Garantia - Carla (Piedade)','inicio':amanha,'fim':amanha,'diaInteiro':True,'descricao':'','local':'','cor':'11','link':''}]
ORC=[{'id':5,'numero':5,'client':'Ana Pré','telefone':'(81) 98888-1111','etapa':'pre_orcamento','items':[],'created_at':'2026-10-01T10:00:00Z','updated_at':'2026-10-06T10:00:00Z'},
     {'id':6,'numero':6,'client':'Beto Enviado','telefone':'(81) 97777-2222','etapa':'enviado','items':[],'created_at':'2026-10-01T10:00:00Z','updated_at':'2026-10-06T10:00:00Z'}]
estado={'cfg':True}
def ag(route):
    r=route.request; rota=r.url.split('/agenda/')[1]; chamadas.append((rota, r.post_data))
    if rota=='status': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'configurado':estado['cfg'],'ok':estado['cfg'],'nome':'CLIENTES CDP'}))
    b=json.loads(r.post_data); de=b['de'][:10]
    evs=EV if True else []
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'eventos':evs}))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(ORC) if 'orcamentos' in r.request.url else '[]'))
    pg.route('**/functions/v1/agenda/**', ag); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1200)
    print('0 menu:', pg.locator('.tab-btn').all_inner_texts(), '| altura nav:', pg.evaluate("document.querySelector('.tabs-nav').offsetHeight"))
    pg.screenshot(path='shotsT/ag-menu.png', clip={'x':0,'y':0,'width':360,'height':200})
    pg.click('.tab-btn[data-tab=agenda]'); pg.wait_for_timeout(1200)
    print('1 dia → cards:', pg.locator('.ag-card').count(), '| resumo:', pg.inner_text('#ag-resumo'), '| filtros:', pg.locator('#ag-exec .hist-chip').all_inner_texts())
    print('   1º card:', pg.locator('.ag-card').first.inner_text().replace('\n',' / '))
    print('   links CDP:', pg.locator('.ag-card .ret-link').all_inner_texts())
    pg.screenshot(path='shotsT/ag-dia.png', full_page=True)
    pg.click('#ag-exec .hist-chip >> text=Jones'); pg.wait_for_timeout(200); print('2 filtro Jones →', pg.locator('.ag-card').count())
    pg.click('#ag-exec .hist-chip >> nth=0'); pg.click('#ag-modo .hist-chip >> text=Semana'); pg.wait_for_timeout(800)
    print('3 semana → dias:', pg.locator('.ag-dia').all_inner_texts(), '| período:', pg.inner_text('#ag-periodo'), '| pediu período de 7 dias:', json.loads(chamadas[-1][1])['de'][:10], json.loads(chamadas[-1][1])['ate'][:10])
    pg.locator('.ag-card .ret-link >> text=CDP-0005').first.click(); pg.wait_for_timeout(700); print('4 abre pasta →', pg.evaluate('document.body.dataset.tela'), pg.inner_text('#pasta-nome'))
    pg.evaluate("voltarParaLista('agenda')"); pg.wait_for_timeout(800); print('   voltou para:', pg.evaluate('document.body.dataset.tela'))
    estado['cfg']=False; pg.evaluate("AG_STATUS=null; renderAgenda('status')"); pg.wait_for_timeout(600); print('5 sem chave →', pg.inner_text('#ag-lista'))
    print('   largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
