import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=lambda: dt.datetime.now(dt.timezone.utc).isoformat()
rows=[{"id":1,"numero":21,"etapa":"fechado","ref":"","client":"Ana Teste Silva","bairro":"Boa Viagem","cidade":"Recife","uf":"PE","telefone":"(81) 98888-1111","anterior_id":None,"pedido_tiny":None,
       "fechado_em":agora(),"motivo_perda":None,"date":"07/10/2026","criado_por":"Bruna","total_tabela":2000,"total_cartao":1900,"total_avista":1700,"items":[],"updated_at":agora(),"created_at":agora()}]
fech={}
def rest(route):
    r=route.request; u=r.url; m=r.method
    if '/orcamentos' in u:
        if m=='PATCH': b=json.loads(r.post_data); rows[0].update(b); return route.fulfill(status=200, content_type='application/json', body=json.dumps([rows[0]]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
    if '/fechamentos' in u:
        if m=='GET': return route.fulfill(status=200, content_type='application/json', body=json.dumps(list(fech.values())))
        b=json.loads(r.post_data)
        quem=PAPEL['nome']
        if 'validado_em' in b and PAPEL['papel']!='dona':
            return route.fulfill(status=403, content_type='application/json', body='{"message":"Só a Madeleine valida o pagamento no extrato."}')
        if m=='POST': f={'orcamento_id':b['orcamento_id']}; fech[b['orcamento_id']]=f
        else: f=fech[int(u.split('orcamento_id=eq.')[1])]
        for k,v in b.items():
            f[k]=v
            if k.endswith('_em'): f[k[:-3]+'_por']= quem if v else None
        return route.fulfill(status=200, content_type='application/json', body=json.dumps([f]))
    route.fulfill(status=200, content_type='application/json', body='[]')
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='buscar': b={'clientes':[{'id':7,'nome':'Ana Teste Silva','celular':'(81) 98888-1111'}]}
    elif rota=='contato': b={'cliente':{'id':7,'nome':'Ana Teste Silva','cpfCnpj':'123.456.789-00','email':'','endereco':'Rua A, 10','numero':'10','bairro':'Boa Viagem','cep':'51000-000','tipoPessoa':'F'}}
    elif rota=='os_numero': b={'os':{'id':99,'numero':'4321','cliente':'Ana Teste Silva','situacao':'Aberta','valor':1700,'desconto':300}}
    elif rota=='os': b={'lidas':0,'detalhes':0}
    else: b={}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
PAPEL={}
PW=sync_playwright().start()
def sessao(nome,papel):
    PAPEL.update(nome=nome,papel=papel)
    p=PW
    if True:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
        pg.on('pageerror', lambda e: errs.append(nome+': '+str(e))); pg.on('dialog', lambda d: d.accept())
        pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":false}'))
        pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))"%(nome,papel))
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1800)
        pg.evaluate("navigator.clipboard.writeText=async(t)=>{window._c=t}")
        return b,pg
# ── Mirelle faz os passos 1 a 4 ──
b,pg=sessao('Mirelle','atendimento')
print('INÍCIO:', pg.inner_text('#inicio-fechamento').replace('\n',' / ')[:160])
pg.locator('#inicio-fechamento .inicio-pend-item').first.click(); pg.wait_for_timeout(800)
P=lambda: pg.inner_text('#pasta-fechamento').replace('\n',' / ')
print('1 pasta:', P()[:150])
pg.locator('#pasta-fechamento >> text=ver o que já está no cadastro do Olist').click(); pg.wait_for_timeout(600)
print('  cadastro:', pg.inner_text('.fc-olist').replace('\n',' '), '| tipo:', fech.get(1,{}).get('tipo_pessoa'))
pg.locator('#pasta-fechamento .conf-wa').first.click(); pg.wait_for_timeout(200)
print('  msg dados:', pg.locator('#pasta-fechamento .conf-msg').input_value()[:60].replace('\n',' '))
pg.locator('#pasta-fechamento >> text=Já pedi os dados').click(); pg.wait_for_timeout(300)
pg.locator('#pasta-fechamento >> text=Dados completos no Olist').last.click(); pg.wait_for_timeout(300)
print('2 passo:', pg.inner_text('.fc-prox'))
pg.fill('#fc-os-1','4321'); pg.locator('#pasta-fechamento >> text=Conferir no Olist').click(); pg.wait_for_timeout(600)
print('  banner:', pg.inner_text('.pasta-fechado-sub')); print('  OS:', pg.inner_text('.fc-os').replace('\n',' | '), '| pedido_tiny salvo:', rows[0]['pedido_tiny'])
pg.locator('#pasta-fechamento >> text=OS conferida').click(); pg.wait_for_timeout(300)
print('3 passo:', pg.inner_text('.fc-prox'), '| os_valor:', fech[1].get('os_valor'))
pg.locator('#pasta-fechamento >> text=PIX · 15%').click(); pg.wait_for_timeout(300)
pg.locator('#pasta-fechamento .fc-passo.atual .conf-wa').first.click(); pg.wait_for_timeout(200)
print('  MSG OS+PIX:\n'+pg.locator('#pasta-fechamento .conf-msg').first.input_value())
pg.locator('#pasta-fechamento .fc-passo.atual .conf-wa').nth(1).click(); pg.wait_for_timeout(200)
print('  CHAVE:', pg.locator('#pasta-fechamento .conf-msg').nth(1).input_value().replace('\n',' | '))
pg.screenshot(path=f'{S}/shotsT/fech-pix.png', full_page=True)
pg.locator('#pasta-fechamento >> text=Já enviei OS e chave').click(); pg.wait_for_timeout(300)
print('4 passo:', pg.inner_text('.fc-prox'))
pg.locator('#pasta-fechamento >> text=desfazer').last.click(); pg.wait_for_timeout(300); print('  desfazer envio →', pg.inner_text('.fc-prox'))
pg.locator('#pasta-fechamento .fc-passo.atual .conf-wa').nth(1).click(); pg.wait_for_timeout(200); pg.locator('#pasta-fechamento >> text=Já enviei OS e chave').click(); pg.wait_for_timeout(300)
pg.locator('#pasta-fechamento >> text=Cliente mandou o comprovante').click(); pg.wait_for_timeout(300)
print('5 passo (Mirelle):', pg.inner_text('.fc-prox'), '|', pg.inner_text('.fc-passo.atual').replace('\n',' / ')[:150])
print('  tentativa de validar pela Mirelle (direto no banco):', pg.evaluate("fetch('x').then(()=>0)") if False else '—')
b.close()
# ── Madeleine valida ──
b,pg=sessao('Madeleine','dona')
print('INÍCIO Madeleine:', pg.inner_text('#inicio-fechamento').replace('\n',' / ')[:180])
pg.locator('#inicio-fechamento .inicio-pend-item').first.click(); pg.wait_for_timeout(800)
pg.locator('#pasta-fechamento >> text=Conferi no extrato').click(); pg.wait_for_timeout(300)
print('6 passo:', pg.inner_text('.fc-prox'), '| validado_por:', fech[1].get('validado_por'))
pg.locator('#pasta-fechamento .fc-passo.atual .conf-wa').click(); pg.wait_for_timeout(200)
print('  msg confirmado:', pg.locator('#pasta-fechamento .conf-msg').input_value()[:70].replace('\n',' '))
pg.locator('#pasta-fechamento >> text=Já enviei').last.click(); pg.wait_for_timeout(300)
print('FIM:', pg.inner_text('.fc-prox'), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
pg.screenshot(path=f'{S}/shotsT/fech-fim.png', full_page=True)
b.close()
print('ERROS JS:', errs)
