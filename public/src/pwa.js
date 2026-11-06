/** Percí v1.5 · Actualización silenciosa de PWA.
 * Si un SW nuevo toma control, avisamos a la app: ella decide cuándo recargar
 * sin interrumpir entrenamiento, formularios, conflictos o borradores.
 */
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    let controller = navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const next = navigator.serviceWorker.controller;
      if (controller && next && controller !== next) {
        document.dispatchEvent(new Event('perci:pwa-updated'));
      }
      controller = next;
    });
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './', updateViaCache: 'none'
      });
      let lastCheck = 0;
      const check = () => {
        if (document.visibilityState === 'hidden') return;
        if (Date.now() - lastCheck < 60000) return;
        lastCheck = Date.now();
        registration.update().catch(() => {});
      };
      check();
      window.addEventListener('focus', check);
      window.addEventListener('online', check);
      document.addEventListener('visibilitychange', check);
      setInterval(check, 4 * 60000);
    } catch (error) {
      console.warn('Percí: actualización PWA temporalmente no disponible:', error?.name);
    }
  });
}
