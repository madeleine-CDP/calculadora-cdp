import json, sys, datetime as dt, urllib.parse as up
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
links=[{'id':1,'grupo':'guias','titulo':'Mensagens prontas','url':'https://docs.google.com/x','emoji':'💬','ordem':1,'copiar':False},
       {'id':2,'grupo':'guias','titulo':'Guia de Processos','url':'https://docs.google.com/y','emoji':'📘','ordem':2,'copiar':False},
       {'id':3,'grupo':'cliente','titulo':'Avaliação no Google','url':'https://g.page/x','emoji':'⭐','ordem':1,'copiar':True}]
nid=[10]
def rest(route):
    r=route.request; u=r.url
    if '/links_uteis' in u:
        if r.method=='GET': return route.fulfill(status=200, content_type='application/json', body=json.dumps(sorted(links,key=lambda x:(x['grupo'],x['ordem'],x['id']))))
        if r.method=='POST': b=json.loads(r.post_data); nid[0]+=1; b['id']=nid[0]; links.append(b); return route.fulfill(status=201, body='')
        i=int(u.split('id=eq.')[1])
        if r.method=='PATCH': [l for l in links if l['id']==i][0].update(json.loads(r.post_data)); return route.fulfill(status=204, body='')
        if r.method=='DELETE': links[:]=[l for l in links if l['id']!=i]; return route.fulfill(status=204, body='')
    route.fulfill(status=200, content_type='application/json', body='[]')
hoje=dt.date.today().isoformat()
def ag(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    if rota=='status': b={'configurado':True,'ok':True,'nome':'CLIENTES CDP'}
    else: b={'eventos':[{'id':'a','titulo':'[A CONFIRMAR] C - Visita - Ana Teste (Boa Viagem)','inicio':hoje+'T09:00:00-03:00','fim':hoje+'T10:00:00-03:00','diaInteiro':False,'descricao':''},
                        {'id':'b','titulo':'M- Beto Teste','inicio':hoje+'T23:00:00-03:00','fim':hoje+'T23:30:00-03:00','diaInteiro':False,'descricao':''}]}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    b={'configurado':True,'conectado':True,'conectadoPor':'Bruna','atualizadoEm':dt.datetime.now().isoformat()} if rota=='status' else {'lidos':0,'faltam':0}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
def rodar(nome, papel):
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
        pg.on('pageerror', lambda e: errs.append(nome+': '+str(e))); pg.on('dialog', lambda d: d.accept())
        pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/agenda/**', ag); pg.route('**/functions/v1/olist/**', olist)
        pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'%s',papel:'%s',provisoria:false}))"%(nome,papel))
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2000)
        tits=pg.locator('#inicio-conteudo .inicio-secao, #inicio-conteudo .inicio-bloco-tit > span:first-child').all_inner_texts()
        print(f'[{nome}] ordem:', ' | '.join(tits))
        print('  atalhos:', pg.locator('.inicio-atalhos button').all_inner_texts())
        print('  agenda hoje:', pg.inner_text('#inicio-agenda').replace('\n',' / ')[:160])
        print('  links:', pg.inner_text('#inicio-links').replace('\n',' / ')[:200], '| editar visível?', pg.locator('#inicio-links >> text=editar').count())
        pg.evaluate("navigator.clipboard.writeText=async(t)=>{window._c=t}")
        pg.locator('#inicio-links .lk-copiar').first.click(); pg.wait_for_timeout(200); print('  copiar avaliação →', pg.evaluate('window._c'))
        pg.screenshot(path=f'{S}/shotsT/cfg-inicio-{nome}.png', full_page=True)
        pg.locator('.usuario-nome').click(); pg.wait_for_timeout(1200)
        print('  config tela:', pg.evaluate('document.body.dataset.tela'), '| seções:', pg.locator('.cfg-tit').all_inner_texts())
        if papel=='admin':
            print('  conexões:', pg.inner_text('#cfg-conexoes').replace('\n',' / ')[:220])
            pg.locator('text=➕ Novo link').click(); pg.wait_for_timeout(200)
            pg.fill('#lk-titulo','Planilha CALC'); pg.fill('#lk-url','planilha'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(200)
            print('  link inválido →', pg.inner_text('#modal-erro'))
            pg.fill('#lk-url','https://docs.google.com/spreadsheets/z'); pg.locator('#modal-ok').click(); pg.wait_for_timeout(600)
            print('  incluiu:', [l['titulo']+':'+str(l.get('ordem')) for l in links if l['grupo']=='guias'])
            pg.locator('.cfg-link-item >> nth=1 >> text=▲').click(); pg.wait_for_timeout(600)
            print('  subiu Guia de Processos:', [l['titulo'] for l in sorted([l for l in links if l['grupo']=='guias'],key=lambda x:x['ordem'])])
            pg.locator('.cfg-link-item >> nth=0 >> text=editar').click(); pg.wait_for_timeout(200)
            pg.locator('text=tirar este link').click(); pg.wait_for_timeout(600)
            print('  tirou:', len(links), '| aviso:', pg.inner_text('#aviso-topo'))
            pg.locator('.aviso-desfazer').click(); pg.wait_for_timeout(600); print('  desfez → total', len(links))
            pg.screenshot(path=f'{S}/shotsT/cfg-config.png', full_page=True)
            pg.locator('text=Abrir tabelas de preço').click(); pg.wait_for_timeout(800)
            print('  tabelas:', pg.evaluate('document.body.dataset.tela'))
            pg.locator('#tab-precos .novo-voltar').click(); pg.wait_for_timeout(600); print('  voltar das tabelas →', pg.evaluate('document.body.dataset.tela'))
        print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
        b.close()
rodar('Mirelle','atendimento'); rodar('Bruna','admin')
print('ERROS JS:', errs)
