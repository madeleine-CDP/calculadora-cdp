import json, sys
from playwright.sync_api import sync_playwright
errs=[]; dialogs=[]; posts=[]
it={"id":1,"ambiente":"Sala","label":"Sala","fab":"real","prod":"CORTINA ROLÔ","fam":"BLACKOUT","col":"BK Pinpoint","w":2.4,"h":2.6,"qty":1,"tabela":1681,"cartao":1597,"avista":1429,"detail":"ROLÔ","full":{"w":2.4,"h":2.6,"usedArea":6.24}}
rows=[{"id":9,"numero":9,"etapa":"pre_orcamento","ref":"","client":"Maria Souza","bairro":"Boa Viagem","telefone":"(81) 98877-6655","origem":"Instagram","como_comecou":"pre_orcamento","anterior_id":None,
       "date":"01/10/2026","criado_por":"Mirelle","total_tabela":1681,"total_cartao":1597,"total_avista":1429,"items":[it]},
      {"id":3,"numero":3,"etapa":"orcamento","ref":"","client":"Outro Cliente","bairro":"","telefone":"(81) 91111-2222","anterior_id":None,"date":"01/09/2026","criado_por":None,"total_tabela":0,"total_cartao":0,"total_avista":500,"items":[]}]
prox={'id':60,'num':10}
def rota(r):
    m=r.request.method
    if m=='POST':
        b=json.loads(r.request.post_data); posts.append(b)
        novo=dict(b,id=prox['id'],numero=prox['num']); prox['id']+=1; prox['num']+=1
        rows.insert(0,novo); return r.fulfill(status=201, content_type='application/json', body=json.dumps([novo]))
    if m=='PATCH':
        i=int(r.request.url.split('id=eq.')[-1]); b=json.loads(r.request.post_data)
        for x in rows:
            if x['id']==i: x.update(b)
        return r.fulfill(status=200, content_type='application/json', body=json.dumps([x for x in rows if x['id']==i]))
    r.fulfill(status=200, content_type='application/json', body=json.dumps(rows))
tela=lambda pg: pg.evaluate("document.body.dataset.tela")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':360,'height':780},device_scale_factor=2,service_workers='block')
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d:(dialogs.append(d.type+': '+d.message[:75].replace('\n',' ')), d.accept()))
    pg.route('**/rest/v1/orcamentos**', rota)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='#tab-calc#tab-calc[data-passo-atual] [data-passo][data-passo]:not(.zz):not(.zz){display:revert!important}';document.head.appendChild(st)})")  # TESTE_TODOS_PASSOS
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk-teste',refresh_token:'rf',expires_at:4102444800,email:'contato@centraldaspersianas.com',nome:'Bru',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(900); pg.evaluate("typeof switchTab==='function' && switchTab('hist')"); pg.wait_for_timeout(400)  # IR_LISTA
    pg.locator('.hist-card', has_text='Maria').locator('.hist-abrir').click(); pg.wait_for_timeout(300)
    print('1 pasta CDP-0009 | botão evoluir:', pg.inner_text('.pasta-evoluir').replace('\n',' | ') if pg.locator('.pasta-evoluir').count() else None, '| jornada visível:', pg.is_visible('#pasta-jornada'))
    pg.screenshot(path='shotsB/c3c-evoluir.png')
    pg.locator('.pasta-evoluir').click(); pg.wait_for_timeout(800)
    b0=posts[-1]
    print('2 evoluiu → POST anterior_id:', b0['anterior_id'], '| etapa:', b0['etapa'], '| itens copiados:', len(b0['items']), '| ids novos:', b0['items'][0]['id']!=1, '| total:', b0['total_avista'], '| origem:', b0['origem'], '| criado_por:', b0['criado_por'])
    print('   tela:', tela(pg), '| sub:', pg.inner_text('#pasta-sub'), '| etapa:', pg.input_value('#pasta-etapa'), '| aviso:', pg.inner_text('#aviso-topo'))
    print('   jornada:', pg.inner_text('#pasta-jornada').replace('\n',' | '))
    print('   botão agora:', pg.inner_text('.pasta-evoluir').split('\n')[0] if pg.locator('.pasta-evoluir').count() else None)
    pg.evaluate("document.getElementById('pasta-jornada').scrollIntoView({block:'center'})"); pg.wait_for_timeout(200)
    pg.screenshot(path='shotsB/c3c-jornada.png')
    pg.locator('#tab-orc .novo-voltar').click(); pg.wait_for_timeout(500)
    print('3 lista:', pg.inner_text('#hist-contagem'), '| card Maria antigo:', pg.locator('.hist-card[onclick="reopenOrc(9)"]').inner_text().replace('\n',' | '))
    print('   card novo:', pg.locator('.hist-card[onclick="reopenOrc(60)"]').inner_text().replace('\n',' | '))
    pg.screenshot(path='shotsB/c3c-lista.png', full_page=True)
    pg.locator('.hist-card[onclick="reopenOrc(9)"]').locator('.hist-abrir').click(); pg.wait_for_timeout(300)
    print('4 abrir antigo → aviso:', pg.inner_text('#pasta-evol').replace('\n',' '), '| botão evoluir:', pg.locator('.pasta-evoluir').count())
    pg.locator('.pasta-evol-aviso .btn-outline').click(); pg.wait_for_timeout(300)
    print('   abrir o novo pelo aviso →', pg.inner_text('#pasta-sub'))
    pg.locator('#tab-orc .novo-voltar').click(); pg.wait_for_timeout(300)
    # cliente repetido
    pg.locator('.btn-novo-orc').click(); pg.fill('#novo-nome','Maria S.'); pg.type('#novo-tel','81988776655'); pg.fill('#novo-bairro','Boa Viagem'); pg.locator('.novo-opcao').first.click()
    n=len(posts); pg.locator('#novo-criar').click(); pg.wait_for_timeout(400)
    print('5 repetido → criou?', len(posts)>n, '| aviso:', pg.inner_text('#novo-repetido').replace('\n',' | ')[:230])
    pg.screenshot(path='shotsB/c3c-repetido.png', full_page=True)
    pg.locator('.repetido-item .btn-outline').first.click(); pg.wait_for_timeout(300)
    print('   Abrir no aviso → tela:', tela(pg), pg.inner_text('#pasta-sub'))
    pg.locator('#tab-orc .novo-voltar').click(); pg.wait_for_timeout(300)
    pg.locator('.btn-novo-orc').click(); pg.fill('#novo-nome','Maria S.'); pg.type('#novo-tel','81988776655'); pg.fill('#novo-bairro','Boa Viagem'); pg.locator('.novo-opcao').first.click()
    pg.locator('#novo-criar').click(); pg.wait_for_timeout(300); pg.locator('.repetido-criar').click(); pg.wait_for_timeout(500)
    print('   mesmo assim → criou?', posts[-1]['client']=='Maria S.', '| tela:', tela(pg))
    # telefone diferente não avisa
    pg.evaluate("limparOrcamentoEmAndamento()"); pg.locator('.btn-novo-orc').click(); pg.fill('#novo-nome','Novo'); pg.type('#novo-tel','81977776666'); pg.fill('#novo-bairro','Boa Viagem'); pg.locator('.novo-opcao').first.click()
    n=len(posts); pg.locator('#novo-criar').click(); pg.wait_for_timeout(400)
    print('6 telefone novo → criou direto?', len(posts)>n, '| largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs); print('diálogos:', dialogs)
