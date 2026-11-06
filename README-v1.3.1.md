# Percí v1.3.1 · Corrección de borrados y mensajes online

**Origen:** v1.3 (`main` en GitHub, commit `5936185d7c3fc3af8fbefb8246f846d647d10764`). **Entrega:** preparada para revisión; no publicada hasta realizar el push a `main`.

## Correcciones

1. **Borrado online inmediato:** tras eliminar un registro, queda una intención persistente por cuenta y se inicia una lectura y reconciliación protegida con Supabase inmediatamente, sin depender solamente del temporizador. Si no hay internet, el borrado sigue en la cola.
2. **Reintento:** al abrir Percí después de un corte se recuperan las intenciones de borrado aunque un cierre de pestaña haya ocurrido entre guardar la intención y el outbox. Si el registro ya se eliminó remotamente, no se considera conflicto.
3. **Mac/iPhone:** al volver a enfocar una pestaña o hacerla visible, Percí consulta la nube sin bloquear la pantalla ni interrumpir formularios o sesiones de entrenamiento. Las sesiones abiertas o ediciones sin guardar no se sobreescriben.
4. **UI discreta:** los avisos normales de sincronización y borradores aparecen solo offline. Online se muestra el texto neutro «Tus datos están seguros». Las opciones reales de recuperar o continuar contenido guardado siguen accesibles. Ante conflictos de datos reales la protección continúa vigente.
5. **PWA:** módulos y service worker con versión `1.3.1` para evitar mezclar caché anterior con el código corregido.

## Límites y seguridad

- El borrado remoto se marca como completado **solo después** de comprobar en una segunda lectura que el registro ya no está.
- No se ejecutan cambios de esquema SQL ni se añaden claves secretas.
- No se elimina un registro sin una confirmación del usuario.
- **No está implementada la sincronización en tiempo real sin cambiar el foco**. Al volver a una pestaña visible, Percí consulta los cambios. En otras circunstancias puede ser necesario actualizar la página.
- Las rutinas/hábitos completos siguen sin sincronizar sus borrados. Esta corrección resuelve específicamente los registros del historial.
- El modo offline usa almacenamiento local sin cifrar: no borrar datos de Safari mientras haya cambios pendientes.
- Las pruebas automatizadas son locales y simuladas. No se pudo completar un test E2E real de navegador porque este entorno bloquea Chromium al entrar a localhost. El borrado en Supabase real y la propagación entre Mac/iPhone deben validarse antes de dar el problema por solucionado.

## Prueba recomendada

1. Exportar JSON desde Ajustes y guardarlo fuera de GitHub.
2. Subir v1.3.1 a `main` desde el script. Confirmar despliegue READY de Vercel.
3. Con una actividad **de prueba**, en el iPhone tocar «Eliminar registro» → «Eliminar definitivamente», estando online.
4. Verificar que desaparece del historial del iPhone y, al volver a la pestaña abierta de Percí en Mac, del historial de Mac.
5. Recargar ambos; verificar que no reaparece.
6. Repetir una vez sin conexión en iPhone, reconectar y verificar el borrado remoto.

No usar entrenamientos personales para la primera prueba de eliminación. Si no desaparece, **no borrar más registros**; conservar JSON y revisar la API de Vercel.
