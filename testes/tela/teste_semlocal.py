import json
from playwright.sync_api import sync_playwright
errs=[]; posts=[]
def rest(route):
    r=route.request
    if r.method=='POST':
        b=json.loads(r.post_data); posts.append(b); l=dict(b,id=9,numero=9,etapa='pre_orcamento')
        return route.fulfill(status=201, content_type='application/json', body=json.dumps([l]))
    route.fulfill(status=200, content_type='application/json', body='[]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":true,"conectado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(800); pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(300)
    pg.fill('#novo-nome','Sem Endereço'); pg.type('#novo-tel','81955554444'); pg.click('.novo-opcao >> nth=0')
    pg.click('.novo-sem-local')
    print('1 botão → bairro/cidade/uf:', pg.input_value('#novo-bairro'), pg.input_value('#novo-cidade'), pg.input_value('#novo-uf'))
    pg.screenshot(path='shotsT/sem-local.png')
    pg.click('#novo-criar'); pg.wait_for_timeout(900)
    print('2 criou → POST:', posts[0].get('bairro'), posts[0].get('cidade'), posts[0].get('uf'), '| erro:', repr(pg.inner_text('#novo-erro')))
    print('3 endereço na proposta:', repr(pg.evaluate('enderecoCompleto(STATE.cliente)')), '| barra uf:', pg.input_value('#cli-uf'))
    print('4 só bairro conhecido:', pg.evaluate("enderecoCompleto({bairro:'Boa Viagem',cidade:'-',uf:'-'})"))
    b.close()
print('ERROS JS:', errs)
