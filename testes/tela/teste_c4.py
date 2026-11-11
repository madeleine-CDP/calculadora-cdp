import json
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]; patches=[]
rows=[{"id":9,"numero":9,"etapa":"orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","anterior_id":None,"pedido_tiny":None,"fechado_em":None,"motivo_perda":None,
       "date":"01/10/2026","criado_por":"Mirelle","total_tabela":0,"total_cartao":0,"total_avista":0,"items":[]}]
def rota(r):
    m=r.request.method
    if m=='PATCH':
        i=int(r.request.url.split('id=eq.')[-1]); b=json.loads(r.request.post_data); patches.append(b)
        x=[x for x in rows if x['id']==i][0]
        if x['etapa']=='fechado' and b.get('etapa','fechado')=='fechado' and 'items' in b and b['items']!=x['items']:
            return r.fulfill(status=400, content_type='application/json', body='{"message":"Orçamento CDP-0009 está fechado. Reabra antes de alterar itens ou valores."}')
        if b.get('etapa')=='fechado' and x['etapa']!='fechado': b['fechado_em']='2026-10-06T21:30:00Z'
        if 'etapa' in b and b['etapa']!='fechado': b['fechado_em']=None
        x.update(b); return r.fulfill(status=200, content_type='application/json', body=json.dumps([x]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},device_scale_factor=2,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.type+': '+d.message[:70].replace('\n',' ')), d.accept()))
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(300)
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
    def calc_add(amb, prod, w):
        pg.locator('.pasta-add').click(); pg.fill('#item-ambiente',amb); pg.dispatch_event('#item-ambiente','input'); pg.evaluate("selectFab('real')")
        escolher('#s-cat','CORTINAS'); escolher('#s-prod',prod); escolher('#s-fam','BLACK'); escolher('#s-col','')
        pg.fill('#i-w',w); pg.fill('#i-h','2.00'); pg.dispatch_event('#i-h','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(250)
        pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
    calc_add('Sala','ROL','2.00'); calc_add('Quarto','ROL','1.50')
    antes = pg.evaluate("CART.map(i=>[i.label,i.w,i.avista])")
    print('itens:', antes)
    # EDITAR: item continua no lugar; desistir não muda nada
    pg.locator('.pasta-botoes button[title=Editar]').first.click(); pg.wait_for_timeout(400)
    print('1 editando → itens no orçamento:', pg.evaluate('CART.length'), '| botão:', pg.inner_text('button.btn[onclick="addToCart()"]'))
    pg.locator('.passos-ver').click(); pg.wait_for_timeout(200)
    print('  desistiu → itens:', pg.evaluate("CART.map(i=>[i.label,i.w,i.avista])")==antes, '| botão voltou:', pg.inner_text('button.btn[onclick="addToCart()"]'))
    pg.locator('.pasta-botoes button[title=Editar]').first.click(); pg.wait_for_timeout(400)
    pg.fill('#i-w','2.40'); pg.dispatch_event('#i-w','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(250)
    pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
    print('2 substituiu →', pg.evaluate("CART.map(i=>[i.label,i.w,i.avista])"), '| aviso:', pg.inner_text('#aviso-topo'))
    # FECHAR
    pg.locator('.btn-fechar-orc').click(); pg.wait_for_timeout(200)
    print('3 janela:', pg.inner_text('#modal-titulo'), '| visível:', pg.is_visible('#modal'))
    pg.screenshot(path='shotsB/c4-modal-fechar.png')
    pg.fill('#modal-pedido','1234'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(400)
    last=patches[-1]
    print('  PATCH:', {k:last[k] for k in ('etapa','pedido_tiny')}, '| itens gravados:', len(last['items']), '| total:', last['total_avista'])
    print('  faixa:', pg.inner_text('#pasta-status').replace('\n',' | '))
    print('  travado → adicionar visível:', pg.is_visible('.pasta-add'), '| botões item:', pg.is_visible('.pasta-botoes'), '| detalhe somente leitura:', pg.evaluate("document.querySelector('#pasta-lista textarea').readOnly"),
          '| etapa desabilitada:', pg.is_disabled('#pasta-etapa'), '| botão de baixo:', pg.inner_text('#pasta-salvar'), '| encerrar:', pg.locator('.pasta-encerrar').count())
    pg.screenshot(path='shotsB/c4-fechado.png', full_page=True)
    # banco recusa mudar itens de fechado (mesmo forçando)
    pg.evaluate("CART[0].avista=1; ORC_SUJO=true"); pg.evaluate('salvarEFechar()'); pg.wait_for_timeout(500)
    print('4 forçando mudança em fechado → tela:', pg.evaluate('document.body.dataset.tela'), '| último diálogo:', dialogs[-1])
    pg.evaluate("ORC_SUJO=false; reopenOrc(9)"); pg.wait_for_timeout(300)
    # nº do pedido
    pg.locator('.pasta-fechado-acoes .btn-outline').first.click(); pg.fill('#modal-pedido','5678'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(300)
    print('5 pedido alterado → PATCH:', patches[-1], '| faixa:', pg.inner_text('.pasta-fechado-sub'))
    # REABRIR
    pg.locator('.pasta-fechado-acoes .btn-outline').nth(1).click(); pg.wait_for_timeout(400)
    print('6 reabrir → PATCH:', patches[-1], '| adicionar visível:', pg.is_visible('.pasta-add'), '| etapa:', pg.input_value('#pasta-etapa'), '| encerrar:', pg.locator('.pasta-encerrar').count())
    # PERDIDO
    pg.locator('.btn-perdido').click(); pg.wait_for_timeout(200); pg.locator('#modal-ok').click(); pg.wait_for_timeout(150)
    print('7 perdido sem motivo →', pg.inner_text('#modal-erro'))
    pg.locator('.motivo', has_text='Outro').click(); pg.locator('#modal-ok').click(); pg.wait_for_timeout(150)
    print('  Outro sem texto →', pg.inner_text('#modal-erro'), '| campo aparece:', pg.is_visible('#modal-outro'))
    pg.screenshot(path='shotsB/c4-modal-perdido.png')
    pg.locator('.motivo', has_text='Preço').click(); pg.locator('#modal-ok').click(); pg.wait_for_timeout(400)
    print('  Preço → PATCH:', {k:patches[-1][k] for k in ('etapa','motivo_perda')}, '| faixa:', pg.inner_text('.pasta-fechado-tit'))
    pg.locator('#pasta-salvar').click(); pg.wait_for_timeout(500)
    print('8 lista:', pg.inner_text('#hist-contagem'), '|', pg.inner_text('.hist-card').replace('\n',' | '), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs); print('diálogos:'); [print('  ',d) for d in dialogs]
