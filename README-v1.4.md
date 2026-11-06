# Percí v1.4 · Sincronización de borrados y protección de datos

**Estado:** entrega para QA en iPhone Safari, Chrome/Safari Mac y Supabase DEV. Esta carpeta **no** ejecuta ninguna migración SQL nueva y **no** contiene credenciales.

## Cambios frente a v1.3.1

1. **Eliminación de rutinas:** al confirmar, Percí las retira localmente y registra un intento persistente en el dispositivo. Online solicita un `DELETE` autenticado de `perci_routines` filtrado por `user_id` y `client_id`. Los ejercicios vinculados se eliminan en cascada. Los entrenamientos completados se conservan en el historial.
2. **Eliminación de hábitos:** confirma y quita el hábito junto a sus checks locales; Supabase lo elimina por identidad propia y Postgres elimina los checks relacionados. No requiere volver a borrar desde la Mac.
3. **Borrados offline:** se almacenan en una cola local aislada por cuenta. Al volver internet, se envían y se verifica en una lectura posterior que no reaparezcan. Se conserva la compatibilidad con las eliminaciones de registros de v1.3.1.
4. **Conflictos reales:** si un dispositivo edita una rutina que el otro quiere eliminar, o registra un cumplimiento de un hábito eliminado, Percí detiene la sincronización y requiere decidir qué versión conservar. Antes de decidir se hace respaldo local. No se deben exhibir banners de sincronización ordinaria estando online.
5. **Lectura entre dispositivos:** cuando una pestaña recupera el foco y vuelve a consultar Supabase, una entidad eliminada en la nube se retira de su caché local si no se había editado allí. Si tenía cambios propios, no se descartan silenciosamente.
6. **Backend sin clave de servicio:** `/api/cloud/delete` acepta listas `records`, `routines`, `habits`, comprueba IDs y usa el JWT validado. El usuario indicado por el cliente se ignora; las políticas RLS de Supabase siguen aplicándose.

## Seguridad y límites

- **No es sincronización transaccional completa.** La comprobación de 3 vías es best-effort; persiste una carrera posible entre leer, decidir y escribir. Para una beta abierta necesitamos versiones remotas y tombstones con operaciones atómicas. Mantener el JSON de respaldo y probar con datos de demostración.
- **RLS con dos cuentas reales:** sigue pendiente. Las pruebas automatizadas de aislamiento validan que el backend filtre por `user_id` y JWT, **no** prueban en vivo las reglas de Supabase.
- En v1.4, desmarcar un cumplimiento existente en otro dispositivo aún puede requerir revisión. El backend de sincronización de borrados cubre **entidades completas** (`routines`, `habits`, `records`); no sincroniza de forma independiente el borrado de un check histórico.
- El modo offline conserva datos en `localStorage` no cifrado. No borrar datos del navegador con cambios pendientes; la cuenta debe haberse autenticado online anteriormente.
- `main` de GitHub dispara Vercel Production; el script pide confirmación antes de publicar y conserva `rama-historica` intacta.

## Pruebas ejecutadas

```bash
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -q
python3 -m py_compile api/shared.py server/perci_server.py api/cloud/delete.py
```

Pruebas de código (sin cuentas Supabase reales): 68 JavaScript y 35 Python, resultados aprobados. Todavía falta validar los borrados en Vercel y dos dispositivos reales.

## Criterios de aprobación en Safari/Mac

1. Exportar JSON desde Percí actual. Conservarlo fuera de GitHub.
2. Crear **rutina de prueba**, confirmarla en iPhone y comprobar que aparece en Mac. Borrarla desde iPhone, volver a la pestaña de Mac y confirmar que desaparece sin volver a importarla.
3. Crear **hábito de prueba** y al menos un check; borrar el hábito y comprobar en Mac que desaparecen ambos.
4. Repetir una eliminación offline en iPhone, reconectar y comprobar en Mac que no reaparece.
5. Crear una edición concurrente de una rutina de prueba desde otro dispositivo y comprobar que Percí pide decidir, no la elimina silenciosamente. No utilizar rutinas personales reales.
6. Verificar que un usuario recién creado no recibe rutinas ni hábitos de otra cuenta. Para aprobar RLS se requiere test con dos usuarios reales y solicitudes cruzadas contra Supabase (pendiente).

**No mergear cambios de esquema**; la base existente ya contiene `ON DELETE CASCADE` para ejercicios y checks.
