import json, sys
from playwright.sync_api import sync_playwright
S = sys.argv[1]; URL = 'http://localhost:8766/'
errs, dialogs, posts, patches = [], [], [], []
# orçamento antigo (sem accSelections nem campos novos) para testar reabrir/editar
antigo = {"id": 7, "numero": 5, "etapa": "orcamento", "telefone": "(81) 9 0000-0000", "bairro": "Boa Viagem", "ref": "0999", "client": "Cliente Antigo", "date": "10/08/2026", "criado_por": None,
  "items": [{"id": 111, "label": "Quarto - Item 1", "ambiente": "Quarto", "fab": "real", "prod": "CORTINA ROLÔ",
             "fam": "BLACKOUT", "col": "BK Pinpoint", "w": 1.2, "h": 1.5, "qty": 1, "tabela": 485, "cartao": 461, "avista": 412,
             "detail": "ROLÔ BLACKOUT"}],
  "total_tabela": 485, "total_cartao": 461, "total_avista": 412}
rows = [antigo, {"id": 8, "numero": 4, "ref": "", "client": "Sem Tiny", "date": "01/10/2026", "items": [], "total_tabela": 0, "total_cartao": 0, "total_avista": 500, "criado_por": "Mirelle"}]
def rota(r):
    m = r.request.method
    if m == 'POST': posts.append(json.loads(r.request.post_data)); return r.fulfill(status=201, content_type='application/json', body='[{"id":99,"numero":6}]')
    if m == 'PATCH': patches.append(json.loads(r.request.post_data)); return r.fulfill(status=200, content_type='application/json', body='[{"id":7,"numero":5}]')
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
def dlg(d):
    dialogs.append(d.type + ': ' + d.message[:70].replace('\n', ' '))
    d.accept()
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', dlg)
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto(URL); pg.wait_for_timeout(1200); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.evaluate("irParaTab('calc')")
    pg.evaluate("document.getElementById('cli-nome').value='Ana Teste'; syncCliente()"); 

    def escolher(sel, chave):
        opts = pg.eval_on_selector(sel, 's=>[...s.options].filter(o=>o.value && !o.disabled).map(o=>o.value)')
        alvo = [o for o in opts if chave and chave.upper() in o.upper()] or opts
        pg.select_option(sel, alvo[0]); pg.wait_for_timeout(120)
    def item(amb, fab, cat, prod, fam, w, h):
        pg.evaluate("irParaTab('calc')")
        pg.fill('#item-ambiente', amb); pg.dispatch_event('#item-ambiente', 'input')
        pg.evaluate(f"selectFab('{fab}')"); pg.wait_for_timeout(150)
        escolher('#s-cat', cat); escolher('#s-prod', prod); escolher('#s-fam', fam); escolher('#s-col', '')
        pg.fill('#i-w', w); pg.fill('#i-h', h); pg.fill('#i-qty', '1'); pg.dispatch_event('#i-qty', 'input')
        pg.evaluate("calcular()"); pg.wait_for_timeout(300)
        av = pg.evaluate("STATE.lastResult && STATE.lastResult.avista")
        pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
        return av
    def item_cdp(amb, w):
        pg.evaluate("irParaTab('calc')")
        pg.fill('#item-ambiente', amb); pg.dispatch_event('#item-ambiente', 'input')
        pg.evaluate("selectFab('cdp')"); pg.wait_for_timeout(150)
        pg.select_option('#cdp-tipo', 'unica'); pg.wait_for_timeout(120); escolher('#cdp-cam1', '')
        pg.fill('#i-w', w); pg.fill('#i-h', '2.60'); pg.dispatch_event('#i-w', 'input')
        pg.evaluate("calcular()"); pg.wait_for_timeout(300)
        av = pg.evaluate("STATE.lastResult && STATE.lastResult.avista")
        pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
        return av

    vals = []
    vals.append(item('Sala', 'real', 'CORTINAS', 'ROL', 'BLACK', '2.40', '2.60'))

    vals.append(item('Sala', 'dec', '', 'ROMANA', '', '1.60', '1.80'))
    vals.append(item('Quarto Casal', 'dec', 'PERSIANA', 'VERTICAL', '', '2.00', '2.20'))
    vals.append(item('Quarto Casal', 'real', 'PERSIANA', 'HORIZONTAL', '', '1.20', '1.40'))
    vals.append(item('Escritório', 'dec', '', 'DOUBLE', '', '1.50', '1.60'))
    vals.append(item_cdp('Quarto Casal', '3.00'))
    cart = pg.evaluate("CART.map(i=>({amb:i.ambiente,label:i.label,fab:i.fab,prod:i.prod,av:i.avista,tab:i.tabela,car:i.cartao}))")
    grupos = pg.evaluate("[...document.querySelectorAll('#orc-resumo-painel > div')].map(d=>d.firstElementChild.textContent.trim())")
    resumo = pg.evaluate("document.getElementById('orc-resumo-valores').textContent")
    # duplica um item e remove outro
    pg.evaluate("duplicarItemCarrinho(CART[1].id)"); pg.wait_for_timeout(150)
    dup = pg.evaluate("CART[CART.length-1].label")
    pg.evaluate("removeFromCart(CART[CART.length-1].id)"); pg.wait_for_timeout(150)
    pg.evaluate("document.getElementById('orc-resumo-painel').style.display='block'; window.scrollTo(0,document.body.scrollHeight)")
    pg.evaluate("document.getElementById('orc-resumo-painel').scrollIntoView()"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{S}/2-resumo-ambientes.png')
    pg.evaluate("saveOrcamento()"); pg.wait_for_timeout(800)
    cart_depois = pg.evaluate("CART.length")
    import copy
    velho = copy.deepcopy(posts[0]['items'][0]); velho['full'].pop('accSelections', None); velho['full'].pop('extras', None)
    antigo['items'] = [velho]; antigo['total_avista'] = velho['avista']
    # reabrir orçamento antigo e editar o item
    pg.locator("button.tab-btn[data-tab=hist]").click(); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{S}/5-lista-numeros.png')
    pg.evaluate("document.getElementById('tab-historico') && 0"); pg.wait_for_timeout(100); pg.evaluate("reopenOrc(7)"); pg.wait_for_timeout(400)
    reaberto = pg.evaluate("({n:CART.length, editando:EDITING_ORC_ID, banner:document.getElementById('cart-editing-banner').textContent, tel:document.getElementById('cli-tel').value, tiny:document.getElementById('cli-tiny').value})")
    pg.evaluate("editarItemCarrinho(CART[0].id)"); pg.wait_for_timeout(500)
    restaurado = pg.evaluate("({fab:STATE.fab,prod:STATE.prod,col:STATE.col,w:document.getElementById('i-w').value})")
    pg.evaluate("calcular()"); pg.wait_for_timeout(300)
    dbg = pg.evaluate("({res:document.getElementById('result-wrap').className, last:STATE.lastResult&&STATE.lastResult.avista, ab:document.querySelector('.tab-panel.active').id, amb:STATE.ambiente})")
    print('DEBUG', dbg, dialogs[-3:])
    pg.evaluate("addToCart()"); pg.wait_for_timeout(300)
    pg.evaluate("saveOrcamento()"); pg.wait_for_timeout(800)
    # computador: resultado com aviso e botões das fábricas
    ctx.close()
    ctx = b.new_context(viewport={'width': 1366, 'height': 900})
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', dlg)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto(URL); pg.wait_for_timeout(1000); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.evaluate("document.getElementById('fb-real').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'{S}/3-fabricas-datas.png')
    ctx.close(); b.close()

print('valores à vista ao calcular:', vals)
print('carrinho:'); [print('  ', c) for c in cart]
print('grupos:', grupos)
print('resumo:', resumo)
soma = {k: sum(c[k] for c in cart) for k in ('av', 'tab', 'car')}
print('soma itens:', soma)
print('duplicado:', dup)
print('POST:', [(repr(x['ref']), x.get('telefone'), x.get('bairro'), x['client'], len(x['items']), x['total_avista'], x['total_tabela'], x['total_cartao'], sorted({i['ambiente'] for i in x['items']})) for x in posts])
print('carrinho após salvar:', cart_depois)
print('reaberto:', reaberto, 'restaurado:', restaurado)
print('PATCH:', [(x['ref'], len(x['items']), x['total_avista'], x['items'][0].get('ambiente')) for x in patches])
print('ERROS JS:', errs)
print('diálogos:'); [print('  ', d) for d in dialogs]
