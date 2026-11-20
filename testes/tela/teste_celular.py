# Ajustes de celular: botão fixo de novo orçamento, blocos do Início que abrem e fecham (lembrados), faixa de urgentes.
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today()
TAREFAS=[{'id':1,'dono':'x@y.com','texto':'Ligar para a fábrica','para_dia':(hoje-dt.timedelta(days=1)).isoformat(),'feita_em':None,'criada_em':agora.isoformat()}]
RET=[{'id':1,'cliente':'A','assunto':'Mandar foto','responsavel':'Mirelle','prazo':(agora-dt.timedelta(days=1)).isoformat(),'status':'aberto','criado_em':agora.isoformat()}]
def rest(route):
    u=route.request.url
    for k,v in (('/tarefas',TAREFAS),('/retornos',RET)):
        if k in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(v))
    route.fulfill(status=200, content_type='application/json', body='[]')
def fn(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[],'lidas':0,'detalhes':0,'lidos':0,'faltam':0}))
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':360,'height':780}, service_workers='block')
    ctx.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    ctx.route('**/rest/v1/**', rest); ctx.route('**/functions/v1/**', fn)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2500)
    print('1 barra de baixo com +:', pg.is_visible('.tab-mais'), '| itens:', pg.locator('.tabs-nav .tab-btn:visible').all_inner_texts(), '| faixa do topo escondida:', not pg.is_visible('.tabs-nav .btn-novo-orc'), '| atalho grande escondido:', not pg.is_visible('.inicio-atalhos > .btn:first-child'))
    print('2 faixa urgentes:', pg.inner_text('#inicio-urgentes') if pg.locator('#inicio-urgentes').count() else None)
    blocos=pg.locator('#inicio-conteudo .dobravel'); print('  blocos dobráveis:', blocos.count())
    alvo=pg.locator('.dobravel', has_text='Minhas tarefas')
    alvo.locator('.inicio-bloco-tit').click(position={'x':10,'y':10}); pg.wait_for_timeout(300)
    print('3 fechou "Minhas tarefas":', 'fechado' in alvo.get_attribute('class'), '| lista some:', not pg.is_visible('.md-lista'))
    pg.reload(); pg.wait_for_timeout(2500)
    print('4 depois de recarregar continua fechado:', 'fechado' in pg.locator('.dobravel', has_text='Minhas tarefas').get_attribute('class'))
    pg.evaluate('celIrUrgente()'); pg.wait_for_timeout(700)   # a faixa ficou escondida (a fila única mostra os urgentes)
    print('5 "ver o primeiro" abre o bloco do urgente:', pg.locator('.inicio-pend-item.pend-atrasado, .md-tarefa.atrasada').first.is_visible())
    pg.screenshot(path=f'{S}/shotsT/celular_360.png', full_page=False)
    pg.click('.tab-mais'); pg.wait_for_timeout(300)
    print('6 "+" abre o menu:', pg.locator('.criar-op').all_inner_texts())
    pg.screenshot(path=f'{S}/shotsT/celular_mais.png', full_page=False)
    pg.click('.criar-op[data-acao=orc]'); pg.wait_for_timeout(600)
    print('  Novo orçamento → tela:', pg.evaluate('document.body.dataset.tela'), '| menu fechou:', pg.locator('#menu-criar').count()==0)
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    ctx.close()
    ctx=b.new_context(viewport={'width':1280,'height':900}, service_workers='block')
    ctx.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    ctx.route('**/rest/v1/**', rest); ctx.route('**/functions/v1/**', fn)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2500)
    pg.locator('.dobravel', has_text='Minhas tarefas').locator('.inicio-bloco-tit').click(position={'x':10,'y':10}); pg.wait_for_timeout(300)
    print('7 computador: menu lateral:', pg.evaluate("getComputedStyle(document.querySelector('.tabs-nav')).position"), '| + escondido:', not pg.is_visible('.tab-mais'), '| título não fecha bloco:', pg.is_visible('.md-lista'))
    b.close()
print('ERROS JS:', errs)
