import json
from playwright.sync_api import sync_playwright
errs=[]
CSS="#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}"
rows=[{"id":9,"numero":9,"etapa":"orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","anterior_id":None,"date":"01/10/2026","criado_por":"Mirelle","total_tabela":0,"total_cartao":0,"total_avista":0,"items":[],"updated_at":"2026-10-06T10:00:00Z","created_at":"2026-10-01T10:00:00Z"}]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':900,'height':1000},device_scale_factor=1,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/orcamentos**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows)))
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='"+CSS+"';document.head.appendChild(st)})")
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("switchTab('hist')"); pg.wait_for_timeout(300)
    pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(300)
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k.upper() in x.upper()] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(100)
    def add(amb,fab,prod,fam,w,h):
        pg.evaluate("irParaTab('calc')"); pg.fill('#item-ambiente',amb); pg.dispatch_event('#item-ambiente','input'); pg.evaluate(f"selectFab('{fab}')")
        escolher('#s-cat','CORTINAS' if prod!='VERTICAL' else 'PERSIANA'); escolher('#s-prod',prod); escolher('#s-fam',fam); escolher('#s-col','')
        pg.fill('#i-w',w); pg.fill('#i-h',h); pg.fill('#i-qty','1'); pg.dispatch_event('#i-qty','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(200); pg.evaluate('addToCart()'); pg.wait_for_timeout(250)
    add('Sala','real','ROL','BLACK','2.40','2.60'); add('Sala','dec','ROMANA','','2.40','2.60')
    add('Quarto','real','ROL','BLACK','1.80','2.20'); add('Quarto','dec','DOUBLE','','1.80','2.20')
    add('Varanda','real','ROL','BLACK','2.00','2.00')
    sel=pg.locator('.pasta-opcao select')
    for idx,l in enumerate(['A','B','A','B']): sel.nth(idx).select_option(l); pg.wait_for_timeout(120)
    pg.locator('.amb-opcional input').nth(2).check(); pg.wait_for_timeout(150)
    print('itens:', pg.evaluate("CART.map(i=>[i.ambiente,i.opcao||'-',!!i.ambienteOpcional,i.avista])"))
    print('faixa na pasta:', pg.inner_text('.pasta-faixa'))
    pg.locator('#pasta-totais').scroll_into_view_if_needed(); pg.screenshot(path='shotsB/combo-pasta.png')
    combos=pg.evaluate("gerarCombinacoes(CART).map(c=>[c.rotulo,c.totais.tabela,c.totais.cartao,c.totais.avista]).sort((a,b)=>a[3]-b[3])")
    print('combinações:'); [print('  ',c) for c in combos]
    pg.evaluate("abrirPropostaPasta()"); pg.wait_for_timeout(300)
    print('marcadas por padrão:', pg.evaluate("COMBOS_SEL.length"), '| lista na tela:', pg.locator('.combo-linha').count())
    pg.locator('.combo-nome').first.fill('Essencial'); pg.locator('.combo-nome').last.fill('Completa')
    pg.locator('#p-combos').screenshot(path='shotsB/combo-config.png')
    pg.evaluate("gerarProposta()"); pg.wait_for_timeout(800)
    doc=pg.locator('#proposta-doc')
    print('ambientes no topo do total:', pg.evaluate("[...document.querySelectorAll('#proposta-doc div')].find(d=>d.textContent.startsWith('AMBIENTES E OPÇÕES')).textContent"))
    print('linhas de total:', pg.evaluate("[...document.querySelectorAll('#proposta-doc td[colspan=\"3\"]')].map(t=>t.textContent)"))
    print('células de ambiente:', pg.evaluate("[...document.querySelectorAll('#proposta-doc tbody tr td:first-child')].map(t=>t.innerText.replace(/\\n/g,' '))"))
    pg.evaluate("[...document.querySelectorAll('#proposta-doc div')].find(d=>d.textContent.startsWith('AMBIENTES E OPÇÕES')).scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    alvo=pg.evaluate("(()=>{const el=[...document.querySelectorAll('#proposta-doc div')].find(d=>d.textContent.startsWith('AMBIENTES E OPÇÕES')).parentElement.parentElement; const r=el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]})()")
    pg.screenshot(path='shotsB/combo-total.png', clip={'x':alvo[0],'y':alvo[1],'width':alvo[2],'height':alvo[3]})
    b.close()
print('ERROS JS:', errs)
