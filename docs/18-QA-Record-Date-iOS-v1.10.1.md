# Percí v1.10.1 · Corrección de fecha de historial en Safari iOS

## Hallazgo del piloto
La fecha del detalle de entrenamiento podía desbordar hacia la derecha en Safari iPhone, a diferencia de Duración y Nota.

## Ajuste
- Contenedor propio `.record-date-control`, recortado y con `width/max-width: 100%`.
- Fecha visible centrada. Input `type=date` nativo superpuesto, transparente, enfocable y con etiqueta para VoiceOver.
- Evento `change` actualiza el texto visible sin modificar el registro hasta pulsar Guardar cambios.
- Identidad PWA de JS/CSS y Service Worker v1.10.1, conservando el módulo de cálculos de series v1.10.0.
- Sin migraciones, sin cambios de Supabase ni de DEV.

## QA de aceptación
1. iPhone Safari PWA: Progreso > Historial > Entrenamiento; la fecha debe caber y alinearse con Duración/Nota.
2. Tocar fecha: debe abrirse selector nativo y cambiar la fecha visible.
3. Guardar cambios: fecha persistida y recuperable desde otro dispositivo.
4. Verificar edición de series finalizadas aún correcta.
5. Contrastar tema claro/oscuro; tamaños mobile 320, 375, 390 y 430 px; desktop 1440 y 1920 px.

## Estado
Implementación en rama QA `qa/perci-record-date-layout-v1-10-1`; pruebas manuales pendientes.
