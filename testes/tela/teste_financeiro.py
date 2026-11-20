# Painel Financeiro e vendas, com banco e Olist SIMULADOS. Madeleine (abre direto), Bruna (pelas abas), Mirelle (não vê).
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today(); iso=lambda d: d.isoformat()
ini_mes=hoje.replace(day=1); ant=(ini_mes-dt.timedelta(days=1)).replace(day=1)
def mes_atras(n):
    d=ini_mes
    for _ in range(n): d=(d-dt.timedelta(days=1)).replace(day=1)
    return d
VENDAS=[]; pid=[1000]
def venda(dia, valor, sit=4):
    pid[0]+=1; VENDAS.append({'id':pid[0],'numero':str(pid[0]),'data':iso(dia),'valor':valor,'situacao':sit,'cliente':'X'})
for k,v in ((5,38000),(4,41000),(3,36000),(2,52000)):
    m=mes_atras(k); venda(m.replace(day=5), v*0.6); venda(m.replace(day=20), v*0.4)
venda(ant.replace(day=1), 20000); venda(ant.replace(day=min(hoje.day,28)), 9000); venda(ant.replace(day=28), 17000)
venda(ini_mes, 30000); venda(hoje, 18920); venda(hoje, 5000, sit=2)   # cancelado não conta
ORCS=[{'id':1,'client':'Carla Teste','etapa':'fechado','numero':60,'pedido_tiny':'1519','total_avista':4360,'created_at':agora.isoformat(),'fechado_em':agora.isoformat(),'updated_at':agora.isoformat()},
      {'id':2,'client':'Novo Teste','etapa':'orcamento','numero':61,'total_avista':1000,'created_at':agora.isoformat(),'updated_at':agora.isoformat()},
      {'id':3,'client':'Perdido Teste','etapa':'perdido','numero':62,'motivo_perda':'preço','total_avista':900,'created_at':agora.isoformat(),'updated_at':agora.isoformat()}]
FECH=[{'orcamento_id':1,'forma_pagamento':'pix','os_valor':4360,'comprovante_em':(agora-dt.timedelta(hours=1)).isoformat(),'comprovante_por':'Mirelle','validado_em':None}]
OS=[{'pedido_id':77,'numero':'1043','cliente':'Maria Teste','valor':3870.3,'situacao':7,'situacao_desde':agora.isoformat(),'data_prevista':iso(hoje+dt.timedelta(days=3)),'lido_em':agora.isoformat(),
     'entrada_validado_em':agora.isoformat(),'saldo_comprovante_em':agora.isoformat(),'saldo_comprovante_por':'Mirelle','saldo_validado_em':None,'numero_fabrica':'D2310'},
    {'pedido_id':78,'numero':'1050','cliente':'Beto Teste','valor':2840,'situacao':4,'situacao_desde':agora.isoformat(),'data_prevista':iso(hoje+dt.timedelta(days=20)),'lido_em':agora.isoformat(),'entrada_validado_em':agora.isoformat(),'numero_fabrica':'R2301'}]
CFG=[{'chave':'metas_vendas','valor':{'minima':65000,'ideal':85000}}]
QUEM=['Madeleine','dona']
def rest(route):
    r=route.request; u=r.url
    J=lambda b,st=200: route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
    if '/configuracoes' in u:
        if r.method=='POST':
            if QUEM[1] not in ('dona','admin'): return J({'message':'rls'},403)
            b=json.loads(r.post_data); CFG[0]['valor']=b['valor']; return J([CFG[0]],201)
        return J(CFG)
    for k,v in (('/orcamentos',ORCS),('/fechamentos',FECH),('/os_acompanhamento',OS)):
        if k in u: return J(v)
    J([])
chamou=[]
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]; chamou.append(rota)
    if rota=='vendas': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'desde':iso(mes_atras(5)),'pedidos':VENDAS}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'lidas':0,'detalhes':0}))
def ag(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[]}))
def abrir(b, nome, papel, w):
    QUEM[:]=[nome,papel]
    pg=b.new_page(viewport={'width':w,'height':900},service_workers='block'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', ag)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))"%(nome,papel))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2500); return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=abrir(b,'Madeleine','dona',1280)
    print('1 Madeleine abre em:', pg.evaluate('document.body.dataset.tela'))
    t=pg.inner_text('#fin-conteudo')
    print('  kpis:', pg.inner_text('.fin-kpis').replace('\n',' / '))
    print('  conferir:', pg.inner_text('.fin-q.alerta').replace('\n',' / ')[:260])
    print('  meta:', pg.locator('.fin-q', has_text='Meta do mês').inner_text().replace('\n',' / ')[:260])
    print('  barras:', pg.locator('.fin-col span').all_inner_texts())
    print('  funil:', pg.locator('.fin-q', has_text='Orçamentos do mês').inner_text().replace('\n',' / ')[:200])
    print('  fases:', pg.locator('.fin-q', has_text='Dinheiro em cada fase').inner_text().replace('\n',' / ')[:300])
    print('  saldos 7 dias:', pg.locator('.fin-q', has_text='Saldos a receber').inner_text().replace('\n',' / ')[:200])
    pg.click('text=editar metas'); pg.fill('#fin-meta-min','70000'); pg.fill('#fin-meta-ideal','90000'); pg.click('.fin-meta-form .btn'); pg.wait_for_timeout(400)
    print('2 metas salvas:', CFG[0]['valor'], '|', pg.locator('.fin-regua').inner_text().replace('\n',' '))
    pg.screenshot(path=f'{S}/shotsT/financeiro_1280.png', full_page=True)
    pg.click('.painel-abas >> text=Meu dia'); pg.wait_for_timeout(1200); print('3 volta ao Meu dia:', pg.evaluate('document.body.dataset.tela'), '| abas:', pg.locator('.painel-abas button').all_inner_texts())
    pg.close()
    pg=abrir(b,'Bruna','admin',360)
    print('4 Bruna abre em:', pg.evaluate('document.body.dataset.tela'), '| abas:', pg.locator('.painel-abas button').all_inner_texts())
    pg.click('.painel-abas >> text=Financeiro'); pg.wait_for_timeout(1500)
    print('  financeiro no celular:', pg.evaluate('document.body.dataset.tela'), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    pg.screenshot(path=f'{S}/shotsT/financeiro_360.png', full_page=True)
    pg.close()
    pg=abrir(b,'Mirelle','atendimento',360)
    print('5 Mirelle: tela', pg.evaluate('document.body.dataset.tela'), '| abas:', pg.locator('.painel-abas').count(), '| abrirFinanceiro faz nada:', pg.evaluate("abrirFinanceiro(), document.body.dataset.tela"))
    b.close()
print('ERROS JS:', errs)
