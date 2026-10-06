// Service worker mínimo: permite instalar o app no celular.
// De propósito NÃO guarda páginas nem preços em cache — tudo vem sempre da versão publicada,
// para ninguém orçar com tabela antiga.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
