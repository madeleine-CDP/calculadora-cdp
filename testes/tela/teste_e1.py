import json, datetime as dt
from playwright.sync_api import sync_playwright
errs=[]
agora=dt.datetime.now(dt.timezone.utc)
iso=lambda dias: (agora-dt.timedelta(days=dias)).isoformat()
def o(i, nome, etapa, upd, av, extra={}):
    r={"id":i,"numero":i,"etapa":etapa,"ref":"","client":nome,"bairro":"Boa Viagem","telefone":"","date":"","criado_por":"Bru","total_tabela":0,"total_cartao":0,"total_avista":av,"items":[],
       "created_at":iso(upd+1),"updated_at":iso(upd),"anterior_id":None,"fechado_em":None,"motivo_perda":None}
    r.update(extra); return r
rows=[o(1,'Ana Pré 4 dias','pre_orcamento',4,1200), o(2,'Bia Pré 10 dias','pre_orcamento',10,900), o(3,'Caio Pré ontem','pre_orcamento',1,500),
      o(4,'Davi Orçamento parado','orcamento',5,3100), o(5,'Eva Enviado 6 dias','enviado',6,2200), o(6,'Fábio Visita','visita',2,0),
      o(7,'Gil Fechado','fechado',1,4500,{"fechado_em":iso(1)}), o(8,'Hugo Perdido','perdido',2,800,{"motivo_perda":"Preço"}),
      o(9,'Ivo Evoluído','pre_orcamento',20,700), o(10,'Ivo Novo','visita',0,750,{"anterior_id":9})]
with sync_playwright() as p:
    b=p.chromium.launch()
    for nome,vw in [('360',360),('desktop',1280)]:
        pg=b.new_page(viewport={'width':vw,'height':800},device_scale_factor=2 if vw<500 else 1,service_workers='block')
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
        pg.route('**/rest/v1/orcamentos**', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows)))
        pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
        pg.goto('http://localhost:8766/'); pg.wait_for_timeout(1200)
        print(nome, '| tela:', pg.evaluate('document.body.dataset.tela'), '| largura:', pg.evaluate('document.documentElement.scrollWidth'), '| cliente visível:', pg.is_visible('.cli-bar'))
        if nome=='360':
            print('  topo:', pg.inner_text('.inicio-topo').replace('\n',' | '))
            print('  em aberto:', pg.inner_text('.inicio-bloco >> nth=0').replace('\n',' | '))
            print('  atenção:'); [print('    -', t.replace('\n',' | ')) for t in pg.eval_on_selector_all('.inicio-pend-item','e=>e.map(x=>x.innerText)')]
            print('  mês:', pg.inner_text('.inicio-mes').replace('\n',' | '))
        pg.screenshot(path=f'shotsB/e1-inicio-{nome}.png', full_page=True)
        if nome=='360':
            pg.locator('.inicio-etapa', has_text='Pré-orçamento').click(); pg.wait_for_timeout(400)
            print('  toque em Pré-orçamento → tela:', pg.evaluate('document.body.dataset.tela'), '| filtro:', pg.evaluate('HIST_ETAPA'), '| cards:', pg.eval_on_selector_all('.hist-client','e=>e.map(x=>x.textContent)'))
            pg.locator('button.tab-btn[data-tab=inicio]').click(); pg.wait_for_timeout(400)
            pg.locator('.inicio-pend-item').first.click(); pg.wait_for_timeout(400)
            print('  toque na 1ª pendência → tela:', pg.evaluate('document.body.dataset.tela'), '|', pg.inner_text('#pasta-nome'))
            pg.locator('button.tab-btn[data-tab=inicio]').click(); pg.wait_for_timeout(400)
            print('  aba Início com orçamento aberto → tela:', pg.evaluate('document.body.dataset.tela'))
        pg.close()
    b.close()
print('ERROS JS:', errs)
