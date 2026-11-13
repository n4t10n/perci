# Percí QA v1.13.1: compatibilidad con Safari iPhone

## Incidente

El editor muestra y recorta correctamente la imagen, pero Safari iOS puede devolver PNG al solicitar WebP con Canvas.toBlob. La v1.13.0 exigía estrictamente blob.type=image/webp, por lo que el usuario veía «Este navegador no puede preparar WebP». No es un problema con la fotografía ni con la conexión a Supabase.

## Corrección

- Exportación del recorte a JPEG de forma nativa: tamaños 512/448/384/320 y compresión progresiva con límite 200 KB.
- El servidor valida MIME y cabecera/dimensiones JPEG antes de escribir en Supabase. Continúa admitiendo fotos WebP previas.
- Cada JWT accede exclusivamente a <auth.uid()>/avatar.jpg o <auth.uid()>/avatar.webp en el bucket privado QA. Eliminar foto borra ambas posibles versiones.
- No se modifica almacenamiento de entrenamientos, sincronización ni tabla de usuario.
- Versionado PWA 1.13.1 para evitar que Safari conserve el convertidor anterior en caché.

## Migración

Aplicar **solo en Supabase QA** `supabase/migrations/202611130002_perci_avatar_jpeg_ios_qa.sql` antes de probar el parche en Vercel QA. Habilita image/jpeg además de image/webp y conserva RLS/propiedad por UID. No tocar DEV ni producción.

## Validación

1. Instalar el parche desde la rama QA 1.13.0, con árbol limpio y SHA correcto.
2. Ejecutar suite completa JS y Python, verificar GitHub Actions.
3. Aplicar migración Supabase QA y publicar Preview en proyecto perci-qa.
4. Safari iPhone: elegir la misma foto, recortar, guardar, comprobar avatar en header y cuenta; cancelar y quitar.
5. Mac: comprobar sincronización. QA-B: no puede ver ni modificar el avatar de QA-A.
6. Producción permanece en su versión previa hasta aprobación.
