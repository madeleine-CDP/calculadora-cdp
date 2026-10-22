import json
from playwright.sync_api import sync_playwright
errs=[]; posts=[]; banco=[]
def rest(route):
    r=route.request
    if r.method=='POST':
        b=json.loads(r.post_data); posts.append(b)
        linha=dict(b, id=77, numero=77, etapa=b.get('etapa','orcamento'), created_at='2026-10-07T10:00:00Z', updated_at='2026-10-07T10:00:00Z')
        banco[:]=[linha]
        return route.fulfill(status=201, content_type='application/json', body=json.dumps([linha]))
    if r.method=='PATCH':
        b=json.loads(r.post_data); posts.append(b); banco[0].update(b)
        return route.fulfill(status=200, content_type='application/json', body=json.dumps([banco[0]]))
    route.fulfill(status=200, content_type='application/json', body=json.dumps(banco))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":true,"conectado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(800)
    pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(300)
    v=lambda i: pg.input_value(i)
    print('1 padrão → cidade:', v('#novo-cidade'), '| uf:', v('#novo-uf'), '| opções UF:', pg.locator('#novo-uf option').count())
    pg.fill('#novo-nome','Teste Cidade'); pg.fill('#novo-tel','81988887777'); pg.dispatch_event('#novo-tel','input')
    pg.fill('#novo-cidade',''); pg.click('.novo-opcao >> nth=0'); pg.click('#novo-criar'); pg.wait_for_timeout(300)
    print('2 sem bairro/cidade →', pg.inner_text('#novo-erro'))
    pg.fill('#novo-bairro','Candeias')
    pg.fill('#novo-cidade','jaboatao dos guararapes'); pg.dispatch_event('#novo-cidade','input'); pg.dispatch_event('#novo-cidade','change')
    print('3 digitou cidade → cidade:', v('#novo-cidade'), '| uf:', v('#novo-uf'))
    pg.fill('#novo-cidade','Maceió'); pg.dispatch_event('#novo-cidade','input')
    print('4 Maceió → uf:', v('#novo-uf'))
    pg.fill('#novo-cidade','Jaboatão dos Guararapes'); pg.dispatch_event('#novo-cidade','input')
    pg.evaluate("document.querySelector('#tab-novo .novo-mais').open=true"); pg.fill('#novo-end','Av. Bernardo Vieira de Melo, 2000')
    pg.click('#novo-criar'); pg.wait_for_timeout(900)
    print('5 criou → POST cidade/uf/bairro:', posts[0].get('cidade'), posts[0].get('uf'), posts[0].get('bairro'), '| tela:', pg.evaluate('document.body.dataset.tela'))
    print('   barra do cliente → cidade:', v('#cli-cidade'), '| uf:', v('#cli-uf'), '| sub da pasta:', pg.inner_text('#pasta-sub'))
    print('   endereço p/ proposta:', pg.evaluate('enderecoCompleto(STATE.cliente)'))
    print('   variações:', pg.evaluate("[enderecoCompleto({end:'Rua A, 1 - Boa Viagem - Recife/PE',bairro:'Boa Viagem',cidade:'Recife',uf:'PE'}), enderecoCompleto({bairro:'Boa Viagem',cidade:'Recife',uf:'PE'}), enderecoCompleto({})]"))
    pg.evaluate("$('cli-uf').value='PB'; $('cli-uf').dispatchEvent(new Event('input',{bubbles:true}))")
    print('6 mudou UF na barra → ORC_SUJO:', pg.evaluate('ORC_SUJO'), '| STATE uf:', pg.evaluate('STATE.cliente.uf'))
    pg.screenshot(path='shotsT/cidade-novo.png', full_page=True)
    print('   largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
