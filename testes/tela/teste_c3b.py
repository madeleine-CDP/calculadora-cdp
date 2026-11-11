import json, sys
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]; dialogs=[]; posts=[]; patches=[]; resposta={'confirm':True}
def item(i, amb, label, av):
    return {"id":i,"ambiente":amb,"label":label,"fab":"real","prod":"CORTINA ROLÔ","fam":"BLACKOUT","col":"BK Pinpoint","w":1.2,"h":1.5,"qty":1,
            "tabela":round(av/0.85),"cartao":round(round(av/0.85)*0.95),"avista":av,"detail":"ROLÔ BLACKOUT — COR A DEFINIR" if i==1 else "ROLÔ BLACKOUT BRANCO"}
rows=[{"id":7,"numero":5,"etapa":"orcamento","ref":"0999","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","date":"04/10/2026","criado_por":"Mirelle",
       "total_tabela":0,"total_cartao":0,"total_avista":824,"items":[item(1,"Sala","Sala",412), item(2,"Quarto Casal","Quarto Casal",412)]}]
def rota(r):
    m=r.request.method
    if m=='POST':
        b=json.loads(r.request.post_data); posts.append(b); return r.fulfill(status=201, content_type='application/json', body=json.dumps([dict(b,id=60,numero=10)]))
    if m=='PATCH':
        patches.append((r.request.url.split('id=eq.')[-1], json.loads(r.request.post_data))); return r.fulfill(status=200, content_type='application/json', body='[{"id":7,"numero":5}]')
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
def dlg(d):
    dialogs.append(d.type+': '+d.message[:60].replace('\n',' '))
    if d.type=='confirm' and not resposta['confirm']: d.dismiss()
    else: d.accept()
