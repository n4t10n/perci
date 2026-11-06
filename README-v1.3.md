# Percí v1.3 · Borrado definitivo de registros

Basado en la versión v1.2 validada. **Estado:** código preparado, no publicado en GitHub/Vercel hasta que se ejecute el script y se confirme el push a `main`.

## Cambios

- Preguntar **Guardar como borrador / Eliminar definitivamente / Cancelar** antes de eliminar una actividad completada.
- El borrador queda en **Progreso → Borradores guardados**, solo en ese dispositivo y vinculado a la cuenta. No cuenta en métricas. Se puede restaurar o descartar.
- Al confirmar eliminar, quita la actividad localmente y crea una intención de borrado persistente que se ejecuta en Supabase cuando haya conexión.
- API `POST /api/cloud/delete`, autenticada con cookie y RLS, elimina por `user_id` y `client_id`, validando IDs. Las series relacionadas desaparecen por ON DELETE CASCADE.
- Verificación remota del borrado, detección de sesiones antiguas para evitar resurrecciones y compatibilidad con eliminación pendiente de v1.2.
- Historial: fila completa clicable, sin botón «Ver» aislado.
- Caché PWA v1.3 para actualizar archivos.

## Limitaciones

Las pruebas de código pasaron pero **no hay validación real en Safari ni Supabase DEV de esta versión**. No se ha probado todavía en Production. El borrado de rutinas y hábitos completos **no** está soportado por este endpoint. Los borradores guardados son locales y no cifrados.

## Instalación

1. En Percí v1.2, exportá JSON desde Ajustes, por precaución.
2. Descargá `Perci_v1.3.zip` y `Perci_v1.3_Actualizar_Main.sh` en Descargas.
3. Corré `bash ~/Downloads/Perci_v1.3_Actualizar_Main.sh ~/Downloads/Perci_v1.3.zip`.
4. Revisá las pruebas y, **solo cuando lo decidas**, respondé `s` al push que actualiza `main` y despliega Production en Vercel.
5. Probá con una actividad de prueba, no con `Día 1 Full Body`. Validá la desaparición desde otro dispositivo y las tres opciones del modal.

Más información: [docs/08-Borrado-de-registros-v1.3.md](docs/08-Borrado-de-registros-v1.3.md).
