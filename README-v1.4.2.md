# Percí v1.4.2 · Recuperación automática por cuenta

## Diagnóstico basado en pruebas reales
El hábito creado desde iPhone se encontró en `/api/cloud/data` de la segunda cuenta al abrirlo desde Mac. El botón **Recuperar mis datos** logró importarlo; por eso el error estaba en la activación/actualización de la vista local, no en la escritura del hábito en Supabase. La causa exacta no fue confirmada en un navegador instrumentado. Al auditar el código se detectó un bloqueo real en la actualización al volver a la pestaña: la condición `app.editor` impedía el refresco incluso cuando la persona ya había abandonado la pantalla de edición.

## Cambios
- Eliminar ese bloqueo obsoleto: sólo se suspende la actualización en una pantalla de edición realmente activa, durante una sesión de entrenamiento o ante un conflicto pendiente.
- Reiniciar el estado efímero de editores, hábitos y modales en cada cambio de cuenta, para que no contamine una sesión nueva.
- Recuperar cambios automáticamente al volver a abrir el navegador/pestaña, al entrar en Inicio/Actividad/Progreso/Hábitos/Mi cuenta, y mientras una página permanezca visible (sondeo cada 30 segundos). Nunca se consulta mientras la pestaña está oculta.
- Seguir usando la comparación de tres vías, la cola offline por cuenta, los borrados explícitos, la confirmación de escritura de Supabase y los bloqueos ante conflictos; no reemplazar datos locales silenciosamente.
- Asegurar que respuestas asíncronas de la cuenta anterior no se apliquen al estado de otra cuenta.
- Renovar la caché PWA y los importadores para v1.4.2.

## QA recomendado para aprobar
1. Exportar un JSON de respaldo desde las dos cuentas en sus dispositivos; no eliminar la PWA ni usar `Recuperar mis datos`.
2. Crear un hábito **de prueba** desde iPhone en una cuenta; abrir la Mac en Hábitos y volver a esa pestaña: debe aparecer sin pulsar botones.
3. Crear otro hábito desde Mac con la cuenta ya abierta en iPhone; cerrar y abrir Percí en iPhone: debe aparecer automáticamente.
4. Alternar cuentas en la Mac y comprobar que nunca aparezcan registros pertenecientes a la otra cuenta.
5. Crear un hábito offline; reconectar y verificar recuperación en Mac sin intervención manual.
6. No considerar suficiente el mensaje genérico «Tus datos están seguros». Verificar presencia real de los objetos entre dispositivos.

### Seguridad
No se incorporan credenciales ni migraciones SQL. Las pruebas locales comprueban lógica con datos ficticios, pero no sustituyen la validación real entre dispositivos y la auditoría RLS entre dos identidades.
