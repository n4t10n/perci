# Percí v1.6.4 · Endurecimiento de la API HTTP

**Propósito:** cerrar hallazgos de la auditoría de seguridad de escrituras sin modificar el contrato de datos, la estructura de Supabase ni la experiencia de entrenamiento.

## Cambios
- El endpoint `/api/cloud/sync` rechaza registros con tipos incorrectos (`routines`, `records`, `habits`, ejercicios) y `checks` que no sea un objeto con respuesta HTTP **400**, antes del primer `upsert`. No devuelve `500` por campos incorrectos.
- Los logs del endpoint serverless ya no imprimen query strings en ninguna respuesta, incluyendo rutas GET.
- Se agregan 16 pruebas de la matriz de seguridad de API (sesión, CSRF/Origin, owner scope, payload, idempotencia/validación, 409 stale write, logging, tamaños). **No requieren credenciales ni escriben en Supabase.**
- `public` conserva la funcionalidad de v1.6.3 y actualiza únicamente el identificador de caché para hacer el despliegue distinguible.

## Resultados de QA
- Ejecutar `npm test`.
- Ejecutar `python3 -m unittest discover -s tests -p 'test_*.py' -q`.
- `python3 -m py_compile api/shared.py server/perci_server.py`.

## No cambia / Limitaciones
- Sin migración SQL, sin cambios de RLS, sin nuevos secretos.
- No se implementa aún CAS de revisiones atómico entre tablas. Eso requiere un proyecto específico antes de la beta pública.
- Las pruebas en mocks complementan, no sustituyen, la validación de escrituras JWT reales en la cuenta QA.
- Usar cuentas Xecloto/Hotmail para los controles destructivos, nunca las cuentas reales del piloto.
