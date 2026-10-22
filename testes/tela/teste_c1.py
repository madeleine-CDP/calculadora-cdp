import json, sys
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]; dialogs=[]
def linha(i, nome, etapa, bairro, ref, amb, av, por):
    return {"id": i, "numero": i, "etapa": etapa, "ref": ref, "client": nome, "bairro": bairro, "telefone": "(81) 98877-66"+str(i).zfill(2),
            "date": "0%d/10/2026" % (i%9+1), "criado_por": por, "total_tabela": av, "total_cartao": av, "total_avista": av,
            "items": [{"id": k, "ambiente": a, "label": a, "fab": "real", "avista": av//len(amb)} for k,a in enumerate(amb)]}
rows = [linha(8,'Maria Souza','pre_orcamento','Boa Viagem','',['Sala de estar','Quarto Casal'],2409,'Bru'),
        linha(7,'Ana Beatriz Cavalcanti de Albuquerque','enviado','Candeias','1042',['Sala','Quarto','Varanda'],4870,'Mirelle'),
        linha(6,'Carlos Lima','visita','Piedade','',['Sala'],1250,'Ricardo'),
        linha(5,'Paulo Mendes','fechado','Jaboatão','1031',['Sala','Escritório'],3120,'Bru'),
        linha(4,'José Antônio','perdido','Setúbal','',['Quarto'],980,'Mirelle'),
        linha(3,'Cliente Antigo','orcamento','','0999',['Sala'],1429,None)]
with sync_playwright() as p:
    b=p.chromium.launch()
    for nome, vw in [('360',360),('desktop',1280)]:
        ctx=b.new_context(viewport={'width':vw,'height':800}, device_scale_factor=2 if vw<500 else 1, service_workers='block')
        pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.message[:60]), d.accept()))
        pg.route('**/rest/v1/orcamentos**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows)))
        # antes do login: lista não pode carregar por trás
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(800); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
        if nome=='360':
            print('antes do login, cards:', pg.locator('.hist-card').count())
            pg.screenshot(path=f'{S}/c1-login.png')
        pg.evaluate("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1200); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
        print(nome, 'aba ativa:', pg.evaluate("document.querySelector('.tab-panel.active').id"), '| cards:', pg.locator('.hist-card').count(),
              '| contagem:', pg.inner_text('#hist-contagem'), '| largura:', pg.evaluate('document.documentElement.scrollWidth'),
              '| cliente visível:', pg.is_visible('.cli-bar'))
        pg.screenshot(path=f'{S}/c1-lista-{nome}.png', full_page=True)
        if nome=='360':
            print('chips:', pg.eval_on_selector_all('.hist-chip', 'e=>e.map(x=>x.textContent.trim())'))
            for termo in ['boa', 'BOA VIAGEM', '0005', '5', 'cdp-0007', 'jose', '1042', 'varanda', '887766', 'xyz']:
                pg.fill('#hist-busca', termo); pg.wait_for_timeout(80)
                print(f'  busca {termo!r}:', pg.eval_on_selector_all('.hist-client', 'e=>e.map(x=>x.textContent)'))
            pg.fill('#hist-busca',''); pg.locator('.hist-chip', has_text='Fechado').click(); pg.wait_for_timeout(80)
            print('  filtro Fechado:', pg.eval_on_selector_all('.hist-client', 'e=>e.map(x=>x.textContent)'))
            pg.screenshot(path=f'{S}/c1-filtro.png')
            pg.locator('.hist-chip', has_text='Todos').click()
            # trocar de aba e voltar
            pg.evaluate("switchTab('calc')"); pg.wait_for_timeout(100)
            print('  calc:', pg.evaluate("document.querySelector('.tab-panel.active').id"), 'sticky:', pg.is_visible('#sticky-actions'), 'cliente:', pg.is_visible('.cli-bar'),
                  'botão ativo:', pg.evaluate("(document.querySelector('.tab-btn.active')||{dataset:{tab:'(nenhum: calculadora fora do menu)'}}).dataset.tab"))
            pg.locator('button.tab-btn[data-tab=hist] .lbl-curto').click(); pg.wait_for_timeout(300)
            print('  volta lista (clicando no texto do botão):', pg.evaluate("document.querySelector('.tab-btn.active').dataset.tab"), 'sticky:', pg.is_visible('#sticky-actions'))
            # abrir um orçamento
            pg.locator('.hist-card', has_text='Paulo Mendes').locator('.hist-abrir').click(); pg.wait_for_timeout(300)
            print('  abrir Paulo → aba:', pg.evaluate("document.querySelector('.tab-panel.active').id"), 'editando:', pg.evaluate('EDITING_ORC_ID'))
            # novo orçamento

            pg.evaluate("novoOrcamento()"); pg.wait_for_timeout(200)
            print('  novo → aba:', pg.evaluate("document.querySelector('.tab-panel.active').id"), 'sticky:', pg.is_visible('#sticky-actions'))
            print('  Limpar tudo existe?', pg.locator('text=Limpar tudo').count())
        ctx.close()
    b.close()
print('ERROS JS:', errs); print('diálogos:', dialogs)
