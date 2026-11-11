import json
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]; patches=[]
rows=[{"id":9,"numero":9,"etapa":"orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","anterior_id":None,"date":"01/10/2026","criado_por":"Mirelle","total_tabela":0,"total_cartao":0,"total_avista":0,"items":[]}]
def rota(r):
    if r.request.method=='PATCH':
        b=json.loads(r.request.post_data); patches.append(b); rows[0].update(b); return r.fulfill(status=200, content_type='application/json', body=json.dumps([rows[0]]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
passo=lambda pg: pg.evaluate("document.getElementById('tab-calc').dataset.passoAtual")
vis=lambda pg: pg.eval_on_selector_all('#tab-calc [data-passo]', "e=>e.filter(x=>x.offsetParent!==null).map(x=>(x.querySelector('.card-title')||x).innerText.split('\\n')[0].slice(0,22))")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},device_scale_factor=2,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.type+': '+d.message[:60].replace('\n',' ')), d.accept()))
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(300); pg.locator('.pasta-add').click(); pg.wait_for_timeout(200)
    print('1 passo', passo(pg), '| contexto:', pg.inner_text('#passos-contexto'), '| visíveis:', vis(pg), '| barra:', pg.inner_text('#passo-voltar'), '/', pg.inner_text('#passo-avancar'))
    pg.screenshot(path='shotsB/d1-passo1.png')
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(150)
    print('  sem ambiente →', pg.inner_text('#passo-erro'), '| passo', passo(pg))
    pg.fill('#item-ambiente','Sala'); pg.dispatch_event('#item-ambiente','input'); pg.locator('#passo-avancar').click(); pg.wait_for_timeout(150)
    print('2 passo', passo(pg), '| visíveis:', vis(pg), '| ambiente:', pg.inner_text('#passo-amb'))
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(100); print('  sem fábrica →', pg.inner_text('#passo-erro'))
    pg.locator('#fb-real').click(); pg.wait_for_timeout(150)
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
    escolher('#s-cat','CORTINAS'); escolher('#s-prod','ROL')
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(100); print('  sem família →', pg.inner_text('#passo-erro'))
    escolher('#s-fam','BLACK'); escolher('#s-col','')
    pg.screenshot(path='shotsB/d1-passo2.png', full_page=True)
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(150)
    print('3 passo', passo(pg), '| visíveis:', vis(pg), '| botão:', pg.inner_text('#passo-avancar'))
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(100); print('  sem medidas →', pg.inner_text('#passo-erro'))
    pg.fill('#i-w','2.40'); pg.fill('#i-h','2.60'); pg.dispatch_event('#i-h','input'); pg.wait_for_timeout(150)
    pg.screenshot(path='shotsB/d1-passo3.png', full_page=True)
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(400)
    print('4 passo', passo(pg), '| à vista:', pg.evaluate('STATE.lastResult.avista'), '| visíveis:', vis(pg), '| botão:', pg.inner_text('#passo-avancar'), '| dark bar:', pg.is_visible('#orc-resumo-bar'))
    pg.wait_for_timeout(300); pg.evaluate('window.scrollTo(0,0)'); pg.screenshot(path='shotsB/d1-passo4.png', full_page=True)
    # voltar ao passo 2 e trocar coleção; pular direto pro 4 pelo topo → recalcula
    av1=pg.evaluate('STATE.lastResult.avista')
    pg.locator('#passos li[data-p="2"] button').click(); pg.wait_for_timeout(150); escolher('#s-col','Euro')
    pg.locator('#passos li[data-p="4"] button').click(); pg.wait_for_timeout(300)
    print('  trocou coleção e pulou pro 4 → recalculou:', pg.evaluate('STATE.lastResult.colLabel'), pg.evaluate('STATE.lastResult.avista'), '(antes', av1, ')')
    # adicionar e calcular outro
    pg.locator('.passo-outro-btn').click(); pg.wait_for_timeout(400)
    print('5 calcular outro → itens:', pg.evaluate('CART.length'), '| passo', passo(pg), '| ambiente mantido:', pg.input_value('#item-ambiente'), '| fábrica limpa:', pg.evaluate('STATE.fab'))
    pg.locator('#fb-dec').click(); pg.wait_for_timeout(150); escolher('#s-cat','CORTINAS'); escolher('#s-prod','ROMANA'); escolher('#s-fam',''); escolher('#s-col','')
    pg.locator('#passo-avancar').click(); pg.fill('#i-w','1.60'); pg.fill('#i-h','1.80'); pg.dispatch_event('#i-h','input'); pg.locator('#passo-avancar').click(); pg.wait_for_timeout(300)
    print('  passo 4 resumo:', pg.inner_text('#passo-orc-resumo').replace('\n',' | ')[:120])
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(400)
    print('6 adicionar → tela:', pg.evaluate('document.body.dataset.tela'), '| itens:', pg.inner_text('#pasta-n'))
    # editar item → abre no passo 3 com "Substituir"
    pg.locator('.pasta-botoes button[title=Editar]').first.click(); pg.wait_for_timeout(400)
    print('7 editar → passo', passo(pg), '| contexto:', pg.inner_text('#passos-contexto'), '| botão:', pg.inner_text('#passo-avancar'), '| outro-btn:', pg.locator('.passo-outro-btn').count())
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(300); print('  passo', passo(pg), 'botão:', pg.inner_text('#passo-avancar'))
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(400)
    print('  substituiu → tela:', pg.evaluate('document.body.dataset.tela'), '| itens:', pg.inner_text('#pasta-n'))
    # voltar do passo 1 → pasta
    pg.locator('.pasta-add').click(); pg.wait_for_timeout(150); pg.locator('#passo-voltar').click(); pg.wait_for_timeout(200)
    print('8 voltar no passo 1 → tela:', pg.evaluate('document.body.dataset.tela'))
    # CDP
    pg.locator('.pasta-add').click(); pg.fill('#item-ambiente','Quarto'); pg.locator('#passo-avancar').click(); pg.locator('#fb-cdp').click(); pg.wait_for_timeout(150)
    pg.locator('#passo-avancar').click(); pg.wait_for_timeout(100); print('9 CDP sem tipo →', pg.inner_text('#passo-erro'))
    pg.select_option('#cdp-tipo','unica'); pg.wait_for_timeout(120); escolher('#cdp-cam1','')
    pg.locator('#passo-avancar').click(); pg.fill('#i-w','3.00'); pg.fill('#i-h','2.60'); pg.dispatch_event('#i-w','input'); pg.locator('#passo-avancar').click(); pg.wait_for_timeout(300)
    print('  CDP passo', passo(pg), '| à vista:', pg.evaluate('STATE.lastResult && STATE.lastResult.avista'))
    print('largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs); print('diálogos:', [d for d in dialogs if not d.startswith('prompt') and 'A DEFINIR' not in d])
