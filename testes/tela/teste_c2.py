import json, sys
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]; dialogs=[]; posts=[]; patches=[]
rows=[{"id":3,"numero":5,"etapa":"orcamento","ref":"","client":"Cliente Antigo","bairro":"","telefone":"","date":"04/10/2026","criado_por":None,"total_tabela":1681,"total_cartao":1597,"total_avista":1429,"items":[{"id":1,"ambiente":"Sala","label":"Sala","fab":"real","avista":1429,"tabela":1681,"cartao":1597}]}]
def rota(r):
    m=r.request.method
    if m=='POST':
        b=json.loads(r.request.post_data); posts.append(b)
        out=dict(b, id=50, numero=9, created_at='2026-10-06'); return r.fulfill(status=201, content_type='application/json', body=json.dumps([out]))
    if m=='PATCH':
        patches.append((r.request.url.split('id=eq.')[-1], json.loads(r.request.post_data)))
        return r.fulfill(status=200, content_type='application/json', body=json.dumps([{"id":50,"numero":9}]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':360,'height':780}, device_scale_factor=2, service_workers='block')
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.type+': '+d.message[:70].replace('\n',' ')), d.accept()))
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1000); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.btn-novo-orc').click(); pg.wait_for_timeout(200)
    print('tela:', pg.evaluate("document.querySelector('.tab-panel.active').id"), '| barra cliente visível:', pg.is_visible('.cli-bar'), '| aba ativa:', pg.evaluate("(document.querySelector('.tab-btn.active')||{}).dataset"))
    pg.screenshot(path=f'{S}/c2-vazio.png', full_page=True)
    pg.locator('#novo-criar').click(); pg.wait_for_timeout(100)
    print('erro vazio:', pg.inner_text('#novo-erro'), '| foco:', pg.evaluate('document.activeElement.id'))
    pg.fill('#novo-nome','Maria Souza'); pg.type('#novo-tel','81988776655'); pg.fill('#novo-bairro','Boa Viagem')
    print('máscara:', pg.input_value('#novo-tel'))
    pg.locator('#novo-criar').click(); pg.wait_for_timeout(100)
    print('erro sem começo:', pg.inner_text('#novo-erro'))
    pg.locator('.novo-opcao[data-comeco=pre_orcamento]').click(); pg.locator('[data-origem=Instagram]').click()
    pg.locator('.novo-mais summary').click(); pg.fill('#novo-end','Rua A, 10'); pg.fill('#novo-email','maria@ex.com')
    pg.screenshot(path=f'{S}/c2-preenchido.png', full_page=True)
    pg.locator('#novo-criar').click(); pg.wait_for_timeout(600)
    print('POST:', {k:posts[0][k] for k in ('client','telefone','bairro','origem','como_comecou','etapa','ref','criado_por')} if posts else None)
    print('depois de criar → tela:', pg.evaluate("document.querySelector('.tab-panel.active').id"), '| editando:', pg.evaluate('EDITING_ORC_ID'),
          '| cliente:', pg.evaluate("[cli-nome,cli-tel,cli-bairro,cli-end,cli-email].map(x=>x.value)".replace('cli-nome',"document.getElementById('cli-nome')").replace('cli-tel',"document.getElementById('cli-tel')").replace('cli-bairro',"document.getElementById('cli-bairro')").replace('cli-end',"document.getElementById('cli-end')").replace('cli-email',"document.getElementById('cli-email')")),
          '| aviso:', pg.inner_text('#aviso-topo'))
    pg.screenshot(path=f'{S}/c2-criado.png')
    # adiciona um item e salva → deve ATUALIZAR o CDP-0009 (PATCH id 50), não criar outro
    def escolher(sel,k):
        o=pg.eval_on_selector(sel,'s=>[...s.options].filter(o=>o.value&&!o.disabled).map(o=>o.value)'); a=[x for x in o if k and k in x] or o; pg.select_option(sel,a[0]); pg.wait_for_timeout(120)
    pg.fill('#item-ambiente','Sala'); pg.dispatch_event('#item-ambiente','input'); pg.evaluate("selectFab('real')")
    escolher('#s-cat','CORTINAS'); escolher('#s-prod','ROL'); escolher('#s-fam','BLACK'); escolher('#s-col','')
    pg.fill('#i-w','2.40'); pg.fill('#i-h','2.60'); pg.dispatch_event('#i-h','input'); pg.evaluate('calcular()'); pg.wait_for_timeout(300)
    pg.evaluate("[...document.querySelectorAll('button.btn')].find(b=>b.textContent.includes('Adicionar ao orçamento')).click()"); pg.wait_for_timeout(300)
    print('barra:', pg.inner_text('#orc-resumo-contador'))
    pg.evaluate('saveOrcamento()'); pg.wait_for_timeout(600)
    print('POSTs totais:', len(posts), '| PATCH:', [(i, len(b['items']), b['total_avista'], b.get('telefone'), b.get('bairro')) for i,b in patches])
    # novo de novo, e cancelar
    pg.locator('.btn-novo-orc').click(); pg.wait_for_timeout(150)
    print('form limpo:', pg.input_value('#novo-nome')=='' and pg.input_value('#novo-tel')=='', '| opção marcada:', pg.locator('.novo-opcao.on').count())
    pg.locator('#tab-novo .novo-voltar').click(); pg.wait_for_timeout(300)
    print('cancelar → tela:', pg.evaluate("document.querySelector('.tab-panel.active').id"), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    # erro de conexão ao criar
    pg.unroute('**/rest/v1/orcamentos**'); pg.route('**/rest/v1/orcamentos**', lambda r: r.fulfill(status=500, body='x'))
    pg.locator('.btn-novo-orc').click(); pg.fill('#novo-nome','X'); pg.fill('#novo-tel','(81) 99999-9999'); pg.locator('.novo-opcao[data-comeco=visita_direta]').click()
    pg.locator('#novo-criar').click(); pg.wait_for_timeout(400)
    print('falha de conexão:', pg.inner_text('#novo-erro'), '| ainda na tela:', pg.evaluate("document.querySelector('.tab-panel.active').id"), '| botão ok:', pg.is_enabled('#novo-criar'))
    ctx.close(); b.close()
print('ERROS JS:', errs); print('diálogos:', dialogs)
