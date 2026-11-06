# Percí v1.4.1 · Hotfix de hábitos y sincronización

## Contexto confirmado
- En producción, el usuario pudo crear un hábito desde iPhone con su segunda cuenta, pero no lo vio en Mac.
- El historial de Vercel registró al menos una llamada POST `/api/cloud/sync` con HTTP 200 y llamadas GET posteriores. **Eso no permite atribuir el contenido a una cuenta ni confirmar qué hábito se envió.**
- El frontend v1.4 podía anunciar «Hábito guardado» sin verificar el éxito de `save()` y su programador de sincronización podía quedar inactivo tras un error anterior.

## Correcciones
1. El formulario de hábitos comprueba `save()`; si falla, restaura en memoria la lista anterior, sin informar un éxito falso.
2. Después de guardar un hábito con internet, ejecuta una actualización protegida de nube que ya no depende únicamente de un temporizador general.
3. Una solicitud de actualización recibida mientras otra está en curso queda programada para ejecutarse al terminar, evitando pérdidas por simultaneidad.
4. Una sincronización previamente fallida permite nuevo intento cuando se guardan cambios; una pausa por conflicto explícito sigue siendo respetada.
5. En **Mi cuenta** solo aparece una alerta especial si ocurrió realmente un fallo y quedan datos pendientes, no mensajes de sincronización cuando el estado es normal y está online.
6. Caché PWA renovada a `perci-shell-v1.4.1`; assets ESM con `?v=1.4.1`.

## Pruebas
- 72 tests de JavaScript (incluye cuenta nueva con primer hábito, fusión remota y retry).
- 35 tests Python del backend con respuestas simuladas.
- Sin cambios de esquema SQL ni migración Supabase.
- **Pendiente:** validación real de la segunda cuenta desde iPhone y Mac. Estas pruebas no demuestran que el fallo original se haya resuelto en producción.

## Procedimiento seguro
1. **No borrar** ni reinstalar la PWA que contiene el hábito sin sincronizar. Exportar JSON desde iPhone.
2. Actualizar `main` usando el script entregado; conservar tag de respaldo de v1.4.
3. Confirmar despliegue `Ready` en Vercel. Reiniciar Percí iPhone y navegador Mac sin borrar almacenamiento.
4. Abrir sesión con la segunda cuenta en iPhone, desde Mi cuenta tocar `Actualizar mis datos`, y comprobar el hábito en Mac tras recargar.
5. Si falla, **no borrar el hábito local**: revisar si Mi cuenta muestra una alerta y comprobar datos desde cuenta autenticada; no exponer tokens ni contraseñas.

### Seguridad
El contenido de `.env.example` son marcadores de ejemplo; no publicar `.env` real. Toda petición se autentica mediante cookies host-only HttpOnly y políticas RLS.
