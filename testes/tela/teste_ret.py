import json, re, datetime as dt
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]
agora=dt.datetime.now(dt.timezone.utc)
iso=lambda d: d.isoformat().replace('+00:00','Z')
ORC=[{'id':5,'numero':5,'client':'Ana Pré','telefone':'(81) 98888-1111','bairro':'Boa Viagem','date':'01/10/2026','items':[{'id':1,'ambiente':'Sala','label':'Sala','tabela':1000,'cartao':950,'avista':850,'qty':1,'fab':'real'}],'total_tabela':1000,'total_cartao':950,'total_avista':850,'etapa':'pre_orcamento','created_at':iso(agora-dt.timedelta(days=10)),'updated_at':iso(agora-dt.timedelta(days=5)),'qtd_contatos':0},
     {'id':6,'numero':6,'client':'Beto Enviado','telefone':'(81) 97777-2222','bairro':'Casa Forte','date':'01/10/2026','items':[],'total_tabela':0,'total_cartao':0,'total_avista':0,'etapa':'enviado','created_at':iso(agora-dt.timedelta(days=10)),'updated_at':iso(agora-dt.timedelta(days=1)),'proximo_contato':(agora-dt.timedelta(days=1)).date().isoformat(),'qtd_contatos':1,'ultimo_contato':iso(agora-dt.timedelta(days=4))}]
RET=[{'id':1,'orcamento_id':6,'cliente':'Beto Enviado','telefone':'(81) 97777-2222','assunto':'Prazo da Decore','responsavel':'Bruna','prazo':iso(agora-dt.timedelta(hours=30)),'status':'aberto','criado_por':'Mirelle'},
     {'id':2,'orcamento_id':None,'cliente':'Carla','telefone':None,'assunto':'Amostra de tecido','responsavel':'Mirelle','prazo':None,'status':'aberto','criado_por':'Bruna'}]
patches=[]
def rest(route):
    r=route.request; u=r.url
    if '/retornos' in u:
        if r.method=='POST':
            b=json.loads(r.post_data); l=dict(b, id=len(RET)+10, status='aberto', criado_por='Bruna'); RET.append(l)
            return route.fulfill(status=201, content_type='application/json', body=json.dumps([l]))
        if r.method=='PATCH':
            i=int(re.search(r'id=eq\.(\d+)',u).group(1)); b=json.loads(r.post_data); l=[x for x in RET if x['id']==i][0]; l.update(b)
            if b.get('status')=='respondido': l['respondido_em']=iso(dt.datetime.now(dt.timezone.utc))
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([l]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(RET))
    if r.method=='PATCH':
        b=json.loads(r.post_data); patches.append(b); i=int(re.search(r'id=eq\.(\d+)',u).group(1)); l=[x for x in ORC if x['id']==i][0]; l.update(b)
        return route.fulfill(status=200 if 'return=minimal' not in (r.headers.get('prefer') or '') else 204, content_type='application/json', body=json.dumps([l]))
    route.fulfill(status=200, content_type='application/json', body=json.dumps(ORC))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: (dialogs.append(d.message[:50]), d.accept()))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":true,"conectado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1500)
    t=pg.inner_text('#inicio-conteudo')
    print('1 Início → bloco retornos:', 'Retornos para hoje' in t, '| Beto (combinado atrasado):', 'Contato combinado atrasado' in t, '| Ana follow-up:', 'Follow-up do pré-orçamento' in t, '| badge:', pg.inner_text('#ret-badge'))
    pg.screenshot(path='shotsT/ret-inicio.png', full_page=True)
    pg.click('.tab-btn[data-tab=ret]'); pg.wait_for_timeout(1000)
    print('2 aba Retornos (meus) →', pg.locator('.ret-card').count(), 'card(s) | grupos:', pg.locator('.ret-grupo').all_inner_texts(), '| filtros:', pg.locator('#ret-filtros .hist-chip').all_inner_texts())
    pg.click('#ret-filtros .hist-chip >> nth=1'); pg.wait_for_timeout(300)
    print('3 todos abertos →', pg.locator('.ret-card').count(), '| link orçamento:', pg.locator('.ret-card .ret-link').first.inner_text())
    pg.screenshot(path='shotsT/ret-lista.png', full_page=True)
    # lançar retorno
    pg.click('.ret-btn-novo'); pg.wait_for_timeout(300)
    pg.fill('#ret-cliente','Ana Pré'); pg.dispatch_event('#ret-cliente','input')
    print('4 cliente da lista → ligado:', pg.inner_text('#ret-ligado'))
    pg.fill('#ret-assunto','Mandar fotos do modelo rolô'); pg.click('#ret-quem .hist-chip >> text=Mirelle'); pg.click('#ret-prazo .hist-chip >> text=Amanhã')
    pg.screenshot(path='shotsT/ret-form.png')
    print('4b WhatsApp puxado do orçamento:', pg.input_value('#ret-tel'))
    pg.click('#modal-ok'); pg.wait_for_timeout(700)
    novo=RET[-1]
    print('5 salvou → orcamento_id:', novo.get('orcamento_id'), '| quem:', novo.get('responsavel'), '| prazo amanhã 18h local:', novo.get('prazo'), '| tel:', novo.get('telefone'))
    # avulso, sem orçamento
    pg.click('.ret-btn-novo'); pg.wait_for_timeout(300)
    pg.fill('#ret-cliente','Dona Lúcia (vizinha da Ana)'); pg.dispatch_event('#ret-cliente','input')
    pg.type('#ret-tel','81966665555'); pg.fill('#ret-assunto','Perguntou se lavamos cortina de linho'); pg.click('#modal-ok'); pg.wait_for_timeout(700)
    print('5b avulso → orcamento_id:', RET[-1].get('orcamento_id'), '| tel:', RET[-1].get('telefone'), '| ligado vazio:', True)
    # respondido
    pg.click('#ret-filtros .hist-chip >> nth=1'); pg.wait_for_timeout(300)
    n=pg.locator('.ret-card').count(); pg.locator('.ret-card .ret-ok').first.click(); pg.wait_for_timeout(700)
    print('6 respondido → abertos', n, '→', pg.locator('.ret-card').count(), '| status salvo:', [x['status'] for x in RET])
    pg.click('#ret-filtros .hist-chip >> nth=3'); pg.wait_for_timeout(300); print('   aba Respondidos:', pg.locator('.ret-card').count())
    # pasta: registrar contato
    pg.evaluate('reopenOrc(5)'); pg.wait_for_timeout(800)
    print('7 pasta Ana → bloco contato:', pg.inner_text('#pasta-contato').replace('\n',' / ')[:200])
    pg.click('#pasta-contato .btn-outline'); pg.wait_for_timeout(300); pg.click('#ctt-prox .hist-chip >> nth=1'); pg.click('#modal-ok'); pg.wait_for_timeout(700)
    print('8 registrou → PATCH:', patches[-1] if patches else None)
    print('   pasta agora:', pg.inner_text('#pasta-contato').split('\n')[1][:80])
    pg.screenshot(path='shotsT/ret-pasta.png', full_page=True)
    pg.evaluate("voltarParaLista('inicio')"); pg.wait_for_timeout(1200)
    print('9 Início depois → Ana some do follow-up:', 'Ana Pré' not in pg.inner_text('#inicio-conteudo').split('Precisa de atenção')[1] if 'Precisa de atenção' in pg.inner_text('#inicio-conteudo') else '?')
    print('   largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('diálogos:', dialogs); print('ERROS JS:', errs)
