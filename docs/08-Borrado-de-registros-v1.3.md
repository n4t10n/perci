# Percí v1.3 · Borrado de actividad y borradores

## Qué se implementó

- **Progreso → detalle del registro → Eliminar registro:** único diálogo previo con tres salidas: **Guardar como borrador**, **Eliminar definitivamente**, **Cancelar**.
- Guardar como borrador almacena una copia del registro en `perci_record_drafts_v13_<uid>` (localStorage por cuenta). El registro desaparece del historial/métricas y puede restaurarse desde **Progreso → Borradores guardados**. Es un borrador de un registro terminado, no una sesión de gimnasio en curso ni una copia en la nube.
- Eliminar definitivamente quita el registro del historial local y registra de forma persistente una intención de borrado en `perci_record_deletes_v13_<uid>`.
- **Online:** la cola envía el borrado con sesión autenticada a `/api/cloud/delete` y después sincroniza el snapshot. Confirma con una nueva lectura que el registro no existe en la nube; entonces limpia la intención.
- **Offline:** mantiene la intención local hasta que se pueda procesar. No muestra un diálogo bloqueante sobre borrados de registros; el indicador lateral puede informar cambios pendientes.
- La API solo acepta IDs de registro validados, filtra con el `user_id` autenticado y usa RLS de Supabase. Al borrar `perci_activity_records`, las series en `perci_workout_sets` se eliminan por `ON DELETE CASCADE` de la migración existente.
- Compatibilidad con eliminaciones de **registros** en v1.2 que quedaron pendientes en el outbox.
- En una sesión anterior de otro navegador, el baseline permite reconocer y quitar registros borrados remotamente que no hayan sido modificados localmente. Si están modificados, no se sobrescriben silenciosamente.
- El historial tiene un objetivo táctil completo por fila en lugar del botón «Ver» separado.

## Lo que **NO** implementa aún

- Borrado sincronizado de **rutinas, hábitos y checks**. Siguen pendientes de un endpoint específico y QA de relaciones. No interpretarlos como sincronizados si aparecen alertas.
- Borrado de copias de seguridad locales históricas o de borradores ya guardados en el dispositivo.
- Sincronización de borradores locales entre dispositivos.
- E2E real contra Supabase y Safari: faltan pruebas en Production con una actividad de prueba, específicamente offline → online → Mac.

## Prueba manual de aceptación

1. Exportar una copia JSON actual desde Ajustes antes de cambiar de versión.
2. Crear **registro de entrenamiento de prueba** que aparezca en Progreso y esté sincronizado en la Mac y el iPhone.
3. En iPhone abrir el detalle y elegir **Eliminar registro → Eliminar definitivamente**. Se elimina inmediatamente del historial, sin pantalla de revisión de borrados.
4. Recargar en Mac y validar que el registro desaparece también allí. Al volver a abrir iPhone, no reaparece.
5. Crear otro registro de prueba y elegir **Guardar como borrador**. Ver que se excluye de las métricas pero aparece en «Borradores guardados». Restaurarlo y comprobar que vuelve al historial; el borrador desaparece de la lista.
6. Repetir la eliminación definitiva sin internet en iPhone; reconectar y validar que la actividad desaparezca también en Mac. Se admite un estado discreto «Cambios por sincronizar» mientras no hay red.
7. Si falla la sincronización, conservar el JSON y no borrar datos del navegador. No eliminar rutinas personales hasta validar.

## Seguridad y limitaciones

- No se usa `service_role` ni claves privadas. El endpoint conserva las cookies de sesión `HttpOnly`, `Secure` en HTTPS y validación de `Origin` del servidor.
- La operación es idempotente y se verifica con una nueva lectura, pero no dispone de transacciones distribuidas cliente-servidor. Si cae la conexión entre borrar y confirmar, se reintenta desde la cola local.
- El almacenamiento offline continúa **sin cifrado**; no utilizarlo con datos de salud sensibles en un entorno no confiable.
- Nunca volver a ejecutar la migración inicial de 8 tablas: este ajuste reutiliza tablas y políticas existentes.
