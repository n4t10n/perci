> **v1.3:** Borrado definitivo de registros de actividad con guardado previo como borrador. Consultá `README-v1.3.md` y `docs/08-Borrado-de-registros-v1.3.md`. No publicar sin probar.

# Percí v1.3 · Borradores offline y sincronización segura

**Estado: código desarrollado y probado automáticamente. Pendiente subir a `main` y validar el modo offline con Safari iPhone/Mac reales.** La v1.1 actualmente desplegada no se modifica hasta ejecutar el script de actualización y confirmar el push.

## Qué cambia

- **Rutina sin conexión:** si el usuario ya inició sesión alguna vez en ese dispositivo, Percí ofrece crear o editar una rutina como borrador. El editor guarda nombre, ejercicios, series y repeticiones en `localStorage`, por cuenta, mientras escribe, incluso antes de pulsar Guardar.
- **Entrenamiento sin conexión:** al comenzar una sesión, Percí ofrece un borrador. Cada peso y repeticiones se guarda al escribir, y las series al confirmarlas. La sesión en curso se retoma tras volver a abrir la app; el servidor solo recibe el registro de entrenamiento una vez finalizado.
- **Cola persistente:** los cambios del usuario se guardan localmente y quedan «Pendientes de sincronizar» aunque se cierre el navegador. Al recuperar conectividad, se comprueba primero la cookie y la nube.
- **Reconciliación de tres vías:** última lectura de nube, borrador local y nube actual. Se agregan registros únicos, se comparan los compartidos y se pide decisión ante cambios incompatibles.
- **Series de fuerza completas:** al finalizar una sesión se conservan peso/repeticiones de cada serie. Supabase utiliza la tabla existente `perci_workout_sets`, sin migraciones nuevas. La lectura remota comprueba esos detalles; las sesiones históricas sin detalle no se rellenan con valores inventados.
- **Confirmación real:** después de POST `/api/cloud/sync`, se vuelve a consultar GET `/api/cloud/data`. Solo se borra la cola local si todos los registros esperados se pueden recuperar y no se creó otra edición mientras se enviaban.
- **Interfaz:** pantalla «Preparando tu progreso» centrada, texto con ancho cómodo en iPhone, mensajes visibles «Modo borrador»/«Cambios pendientes» y recuperación de borradores desde Actividad.
- **PWA:** `perci-shell-v1.2` y módulos con query de versión nueva para evitar mezclar JavaScript de v1.1 y v1.2.

## Límites y seguridad

- **No se sincronizan eliminaciones todavía:** si una eliminación local debe propagarse, el proceso se detiene y ofrece recuperar esos registros desde la nube o conservar el borrador local sin sincronizar. NO anunciar borrados como confirmados.
- **No hay sincronización en tiempo real:** otro dispositivo ve las novedades al actualizar/volver a abrir Percí. No existen websockets ni live updates.
- **Offline requiere sesión previa autenticada y PWA cargada online al menos una vez.** Un primer registro y primer login requieren internet.
- **Datos locales sin cifrado:** `localStorage` puede ser eliminado por el navegador o por el usuario. No garantiza protección frente a alguien que utilice ese dispositivo. Conservar exportación JSON externa para información importante.
- La protección de credenciales sigue siendo el backend con cookies `HttpOnly`, `Secure` en HTTPS y RLS de Supabase. Esta versión no agrega tablas ni cambia credenciales.
- La cola no envía una sesión `draft` en curso ni una rutina de editor que no fue guardada. Una rutina recién guardada sí forma parte de los cambios que pueden sincronizarse.
- El backend actual sigue usando upsert. La reconciliación no tiene transacciones globales, versiones persistentes de cada fila ni borrados propagados. Quedan pendientes QA con dos cuentas y resolución de concurrencia a escala antes de un lanzamiento abierto.

## Estructura técnica nueva

- `public/src/data/offline-outbox.js`: cola local por ID de usuario, borrador de editor, snapshot de referencia y merge de tres vías.
- `public/src/account.js`: cola el cambio primero, no hace POST ciego, avisa al orquestador para comprobar Supabase.
- `public/src/app.js`: editor y sesión offline, recuperación tras reconexión, revisión de conflicto, POST + GET verificados.
- `public/src/account-ui.js` y `public/src/styles.css`: estado visible, acciones de reintento y correcciones mobile.
- `public/sw.js`: caché v1.2.
- `tests/offline-outbox.test.mjs`: pruebas de colas, sesiones, aislamiento, merge, conflicto, borrados y verificación.

## Publicación

1. Exportar desde Percí v1.1 el JSON actualizado con Día 1 Full Body y Rutina 2. Conservarlo fuera de GitHub.
2. Confirmar que Vercel tiene `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en Production, ya verificados en la configuración anterior.
3. Descargar `Perci_v1.2.zip` y `Perci_v1.2_Actualizar_Main.sh` en Descargas. Ejecutar `bash ~/Downloads/Perci_v1.2_Actualizar_Main.sh ~/Downloads/Perci_v1.2.zip`.
4. El script valida el SHA previo de `main`, conserva un tag `perci-v1.1-stable` y ejecuta tests; solamente sube a `main` después de autorización explícita. `rama-historica` no se modifica.
5. Verificar https://perci-gamma.vercel.app en Safari iPhone y Mac. Probar desconexión, borrador, cierre/reapertura y reconexión sin tocar rutinas importantes.

## Pruebas automatizadas

```bash
npm test
python3 -m unittest discover -s tests -p test_vercel_api.py -q
python3 -m unittest discover -s tests -p test_cookie_server.py -q
python3 -m unittest discover -s tests -p test_workout_sets.py -q
```

En este entorno: **48 pruebas JS y 19 pruebas Python aprobadas**. El navegador automatizado bloqueó los sitios de prueba por una política del entorno, por lo que no se afirma que la ejecución visual en Safari o Chromium esté validada. El acceso real a Supabase tampoco se probó en esta versión porque las credenciales no se incluyen aquí.

La v1.1, validada anteriormente en Mac e iPhone con recuperaciones automáticas, se conserva en GitHub mediante el tag `perci-v1.1-stable`.
