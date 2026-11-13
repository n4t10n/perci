# Percí v1.9.0 · UX, WCAG 2.2 AA y heurísticas · QA

**Rama:** `qa/perci-ux-accessibility-v1-9` · **Base:** main v1.8.4. No se despliega a producción.

## Cobertura P0 / P1 / P2

- P0: selección de días con teclado y nombres de días completos; campos «series» y «reps objetivo» etiquetados por ejercicio.
- P1: foco de apertura, trap de Tab, Escape y retorno del foco en modales; `aria-pressed` en ajustes/onboarding; calendarios semánticos; comprobación de `save()` antes de anunciar guardado; estado de última comprobación online verificada en Cuenta; contrastes de texto secundario.
- P2: tokens de espacio, orden responsive 701–1100px, aumento de targets pequeños, jerarquía de serie en curso, instrucciones del editor, ajustes de texto para mobile, reducción de movimiento y contraste aumentado.

## Automatizadas (debe pasar todo)

`npm test` · `python3 -m unittest discover -s tests -p 'test_*.py' -v` · `git diff --check`.

## Prueba manual: vista y teclado

Probar viewport **320, 360, 375, 390, 430, 480, 700, 701, 768, 950, 951, 1024, 1280, 1440 y 1920 CSS px**. Repetir en claro/oscuro y zoom 200%; revisar horizontal scroll, texto cortado y navegación visible. En iPhone instalar PWA y verificar el safe-area/bottom-nav y calendario nativo.

1. **Registro/login**: contraseña correcta/errónea, confirmación, autocompletar, errores anunciados. Navegar sin mouse.
2. **Onboarding**: cambiar tema y enfoque con teclado; VoiceOver anuncia «pulsado/no pulsado». Ir a Inicio.
3. **Inicio/navegación**: navegar todas las secciones con Tab; la nueva pantalla enfoca su título. Abrir modal de cancelación: Tab/Shift+Tab no sale del diálogo; Escape lo cierra y vuelve al botón disparador.
4. **Actividad/rutinas**: crear rutina, nombrar, añadir ejercicio; VoiceOver lee «Series de [ejercicio]», «Repeticiones objetivo de [ejercicio]». Reordenar por flechas, renombrar, editar, duplicar, eliminar. Confirmación accesible.
5. **Compartir**: generar código, importar con una segunda cuenta, intentar duplicado, revocar código; no afecta rutina origen.
6. **Sesión**: iniciar, confirmar/desmarcar series, «Usar anterior» con teclado, descanso y fecha. Progreso anunciado. Cancelar y volver a iniciar; finalizar y verificar historial.
7. **Otras actividades**: guardar caminata/deporte con fecha/duración/notas; probar datos inválidos. En un test controlado de almacenamiento fallido, **no** debe decir «Guardado». 
8. **Progreso**: filtros, historial, editar fecha/duración, borrar/restaurar borrador; calendario leído con estado por día; gráficos incluyen descripciones.
9. **Hábitos**: crear desde teclado; Tab llega a cada día y Espacio alterna; nombre completo en VoiceOver; completar, pausar, reanudar, eliminar. Calendario anuncia completados y programados.
10. **Cuenta/offline**: mirar «Estado de tus datos», editar sin conexión en dispositivo previamente autenticado, reconectar, verificar en otro dispositivo. No anunciar última comprobación si está pendiente o fallida.
11. **Ajustes/exportación**: comprobar tema claro/oscuro/auto, enfoque, exportar y restaurar backup con datos de prueba.

## Gate de aprobación QA

- [ ] `npm test` y Python pasan en rama QA, sin modificar `main`.
- [ ] Nada se sale a 320–1920 px en ambos temas y con texto ampliado.
- [ ] Teclado/VoiceOver completan procesos críticos sin perder foco.
- [ ] Guardados fallidos preservan datos y no muestran éxito engañoso.
- [ ] Offline y sincronización están verificados con cuentas QA-A y QA-B.
- [ ] El despliegue Vercel corresponde al SHA de la rama QA.
- [ ] Owner aprueba QA antes de abrir PR para `main`.

**Alcance**: esta actualización automatiza revisiones estructurales pero no certifica cumplimiento WCAG. Las pruebas reales de VoiceOver, Safari y E2E son obligatorias para aprobar.
