import json
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]; reqs=[]
estado={'senha':'provisoria123','provisoria':True,'expirar_uma_vez':False,'renovou':0}
def auth(route):
    r=route.request; url=r.url
    if '/auth/v1/token?grant_type=password' in url:
        b=json.loads(r.post_data)
        ok = b['email']=='operacao.centraldaspersianas@gmail.com' and b['password']==estado['senha']
        if not ok: return route.fulfill(status=400, content_type='application/json', body='{"error":"invalid_grant","error_description":"Invalid login credentials"}')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'access_token':'tk1','refresh_token':'rf1','expires_in':3600,'user':{'email':b['email']}}))
    if '/auth/v1/token?grant_type=refresh_token' in url:
        estado['renovou']+=1
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'access_token':'tk2','refresh_token':'rf2','expires_in':3600,'user':{'email':'operacao.centraldaspersianas@gmail.com'}}))
    if url.endswith('/auth/v1/user') and r.method=='PUT':
        assert r.headers.get('authorization','').startswith('Bearer tk'), r.headers
        estado['senha']=json.loads(r.post_data)['password']
        return route.fulfill(status=200, content_type='application/json', body='{}')
    if '/auth/v1/logout' in url: return route.fulfill(status=204, body='')
    route.fulfill(status=404, body='')
def rest(route):
    r=route.request; reqs.append((r.method, r.url.split('/rest/v1/')[1][:40], r.headers.get('authorization','')))
    if '/perfis' in r.url:
        if r.method=='PATCH': estado['provisoria']=False; return route.fulfill(status=204, body='')
        return route.fulfill(status=200, content_type='application/json', body=json.dumps([{'nome':'Mirelle','papel':'atendimento','senha_provisoria':estado['provisoria']}]))
    if estado['expirar_uma_vez']:
        estado['expirar_uma_vez']=False
        return route.fulfill(status=401, content_type='application/json', body='{"message":"JWT expired"}')
    route.fulfill(status=200, content_type='application/json', body='[]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':760},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: (dialogs.append(d.message[:60]), d.accept()))
    pg.route('**/auth/v1/**', auth); pg.route('**/rest/v1/**', rest)
    pg.add_init_script("if(!sessionStorage.getItem('x')){localStorage.setItem('cdp_sessao', JSON.stringify({nome:'Bru',login:'t'}));sessionStorage.setItem('x','1')}")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(800)
    vis=lambda s: pg.evaluate(f"(()=>{{const e=document.querySelector('{s}');return !!e && getComputedStyle(e).display!=='none' && !e.hidden && e.offsetParent!==null}})()")
    print('1 sessão antiga → tela de login?', vis('#login-form'), '| cdp_sessao apagada?', pg.evaluate("localStorage.getItem('cdp_sessao')") is None)
    pg.fill('#login-user','mirelle'); pg.fill('#login-pass','errada'); pg.click('#login-btn'); pg.wait_for_timeout(400)
    print('2 senha errada →', pg.inner_text('#login-erro'))
    pg.fill('#login-user','Operacao@cdaspersianas'); pg.fill('#login-pass','provisoria123'); pg.click('#login-btn'); pg.wait_for_timeout(600)
    print('3 primeiro acesso → tela de criar senha?', vis('#senha-form'), '|', pg.inner_text('#senha-titulo'), '| cancelar escondido?', not vis('#senha-cancelar'))
    pg.fill('#senha-nova','abc'); pg.fill('#senha-conf','abc'); pg.click('#senha-btn'); pg.wait_for_timeout(200)
    print('4 senha curta →', pg.inner_text('#senha-erro'))
    pg.fill('#senha-nova','minhasenha9'); pg.fill('#senha-conf','minhasenha8'); pg.click('#senha-btn'); pg.wait_for_timeout(200)
    print('5 diferentes →', pg.inner_text('#senha-erro'))
    pg.fill('#senha-conf','minhasenha9'); pg.click('#senha-btn'); pg.wait_for_timeout(800)
    print('6 salvou → login some?', not vis('#login-screen'), '| senha no "servidor":', estado['senha']=='minhasenha9', '| provisória desligada:', not estado['provisoria'])
    print('   tela:', pg.evaluate("document.body.dataset.tela"), '| nome no topo:', pg.inner_text('#usuario-logado'), '| saudação:', pg.inner_text('.inicio-topo .hist-titulo'))
    print('   token nas consultas:', sorted(set(a for m,u,a in reqs if u.startswith('orcamentos'))))
    pg.evaluate("localStorage.setItem('cdp_auth', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('cdp_auth')),{expires_at: Math.floor(Date.now()/1000)+30})))")
    pg.reload(); pg.wait_for_timeout(1000)
    print('7 token quase vencido → renovou sozinho:', estado['renovou'], '| última consulta com:', [a for m,u,a in reqs if u.startswith('orcamentos')][-1])
    estado['expirar_uma_vez']=True; pg.evaluate("switchTab('hist')"); pg.wait_for_timeout(800)
    print('8 banco recusou (401) → renovou e repetiu:', estado['renovou'], '| lista ok:', pg.inner_text('#hist-list')[:40])
    pg.evaluate("mostrarTrocaSenha(false)"); pg.wait_for_timeout(200)
    print('9 trocar senha pelo topo →', pg.inner_text('#senha-titulo'), '| cancelar visível:', vis('#senha-cancelar'))
    pg.click('#senha-cancelar'); pg.wait_for_timeout(200); print('   cancelou → login some:', not vis('#login-screen'))
    pg.click('.btn-sair'); pg.wait_for_timeout(800)
    print('10 sair → tela de login:', vis('#login-form'), '| sessão apagada:', pg.evaluate("localStorage.getItem('cdp_auth')") is None)
    pg.fill('#login-user','mirelle'); pg.fill('#login-pass','minhasenha9'); pg.click('#login-btn'); pg.wait_for_timeout(800)
    print('11 entra com a senha nova, sem pedir troca:', not vis('#login-screen'), '| sw:', pg.evaluate("document.documentElement.scrollWidth"))
    b.close()
print('diálogos:', dialogs); print('ERROS JS:', errs)
