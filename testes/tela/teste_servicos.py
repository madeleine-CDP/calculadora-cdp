# Acompanhamento das OS de serviço (aba Pedidos), com banco SIMULADO.
import json, sys, datetime as dt
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today()
def os_(i,num,cli,sit,**k):
    d={'pedido_id':i,'numero':num,'cliente':cli,'celular':'','valor':500,'situacao':sit,'situacao_desde':agora.isoformat(),'data_venda':hoje.isoformat(),'lido_em':agora.isoformat(),
       'numero_fabrica':None,'servico_tipos':None,'tem_produto':None,'marcado_servico':False,'itens_resumo':None,'entrada_validado_em':agora.isoformat()}
    d.update(k); return d
OS=[os_(1,'1700','Lavagem Teste',3,servico_tipos='lavagem',tem_produto=False,itens_resumo='CDP – LAVAGEM DE CORTINA'),
    os_(2,'1701','Manutencao Teste',3,servico_tipos='manutenção',tem_produto=False,itens_resumo='CDP – MANUTENÇÃO DE CORTINAS'),
    os_(3,'1702','Produto Tag Teste',4,servico_tipos='instalação',tem_produto=True,marcado_servico=True,numero_fabrica='D2400',itens_resumo='DECORE – CORTINA ROLÔ · CDP – INSTALAÇÃO'),
    os_(4,'1703','Produto Normal Teste',4,servico_tipos='instalação',tem_produto=True,numero_fabrica='D2401')]
SVC={}
def rest(route):
    r=route.request; u=r.url
    J=lambda b,st=200: route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
    if '/servicos_os' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); i=b['pedido_id']; x=SVC.setdefault(i,{'pedido_id':i})
            for k,v in b.items():
                x[k]=v
                if k.endswith('_em'): x[k[:-3]+'_por']='Mirelle' if v else None
            return J([x],201)
        return J(list(SVC.values()))
    if '/os_acompanhamento' in u: return J(OS)
    J([])
def fn(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[],'lidas':0,'detalhes':0,'lidos':0,'faltam':0}))
card=lambda pg,t: pg.locator('#ped-servicos .svc-card', has_text=t)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', fn)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2200)
    print('1 Início:', [l for l in pg.inner_text('#inicio-pedidos').split('\n') if 'serviço' in l])
    pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1300)
    print('2 serviços na lista:', pg.locator('#ped-servicos .svc-card strong').all_inner_texts())
    print('  produto normal fora de Serviços e com link:', card(pg,'Produto Normal').count()==0, pg.locator('.ped-card', has_text='Produto Normal').locator('text=acompanhar como serviço').count())
    print('  só-serviço fora de "Fazer pedido na fábrica":', pg.locator('.ped-grupo:not(#ped-servicos) .ped-card', has_text='Lavagem Teste').count()==0)
    print('  produto com tag nos dois lugares:', pg.locator('.ped-card', has_text='Produto Tag').count())
    # lavagem: retirar (sugerido), sem peça, etapas
    c=card(pg,'Lavagem'); print('3 lavagem pergunta:', c.locator('.svc-perg').first.inner_text().replace('\n',' / '))
    c.locator('text=Retirar e fazer na loja').click(); pg.wait_for_timeout(300)
    card(pg,'Lavagem').locator('.svc-perg >> text=Não').click(); pg.wait_for_timeout(300)
    print('  etapas:', card(pg,'Lavagem').locator('.svc-etapas').inner_text().replace('\n',' / '))
    for _ in range(3): card(pg,'Lavagem').locator('.svc-et.prox .conf-btn').click(); pg.wait_for_timeout(250)
    print('  depois de 3 etapas:', card(pg,'Lavagem').locator('.svc-sit').inner_text(), '| feito por:', SVC[1].get('feito_por'))
    card(pg,'Lavagem').locator('.svc-et.prox .conf-btn').click(); pg.wait_for_timeout(300)
    print('  concluída some da lista:', card(pg,'Lavagem').count()==0, SVC[1].get('concluido_em') is not None)
    # manutenção: no local, precisa peça
    c=card(pg,'Manutencao'); c.locator('text=No local').click(); pg.wait_for_timeout(300)
    card(pg,'Manutencao').locator('.svc-perg >> text=Sim').click(); pg.wait_for_timeout(300)
    pg.fill('#svc-desc-2','Corda do mecanismo'); pg.select_option('#svc-fab-2','Decore'); pg.fill('#svc-ped-2','D2405'); card(pg,'Manutencao').locator('.svc-peca .conf-btn.ok').click(); pg.wait_for_timeout(300)
    card(pg,'Manutencao').locator('.svc-et.prox .conf-btn').click(); pg.wait_for_timeout(300)
    print('4 manutenção:', card(pg,'Manutencao').locator('.svc-sit').inner_text(), '|', SVC[2].get('peca_desc'), SVC[2].get('peca_fabrica'), SVC[2].get('peca_pedido'))
    card(pg,'Manutencao').locator('.svc-et.ok >> text=desfazer').click(); pg.wait_for_timeout(300)
    print('  desfez peça pedida:', SVC[2].get('peca_pedida_em'), '|', card(pg,'Manutencao').locator('.svc-sit').inner_text())
    pg.screenshot(path=f'{S}/shotsT/servicos_360.png', full_page=True)
    pg.locator('.ped-card', has_text='Produto Normal').locator('text=acompanhar como serviço').click(); pg.wait_for_timeout(300)
    print('5 marcado à mão:', card(pg,'Produto Normal').count(), SVC[4].get('eh_servico'))
    card(pg,'Produto Normal').locator('text=não é OS de serviço').click(); pg.wait_for_timeout(300)
    print('  desmarcado:', card(pg,'Produto Normal').count(), SVC[4].get('eh_servico'))
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
