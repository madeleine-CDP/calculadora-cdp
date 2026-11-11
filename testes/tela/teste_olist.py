import json, sys
from playwright.sync_api import sync_playwright
errs=[]; chamadas=[]
estado={'conectado':True,'configurado':True,'falhar':False}
CLIENTES=[{'id':1,'nome':'Maria Souza Lima','cpfCnpj':'123.456.789-09','celular':'(81) 98877-6655','telefone':'','email':'maria@exemplo.com','endereco':'Rua das Flores, 100 - Apto 301','bairro':'Boa Viagem','cidade':'Recife/PE','cep':'51020-000'},
          {'id':2,'nome':'Maria Souza Costa','cpfCnpj':'','celular':'','telefone':'(81) 3333-4444','email':'','endereco':'','bairro':'Casa Amarela','cidade':'Recife/PE','cep':''}]
def func(route):
    r=route.request; rota=r.url.split('/olist/')[1].split('?')[0]
    chamadas.append((rota, r.headers.get('authorization',''), r.post_data))
    if estado['falhar'] and rota=='buscar': return route.fulfill(status=502, content_type='application/json', body='{"erro":"olist_indisponivel"}')
    if rota=='status': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'configurado':estado['configurado'],'conectado':estado['conectado']}))
    if rota=='buscar': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'clientes':[dict(c, celular='', telefone='') for c in CLIENTES]}))
    if rota=='contato':
        i=json.loads(r.post_data)['id']; c=[x for x in CLIENTES if x['id']==i][0]
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'cliente':c}))
    if rota=='pedidos': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'pedidos':[{'numero':1523,'data':'2025-11-03','valor':4210.5,'situacao':'Entregue'},{'numero':1301,'data':'2024-05-20','valor':980,'situacao':'Faturada'}]}))
    if rota=='iniciar': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'url':'http://localhost:8766/?olist=conectado'}))
    route.fulfill(status=404, body='{}')
def sessao(papel, nome):
    return "localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))" % (nome, papel)
with sync_playwright() as p:
    b=p.chromium.launch()
    def nova(papel, nome, w=360):
        pg=b.new_page(viewport={'width':w,'height':760},service_workers='block')
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.route('**/rest/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='[]'))
        pg.route('**/functions/v1/olist/**', func)
        pg.add_init_script(sessao(papel, nome))
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(800); return pg
    pg=nova('atendimento','Mirelle')
    pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(500)
    print('1 conectado → busca visível:', pg.is_visible('#olist-busca'), '| token enviado:', chamadas[-1][1][:14])
    pg.fill('#olist-busca','ma'); pg.dispatch_event('#olist-busca','input'); pg.wait_for_timeout(700)
    print('2 "ma" (curto) → nada:', repr(pg.inner_text('#olist-res')), '| buscou?', any(c[0]=='buscar' for c in chamadas))
    pg.fill('#olist-busca','maria souza'); pg.dispatch_event('#olist-busca','input'); pg.wait_for_timeout(900)
    print('3 resultados:', pg.locator('.olist-item').count(), '|', pg.inner_text('.olist-item >> nth=0').replace('\n',' / '))
    pg.click('.olist-item >> nth=0'); pg.wait_for_timeout(700)
    v=lambda i: pg.input_value(i)
    print('4 preencheu → nome:', v('#novo-nome'), '| tel:', v('#novo-tel'), '| bairro:', v('#novo-bairro'), '| cidade:', v('#novo-cidade'), '| uf:', v('#novo-uf'), '| end:', v('#novo-end'), '| cpf:', v('#novo-cpf'), '| email:', v('#novo-email'))
    print('   chamou cadastro completo:', any(c[0]=='contato' for c in chamadas))
    print('   origem "Já é cliente" marcada:', pg.evaluate("!!document.querySelector('#tab-novo [data-origem=\"Já é cliente\"].on')"))
    print('   pedidos:', pg.inner_text('#olist-pedidos').replace('\n',' / '))
    pg.screenshot(path='shotsT/olist-escolhido.png', full_page=True)
    print('   largura:', pg.evaluate('document.documentElement.scrollWidth'))
    estado['falhar']=True
    pg.fill('#olist-busca','81988776655'); pg.dispatch_event('#olist-busca','input'); pg.wait_for_timeout(900)
    print('5 Olist fora → ', pg.inner_text('#olist-res'))
    estado['falhar']=False
    pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(400)
    print('6 novo de novo → limpou pedidos:', repr(pg.inner_text('#olist-pedidos')), '| campo busca:', repr(v('#olist-busca')))
    pg.close()
    estado['conectado']=False
    pg=nova('atendimento','Mirelle'); pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(500)
    print('7 desconectado (Mirelle) → busca escondida:', not pg.is_visible('#olist-busca'), '| aviso:', repr(pg.inner_text('#olist-aviso')))
    pg.close()
    pg=nova('admin','Bruna'); pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(500)
    print('8 desconectado (Bruna) → aviso:', pg.inner_text('#olist-aviso'))
    pg.screenshot(path='shotsT/olist-conectar.png')
    pg.click('#olist-aviso button'); pg.wait_for_timeout(1500)
    print('9 conectar → voltou e avisou:', pg.evaluate("document.body.innerText.includes('Olist conectado')"), '| url limpa:', pg.url)
    pg.close()
    estado['configurado']=False
    pg=nova('admin','Bruna'); pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(500)
    print('10 sem chave → aviso:', pg.inner_text('#olist-aviso'))
    b.close()
print('ERROS JS:', errs)