tela=lambda pg: pg.evaluate("document.body.dataset.tela")
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2, service_workers='block')
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', dlg)
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1000); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.hist-abrir').first.click(); pg.wait_for_timeout(300)
    print('1 abrir → tela:', tela(pg), '| nome:', pg.inner_text('#pasta-nome'), '| sub:', pg.inner_text('#pasta-sub'), '| itens:', pg.inner_text('#pasta-n'),
          '| barra cliente:', pg.is_visible('.cli-bar'), '| barra escura:', pg.is_visible('#orc-resumo-bar'), '| barra pasta:', pg.is_visible('.pasta-barra'),
          '| detalhe pendente aberto:', pg.locator('.pasta-detalhe[open]').count())
    pg.screenshot(path=f'{S}/c3b-pasta.png', full_page=True)
    pg.select_option('#pasta-etapa','enviado'); pg.wait_for_timeout(300)
    print('2 etapa → PATCH:', patches[-1], '| aviso:', pg.inner_text('#aviso-topo'))
    pg.locator('.pasta-add').click(); pg.wait_for_timeout(200)
    print('3 adicionar → tela:', tela(pg), '| barra escura:', pg.is_visible('#orc-resumo-bar'), pg.inner_text('#orc-resumo-contador').replace('\n',' '))
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
    pg.fill('#item-ambiente','Varanda'); pg.dispatch_event('#item-ambiente','input'); pg.evaluate("selectFab('dec')")
    escolher('#s-cat','CORTINAS'); escolher('#s-prod','ROL'); escolher('#s-fam',''); escolher('#s-col','')
    pg.fill('#i-w','1.60'); pg.fill('#i-h','1.80'); pg.dispatch_event('#i-h','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(300)
    av_novo = pg.evaluate('STATE.lastResult.avista')
    pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
    print('4 adicionado → tela:', tela(pg), '| itens:', pg.inner_text('#pasta-n'), '| sujo:', pg.evaluate('ORC_SUJO'), '| aviso:', pg.inner_text('#aviso-topo'))
    resposta['confirm']=False
    pg.locator('button.tab-btn[data-tab=hist]').click(); pg.wait_for_timeout(200)
    print('5 sair → janela aberta:', pg.is_visible('#modal-sair'), '| texto:', pg.inner_text('#modal-sair .modal-corpo'))
    pg.screenshot(path=S+'/sair-janela.png')
    pg.locator('#modal-sair [data-r=ficar]').last.click(); pg.wait_for_timeout(200)
    print('  continuar editando → tela:', tela(pg), '| itens:', pg.evaluate('CART.length'), '| janela fechou:', not pg.is_visible('#modal-sair'))
    resposta['confirm']=True
    pg.locator('.pasta-botoes button[title=Remover]').nth(1).click(); pg.wait_for_timeout(200)
    print('6 remover Quarto → itens:', pg.inner_text('#pasta-n'))
    pg.locator('.pasta-botoes button[title=Editar]').nth(1).click(); pg.wait_for_timeout(400)
    print('7 editar → tela:', tela(pg), '| ambiente restaurado:', pg.input_value('#item-ambiente'))
    pg.evaluate('calcular()'); pg.wait_for_timeout(300)
    pg.locator('#passo-avancar').click() if pg.evaluate('document.body.dataset.tela')=='calc' and pg.evaluate('PASSO')==4 else pg.evaluate('addToCart()'); pg.wait_for_timeout(300)
    print('   re-adicionado → tela:', tela(pg), '| itens:', pg.inner_text('#pasta-n'))
    pg.locator('#pasta-dados').click(); pg.wait_for_timeout(150)
    print('8 dados do cliente → barra cliente:', pg.is_visible('.cli-bar'))
    pg.fill('#cli-bairro','Pina'); pg.locator('#pasta-dados').click()
    print('   sub atualizado:', pg.inner_text('#pasta-sub'))
    pg.locator('.pasta-barra .btn-outline').click(); pg.wait_for_timeout(300)
    print('9 proposta → tela:', tela(pg), '| barra escura:', pg.is_visible('#orc-resumo-bar'))
    pg.locator('#orc-resumo-bar > div').first.click(); pg.wait_for_timeout(200)
    print('   barra escura → tela:', tela(pg))
    pg.screenshot(path=f'{S}/c3b-pasta-editada.png', full_page=True)
    pg.locator('#pasta-salvar').click(); pg.wait_for_timeout(800)
    last = patches[-1]
    print('10 salvar e fechar → tela:', tela(pg), '| PATCH id:', last[0], '| itens:', [(i['ambiente'], i['avista']) for i in last[1]['items']], '| total:', last[1]['total_avista'],
          '| bairro:', last[1].get('bairro'), '| mexeu em criado_por?', 'criado_por' in last[1], '| carrinho:', pg.evaluate('CART.length'), '| editando:', pg.evaluate('EDITING_ORC_ID'))
    print('   aviso:', pg.inner_text('#aviso-topo'), '| barra escura:', pg.is_visible('#orc-resumo-bar'))
    pg.screenshot(path=f'{S}/c3b-salvo.png')
    # fluxo novo orçamento → item → pasta → salvar
    pg.locator('.btn-novo-orc').click(); pg.fill('#novo-nome','Ana'); pg.fill('#novo-tel','(81) 99999-0000'); pg.fill('#novo-bairro','Boa Viagem'); pg.locator('.novo-opcao').first.click(); pg.locator('#novo-criar').click(); pg.wait_for_timeout(500)
    print('11 criado → tela:', tela(pg), '| passo:', pg.evaluate('PASSO'), '| contexto:', pg.inner_text('#passos-contexto'))
    pg.locator('#passo-voltar').click(); pg.wait_for_timeout(200)
    print('   pasta vazia:', pg.inner_text('#pasta-lista').replace('\n',' '), '| etapa:', pg.input_value('#pasta-etapa'))
    pg.locator('#pasta-salvar').click(); pg.wait_for_timeout(400)
    print('   salvar e fechar sem itens → tela:', tela(pg))
    print('largura:', pg.evaluate('document.documentElement.scrollWidth'), '| av novo item:', av_novo)
    ctx.close(); b.close()
print('ERROS JS:', errs); print('diálogos:'); [print('  ', d) for d in dialogs]
