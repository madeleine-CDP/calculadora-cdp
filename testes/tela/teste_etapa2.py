import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1] if len(sys.argv)>1 else 'shotsN'; errs=[]
UTC=dt.timezone.utc
def uteis_atras(n, hora=10):
    d=dt.datetime.now(UTC); k=0
    while k<n:
        d-=dt.timedelta(days=1)
        if d.weekday()<5: k+=1
    return d.replace(hour=hora).isoformat()
agora=lambda: dt.datetime.now(UTC).isoformat()
def orc(i,nome,tiny): return {"id":i,"numero":20+i,"etapa":"fechado","ref":"","client":nome,"bairro":"Boa Viagem","cidade":"Recife","uf":"PE","telefone":"(81) 98888-111%d"%i,"anterior_id":None,"pedido_tiny":tiny,
       "fechado_em":agora(),"motivo_perda":None,"date":"07/10/2026","criado_por":"Bruna","total_tabela":2000,"total_cartao":1900,"total_avista":1700,"items":[],"updated_at":agora(),"created_at":agora()}
rows=[orc(1,'Ana Cobrar','501'),orc(2,'Beto Recente','502'),orc(3,'Carla Atrasada','503')]
base=lambda: {"dados_ok_em":uteis_atras(9),"os_conferida_em":uteis_atras(9)}
fech={1:dict(base(),orcamento_id=1,os_enviada_em=uteis_atras(1,9),forma_pagamento='pix'),
      2:dict(base(),orcamento_id=2,os_enviada_em=agora(),forma_pagamento='pix'),
      3:dict(base(),orcamento_id=3,os_enviada_em=uteis_atras(7),followup_em=uteis_atras(3),followup_por='Mirelle',forma_pagamento='cartao')}
hoje_tarde=dt.datetime.now(UTC).replace(hour=21).isoformat()
rets=[
 dict(id=1,cliente='Dona Rosa',assunto='Retorno sobre cor',responsavel='Mirelle',prazo=uteis_atras(2),status='aberto'),
 dict(id=2,cliente='Seu João',assunto='Prazo de entrega',responsavel='Mirelle',prazo=hoje_tarde,status='aberto'),
 dict(id=3,cliente='Luiza',assunto='Amostra',responsavel='Mirelle',prazo=None,status='aguardando'),
 dict(id=4,cliente='Pedro',assunto='Medida',responsavel='Bruna',prazo=hoje_tarde,status='aberto'),
 dict(id=5,cliente='Marta',assunto='Garantia',responsavel='Fábrica',prazo=uteis_atras(1),status='aguardando'),
 dict(id=6,cliente='Lia',assunto='Ok',responsavel='Mirelle',prazo=uteis_atras(3),status='respondido',respondido_em=uteis_atras(1)),
 dict(id=7,cliente='Rui',assunto='Ok',responsavel='Bruna',prazo=uteis_atras(4),status='respondido',respondido_em=uteis_atras(2)),
]
osl=[dict(pedido_id=900+i,numero=str(500+i),cliente=n,situacao=0,situacao_desde=agora(),valor=1700) for i,n in [(1,'Ana Cobrar'),(2,'Beto Recente'),(3,'Carla Atrasada')]]
def J(route,b,st=200): route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
def rest(route):
    r=route.request; u=r.url; m=r.method
    if '/orcamentos' in u: return J(route, rows)
    if '/retornos' in u: return J(route, rets)
    if '/os_acompanhamento' in u: return J(route, osl)
    if '/fechamentos' in u:
        if m=='GET': return J(route, list(fech.values()))
        b=json.loads(r.post_data); f=fech[int(u.split('orcamento_id=eq.')[1])]
        for k,v in b.items():
            f[k]=v
            if k.endswith('_em'): f[k[:-3]+'_por']='Mirelle' if v else None
        return J(route,[f])
    J(route,[])
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest)
    pg.route('**/functions/v1/olist/**', lambda r: J(r,{'lidas':0,'detalhes':0,'configurado':True,'conectado':True}))
    pg.route('**/functions/v1/agenda/**', lambda r: J(r,{'configurado':False}))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'operacao@x.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2200)
    txt=lambda s: pg.inner_text(s) if pg.locator(s).count() else '(não achei)'
    print('1 bloco fechamentos:', txt('#inicio-fechamento').replace('\n',' | ')[:400])
    blocos=pg.locator('.inicio-bloco').all_inner_texts()
    ret=[x for x in blocos if x.startswith('💬 Retornos')]
    print('2 bloco retornos:', ret[0].replace('\n',' | ')[:500] if ret else 'NÃO APARECEU')
    pg.screenshot(path=S+'/e2-inicio.png', full_page=True)
    print('   largura:', pg.evaluate('document.documentElement.scrollWidth'))
    # toque no número de atrasados da Mirelle
    pg.locator('.rg-linha.rg-eu .rg-n').nth(0).click(); pg.wait_for_timeout(400)
    print('3 tocou atrasados (Mirelle) → tela:', pg.evaluate('document.body.dataset.tela'), '| filtro:', pg.evaluate('RET_FILTRO'), pg.evaluate('RET_PESSOA'), '| cartões:', pg.locator('#ret-lista .ret-card, #ret-lista [class*=ret-card]').count(), '| pessoas:', txt('#ret-pessoas').replace('\n',' '))
    pg.screenshot(path=S+'/e2-retornos-filtro.png', full_page=True)
    pg.locator('#ret-pessoas .ret-pessoa', has_text='Todos').click(); pg.wait_for_timeout(200)
    print('   Todos → cartões:', pg.locator('#ret-lista .ret-card, #ret-lista [class*=ret-card]').count())
    # Pedidos: fase pagar
    pg.evaluate("switchTab('ped')"); pg.wait_for_timeout(900)
    print('4 pedidos (pagar):', ' || '.join(t.replace('\n',' ')[:140] for t in pg.locator('.ped-card').all_inner_texts()[:3]))
    pg.screenshot(path=S+'/e2-pedidos.png', full_page=True)
    # pasta passo 4: cobrar e desfazer
    pg.evaluate("switchTab('inicio')"); pg.wait_for_timeout(500)
    pg.evaluate('reopenOrc(1)'); pg.wait_for_timeout(900)
    print('5 pasta Ana passo 4:', txt('.fc-passo.atual').replace('\n',' | ')[:300])
    pg.locator('.fc-passo.atual .conf-wa').click(); pg.wait_for_timeout(200)
    pg.locator('.fc-passo.atual button', has_text='Já cobrei').click(); pg.wait_for_timeout(400)
    print('6 já cobrei →', txt('.fc-passo.atual').replace('\n',' | ')[:260], '| followup_em gravado:', bool(fech[1].get('followup_em')))
    pg.screenshot(path=S+'/e2-pasta-cobrei.png', full_page=True)
    pg.locator('.fc-passo.atual .fc-feito button', has_text='desfazer').click(); pg.wait_for_timeout(400)
    print('7 desfazer → followup_em:', fech[1].get('followup_em'), '|', txt('.fc-passo.atual').replace('\n',' | ')[:120])
    b.close()
print('ERROS JS:', errs)
