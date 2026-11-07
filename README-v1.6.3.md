# Percí v1.6.3 · Reconexión fiable en Safari iPhone

Base: Percí v1.6.2 (GitHub `main` SHA `ce9b4a44a26e0c65614ba8acf19918a0a9cbd73e`).

## Feedback del piloto

Al repetir el conflicto entre Mac e iPhone, el aviso no apareció al recuperar Internet en el teléfono. La Mac lo mostró recién al actualizar la página. Esto es una falla de detección/actualización automática y también puede ocurrir si el cambio de la Mac aún no terminó de guardarse en Supabase antes de reconectar el teléfono.

**Criterio correcto:** la decisión debe aparecer en el dispositivo que tenga cambios locales incompatibles **y cuya lectura descubra una versión remota ya confirmada**. No se puede prometer que sea siempre el primer equipo que reciba una señal de conexión; el otro cambio debe existir en la nube y ambos envíos podrían llegar en distinto orden. El programa jamás debe elegir silenciosamente por el usuario cuando hay un conflicto real.

## Cambios

- Se verifica el restablecimiento de la sesión cuando la PWA vuelve a primer plano (`focus`, `visibilitychange`, `pageshow`), aun si Safari nunca emite el evento `online`.
- Se reintenta la verificación mientras la app está visible, cada 12 segundos como máximo; con conexión confirmada, se mantiene el refresco de datos aproximadamente cada 30 segundos.
- Una comprobación de sesión que responde correctamente permite superar una indicación `navigator.onLine=false` desactualizada, durante un plazo limitado de 60 segundos. Un evento `offline` invalida ese estado.
- Las verificaciones concurrentes de sesión se deduplican para evitar solicitudes innecesarias.
- No se interrumpe el registro de una sesión activa, un formulario abierto o un conflicto en resolución para iniciar sondeos automáticos.
- Sigue vigente el merge de tres vías de v1.6.2: si no hay cambios locales nuevos, la versión remota reemplaza la antigua sin un segundo modal. Los cambios incompatibles del mismo registro mantienen la decisión explícita.
- La sincronización, el almacenamiento, las contraseñas y las cookies de sesión no cambian de formato. Sin migración SQL.

## Pruebas

- 106 tests JavaScript: reconciliación, reconexión silenciosa sin evento online, deduplicación de comprobaciones, señal stale de iOS, protección del outbox e integridad PWA.
- 43 tests Python: servidor/API, autorización y sincronización.
- Falta QA físico en Safari iPhone y Mac. El navegador automatizado externo del entorno no pudo simular el escenario móvil real.

## Protocolo de QA real (solo cuenta de prueba Xecloto)

1. Antes de publicar, exportar respaldo JSON de cada cuenta con datos reales. No modificar cuentas de Valen ni Facu durante esta prueba.
2. Publicar v1.6.3 y verificar que Vercel reporte `READY`. Abrir la versión actualizada en **ambos** dispositivos.
3. Verificar que ambas copias de la rutina ficticia compartan el mismo nombre inicial.
4. Desconectar completamente el iPhone de Internet y editar el nombre a `TEST IPHONE 4`. Guardar en el dispositivo.
5. En la Mac conectada, editar la misma rutina a `TEST MAC 4` y esperar a que se sincronice. **Antes de reconectar el teléfono, abrir `/api/cloud/data` en otra pestaña de la Mac y comprobar que la rutina figura como `TEST MAC 4`.** Esto evita falsear el resultado por el orden de escrituras. No pegar JSON privados en chats.
6. Reconectar el iPhone, manteniendo Percí visible o volviendo a abrirla desde su ícono. Verificar que el conflicto aparezca **en el iPhone sin recargar la página**. Puede requerir algunos segundos por la verificación de sesión/red.
7. Elegir `Usar cambios de este dispositivo`. Comprobar que iPhone y Mac muestren `TEST IPHONE 4` y que la Mac no muestre un segundo conflicto.
8. Hacer otra prueba solo con una edición desde Mac: iPhone debe importarla sin preguntar.

Si el aviso aparece primero en Mac y no en iPhone, detener la prueba, no elegir versiones a ciegas y comprobar cuál era el nombre confirmado en Supabase antes de reconectar. Conservar las capturas y el instante de ambos guardados.

## Limitaciones pendientes

El backend conserva una comprobación optimista no atómica entre tablas. La concurrencia simultánea exacta sigue necesitando una revisión transaccional o por entidad para beta abierta. Este parche mejora el momento de detección y la recuperación de conexión, pero no ofrece garantías transaccionales nuevas.
