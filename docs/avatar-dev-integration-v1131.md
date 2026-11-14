# Percí v1.13.1 → DEV · Guía de integración

## Aprobación de origen
- QA rama `qa/perci-avatar-ios-jpeg-v1-13-1`, SHA `b899ef9628c5e5ac009824b8e1d1dd36d5a15745`.
- 219 pruebas JS + 106 pruebas Python aprobadas; validación iPhone Safari, Mac Chrome y aislamiento entre QA-A/QA-B.
- DEV integra las 9 revisiones posteriores a `main` v1.9.0, incluyendo v1.10 a v1.13.1.

## Aislamiento
- Branch nueva `release/perci-v1.13.1-dev-integration`; `main` y ramas QA no se alteran.
- Bucket foto exclusivo para DEV `perci-avatars-dev`; compatible JPEG/WebP, privada, 200 KB, RLS por usuario.
- **NO ejecutar automáticamente SQL de QA en DEV**. Aplicar solamente `supabase/migrations/202611130003_perci_avatar_storage_dev.sql` en Supabase DEV, previa confirmación del proyecto exacto.
- Vercel del proyecto público `perci` tiene variables únicamente para producción. No desplegar ahí como atajo. Para DEV usar proyecto propio `perci-dev` y credenciales DEL proyecto Supabase DEV previsto para ensayos, no las de QA ni sin verificar las de producción.
- No copiar claves, secretos ni cookies entre proyectos y no imprimirlos en logs.

## Validación restante antes de cerrar DEV
1. GitHub Actions completo en verde en rama DEV.
2. Aislar proyecto Vercel DEV y configurar `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` del proyecto Supabase DEV correcto en entorno adecuado.
3. Aplicar migración solamente en Supabase DEV y validar bucket/políticas.
4. Desplegar rama en Vercel DEV, comprobar email/login y callbacks, entrenamientos, rutinas, sincronización, GIF/video y avatar en iPhone y Mac.
5. Confirmar `main` y producción intactos; rollback = cambiar alias a último deployment READY DEV.

No promover a `main` ni producción sin aprobación expresa.
