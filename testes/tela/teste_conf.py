import json, datetime as dt, urllib.parse as up
from playwright.sync_api import sync_playwright
errs=[]; banco={}
hoje=dt.date.today(); am=(hoje+dt.timedelta(days=1)).isoformat()
EV=[{'id':'e1|1','titulo':'C [ÀS 9H] - Visita - Ana Teste (Boa Viagem)','inicio':am+'T09:30:00-03:00','fim':am+'T10:30:00-03:00','diaInteiro':False,'descricao':'Contato: 98888-1111\nReferência: x','local':'','cor':None},
    {'id':'e2|1','titulo':'C/M- Instalação - Beto Teste (Casa Forte)','inicio':am+'T14:00:00-03:00','fim':am+'T16:00:00-03:00','diaInteiro':False,'descricao':'Contato: 97777-2222 (Beto) e 96666-3333 (portaria)','local':'','cor':None},
    {'id':'e3|1','titulo':'M - CURSO','inicio':am+'T08:00:00-03:00','fim':am+'T09:00:00-03:00','diaInteiro':False,'descricao':'','local':'','cor':None},
    {'id':'e4|1','titulo':'M - Visita manutenção - Carla Teste','inicio':am+'T16:30:00-03:00','fim':am+'T17:00:00-03:00','diaInteiro':False,'descricao':'Apt 302','local':'','cor':None}]
def ag(route):
    rota=route.request.url.split('/agenda/')[1]
    if rota=='status': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'configurado':True,'ok':True,'nome':'CLIENTES CDP'}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'eventos':EV}))
def rest(route):
    r=route.request; u=r.url
    if 'agenda_confirmacoes' in u:
        if r.method=='GET': return route.fulfill(status=200, content_type='application/json', body=json.dumps(list(banco.values())))
        if r.method=='POST':
            b=json.loads(r.post_data); b.update(enviado_por='Bruna',enviado_em='2026-10-07T19:05:00Z',atualizado_por='Bruna',atualizado_em='2026-10-07T19:05:00Z'); banco[b['evento_id']]=b
            return route.fulfill(status=201, content_type='application/json', body=json.dumps([b]))
        if r.method=='DELETE':
            idv=up.unquote(u.split('evento_id=eq.')[1]); banco.pop(idv,None); return route.fulfill(status=204, body='')
        if r.method=='PATCH':
            idv=up.unquote(u.split('evento_id=eq.')[1]); banco[idv].update(json.loads(r.post_data)); banco[idv]['atualizado_em']='2026-10-07T19:40:00Z'
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([banco[idv]]))
    route.fulfill(status=200, content_type='application/json', body='[]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/agenda/**', ag); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false})); window._abertos=[]; window.open=(u)=>{window._abertos.push(u);return null;}")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1800)
    print('1 bloco:', pg.inner_text('#inicio-confirmar .inicio-bloco-tit').replace('\n',' | '))
    print('  itens:', pg.locator('.conf-item').count(), '| botões:', pg.locator('.conf-item .conf-wa').all_inner_texts())
    pg.locator('.conf-item .conf-wa').first.click(); pg.wait_for_timeout(400)
    print('2 abriu painel:', pg.locator('.conf-item').first.locator('.conf-painel').count(), '| abriu janela/link?', pg.evaluate('window._abertos.length'), '| banco ainda vazio?', len(banco)==0)
    print('  fones:', pg.locator('.conf-item').first.locator('.conf-fones').inner_text())
    print('  MENSAGEM:'); print(pg.locator('.conf-item').first.locator('.conf-msg').input_value())
    pg.evaluate("window._copiado=null; navigator.clipboard.writeText=async(t)=>{window._copiado=t}")
    pg.locator('.conf-item').first.locator('text=Copiar mensagem').click(); pg.wait_for_timeout(300)
    print('3 copiou igual ao texto?', pg.evaluate('window._copiado')==pg.locator('.conf-item').first.locator('.conf-msg').input_value(), '| banco ainda vazio?', len(banco)==0, '| botão:', pg.locator('.conf-item').first.locator('.conf-painel .conf-btn').first.inner_text())
    pg.screenshot(path='shotsT/conf-painel.png', full_page=True)
    pg.locator('.conf-item').first.locator('text=Já enviei').click(); pg.wait_for_timeout(400)
    print('4 já enviei:', pg.locator('.conf-item').first.inner_text().replace('\n',' / '), '| banco:', {k:v['status'] for k,v in banco.items()})
    pg.locator('.conf-item').first.locator('text=Confirmou').click(); pg.wait_for_timeout(400)
    print('5 confirmou:', pg.locator('.conf-item').first.inner_text().replace('\n',' / '), '|', pg.inner_text('#inicio-confirmar .inicio-bloco-tit').replace('\n',' | '))
    pg.locator('.conf-item >> nth=1').locator('.conf-wa').click(); pg.wait_for_timeout(300)
    print('6 2º item fones:', pg.locator('.conf-item >> nth=1').locator('.conf-fones').inner_text().replace('\n',' / '))
    pg.locator('.conf-item >> nth=1').locator('text=fechar').click(); pg.wait_for_timeout(300)
    print('  fechou painel:', pg.locator('.conf-item >> nth=1').locator('.conf-painel').count()==0, '| banco:', {k:v['status'] for k,v in banco.items()})
    pg.locator('.conf-item').first.locator('text=desfazer').click(); pg.wait_for_timeout(400)
    print('7 desfazer confirmado →', pg.locator('.conf-item').first.inner_text().replace('\n',' / '), '| banco:', {k:v['status'] for k,v in banco.items()})
    pg.locator('.conf-item').first.locator('text=desfazer envio').click(); pg.wait_for_timeout(400)
    print('8 desfazer envio →', pg.locator('.conf-item').first.inner_text().replace('\n',' / '), '| banco:', {k:v['status'] for k,v in banco.items()})
    pg.locator('.conf-item >> nth=1').locator('.conf-wa').click(); pg.wait_for_timeout(200); pg.locator('.conf-item >> nth=1').locator('text=Já enviei').click(); pg.wait_for_timeout(300)
    pg.locator('.conf-item >> nth=1').locator('text=Quer reagendar').click(); pg.wait_for_timeout(300)
    pg.locator('.conf-item >> nth=1').locator('text=desfazer').click(); pg.wait_for_timeout(300)
    print('9 reagendar → desfazer:', pg.locator('.conf-item >> nth=1').inner_text().replace('\n',' / '), '| banco:', {k:v['status'] for k,v in banco.items()})
    pg.screenshot(path='shotsT/conf-inicio2.png', full_page=True)
    pg.evaluate("AG_DATA=new Date(Date.now()+864e5)"); pg.click('.tab-btn[data-tab=agenda]'); pg.wait_for_timeout(1500)
    print('6 agenda amanhã: cards', pg.locator('.ag-card').count(), '| com controle:', pg.locator('.ag-card .conf-ctrl').count())
    pg.screenshot(path='shotsT/conf-agenda.png', full_page=True)
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
