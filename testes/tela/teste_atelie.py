# Ateliê (cortina em tecido) na aba Pedidos, com banco e Olist SIMULADOS.
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today()
def os_(i,num,cli,sit,**k):
    d={'pedido_id':i,'numero':num,'cliente':cli,'celular':'','valor':1500,'situacao':sit,'situacao_desde':agora.isoformat(),'data_venda':hoje.isoformat(),'lido_em':agora.isoformat(),
       'numero_fabrica':None,'servico_tipos':None,'tem_produto':True,'marcado_servico':False,'marcadores':None,'itens_resumo':None,'entrada_validado_em':agora.isoformat()}
    d.update(k); return d
OS=[os_(1,'1800','Atelie Um Teste',3,marcadores='ATELIE',itens_resumo='CORTINA TRADICIONAL EM TECIDO LINHO'),
    os_(2,'1801','Atelie Dois Teste',4,marcadores='ATELIE, SERVIÇO',itens_resumo='CORTINA TRADICIONAL EM TECIDO VOIL'),
    os_(3,'1802','Tecido Sem Tag',3,itens_resumo='CORTINA TRADICIONAL EM TECIDO'),
    os_(4,'1803','Atelie Entregue',6,marcadores='ATELIE',data_entrega=hoje.isoformat()),
    os_(5,'1804','Rolo Normal',3,numero_fabrica='D2500',itens_resumo='DECORE – CORTINA ROLÔ')]
ATL={}
def rest(route):
    r=route.request; u=r.url
    J=lambda b,st=200: route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
    if '/atelie_os' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); i=b['pedido_id']; x=ATL.setdefault(i,{'pedido_id':i})
            for k,v in b.items():
                x[k]=v
                if k.endswith('_em'): x[k[:-3]+'_por']='Mirelle' if v else None
            return J([x],201)
        return J(list(ATL.values()))
    if '/os_acompanhamento' in u: return J(OS)
    J([])
def fn(route):
    u=route.request.url
    if u.endswith('/pedido'):
        i=json.loads(route.request.post_data)['id']
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'pedido':{'id':i,'itens':[{'descricao':'CORTINA TRADICIONAL LINHO','tipo':'P','quantidade':1,'detalhe':'TAMANHO CORTINA: 3,00L X 2,60A. PREGAS AMERICANAS.'},{'descricao':'INSTALAÇÃO','tipo':'S','quantidade':1,'detalhe':''}]}}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[],'lidas':0,'detalhes':0}))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', fn)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2000)
    pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1300)
    print('1 Tudo: linhas do ateliê:', pg.locator('#ped-atelie .svc-linha strong, #ped-atelie .svc-linha b').all_inner_texts())
    print('  chip:', pg.locator('#ped-filtros .hist-chip', has_text='Ateliê').inner_text().replace('\n',' '))
    print('  sem tag tem o link:', pg.locator('.ped-card', has_text='Tecido Sem Tag').locator('text=acompanhar no ateliê').count())
    pg.locator('#ped-filtros .hist-chip', has_text='Ateliê').click(); pg.wait_for_timeout(300)
    c=lambda t: pg.locator('#ped-atelie .atl-card', has_text=t)
    print('2 cartões:', pg.locator('#ped-atelie .atl-card strong').all_inner_texts())
    c('Atelie Um').locator('text=Tecido comprado / separado').click(); pg.wait_for_timeout(300)
    print('3 tecido:', ATL[1].get('tecido_em') is not None, '| próxima:', c('Atelie Um').locator('.svc-et.prox').inner_text())
    c('Atelie Dois').locator('text=Tecido comprado / separado').click(); pg.wait_for_timeout(300)
    c('Atelie Dois').locator('text=Enviado ao ateliê').click(); pg.wait_for_timeout(300)
    ontem=(hoje-dt.timedelta(days=1)).isoformat()
    c('Atelie Dois').locator('input[type=date]').fill(ontem); c('Atelie Dois').locator('input[id^=atl-obs]').fill('ateliê da Vidal')
    c('Atelie Dois').locator('text=Salvar').click(); pg.wait_for_timeout(300)
    print('4 previsão/obs:', ATL[2].get('previsao'), ATL[2].get('obs'), '| situação:', c('Atelie Dois').locator('.svc-sit').inner_text())
    pg.locator('text=Resumo para a Madeleine').click(); pg.wait_for_timeout(1200)
    tx=pg.locator('#atl-resumo-tx').input_value()
    print('5 resumo:\n'+tx)
    print('  tem medidas do Olist:', '3,00L X 2,60A' in tx, '| sem instalação:', 'INSTALAÇÃO' not in tx, '| atrasado:', 'ATRASADO' in tx)
    # desfazer
    c('Atelie Um').locator('.svc-et.ok >> text=desfazer').click(); pg.wait_for_timeout(300)
    print('6 desfazer:', ATL[1].get('tecido_em'), ATL[1].get('tecido_por'))
    pg.screenshot(path=S+'/atelie.png', full_page=True)
    print('ERROS JS:', errs)
    b.close()
