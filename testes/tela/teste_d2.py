import json
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]; posts=[]; patches=[]
rows=[{"id":9,"numero":9,"etapa":"pre_orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","anterior_id":None,"date":"01/10/2026","criado_por":"Mirelle","total_tabela":0,"total_cartao":0,"total_avista":980,
       "items":[{"id":1,"ambiente":"Quarto","label":"Quarto","fab":"real","prod":"CORTINA ROLÔ","fam":"BLACKOUT","col":"BK Pinpoint","w":1.2,"h":1.5,"qty":1,"tabela":1153,"cartao":1095,"avista":980,"detail":"x"}]},
      {"id":4,"numero":4,"etapa":"fechado","ref":"","client":"Fechado Silva","bairro":"","telefone":"","date":"01/09/2026","total_tabela":0,"total_cartao":0,"total_avista":100,"items":[]}]
def rota(r):
    m=r.request.method
    if m=='POST':
        b=json.loads(r.request.post_data); posts.append(b); novo=dict(b,id=70,numero=12); rows.insert(0,novo); return r.fulfill(status=201, content_type='application/json', body=json.dumps([novo]))
    if m=='PATCH':
        i=int(r.request.url.split('id=eq.')[-1]); b=json.loads(r.request.post_data); patches.append((i,b)); x=[x for x in rows if x['id']==i][0]; x.update(b); return r.fulfill(status=200, content_type='application/json', body=json.dumps([x]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
def escolher(pg,sel,k):
    o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
def item(pg, amb, fab, prod, w, h, passo1=True):
    if passo1: pg.fill('#item-ambiente',amb); pg.locator('#passo-avancar').click()
    pg.locator('#fb-'+fab).click(); pg.wait_for_timeout(150); escolher(pg,'#s-cat','CORTINAS'); escolher(pg,'#s-prod',prod); escolher(pg,'#s-fam',''); escolher(pg,'#s-col','')
    pg.locator('#passo-avancar').click(); pg.fill('#i-w',w); pg.fill('#i-h',h); pg.dispatch_event('#i-h','input'); pg.locator('#passo-avancar').click(); pg.wait_for_timeout(350)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},device_scale_factor=2,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.type+': '+d.message[:70].replace('\n',' ')), d.accept()))
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.evaluate("switchTab('calc')"); pg.wait_for_timeout(200)
    print('1 Calcular →', pg.inner_text('#passos-contexto'), '| voltar:', pg.inner_text('#passo-voltar'))
    item(pg,'Sala','real','ROL','2.40','2.60')
    print('2 resultado → botão:', pg.inner_text('#passo-avancar'), '| opções:', pg.inner_text('.rapido-acoes').replace('\n',' | '))
    pg.screenshot(path='shotsB/d2-resultado.png', full_page=True)
    pg.locator('.rapido-acoes .passo-outro-btn', has_text='Somar').click(); pg.wait_for_timeout(300)
    print('3 somar → itens:', pg.evaluate('CART.length'), '| passo:', pg.evaluate('PASSO'), '| ambiente:', pg.input_value('#item-ambiente'), '| tela:', pg.evaluate('document.body.dataset.tela'))
    item(pg,'Sala','dec','ROMANA','1.60','1.80', passo1=False)
    print('  resumo:', pg.inner_text('.passo-ja-tem').replace('\n',' | '))
    pg.screenshot(path='shotsB/d2-somado.png', full_page=True)
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(300)
    print('4 criar orçamento → tela:', pg.evaluate('document.body.dataset.tela'), '| aviso:', pg.inner_text('#tab-novo .hist-sub'))
    pg.screenshot(path='shotsB/d2-novo.png')
    pg.fill('#novo-nome','João Lima'); pg.type('#novo-tel','81911112222'); pg.fill('#novo-bairro','Boa Viagem'); pg.locator('.novo-opcao').first.click(); pg.locator('#novo-criar').click(); pg.wait_for_timeout(700)
    print('  POST itens:', len(posts[-1]['items']), '| PATCH:', patches[-1][0], len(patches[-1][1]['items']), patches[-1][1]['total_avista'], '| tela:', pg.evaluate('document.body.dataset.tela'), '| pasta:', pg.inner_text('#pasta-n'), '| sujo:', pg.evaluate('ORC_SUJO'))
    print('  aviso:', pg.inner_text('#aviso-topo'))
    pg.locator('#pasta-salvar').click(); pg.wait_for_timeout(600)
    # novo cálculo rápido → adicionar a existente
    pg.evaluate("switchTab('calc')"); pg.wait_for_timeout(200)
    item(pg,'Varanda','real','ROL','1.20','1.50')
    pg.locator('.rapido-acoes .passo-outro-btn', has_text='existente').click(); pg.wait_for_timeout(500)
    print('5 existente → lista:', pg.eval_on_selector_all('.destino-item strong','e=>e.map(x=>x.textContent)'))
    pg.fill('#destino-busca','maria'); pg.wait_for_timeout(100)
    print('  busca maria → visíveis:', pg.eval_on_selector_all('.destino-item','e=>e.filter(x=>x.style.display!="none").map(x=>x.querySelector("strong").textContent)'))
    pg.screenshot(path='shotsB/d2-existente.png')
    pg.locator('.destino-item', has_text='Maria').click(); pg.wait_for_timeout(400)
    print('  escolheu → tela:', pg.evaluate('document.body.dataset.tela'), '| sub:', pg.inner_text('#pasta-sub'), '| itens:', pg.inner_text('#pasta-n'), '| sujo:', pg.evaluate('ORC_SUJO'), '| modal ok volta:', pg.evaluate("document.getElementById('modal-ok').style.display"))
    print('  aviso:', pg.inner_text('#aviso-topo'))
    pg.locator('#pasta-salvar').click(); pg.wait_for_timeout(600)
    print('  salvou Maria → PATCH itens:', [i['ambiente'] for i in patches[-1][1]['items']])
    # sair do cálculo rápido com item
    pg.evaluate("switchTab('calc')"); pg.wait_for_timeout(200); item(pg,'Sala','real','ROL','1.00','1.00')
    pg.locator('.rapido-acoes .passo-outro-btn', has_text='Somar').click(); pg.wait_for_timeout(300)
    for _ in range(2): pg.locator('#passo-voltar').click(); pg.wait_for_timeout(100)
    print('6 sair com item → tela:', pg.evaluate('document.body.dataset.tela'), '| itens:', pg.evaluate('CART.length'), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs); print('diálogos:', [d for d in dialogs if not d.startswith('prompt') and 'A DEFINIR' not in d])
