import json, sys
from playwright.sync_api import sync_playwright
S=sys.argv[1] if len(sys.argv)>1 else 'shotsN'
errs=[]; patches=[]
rows=[{"id":9,"numero":9,"etapa":"orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","anterior_id":None,"date":"01/10/2026","criado_por":"Mirelle","total_tabela":0,"total_cartao":0,"total_avista":0,"items":[],"updated_at":"2026-10-06T10:00:00Z","created_at":"2026-10-01T10:00:00Z"}]
def rota(r):
    if r.request.method=='PATCH':
        b=json.loads(r.request.post_data); patches.append(b); rows[0].update(b); return r.fulfill(status=200, content_type='application/json', body=json.dumps([rows[0]]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
vis=lambda pg,sel: pg.is_visible(sel)
lado=lambda pg: pg.evaluate("document.body.classList.contains('lado-a-lado')")
def escolher(pg,sel,k):
    o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
def item(pg,amb,fab,prod,w,h,acc=(),janela=None):
    pg.fill('#item-ambiente',amb); pg.locator('#passo-avancar').click(); pg.locator('#fb-'+fab).click(); pg.wait_for_timeout(150)
    escolher(pg,'#s-cat','CORTINAS' if 'PERSIANA' not in prod else 'PERSIANAS'); escolher(pg,'#s-prod',prod); escolher(pg,'#s-fam',''); escolher(pg,'#s-col','')
    pg.locator('#passo-avancar').click()
    if janela:
        pg.select_option('#tipo-medida','janela'); pg.dispatch_event('#tipo-medida','change')
        pg.fill('#jan-w',janela[0]); pg.fill('#jan-h',janela[1]); pg.dispatch_event('#jan-h','input'); pg.evaluate('calcSobra()')
    else:
        pg.fill('#i-w',w); pg.fill('#i-h',h); pg.dispatch_event('#i-h','input')
    for a in acc:
        pg.evaluate(f"(()=>{{const c=$('chk_{a}'); c.checked=true; onAccChange(c,'{a}');}})()")
    pg.wait_for_timeout(150)
    return pg.input_value('#item-detalhamento')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1366,'height':860},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("switchTab('hist')"); pg.wait_for_timeout(400)
    pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(400)
    print('A1 abrir no computador → pasta inteira (sem lado a lado):', not lado(pg), '| tela:', pg.evaluate('document.body.dataset.tela'))
    pg.screenshot(path=S+'/e1-pasta-inteira.png')
    pg.locator('.pasta-barra button', has_text='Adicionar').first.click() if pg.locator('.pasta-barra button', has_text='Adicionar').count() else pg.evaluate('adicionarItemPasta()')
    pg.wait_for_timeout(300)
    print('A2 adicionar item → lado a lado:', lado(pg), '| botão voltar:', pg.inner_text('#passo-voltar'))
    d=item(pg,'Sala','real','ROL','2.40','2.60',acc=['r_bs','r_gl6','r_m6n','r_rc1'])
    print('B1 Rolô pronta + bandô/guia/motor/controle →\n   ', d)
    pg.screenshot(path=S+'/e1-detalhamento.png')
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(350); pg.locator('#passo-avancar').click(); pg.wait_for_timeout(400)
    print('A3 salvou o item → lado a lado:', lado(pg), '| tela:', pg.evaluate('document.body.dataset.tela'), '| itens:', pg.inner_text('#pasta-n'))
    pg.screenshot(path=S+'/e1-depois-item.png')
    print('   detalhe salvo:', pg.evaluate('CART[0].detail')[:90])
    pg.evaluate('adicionarItemPasta()'); pg.wait_for_timeout(300)
    d=item(pg,'Quarto','dec','ROMANA',None,None,janela=('1.50','1.45'))
    print('B2 Romana pela janela →\n   ', d)
    pg.locator('#passo-voltar').click(); pg.wait_for_timeout(300)
    pg.locator('#passo-voltar').click(); pg.wait_for_timeout(300)
    pg.locator('#passo-voltar').click(); pg.wait_for_timeout(300)
    print('A4 fechar a calculadora → lado:', lado(pg), '| tela:', pg.evaluate('document.body.dataset.tela'))
    # sair: sair sem salvar / salvar e sair
    pg.evaluate("switchTab('inicio')"); pg.wait_for_timeout(300)
    print('C1 sair com alteração → janela:', vis(pg,'#modal-sair'))
    pg.screenshot(path=S+'/e1-sair-desktop.png')
    pg.locator('#modal-sair [data-r=salvar]').click(); pg.wait_for_timeout(700)
    print('C2 salvar e sair → tela:', pg.evaluate('document.body.dataset.tela'), '| PATCH itens:', len(patches[-1].get('items',[])) if patches else None, '| sujo:', pg.evaluate('ORC_SUJO'), '| aviso:', pg.inner_text('#aviso-topo')[:60])
    pg.evaluate("switchTab('hist')"); pg.wait_for_timeout(300); pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(400)
    pg.evaluate("ORC_SUJO=true"); n=len(patches)
    pg.evaluate("switchTab('ped')"); pg.wait_for_timeout(200); pg.locator('#modal-sair [data-r=descartar]').click(); pg.wait_for_timeout(400)
    print('C3 sair sem salvar → tela:', pg.evaluate('document.body.dataset.tela'), '| gravou?', len(patches)>n)
    # cidade no celular
    pg.set_viewport_size({'width':360,'height':780}); pg.evaluate('novoOrcamento()'); pg.wait_for_timeout(300)
    pg.locator('#novo-cidade').click(); pg.locator('#novo-cidade').fill('')
    pg.locator('#novo-cidade').type('jab', delay=40); pg.wait_for_timeout(200)
    print('D1 digitou "jab" → lista:', vis(pg,'.cid-lista'), pg.locator('.cid-op').all_inner_texts()[:3])
    pg.screenshot(path=S+'/e1-cidade-lista.png')
    pg.locator('.cid-op').first.click(); pg.wait_for_timeout(200)
    print('D2 escolheu → cidade:', pg.input_value('#novo-cidade'), '| UF:', pg.input_value('#novo-uf'), '| lista fechou:', not vis(pg,'.cid-lista'))
    pg.locator('#novo-cidade').fill(''); pg.locator('#novo-cidade').type('joao pes', delay=30); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    print('D3 "joao pes" + Enter → cidade:', pg.input_value('#novo-cidade'), '| UF:', pg.input_value('#novo-uf'))
    pg.locator('#novo-cidade').fill(''); pg.locator('#novo-cidade').type('maceio', delay=30); pg.locator('#novo-bairro').click(); pg.wait_for_timeout(300)
    print('D4 "maceio" e saiu do campo → cidade:', pg.input_value('#novo-cidade'), '| UF:', pg.input_value('#novo-uf'))
    print('   largura da página:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
