# Carregado sozinho pelo Python quando o rodar_tela.sh roda os testes.
# Isola os testes do banco de verdade: qualquer pedido ao Supabase que o teste
# NÃO simulou falha como "sem internet". As simulações do próprio teste
# (pg.route registrado depois) continuam valendo, porque têm prioridade.
try:
    from playwright.sync_api import Browser

    def _isolar(alvo):
        alvo.route('**/*.supabase.co/**', lambda r: r.abort())
        return alvo

    _np, _nc = Browser.new_page, Browser.new_context
    Browser.new_page = lambda self, *a, **k: _isolar(_np(self, *a, **k))
    Browser.new_context = lambda self, *a, **k: _isolar(_nc(self, *a, **k))
except Exception:
    pass
