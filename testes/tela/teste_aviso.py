import json
from playwright.sync_api import sync_playwright
exec(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'teste_c3c.py')).read().split('tela=lambda')[0])   # reaproveita os dados e o banco simulado
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},device_scale_factor=2,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.hist-card[onclick="reopenOrc(9)"] .hist-abrir').click(); pg.wait_for_timeout(300)
    print('a) original (sem evolução) → aviso geral:', pg.locator('.aviso-preco').count())
    pg.locator('.pasta-evoluir').click(); pg.wait_for_timeout(800)
    print('b) evoluído com itens antigos → aviso geral:', pg.inner_text('.aviso-preco').replace('\n',' ') if pg.locator('.aviso-preco').count() else 'NÃO')
    pg.screenshot(path='shotsB/c3c-aviso-preco.png')
    # item calculado agora: guarda a tabela e não avisa
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
    pg.locator('.pasta-add').click(); pg.fill('#item-ambiente','Quarto'); pg.dispatch_event('#item-ambiente','input'); pg.evaluate("selectFab('dec')")
    escolher('#s-cat','CORTINAS'); escolher('#s-prod','ROL'); escolher('#s-fam',''); escolher('#s-col','')
    pg.fill('#i-w','1.20'); pg.fill('#i-h','1.50'); pg.dispatch_event('#i-h','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(250)
    pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
    print('c) item novo guardou tabela:', pg.evaluate("CART[CART.length-1].tabelaVer"), '| avisos no item novo:', pg.locator('.pasta-item').last.locator('.pasta-alerta').count())
    # simula um item calculado com tabela antiga
    pg.evaluate("CART[CART.length-1].tabelaVer='Julho/2026'; renderPasta()")
    print('d) item com tabela antiga →', pg.locator('.pasta-item').last.locator('.pasta-alerta').inner_text())
    b.close()
print('ERROS JS:', errs)
