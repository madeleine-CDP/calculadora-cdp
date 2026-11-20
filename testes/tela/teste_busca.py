# Busca única (topo) e histórico do cliente, com banco, Olist e Agenda SIMULADOS. Computador (1280) e celular (360).
import json, sys, datetime as dt
from playwright.sync_api import sync_playwright
S=sys.argv[1]; errs=[]
agora=dt.datetime.now(dt.timezone.utc); hoje=dt.date.today(); iso=lambda d: d.isoformat()
ORCS=[{'id':31,'ref':'','client':'Maria Exemplo Teste','date':'','items':[],'total_tabela':4550,'total_cartao':4320,'total_avista':3870.3,'created_at':(agora-dt.timedelta(days=16)).isoformat(),
       'criado_por':'Mirelle','telefone':'(81) 90000-0000','bairro':'Boa Viagem','cidade':'Recife','uf':'PE','numero':31,'etapa':'fechado','fechado_em':(agora-dt.timedelta(days=11)).isoformat(),
       'pedido_tiny':'1043','updated_at':agora.isoformat(),'ultimo_contato':(agora-dt.timedelta(days=12)).isoformat(),'qtd_contatos':2,'motivo_perda':''},
      {'id':19,'ref':'','client':'Maria Exemplo Teste','date':'','items':[],'total_tabela':1500,'total_cartao':1400,'total_avista':1240,'created_at':'2025-08-01T12:00:00Z','criado_por':'Bruna',
       'telefone':'81900000000','bairro':'Boa Viagem','cidade':'Recife','uf':'PE','numero':19,'etapa':'perdido','updated_at':'2025-08-20T12:00:00Z','motivo_perda':'preço','qtd_contatos':3},
      {'id':40,'ref':'','client':'Outra Pessoa','date':'','items':[],'total_tabela':900,'total_cartao':850,'total_avista':800,'created_at':agora.isoformat(),'telefone':'(81) 98888-7777','numero':40,'etapa':'orcamento'}]
OS=[{'pedido_id':77,'numero':'1043','cliente':'Maria Exemplo Teste','celular':'(81) 90000-0000','valor':3870.3,'situacao':7,'situacao_desde':agora.isoformat(),'data_venda':iso(hoje-dt.timedelta(days=9)),
     'data_prevista':iso(hoje+dt.timedelta(days=5)),'data_entrega':None,'numero_fabrica':'D2310','lido_em':agora.isoformat(),'entrada_validado_em':(agora-dt.timedelta(days=8)).isoformat(),'entrada_validado_por':'Madeleine (marcado por Bruna)',
     'saldo_modo':None,'saldo_comprovante_em':agora.isoformat(),'saldo_comprovante_por':'Mirelle','saldo_validado_em':None,'saldo_validado_por':None}]
RET=[{'id':5,'cliente':'Maria Exemplo Teste','telefone':'(81) 90000-0000','assunto':'Enviar foto da cor Creme','responsavel':'Mirelle','prazo':iso(hoje+dt.timedelta(days=1)),'status':'aberto','criado_por':'Bruna','criado_em':(agora-dt.timedelta(days=1)).isoformat()}]
GAR=[{'id':2,'cliente':'Maria Exemplo Teste','telefone':'81900000000','pedido_numero':'712','relato':'motor não responde','status':'resolvido','solucao':'Decore trocou o motor','criado_em':'2024-10-22T12:00:00Z'}]
def rest(route):
    u=route.request.url
    for k,v in (('/orcamentos',ORCS),('/os_acompanhamento',OS),('/retornos',RET),('/garantias',GAR)):
        if k in u: return route.fulfill(status=200, content_type='application/json', body=json.dumps(v))
    route.fulfill(status=200, content_type='application/json', body='[]')
hist_chamado=[]
def olist(route):
    rota=route.request.url.rstrip('/').split('/')[-1]; b=json.loads(route.request.post_data or '{}')
    if rota=='buscar': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'clientes':[
        {'id':900,'nome':'Maria Exemplo Teste','celular':'(81) 90000-0000','cpfCnpj':'000.000.000-00','bairro':'Boa Viagem','cidade':'Recife/PE'},
        {'id':901,'nome':'Mario Exemplo Teste','celular':'(81) 91111-1111','bairro':'Casa Forte','cidade':'Recife/PE'}]}))
    if rota=='historico':
        hist_chamado.append(b)
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'cliente':{'id':900,'nome':'Maria Exemplo Teste','cpfCnpj':'000.000.000-00','email':'maria@exemplo.com','celular':'(81) 90000-0000','endereco':'Rua Exemplo, 100','bairro':'Boa Viagem','cidade':'Recife/PE'},
          'pedidos':[{'id':77,'numero':'1043','data':iso(hoje-dt.timedelta(days=9)),'valor':3870.3,'situacaoCod':7,'situacao':'Pronto para envio','itens':[{'descricao':'DECORE – ROLÔ BK NÁPOLES','tipo':'P','quantidade':2},{'descricao':'CDP – INSTALAÇÃO','tipo':'S','quantidade':1}],'dataEntrega':None,'numeroFabrica':'D2310','nf':False},
                     {'id':50,'numero':'712','data':'2024-09-01','valor':2140,'situacaoCod':6,'situacao':'Entregue','itens':[{'descricao':'Horizontal 25mm motorizada','tipo':'P','quantidade':1}],'dataEntrega':'2024-09-16','numeroFabrica':'D1638','nf':True},
                     {'id':20,'numero':'388','data':'2023-05-10','valor':1850,'situacaoCod':6,'situacao':'Entregue','itens':[{'descricao':'Rolô Blackout','tipo':'P','quantidade':2}],'dataEntrega':'2023-05-20','numeroFabrica':None,'nf':True},
                     {'id':21,'numero':'389','data':'2023-05-11','valor':500,'situacaoCod':2,'situacao':'Cancelada','itens':[],'dataEntrega':None,'numeroFabrica':None,'nf':False}]}))
    if rota=='pedido': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'pedido':{'id':77,'numero':'1043','cliente':{'nome':'Maria Exemplo Teste'},'itens':[],'subtotal':0,'desconto':0,'total':3870.3,'pagamento':{'parcelas':[]},'observacoes':'','observacoesInternas':''}}))
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'lidas':0,'detalhes':0}))
def ag(route):
    rota=route.request.url.rstrip('/').split('/')[-1]
    b={'configurado':True,'ok':True} if rota=='status' else {'eventos':[{'id':'e1','titulo':'C - Instalação - Maria Exemplo (Boa Viagem)','inicio':iso(hoje+dt.timedelta(days=6))+'T09:00:00-03:00','diaInteiro':False,'descricao':''},
        {'id':'e2','titulo':'C - Visita - Maria Exemplo (Boa Viagem)','inicio':iso(hoje-dt.timedelta(days=14))+'T10:00:00-03:00','diaInteiro':False,'descricao':''}]}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(b))
