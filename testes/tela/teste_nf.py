import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1] if len(sys.argv)>1 else 'shotsN'; errs=[]
hoje=dt.date.today(); iso=lambda d: d.isoformat(); agora=dt.datetime.now(dt.timezone.utc)
def os_(i,cli,ent_dias,**k):
    o={'pedido_id':i,'numero':str(600+i),'cliente':cli,'celular':'(81) 99999-000%d'%i,'valor':2000,'situacao':6,'situacao_desde':agora.isoformat(),'data_prevista':None,
       'data_entrega':iso(hoje-dt.timedelta(days=ent_dias)),'numero_fabrica':'D23%02d'%i,'lido_em':agora.isoformat(),'em_maos_em':None,'avaliacao_em':None,'avaliacao_por':None,
       'nf_id':None,'nf_numero':None,'nf_situacao':None,'nf_enviada_em':None,'nf_enviada_por':None,'nf_fora_em':None,'nf_fora_por':None}
    o.update(k); return o
OS=[os_(1,'Ana SemNota',2), os_(2,'Beto ComNota',20,nf_id=91,nf_numero='1234',nf_situacao=6), os_(3,'Carla NotaPendente',5,nf_id=92,nf_numero='1235',nf_situacao=1),
    os_(4,'Davi Tudo Feito',4,nf_id=93,nf_numero='1236',nf_situacao=6,nf_enviada_em=agora.isoformat(),avaliacao_em=agora.isoformat()),
    os_(5,'Eva Empresa NotaAntes',1,nf_id=94,nf_numero='1200',nf_situacao=7), os_(6,'Fabi PorEmail',3,nf_id=95,nf_enviada_em=agora.isoformat(),nf_enviada_por='Olist (e-mail)')]
def rest(route):
    r=route.request; u=r.url; m=r.method
    if '/os_acompanhamento' in u:
        if m=='PATCH':
            i=int(u.split('pedido_id=eq.')[1]); o=[x for x in OS if x['pedido_id']==i][0]; b=json.loads(r.post_data)
            for k,v in b.items(): o[k]=v; o[k[:-3]+'_por']='Mirelle' if v else None
            return route.fulfill(status=200, content_type='application/json', body=json.dumps([o]))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps(OS))
    route.fulfill(status=200, content_type='application/json', body='[]')
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':800},service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.route('**/rest/v1/**', rest)
    pg.route('**/functions/v1/olist/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"lidas":5,"detalhes":0}'))
    pg.route('**/functions/v1/agenda/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{"configurado":false}'))
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Mirelle',papel:'atendimento',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2200)
    print('1 Início pedidos:', pg.inner_text('#inicio-pedidos').replace('\n',' | '))
    pg.evaluate("abrirPedidos('entregue')"); pg.wait_for_timeout(900)
    cards=pg.locator('.ped-card').all_inner_texts()
    print('2 entregues na tela:', len(cards))
    for c in cards: print('   -', c.replace('\n',' | ')[:230])
    pg.screenshot(path=S+'/nf-entregues.png', full_page=True)
    card=lambda nome: pg.locator('.ped-card', has_text=nome)
    card('Beto ComNota').locator('button', has_text='Já enviei a NF').click(); pg.wait_for_timeout(300)
    print('3 Beto enviei → some da lista?', card('Beto ComNota').count()==0, '| gravado:', OS[1]['nf_enviada_em'] is not None)
    card('Ana SemNota').locator('button', has_text='fora do Tiny').click(); pg.wait_for_timeout(300)
    print('4 Ana fora do Tiny →', card('Ana SemNota').inner_text().replace('\n',' | ')[:200])
    card('Ana SemNota').locator('.conf-ctrl', has_text='fora do Tiny').locator('button', has_text='desfazer').click(); pg.wait_for_timeout(300)
    print('5 desfazer → volta a emitir:', 'ainda não emitida' in card('Ana SemNota').inner_text(), '| nf_fora_em:', OS[0]['nf_fora_em'])
    print('6 Fabi:', card('Fabi PorEmail').inner_text().replace('\n',' | ')[:220])
    print('   chips:', pg.inner_text('#ped-filtros').replace('\n',' '))
    b.close()
print('ERROS JS:', errs)
