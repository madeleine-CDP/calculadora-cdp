# Detalhe do pedido de venda (aba Pedidos → "ver pedido"), com o Olist SIMULADO. Celular (360) e computador (1280).
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc)
OS=[{'pedido_id':77,'numero':'1043','cliente':'Maria Exemplo Teste','celular':'(81) 90000-0000','valor':3870.3,'situacao':4,'situacao_desde':agora.isoformat(),
     'data_prevista':'2026-11-24','data_entrega':None,'numero_fabrica':'D0215','lido_em':agora.isoformat()}]
PED={'id':77,'numero':'1043','situacao':'Preparando envio','situacaoCod':4,'data':'2026-11-10','dataPrevista':'2026-11-24','dataEntrega':None,'vendedor':'Mirelle',
  'numeroFabrica':'D0215','cliente':{'nome':'Maria Exemplo Teste','cpfCnpj':'000.000.000-00','celular':'81900000000','email':'maria@exemplo.com','endereco':'Rua Exemplo, 100 - apto 201','bairro':'Boa Viagem','cidade':'Recife/PE','cep':'51000-000'},
  'itens':[{'descricao':'DECORE – CORTINA ROLÔ BLACKOUT BK NÁPOLES','sku':'DECORE158A','tipo':'P','unidade':'PÇ','quantidade':2,'valorUnitario':812,'total':1624,'detalhe':'TAMANHO CORTINA: 1,72L X 1,60A. COR: CREME.\nLADO COMANDO: ESQUERDO.'},
           {'descricao':'CDP – CORTINA TRADICIONAL VOIL LINHÃO','sku':'CDP41TA','tipo':'P','unidade':'M','quantidade':3.2,'valorUnitario':550,'total':1760,'detalhe':''},
           {'descricao':'CDP – INSTALAÇÃO DE CORTINAS <b>x</b>','sku':'CDP2A','tipo':'S','unidade':'SV','quantidade':4,'valorUnitario':0,'total':0,'detalhe':'Inclusa.'}],
  'subtotal':3384,'desconto':169.2,'frete':0,'outras':0,'total':3214.8,
  'pagamento':{'forma':'PIX','meio':'','condicao':'50/50','parcelas':[{'data':'2026-11-11','valor':1607.4,'forma':'PIX','obs':'entrada'},{'data':'2026-11-23','valor':1607.4,'forma':'PIX','obs':''}]},
  'observacoes':'Instalação pela manhã.','observacoesInternas':''}
falhar=[True]
def rest(route):
    u=route.request.url
    if '/os_acompanhamento' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(OS))
    route.fulfill(status=200, content_type='application/json', body='[]')
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='pedido':
        if falhar[0]: falhar[0]=False; return route.fulfill(status=502, content_type='application/json', body=json.dumps({'erro':'olist_indisponivel'}))
        assert json.loads(route.request.post_data)['id']==77
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'pedido':PED}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'lidas':1,'detalhes':0}))
def ag(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'eventos':[]}))
with sync_playwright() as p:
    b=p.chromium.launch()
    for larg in (360,1280):
        pg=b.new_page(viewport={'width':larg,'height':800},service_workers='block'); falhar[0]=True
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', ag)
        pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1500)
        pg.evaluate("navigator.clipboard.writeText=async(t)=>{window._c=t}")
        pg.click('.tab-btn[data-tab=ped]'); pg.wait_for_timeout(1200)
        pg.click('.ped-ver'); pg.wait_for_timeout(800)
        print(larg,'1 erro Olist:', pg.inner_text('#pedv-conteudo').replace('\n',' / ')[:120])
        pg.click('text=Tentar de novo'); pg.wait_for_timeout(800)
        print('  tela:', pg.evaluate('document.body.dataset.tela'), '| aba ativa:', pg.evaluate("document.querySelector('.tab-btn.active').dataset.tab"))
        t=pg.inner_text('#pedv-conteudo')
        for k in ['Pedido nº 1043','Em produção','D0215','Maria Exemplo Teste','maria@exemplo.com','Boa Viagem','24/11/2026','10/11/2026','Mirelle','3 itens','NÁPOLES','LADO COMANDO','R$ 1.624,00','3,2','Desconto (5%)','R$ 3.214,80','R$ 1.607,40','11/11/2026','Instalação pela manhã','Nenhuma.']:
            if k not in t: print('  FALTA:', k)
        print('  html escapado:', '<b>x</b>' in t, '| wa:', pg.get_attribute('.pedv-dl a','href'))
        print('  ícones:', pg.locator('.pedv-ic svg').count(), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
        pg.click('text=Copiar resumo'); pg.wait_for_timeout(200)
        print('  resumo:', pg.evaluate('window._c')[:160].replace('\n',' | '))
        pg.screenshot(path=f'{S}/shotsT/pedv_{larg}.png', full_page=True)
        pg.click('.pedv-voltar'); pg.wait_for_timeout(500); print('  voltar:', pg.evaluate('document.body.dataset.tela'))
        pg.close()
    b.close()
print('ERROS JS:', errs)
