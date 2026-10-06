// Registra o service worker para o sistema poder ser instalado na tela inicial do celular.
if (navigator.serviceWorker) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
