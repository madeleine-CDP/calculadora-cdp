import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
hoje=dt.date.today(); iso=lambda d: d.isoformat()
agora=dt.datetime.now(dt.timezone.utc)
def os_(i,num,cli,sit,fab=None,desde=0,prev=None,ent=None): return {'pedido_id':i,'numero':num,'cliente':cli,'celular':'(81) 9'+str(i)*4+'-1111','valor':1500+i,'situacao':sit,
  'situacao_desde':(agora-dt.timedelta(days=desde)).isoformat(),'data_prevista':prev,'data_entrega':ent,'numero_fabrica':fab,'lido_em':agora.isoformat(),'em_maos_em':None,'em_maos_por':None,'avaliacao_em':None,'avaliacao_por':None}
OS=[os_(1,'500','Ana Aberta Teste',0), os_(2,'501','Beto Aprovado Teste',3,desde=2), os_(3,'502','Carla Producao Teste',4,'D2310',5,iso(hoje-dt.timedelta(days=1))),
    os_(4,'503','Davi Producao Teste',4,'R2311',1,iso(hoje+dt.timedelta(days=5))), os_(5,'504','Eva Pronta Teste',7,'D2305',2), os_(6,'505','Fabio Agendado Teste',5,'R2300',3),
    os_(7,'506','Gil Entregue Teste',6,'D2290',1,ent=iso(hoje-dt.timedelta(days=2)))]
CONF=[]; nid=[0]
def rest(route):
    r=route.request; u=r.url; m=r.method
    if '/os_acompanhamento' in u:
        if m=='PATCH':
            i=int(u.split('pedido_id=eq.')[1]); o=[x for x in OS if x['pedido_id']==i][0]; b=json.loads(r.post_data)
            for k,v in b.items(): o[k]=v; o[k[:-3]+'_por']='Mirelle' if v else None
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([o]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(OS))
    if '/conferencias_fabrica' in u:
        if m=='POST': nid[0]+=1; c={'id':nid[0],'fabrica':json.loads(r.post_data)['fabrica'],'conferido_em':dt.datetime.now(dt.timezone.utc).isoformat(),'conferido_por':'Mirelle'}; CONF.insert(0,c); return route.fulfill(status=201, content_type='application/json', body=json.dumps([c]))
        if m=='DELETE': i=int(u.split('id=eq.')[1]); CONF[:]=[c for c in CONF if c['id']!=i]; return route.fulfill(status=204, body='')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(CONF))
    route.fulfill(status=200, content_type='application/json', body='[]')
def ag(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    b={'configurado':True,'ok':True} if rota=='status' else {'eventos':[{'id':'x','titulo':'C - Instalação - Fabio Agendado (Pina)','inicio':iso(hoje+dt.timedelta(days=3))+'T09:00:00-03:00','fim':iso(hoje+dt.timedelta(days=3))+'T11:00:00-03:00','diaInteiro':False,'descricao':''}]}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
olist_os=[0]
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='os': olist_os[0]+=1
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'lidas':7,'detalhes':0} if rota=='os' else {'lidos':0,'faltam':0}))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', ag)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2000)
    pg.evaluate("navigator.clipboard.writeText=async(t)=>{window._c=t}")
    print('INÍCIO pedidos:', pg.inner_text('#inicio-pedidos').replace('\n',' / '))
    print('  menu:', pg.locator('.tab-btn .lbl-curto').all_inner_texts())
    pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1500)
    print('1 tela:', pg.evaluate('document.body.dataset.tela'), '|', pg.inner_text('#ped-sub'), '| leu Olist:', olist_os[0])
    print('  filtros:', pg.locator('#ped-filtros .hist-chip').all_inner_texts())
    print('  próximo nº:', pg.inner_text('.ped-num').replace('\n',' '))
    print('  conferência:', pg.inner_text('.ped-conf').replace('\n',' / ')[:220])
    print('  produção:', [c.replace('\n',' / ') for c in pg.locator('.ped-grupo:nth-of-type(3) .ped-card').all_inner_texts()])
    pg.locator('.ped-conf-f >> nth=0 >> text=Conferi agora').click(); pg.wait_for_timeout(300)
    print('2 conferiu Decore:', pg.locator('.ped-conf-f').first.inner_text().replace('\n',' / '))
    pg.locator('.ped-conf-f >> nth=0 >> text=desfazer').click(); pg.wait_for_timeout(300); print('  desfez:', len(CONF))
    pg.locator('.ped-conf-f >> nth=0 >> text=Conferi agora').click(); pg.wait_for_timeout(300)
    pg.locator('.ped-conf-f >> nth=1 >> text=Conferi agora').click(); pg.wait_for_timeout(300)
    pronto=pg.locator('.ped-card', has_text='Eva Pronta')
    print('3 pronto:', pronto.inner_text().replace('\n',' / ')[:200])
    pronto.locator('button', has_text='Itens conferidos em mãos').click(); pg.wait_for_timeout(300)
    print('  em mãos:', OS[4]['em_maos_por'])
    pg.locator('.ped-card', has_text='Eva Pronta').locator('text=Mensagem: propor data').click(); pg.wait_for_timeout(200)
    print('  msg agendar:', pg.locator('.ped-card', has_text='Eva Pronta').locator('.conf-msg').input_value()[:90].replace('\n',' '))
    print('4 agendado:', pg.locator('.ped-card', has_text='Fabio Agendado').inner_text().replace('\n',' / '))
    ent=pg.locator('.ped-card', has_text='Gil Entregue')
    ent.locator('text=finalização e avaliação').click(); pg.wait_for_timeout(200)
    print('5 msg avaliação:', pg.locator('.ped-card', has_text='Gil Entregue').locator('.conf-msg').input_value()[-120:].replace('\n',' '))
    pg.locator('.ped-card', has_text='Gil Entregue').locator('text=Já enviei').click(); pg.wait_for_timeout(300)
    print('  avaliação:', OS[6]['avaliacao_por'], '|', pg.locator('.ped-card', has_text='Gil Entregue').inner_text().replace('\n',' / ')[-60:])
    pg.locator('.ped-card', has_text='Gil Entregue').locator('text=desfazer').click(); pg.wait_for_timeout(300); print('  desfez:', OS[6]['avaliacao_em'])
    pg.screenshot(path=f'{S}/shotsT/ped.png', full_page=True)
    pg.locator('#ped-filtros >> text=Fazer pedido').click(); pg.wait_for_timeout(200)
    print('6 filtro fábrica:', pg.inner_text('#ped-lista').replace('\n',' / ')[:200])
    pg.click('.tab-btn[data-tab=inicio]'); pg.wait_for_timeout(1500)
    print('7 início depois:', pg.inner_text('#inicio-pedidos').replace('\n',' / '))
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
