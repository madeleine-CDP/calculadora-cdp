# Campanhas de desconto das fábricas (Black November da Real), com banco SIMULADO. Valores conferidos no portal da Real em 21/11/2026.
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]; POSTS=[]
hoje=dt.date.today(); fim=(hoje+dt.timedelta(days=9)).isoformat(); ontem=(hoje-dt.timedelta(days=1)).isoformat()
BN={'id':'c1','nome':'Black November','fab':'real','desconto':40,'inicio':(hoje-dt.timedelta(days=20)).isoformat(),'fim':fim,'ativo':True,
    'regras':[{'prod':'CORTINA CELULAR','fam':'','col':''},{'prod':'PERSIANA HORIZONTAL','fam':'50MM — MADEIRA / BAMBU','col':'Bamb'}]}
VELHA={'id':'c0','nome':'Campanha Velha','fab':'real','desconto':50,'inicio':'2026-01-01','fim':ontem,'ativo':True,'regras':[{'prod':'CORTINA ROLÔ','fam':'','col':''}]}
CFG={'lista':[BN,VELHA]}
def rest(route):
    r=route.request; u=r.url
    J=lambda b,st=200: route.fulfill(status=st, content_type='application/json', body=json.dumps(b))
    if '/configuracoes' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); POSTS.append(b); CFG.update(b['valor']); return J([b],201)
        return J([{'chave':'campanhas','valor':CFG}] if 'campanhas' in u else [])
    J([])
CALC="""([fab,key,col,w,h])=>{ const [cat,prod,fam]=key.split('|');
 Object.assign(STATE,{fab,cat,prod,fam,col,w,h,qty:1,ambiente:'Sala',tubo:prod.includes('ROLÔ')?getTuboReal(w,h):null,reducao:false});
 window.alert=m=>{throw new Error(m)}; calcular(); const r=STATE.lastResult;
 return [r.totalGeral.toFixed(2), r.discPct, r.campanha&&r.campanha.nome]; }"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2500)
    print('1 campanhas carregadas:', pg.evaluate('CAMPANHAS.length'))
    casos=[('Celular BK Cocoon 1,50x1,80 (portal 990,65)',['real','CORTINAS|CORTINA CELULAR|BLACKOUT','BK Cocoon',1.5,1.8]),
           ('Bambu 1,20x1,40 (portal 535,14)',['real','PERSIANAS|PERSIANA HORIZONTAL|50MM — MADEIRA / BAMBU','Bambu c/ Cadarço',1.2,1.4]),
           ('Bamboo Eco 1,20x1,40 (portal 535,14)',['real','PERSIANAS|PERSIANA HORIZONTAL|50MM — MADEIRA / BAMBU','Bamboo Eco c/ Cadarço',1.2,1.4]),
           ('Madeira Sint. 1,20x1,40 (portal 731,81, sem campanha)',['real','PERSIANAS|PERSIANA HORIZONTAL|50MM — MADEIRA / BAMBU','Madeira Sintética c/ Cadarço',1.2,1.4]),
           ('Rolô BK Pinpoint 1,50x1,80 (campanha vencida → 317,02)',['real','CORTINAS|CORTINA ROLÔ|BLACKOUT','BK Pinpoint',1.5,1.8])]
    for n,c in casos: print('2', n, '→', pg.evaluate(CALC,c))
    pg.evaluate(CALC,casos[0][1])
    print('3 resultado mostra a campanha:', pg.evaluate("document.body.textContent.includes('Campanha Black November')"))
    print('4 proposta:', pg.evaluate("campTextoProposta([{full:{campanha:{nome:'Black November',fim:'%s'}}},{full:{}}])" % fim))
    print('  etiqueta vencida:', 'acabou' in pg.evaluate("campEtiquetaItem({full:{campanha:{nome:'X',fim:'%s'}}})" % ontem))
    # tela: cadastrar campanha nova
    pg.evaluate('abrirTabelasPreco()'); pg.wait_for_timeout(800)
    pg.locator('#tp-conteudo .hist-chip', has_text='Real').click(); pg.wait_for_timeout(300)
    print('5 tela lista:', pg.locator('#camp-bloco .camp-l b').all_inner_texts())
    pg.locator('#camp-bloco .camp-nova').click(); pg.wait_for_timeout(200)
    pg.fill('#camp-nome','Teste Decore'); pg.fill('#camp-desc','25'); pg.fill('#camp-fim', fim)
    pg.locator('.camp-regra select').first.select_option(index=1); pg.wait_for_timeout(200)
    pg.locator('.camp-form button[type=submit]').click(); pg.wait_for_timeout(400)
    print('  salvou:', len(POSTS), [c['nome'] for c in POSTS[-1]['valor']['lista']] if POSTS else '')
    pg.locator('#camp-bloco .conf-link', has_text='encerrar agora').first.click(); pg.wait_for_timeout(300)
    print('6 encerrar:', [ (c['nome'],c['ativo']) for c in POSTS[-1]['valor']['lista'] ])
    pg.screenshot(path=S+'/campanhas.png', full_page=True)
    print('ERROS JS:', errs); b.close()
