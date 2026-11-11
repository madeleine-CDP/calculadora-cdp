import json, sys, urllib.parse as up, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1] if len(sys.argv)>1 else '.'
errs=[]; gar=[]; pv={}; nid=[100]
hoje=dt.date.today()
def mes(n): 
    d=hoje.replace(day=1); m=d.month-n; y=d.year
    while m<=0: m+=12; y-=1
    return dt.date(y,m,min(hoje.day,28)).isoformat()
pv={1:{'pedido_id':1,'numero':'501','cliente':'Ana Teste Silva','celular':'(81) 98888-1111','data_entrega':mes(7),'contato_em':None,'contato_por':None},
    2:{'pedido_id':2,'numero':'502','cliente':'Beto Teste','celular':'','data_entrega':mes(6),'contato_em':None,'contato_por':None}}
def rest(route):
    r=route.request; u=r.url
    if '/garantias' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); nid[0]+=1; b.update({'id':nid[0],'status':b.get('status','aberto'),'criado_por':'Bruna','criado_em':dt.datetime.utcnow().isoformat()+'Z','primeiro_retorno_em':None,'acionado':None,'solucao':None,'resolvido_em':None}); gar.append(b)
            return route.fulfill(status=201, content_type='application/json', body=json.dumps([b]))
        if r.method=='PATCH':
            i=int(u.split('id=eq.')[1]); g=[x for x in gar if x['id']==i][0]; g.update(json.loads(r.post_data))
            if g['status'] in ('resolvido','nao_defeito') and not g.get('resolvido_em'): g['resolvido_em']=dt.datetime.utcnow().isoformat()+'Z'
            if g['status'] in ('aberto','aguardando'): g['resolvido_em']=None
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([g]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(gar))
    if '/posvenda' in u:
        if r.method=='PATCH':
            i=int(u.split('pedido_id=eq.')[1]); b=json.loads(r.post_data); pv[i]['contato_em']=b['contato_em']; pv[i]['contato_por']='Bruna' if b['contato_em'] else None
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([pv[i]]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(list(pv.values())))
    route.fulfill(status=200, content_type='application/json', body='[]')
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='buscar': body={'clientes':[{'id':7,'nome':'Carla Teste','celular':'(81) 97777-2222','bairro':'Boa Viagem','cidade':'Recife/PE','cpfCnpj':''}]}
    elif rota=='contato': body={'cliente':{'id':7,'nome':'Carla Teste','celular':'(81) 97777-2222'}}
    elif rota=='pedidos': body={'pedidos':[{'id':9,'numero':'777','situacao':'Entregue','entregue':True,'entrega':mes(14)},{'id':8,'numero':'650','situacao':'Entregue','entregue':True,'entrega':mes(4)}]}
    elif rota=='posvenda': body={'lidos':0,'faltam':0}
    else: body={}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(body))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1800)
    print('1 pós-venda:', pg.inner_text('#inicio-posvenda').replace('\n',' / ')[:300])
    pg.locator('#inicio-posvenda .conf-wa').first.click(); pg.wait_for_timeout(300)
    print('  mensagem:\n'+pg.locator('#inicio-posvenda .conf-msg').input_value())
    pg.evaluate("navigator.clipboard.writeText=async(t)=>{window._c=t}")
    pg.locator('#inicio-posvenda >> text=Copiar mensagem').click(); pg.wait_for_timeout(200)
    print('  copiou e não registrou?', pg.evaluate('!!window._c'), pv[1]['contato_em'] is None)
    pg.locator('#inicio-posvenda >> text=Já enviei').click(); pg.wait_for_timeout(300)
    print('2 já enviei →', pg.locator('#inicio-posvenda .pv-item').first.inner_text().replace('\n',' / '), '| banco:', pv[1]['contato_por'])
    pg.locator('#inicio-posvenda >> text=desfazer').click(); pg.wait_for_timeout(300)
    print('  desfazer →', pv[1]['contato_em'] is None, '|', pg.locator('#inicio-posvenda .pv-item').first.inner_text().replace('\n',' / '))
    # novo chamado
    pg.locator('.inicio-atalhos >> text=Garantia / problema').click(); pg.wait_for_timeout(300)
    pg.fill('#gar-busca','Carla'); pg.wait_for_timeout(900)
    pg.locator('#gar-busca-res .olist-item').first.click(); pg.wait_for_timeout(600)
    print('3 OS:', pg.inner_text('#gar-os').replace('\n',' / '), '| situação:', pg.inner_text('#gar-situacao'))
    pg.locator('.gar-os-item >> nth=1').click(); pg.wait_for_timeout(200)
    print('  OS recente:', pg.inner_text('#gar-situacao'))
    pg.screenshot(path=f'{S}/shotsT/gar-form.png', full_page=True)
    pg.locator('#modal-ok').click(); pg.wait_for_timeout(200); print('  sem relato →', pg.inner_text('#modal-erro'))
    pg.fill('#gar-relato','Rolô da sala não sobe'); pg.check('#gar-fotos'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(500)
    print('4 salvo:', {k:gar[0][k] for k in ('cliente','telefone','pedido_numero','data_entrega','tipo','fotos','sem_cadastro','prazo_retorno')})
    print('  início garantia:', pg.inner_text('#inicio-garantia').replace('\n',' / ')[:200])
    pg.locator('#inicio-garantia .inicio-pend-item').first.click(); pg.wait_for_timeout(600)
    print('5 tela:', pg.evaluate('document.body.dataset.tela'), '|', pg.inner_text('#gar-contagem'))
    pg.locator('.gar-card >> text=Já dei o 1º retorno').click(); pg.wait_for_timeout(300)
    print('  1º retorno:', bool(gar[0]['primeiro_retorno_em']))
    pg.locator('.gar-card >> text=desfazer').first.click(); pg.wait_for_timeout(300); print('  desfez:', gar[0]['primeiro_retorno_em'] is None)
    pg.locator('.gar-card >> text=Decore').click(); pg.wait_for_timeout(300); print('6 acionou Decore → status:', gar[0]['status'], gar[0]['acionado'])
    pg.locator('.gar-card >> text=Resolvido').click(); pg.wait_for_timeout(200); pg.fill('#gar-solucao','Decore trocou o tecido'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(400)
    print('7 resolvido:', gar[0]['status'], '| lista abertos:', pg.inner_text('#gar-lista')[:60].replace('\n',' '))
    pg.locator('#gar-filtros >> text=Resolvidos').click(); pg.wait_for_timeout(200)
    pg.locator('.gar-card >> text=reabrir').click(); pg.wait_for_timeout(300); print('  reabrir:', gar[0]['status'])
    # chamado sem cadastro / fora da garantia
    pg.locator('text=+ Novo chamado').click(); pg.wait_for_timeout(200)
    pg.fill('#gar-busca','Fulano Desconhecido'); pg.wait_for_timeout(900)
    pg.locator('.gar-semcad').click(); pg.wait_for_timeout(200)
    print('8 sem cadastro:', pg.inner_text('#gar-situacao')[:90], '| nome:', pg.input_value('#gar-cliente'))
    pg.fill('#gar-relato','Persiana com defeito'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(400)
    pg.locator('#gar-filtros >> text=Abertos').click(); pg.wait_for_timeout(200)
    pg.locator('text=mensagem da taxa de visita').first.click(); pg.wait_for_timeout(200)
    print('  taxa:\n'+pg.input_value('#gar-taxa-msg')); pg.locator('.modal-fechar, #modal-cancelar, text=Cancelar').first.click() if pg.locator('#modal-cancelar').count() else None
    pg.screenshot(path=f'{S}/shotsT/gar-lista.png', full_page=True)
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
