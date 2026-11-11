import json, re
from playwright.sync_api import sync_playwright
errs=[]; AJ=[]; posts=[]; patches=[]
ORC=[{'id':3,'numero':3,'client':'Cli Aberto','etapa':'orcamento','items':[{'fab':'dec','prod':'CORTINA ROLÔ','fam':'TRANSLÚCIDA','col':'Delta','avista':500,'tabela':588,'cartao':559}],'total_avista':500,'created_at':'2026-10-01T10:00:00Z','updated_at':'2026-10-06T10:00:00Z'}]
def rest(route):
    r=route.request; u=r.url
    if '/precos_ajustes' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); posts.append(b)
            for x in b: AJ.append(dict(x, ativo=True, criado_por='Bruna', criado_em='2026-10-07T11:00:00Z', id=len(AJ)+1))
            return route.fulfill(status=201, body='')
        if r.method=='PATCH':
            lote=re.search(r'lote=eq\.([\w-]+)',u).group(1); patches.append(lote)
            for x in AJ:
                if x['lote']==lote: x['ativo']=False
            return route.fulfill(status=204, body='')
        if 'ativo=eq.true' in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps([x for x in AJ if x['ativo']]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(list(reversed(AJ))))
    if '/retornos' in u: return route.fulfill(status=200, content_type='application/json', body='[]')
    route.fulfill(status=200, content_type='application/json', body=json.dumps(ORC))
def nova(b, papel):
    pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":true,"conectado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'%s',provisoria:false}))" % papel)
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1300); return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=nova(b,'atendimento'); pg.click('.usuario-nome'); pg.wait_for_timeout(500); print('1 Mirelle → tabelas em Configurações:', pg.locator('text=Abrir tabelas de preço').count()); pg.close()
    pg=nova(b,'admin')
    pg.click('.usuario-nome'); pg.wait_for_timeout(500); print('2 Bruna → botão em Configurações:', pg.locator('text=Abrir tabelas de preço').count())
    pg.click('text=Abrir tabelas de preço'); pg.wait_for_timeout(800)
    print('3 tela →', pg.evaluate('document.body.dataset.tela'), '|', pg.inner_text('.tp-versao'))
    pg.select_option('#tp-escopo', 'prod:CORTINA ROLÔ'); pg.fill('#tp-pct','6,5')
    pg.fill('#tp-busca','bandô box 90'); pg.dispatch_event('#tp-busca','input'); pg.wait_for_timeout(200)
    n=pg.locator('.tp-item').count(); print('4 busca acessório →', n, 'resultado(s):', pg.locator('.tp-item span').first.inner_text() if n else '-')
    pg.locator('.tp-item input').first.fill('200,00'); pg.locator('.tp-item input').first.dispatch_event('change'); pg.wait_for_timeout(200)
    print('   corrigidos:', pg.inner_text('#tp-editados').replace('\n',' / ')[:150])
    pg.fill('#tp-versao','Novembro/2026'); pg.fill('#tp-vig','2026-11-01')
    pg.screenshot(path='shotsT/tp-tela.png', full_page=True)
    pg.click('.tp-barra .btn'); pg.wait_for_timeout(400)
    print('5 relatório →', pg.inner_text('#modal-corpo').replace('\n',' / ')[:420])
    pg.screenshot(path='shotsT/tp-relatorio.png')
    antes=pg.evaluate("DB_DECORE['CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA'].cols.Delta.p")
    pg.click('#modal-ok'); pg.wait_for_timeout(1200)
    depois=pg.evaluate("DB_DECORE['CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA'].cols.Delta.p")
    print('6 salvou → linhas:', len(posts[0]) if posts else 0, '| Delta', antes, '→', depois, '| versão:', pg.evaluate("TABELAS_INFO.dec.tabela+' · '+TABELAS_INFO.dec.data"), '| painel não mexeu:', pg.evaluate("DB_DECORE['CORTINAS|CORTINA PAINEL|TRANSLÚCIDA'].subCols['Painel Manual'].Delta.p"))
    print('   histórico:', pg.inner_text('#tp-lotes').replace('\n',' / ')[:200])
    pg.click('#tp-lotes .btn-outline'); pg.wait_for_timeout(300); pg.click('#modal-ok'); pg.wait_for_timeout(1200)
    print('7 desfez → Delta:', pg.evaluate("DB_DECORE['CORTINAS|CORTINA ROLÔ|TRANSLÚCIDA'].cols.Delta.p"), '| versão:', pg.evaluate("TABELAS_INFO.dec.tabela"), '| histórico:', pg.inner_text('#tp-lotes').replace('\n',' / ')[:120])
    pg.fill('#tp-pct','55'); pg.click('.tp-barra .btn'); pg.wait_for_timeout(300)
    print('8 55% → bloqueado:', pg.evaluate("document.getElementById('modal').hidden"), '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
