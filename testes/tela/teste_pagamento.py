# Pagamento da OS: entrada libera a produção, saldo libera a instalação (Bruna = admin marca "Madeleine conferiu"; Mirelle não).
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today()
def os_(i,num,cli,sit,**k):
    d={'pedido_id':i,'numero':num,'cliente':cli,'celular':'','valor':3000,'situacao':sit,'situacao_desde':agora.isoformat(),'data_prevista':None,'data_entrega':None,
       'numero_fabrica':'D0300' if sit!=3 else None,'lido_em':agora.isoformat(),'entrada_validado_em':None,'entrada_validado_por':None,'saldo_modo':None,
       'saldo_comprovante_em':None,'saldo_comprovante_por':None,'saldo_validado_em':None,'saldo_validado_por':None}
    d.update(k); return d
def base(): return [os_(1,'601','Ana Aprovada Teste',3), os_(2,'602','Beto Pronto Teste',7,entrada_validado_em=agora.isoformat(),entrada_validado_por='Madeleine'),
    os_(3,'603','Caio Cartao Teste',5,entrada_validado_em=agora.isoformat(),entrada_validado_por='Madeleine',saldo_modo='nao')]
OS=base(); QUEM=['Bruna','admin']
def rest(route):
    r=route.request; u=r.url
    if '/os_acompanhamento' in u:
        if r.method=='PATCH':
            i=int(u.split('pedido_id=eq.')[1]); o=[x for x in OS if x['pedido_id']==i][0]; b=json.loads(r.post_data)
            if any(k in b for k in ('entrada_validado_em','saldo_validado_em')) and QUEM[1] not in ('dona','admin'):
                return route.fulfill(status=403, content_type='application/json', body='{"message":"Só a Madeleine"}')
            for k,v in b.items():
                o[k]=v
                if k.endswith('_em'): o[k[:-3]+'_por']=None if v is None else (('Madeleine' if QUEM[1]=='dona' else 'Madeleine (marcado por '+QUEM[0]+')') if 'validado' in k else QUEM[0])
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([o]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(OS))
    route.fulfill(status=200, content_type='application/json', body='[]')
amanha=hoje+dt.timedelta(days=1)
while amanha.weekday()==6: amanha+=dt.timedelta(days=1)
def ag(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    b={'configurado':True,'ok':True} if rota=='status' else {'eventos':[{'id':'e1','titulo':'C - Instalação - Beto Pronto (Pina)','inicio':amanha.isoformat()+'T09:00:00-03:00','fim':amanha.isoformat()+'T11:00:00-03:00','diaInteiro':False,'descricao':''}]}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='pedido': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'pedido':{'id':2,'numero':'602','cliente':{'nome':'Beto Pronto Teste'},'itens':[],'subtotal':3000,'desconto':0,'total':3000,
        'pagamento':{'forma':'PIX','parcelas':[{'data':'2026-11-10','valor':1500,'obs':'ok em 10/11'},{'data':'2026-11-25','valor':1500,'obs':''}]},'observacoes':'','observacoesInternas':''}}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'lidas':3,'detalhes':0}))
def abrir(b, nome, papel):
    QUEM[:]=[nome,papel]
    pg=b.new_page(viewport={'width':360,'height':800},service_workers='block'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', ag)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))"%(nome,papel))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2500); return pg
card=lambda pg,t: pg.locator('.ped-card', has_text=t)
with sync_playwright() as p:
    b=p.chromium.launch()
    # ── Mirelle: vê as travas, marca comprovante, não confere ──
    pg=abrir(b,'Mirelle','atendimento')
    print('M início confirmar:', pg.inner_text('#inicio-confirmar').replace('\n',' / ')[:260])
    print('M início pedidos:', pg.inner_text('#inicio-pedidos').replace('\n',' / ')[:260])
    pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1200)
    print('M fábrica:', card(pg,'Ana Aprovada').inner_text().replace('\n',' / ')[:200])
    print('M pronto:', card(pg,'Beto Pronto').inner_text().replace('\n',' / ')[:220])
    print('  botões conferir p/ Mirelle:', pg.locator('text=Madeleine conferiu').count())
    card(pg,'Beto Pronto').locator('text=Cliente mandou o comprovante').click(); pg.wait_for_timeout(300)
    print('  comprovante por:', OS[1]['saldo_comprovante_por'], '|', card(pg,'Beto Pronto').inner_text().replace('\n',' / ')[:160])
    print('M agendado cartão:', card(pg,'Caio Cartao').inner_text().replace('\n',' / ')[:160])
    pg.close()
    # ── Bruna: confere entrada e saldo em nome da Madeleine ──
    pg=abrir(b,'Bruna','admin')
    print('B início pedidos:', pg.inner_text('#inicio-pedidos').replace('\n',' / ')[:300])
    pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1200)
    card(pg,'Ana Aprovada').locator('text=Madeleine conferiu').click(); pg.wait_for_timeout(300)
    print('B entrada Ana:', OS[0]['entrada_validado_por'], '| trava some:', card(pg,'Ana Aprovada').locator('.pg-trava').count())
    card(pg,'Beto Pronto').locator('text=Madeleine conferiu').click(); pg.wait_for_timeout(300)
    print('B saldo Beto:', OS[1]['saldo_validado_por'], '|', card(pg,'Beto Pronto').locator('.pg-livre').inner_text())
    card(pg,'Beto Pronto').locator('.pg-linha.ok >> text=desfazer').last.click(); pg.wait_for_timeout(300)
    print('  desfez:', OS[1]['saldo_validado_em'], '| trava volta:', card(pg,'Beto Pronto').locator('.pg-trava').count())
    card(pg,'Beto Pronto').locator('text=Madeleine conferiu').click(); pg.wait_for_timeout(300)
    card(pg,'Caio Cartao').locator('text=tem saldo a pagar?').click(); pg.wait_for_timeout(300)
    print('B Caio tem saldo:', OS[2]['saldo_modo'], '| trava:', card(pg,'Caio Cartao').locator('.pg-trava').count())
    pg.screenshot(path=f'{S}/shotsT/pagamento.png', full_page=True)
    card(pg,'Beto Pronto').locator('.ped-ver').click(); pg.wait_for_timeout(800)
    print('B pedido Beto:', pg.inner_text('.pedv-parcelas').replace('\n',' / '), '| parcela ok verde:', pg.locator('.pedv-parc.ok').count(), '| bloco:', pg.locator('#pedv-conteudo .pg-bloco').count())
    pg.click('.tab-btn[data-tab=inicio]'); pg.wait_for_timeout(2000)
    print('B início confirmar depois:', pg.inner_text('#inicio-confirmar').replace('\n',' / ')[:200])
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    pg.close(); b.close()
print('ERROS JS:', errs)
