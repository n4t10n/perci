// Registro seguro de PWA. El service worker funciona en localhost o HTTPS.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .catch(error => console.warn('Percí: service worker no disponible:', error));
  });
}
