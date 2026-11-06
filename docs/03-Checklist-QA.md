# Checklist QA · v0.5

## Verificaciones realizadas en este entorno (05/11/2026)

- **Inspección de sintaxis:** `node --check` pasó para los archivos JS principales y service worker.
- **Simulación controlada de interfaz Chromium:** ancho 375, 390, 430 y 1280 CSS px; sin desbordes horizontales ni errores de ejecución. En vez de acceso HTTP real, se inyectó el CSS y JS equivalente en una página de prueba debido a restricciones de acceso a localhost.
- **Pruebas de flujos en Chromium controlado:** bienvenida, crear rutina, biblioteca, guardar rutina, iniciar sesión, completar serie, finalizar sesión, registrar deporte, crear hábito. Completadas sin errores JS.
- **Importante:** estas pruebas no verifican el cargado real de ES modules por HTTP, la instalación PWA, service worker en línea, comportamiento offline con red desconectada ni Safari/iOS real. Todos estos puntos quedan pendientes.

## Pruebas automatizables
- [ ] Servidor responde `/`, módulos, iconos, manifest.
- [ ] No hay errores JavaScript al abrir bienvenida e Inicio.
- [ ] Sin desbordes horizontales a 375, 390, 430, 1280 CSS px.
- [ ] Crear rutina, seleccionar ejercicio, registrar sesión, historial.
- [ ] Registrar caminata y deporte; cancelar formularios.
- [ ] Hábitos: crear, completar, pausar y eliminar.
- [ ] LocalStorage preserva datos al refrescar; exportación/importación y reversión.
- [ ] Service worker registra y el shell se abre offline después de primera carga.
- [ ] Recursos oficiales de marca cargan desde `assets`.

## Pruebas manuales para aprobar el Paso 1
- [ ] Safari real en iPhone con icono «Agregar a pantalla de inicio».
- [ ] Scroll, safe areas, inputs y navegación inferior con teclado abierto.
- [ ] Safari en MacBook Air; escritorio a 1280 CSS px.
- [ ] Chrome/Edge Windows y navegación por teclado.
- [ ] WCAG 2.2 AA en flujos críticos.
- [ ] Diseño con fotos online y degradación offline.

Este checklist no supone que se hayan ejecutado pruebas en dispositivos reales.
