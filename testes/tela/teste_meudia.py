# Meu dia (Início): mural da equipe, minhas tarefas e bloco de notas, com o banco SIMULADO (com as regras de permissão).
import json, sys, datetime as dt, re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today()
EMAIL={'Mirelle':'mi@x','Bruna':'b@x'}; PAPEL={'Mirelle':'atendimento','Bruna':'admin'}
QUEM=['Mirelle']
TAREFAS=[{'id':1,'dono':'mi@x','texto':'Separar mostruário','para_dia':hoje.isoformat(),'feita_em':None,'criada_em':agora.isoformat()},
         {'id':2,'dono':'mi@x','texto':'Ligar para a fábrica','para_dia':(hoje-dt.timedelta(days=1)).isoformat(),'feita_em':None,'criada_em':agora.isoformat()},
         {'id':3,'dono':'b@x','texto':'Tarefa da Bruna','para_dia':None,'feita_em':None,'criada_em':agora.isoformat()}]
MURAL=[{'id':10,'texto':'A Real só entrega às terças','fixado':True,'lembrar_em':None,'autor_email':'m@x','autor':'Madeleine','criado_em':(agora-dt.timedelta(days=10)).isoformat()},
       {'id':11,'texto':'Recado antigo','fixado':False,'lembrar_em':None,'autor_email':'b@x','autor':'Bruna','criado_em':(agora-dt.timedelta(days=9)).isoformat()},
       {'id':12,'texto':'Reunião de metas','fixado':False,'lembrar_em':(hoje+dt.timedelta(days=2)).isoformat(),'autor_email':'b@x','autor':'Bruna','criado_em':agora.isoformat()}]
NOTAS={}; nid=[100]
def eu(): return EMAIL[QUEM[0]]
def rest(route):
    r=route.request; u=r.url; m=r.method; q=parse_qs(urlparse(u).query)
    J=lambda st,b: route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
    if '/rest/v1/tarefas' in u:
        if m=='GET': return J(200,[t for t in TAREFAS if t['dono']==eu()])
        if m=='POST':
            b=json.loads(r.post_data); nid[0]+=1; t={'id':nid[0],'dono':eu(),'texto':b['texto'],'para_dia':b.get('para_dia'),'feita_em':b.get('feita_em'),'criada_em':agora.isoformat()}; TAREFAS.append(t); return J(201,[t])
        i=int(q['id'][0][3:]); t=[x for x in TAREFAS if x['id']==i and x['dono']==eu()]
        if m=='PATCH':
            if t: t[0].update(json.loads(r.post_data))
            return J(200,t)
        if m=='DELETE':
            TAREFAS[:]=[x for x in TAREFAS if not (x['id']==i and x['dono']==eu())]; return route.fulfill(status=204, body='')
    if '/rest/v1/mural' in u:
        if m=='GET': return J(200,MURAL)
        if m=='POST':
            b=json.loads(r.post_data); nid[0]+=1; x=dict(b, id=nid[0], autor_email=eu(), autor=QUEM[0], criado_em=agora.isoformat()); MURAL.insert(0,x); return J(201,[x])
        i=int(q['id'][0][3:]); x=[y for y in MURAL if y['id']==i and (y['autor_email']==eu() or PAPEL[QUEM[0]]=='admin')]
        if m=='PATCH':
            if x: x[0].update(json.loads(r.post_data))
            return J(200,x)
        if m=='DELETE':
            MURAL[:]=[y for y in MURAL if y not in x]; return J(200,x)
    if '/rest/v1/notas' in u:
        if m=='GET': return J(200,[NOTAS[eu()]] if eu() in NOTAS else [])
        b=json.loads(r.post_data); NOTAS[eu()]={'dono':eu(),'texto':b['texto']}; return J(201,[NOTAS[eu()]])
    J(200,[])
def fn(route): route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'configurado':True,'eventos':[],'lidas':0,'detalhes':0,'lidos':0,'faltam':0}))
def abrir(b, quem, w):
    QUEM[0]=quem
    pg=b.new_page(viewport={'width':w,'height':900},service_workers='block'); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', fn)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'%s',nome:'%s',papel:'%s',provisoria:false}))"%(EMAIL[quem],quem,PAPEL[quem]))
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2200); return pg
txt=lambda pg,sel: pg.inner_text(sel).replace('\n',' / ')
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=abrir(b,'Mirelle',360)
    print('1 mural:', txt(pg,'.md-mural')[:260])
    print('  apagar/fixar p/ Mirelle (recados de outros):', pg.locator('.md-mural >> text=apagar').count())
    print('2 tarefas:', txt(pg,'.md-tarefas')[:260])
    print('  vê tarefa da Bruna?', 'Tarefa da Bruna' in pg.inner_text('#inicio-meudia'))
    pg.fill('#md-tarefa-txt','Mandar fotos para a Ana'); pg.click('.md-form-tarefa .btn'); pg.wait_for_timeout(300)
    pg.locator('.md-tarefa', has_text='Separar').locator('.md-ck').click(); pg.wait_for_timeout(300)
    print('3 depois de adicionar e marcar:', txt(pg,'.md-tarefas .inicio-bloco-tit'), '| feita:', TAREFAS[0]['feita_em'] is not None)
    pg.locator('.md-tarefa', has_text='Mandar fotos').locator('.md-x').click(); pg.wait_for_timeout(300)
    print('  excluiu:', not any(t['texto']=='Mandar fotos para a Ana' for t in TAREFAS))
    pg.click('.aviso-desfazer'); pg.wait_for_timeout(300); print('  desfez:', any(t['texto']=='Mandar fotos para a Ana' for t in TAREFAS))
    pg.click('.md-mural >> text=+ Recado'); pg.fill('#md-recado-txt','Cliente da OS 1043 pediu instalação pela manhã'); pg.check('#md-recado-fixo'); pg.click('.md-form-recado .btn'); pg.wait_for_timeout(300)
    print('4 recado publicado:', MURAL[0]['texto'][:30], MURAL[0]['autor'], MURAL[0]['fixado'], '| botões no próprio:', pg.locator('.md-recado', has_text='Cliente da OS').locator('text=apagar').count())
    pg.click('.md-mural >> text=ver todos'); pg.wait_for_timeout(200); print('  ver todos:', pg.locator('.md-recado').count(), 'recados')
    pg.fill('#md-nota','Ana quer ver o Nápoles na cor Linho'); pg.wait_for_timeout(1400)
    print('5 nota salva:', NOTAS.get('mi@x',{}).get('texto'), '|', pg.inner_text('#md-nota-est'))
    pg.screenshot(path=f'{S}/shotsT/meudia_360.png', full_page=True)
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    pg.close()
    pg=abrir(b,'Bruna',1280)
    print('6 Bruna: nota da Mirelle?', 'Nápoles' in pg.inner_text('#inicio-notas'), '| tarefas:', txt(pg,'.md-lista'))
    print('  pode apagar recados:', pg.locator('.md-mural >> text=apagar').count())
    pg.locator('.md-recado', has_text='Cliente da OS').locator('text=desafixar').click(); pg.wait_for_timeout(300)
    print('  desafixou o da Mirelle:', [m for m in MURAL if 'OS 1043' in m['texto']][0]['fixado'])
    pg.screenshot(path=f'{S}/shotsT/meudia_1280.png', full_page=False)
    b.close()
print('ERROS JS:', errs)