def abrir(b, w):
    pg=b.new_page(viewport={'width':w,'height':900},service_workers='block'); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/rest/v1/**', rest); pg.route('**/functions/v1/olist/**', olist); pg.route('**/functions/v1/agenda/**', ag)
    pg.add_init_script("localStorage.setItem('cdp_auth', JSON.stringify({access_token:'tk',refresh_token:'rf',expires_at:4102444800,email:'x@y.com',nome:'Bruna',papel:'admin',provisoria:false}))")
    pg.goto('http://localhost:8766/'); pg.wait_for_timeout(2000); return pg
with sync_playwright() as p:
    b=p.chromium.launch()
    pg=abrir(b,1280)
    pg.fill('#busca-in','maria ex'); pg.wait_for_timeout(1200)
    print('1 lista:', pg.inner_text('#busca-lista').replace('\n',' / ')[:420])
    pg.fill('#busca-in','D2310'); pg.wait_for_timeout(900); print('2 por nº fábrica:', pg.inner_text('#busca-lista').replace('\n',' / ')[:200])
    pg.fill('#busca-in','90000'); pg.wait_for_timeout(900); print('3 por telefone:', pg.inner_text('#busca-lista').replace('\n',' / ')[:200])
    pg.fill('#busca-in','cdp-0019'); pg.wait_for_timeout(900); print('4 por CDP:', pg.inner_text('#busca-lista').replace('\n',' / ')[:160])
    pg.fill('#busca-in','maria ex'); pg.wait_for_timeout(1200)
    pg.locator('#busca-lista .bs-res').first.click(); pg.wait_for_timeout(1500)
    print('5 tela:', pg.evaluate('document.body.dataset.tela'), '| historico pediu:', hist_chamado[-1] if hist_chamado else None)
    t=pg.inner_text('#cli-conteudo')
    for k in ['Maria Exemplo Teste','Cliente desde','CPF 000.000.000-00','maria@exemplo.com','Em aberto' if False else 'Pagamento','OS 1043','Retorno','Instalação','Histórico','Pedido de venda nº 712','OS 712 entregue','Orçamento CDP-0019 perdido','preço','Chamado de garantia','Visita','2023','O que já tem em casa','Horizontal 25mm motorizada','fora da garantia','Total comprado','R$ 7.860']:
        if k not in t: print('  FALTA:', k)
    print('  cancelado fora do total:', 'R$ 8.360' not in t, '| instalação fora do "em casa":', 'INSTALAÇÃO' not in pg.inner_text('.cli-casa'))
    pg.click('.cli-filtros >> text=Garantia'); pg.wait_for_timeout(200); print('6 filtro garantia:', pg.inner_text('.cli-hist').replace('\n',' / ')[:200])
    pg.screenshot(path=f'{S}/shotsT/cliente_1280.png', full_page=True)
    pg.click('.cli-acoes >> text=Novo orçamento'); pg.wait_for_timeout(600)
    print('7 novo orçamento:', pg.evaluate('document.body.dataset.tela'), pg.input_value('#novo-nome'), pg.input_value('#novo-tel'), pg.input_value('#novo-bairro'))
    pg.close()
    pg=abrir(b,360)
    print('8 celular: campo escondido', not pg.is_visible('#busca-in'), '| botão lupa', pg.is_visible('.busca-bt-cel'))
    pg.click('.busca-bt-cel'); pg.wait_for_timeout(300); pg.fill('#busca-tela-in','mario'); pg.wait_for_timeout(1500)
    print('  resultados:', pg.inner_text('#busca-tela-lista').replace('\n',' / ')[:200])
    pg.locator('#busca-tela-lista .bs-res', has_text='Mario').first.click(); pg.wait_for_timeout(1500)
    print('9 cliente só no Olist:', pg.evaluate('document.body.dataset.tela'), '| historico id:', hist_chamado[-1].get('id'))
    pg.screenshot(path=f'{S}/shotsT/cliente_360.png', full_page=True)
    print('  largura:', pg.evaluate('document.documentElement.scrollWidth'))
    b.close()
print('ERROS JS:', errs)
