# Percí v1.10.0 · Edición de series históricas (solo QA)

## Alcance

- Progreso → Historial → sesión de fuerza → Editar series.
- Solo peso y repeticiones de series confirmadas. No altera fecha, duración, rutina o historial ajeno.
- Recalcula volumen y datos de evolución por ejercicio a partir de las series actualizadas.
- Cancela sin persistir y revierte exactamente la sesión original si falla el guardado local.
- Conserva reconciliación y persistencia atómica existente. Sin migraciones SQL.
- Los registros antiguos sin setDetails no muestran la edición.

## Plan QA manual

1. Abrir con cuenta QA-A un entrenamiento ficticio ya finalizado. Anotar valores y volumen.
2. Pulsar «Editar series» y cambiar una serie de 40 × 10 a 45 × 8. Guardar.
3. Verificar que la misma sesión existe una sola vez, muestra los nuevos valores y el volumen correcto.
4. Volver a Progreso y comprobar el gráfico de fuerza por ejercicio.
5. Entrar nuevamente, cambiar un valor y pulsar Cancelar: no debe guardar.
6. Probar peso vacío, negativo y superior a 99999, y reps > 100: no deben guardarse.
7. Sin conexión, editar una sesión ficticia; reconectar y comprobar recuperación en otro dispositivo de la MISMA cuenta.
8. Con QA-B, comprobar aislamiento: los registros de QA-A no deben aparecer.
9. Revisar en Safari PWA iPhone y Mac/Chrome, temas claro/oscuro y viewport 320, 375, 390, 430, 768 y 1920.
10. Confirmar que Cancelar y el botón Volver descartan la edición. VoiceOver debe anunciar nombre, serie, peso y reps.

## Estado

Rama sugerida: qa/perci-historical-sets-v1-10. Pendiente publicación en Vercel perci-qa (Preview), pruebas manuales y aprobación del Product Owner. No promover a main automáticamente.
