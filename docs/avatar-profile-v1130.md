# Percí v1.13.0 · Foto de perfil (solo QA)

## Experiencia

- Mi cuenta: tocar avatar o **Cambiar foto**, elegir desde Fotos/Archivos, arrastrar o usar flechas para reencuadrar, zoom, Guardar/Cancelar.
- La foto reemplaza la inicial en Mi cuenta y el encabezado. **Quitar foto** requiere confirmación.
- JPEG, PNG, WebP y HEIC (este último solo si Safari puede decodificarlo); entrada máxima 10 MiB, se convierte localmente a WebP cuadrado de 512 × 512 px y se comprime a <= 200 KB.
- Se ve última foto cachéada en modo offline, pero cambiar/quitar foto exige conexión. El editor nunca modifica rutinas, hábitos, registros ni outbox.
- Foto privada por defecto. Las funciones sociales de v1.14 no heredan acceso automático.

## Almacenamiento, permisos y aislamiento

- Ejecutar **únicamente en el proyecto Supabase QA**: `supabase/migrations/202611130001_perci_avatar_storage_qa.sql`. No aplicar a DEV/producción.
- Bucket `perci-avatars-qa` privado, MIME `image/webp`, máximo 200000 bytes.
- Ruta por JWT autenticado: `<auth.uid()>/avatar.webp`; RLS exacta para SELECT / INSERT / UPDATE / DELETE. No se usa service_role.
- `GET /api/profile/avatar` devuelve la imagen privada como data URL WebP en JSON, `POST /api/profile/avatar` guarda o quita. La API reutiliza HttpOnly cookies y `Origin` same-site de api/shared.py.
- El cuerpo POST incluye `ownerId` y el servidor lo compara con Auth; evita que operaciones de una pestaña con sesión obsoleta escriban en otra cuenta. La ruta del objeto nunca llega desde cliente.
- Caché de última imagen en localStorage aislada por user ID y validada antes de renderizar. Jamás precachear fotos de usuario con Service Worker.

## Verificación manual QA

1. Abrir QA en Safari iPhone e iniciar sesión QA-A. Ver inicial (sin foto).
2. Subir JPG/PNG: elegir, ampliar, arrastrar, guardar. Debe aparecer foto en Mi cuenta y header sin recarga.
3. Cerrar/abrir PWA y Mac Chrome: misma foto; ningún cambio en rutinas o sincronización.
4. Probar cancelar editor, imagen grande/incorrecta, pérdida de conexión, quitar, y subida de nuevo.
5. Ingresar con cuenta QA-B: NO debe verse ni modificarse foto QA-A. Probar también GET y POST sin sesión, con Origin ajeno y `ownerId` incorrecto.
6. Con QA-A offline: debe verse última foto de ese usuario si estaba en caché, pero el botón de subir debe informar que requiere conexión.
7. Comprobar `public/src/app.js?v=1.13.0`, `public/src/account-ui.js?v=1.13.0`, `public/src/profile-avatar.js?v=1.13.0` y `public/src/styles.css?v=1.13.0` en el mismo Service Worker.

## Despliegue

- Primero ejecutar migración privada en Supabase QA; comprobar bucket `public=false` y RLS.
- Ejecutar `npm test` y `python3 -m unittest discover -s tests -p 'test_*.py' -q`.
- Publicar rama QA en GitHub y verificar CI, luego desplegar SOLO proyecto Vercel `perci-qa` como Preview.
- No tocar DEV, `main`, Vercel Production ni Supabase DEV. La migración QA no es suficiente para un futuro despliegue a DEV/producción: ese paso requerirá su propia revisión.
