# Percí v1.6 · Entrenamiento real y progreso por ejercicio

Base: Percí v1.5.1, `main` SHA `0c0cf2221dc51aa9e37b3d05288171176b5301c6`. Iteración mobile-first para el piloto controlado de gimnasio de Valen y Facu.

## Novedades

1. **Biblioteca:** campo «Crear ejercicio personalizado» antes del buscador/filtro y antes del listado. Añadir con botón o tecla Enter, sin desplazarse hasta el pie.
2. **Entrenamiento activo:** la serie siguiente se distingue visualmente y el contador solo suma series confirmadas. Se muestra peso/repeticiones de la sesión previa, con «Usar anterior» explícito por número de serie. No se autocompletan datos sin consentimiento.
3. **Descanso opcional:** activar o desactivar; 60, 90 o 120 segundos; inicia al marcar una serie si restan series; omitir/iniciar manualmente. El reloj usa marca temporal absoluta persistida en el borrador local y no requiere servicios de fondo ni notificaciones.
4. **Resumen tras finalizar:** duración real, series confirmadas y volumen en kg calculado desde cada serie, con máximo dos decimales. Mantiene detalle por ejercicio.
5. **Progreso por ejercicio:** selector de ejercicios realmente entrenados, peso máximo por sesión, cantidad de sesiones, diferencia respecto de la primera y tendencia visual hasta ocho sesiones. Sin estimaciones de 1RM ni predicciones.
6. **Seguridad de datos:** las métricas se calculan sobre `state.records` de la cuenta activa. Sin endpoints nuevos, credenciales, tablas ni migración SQL. Se conserva sincronización offline-first y verificación remota de v1.5.

## Cómo instalar

1. Exportar respaldo JSON desde ambas cuentas usadas en el piloto.
2. Descargar `Perci_v1.6.zip` y `Perci_v1.6_Actualizar_Main.sh` a Descargas.
3. Ejecutar `bash ~/Downloads/Perci_v1.6_Actualizar_Main.sh ~/Downloads/Perci_v1.6.zip`.
4. Revisar pruebas y diff. Ingresar `s` solo si se desea publicar en `main` y desplegar Vercel. Se crea el tag `perci-v1.5.1-stable` sin alterar `rama-historica`.

## QA antes de dar por aprobado

- En iPhone Safari y PWA instalada, crear una rutina, entrar a Biblioteca y agregar un ejercicio propio sin hacer scroll al final.
- Completar una sesión; registrar pesos y repeticiones reales, y finalizar. Verificar que la pantalla de resumen coincida con el historial de Progreso.
- Repetir el mismo ejercicio en una segunda sesión y comprobar «Última vez», «Usar anterior» y gráfica por ejercicio.
- Activar descanso, confirmar una serie y bloquear/desbloquear iPhone. Debe continuar contando con tiempo real sin interrumpir la sesión.
- Probar primero sin red, recuperar conexión y verificar historial en otro dispositivo con **la misma cuenta**.
- Verificar que Facu no visualice datos de Valen. No utilizar un único usuario compartido.

## Límites / precauciones

- La comparación histórica se hace por nombre normalizado de ejercicio. Dos ejercicios distintos con exactamente el mismo nombre comparten evolución; identificadores estables por ejercicio quedan para una futura mejora del esquema.
- Las series de entrenamientos históricos que no tengan detalle completo no generan datos ficticios.
- El temporizador no emite notificaciones ni sonidos cuando Safari suspende la PWA. Al volver a abrir muestra el tiempo transcurrido real.
- El resumen inmediato es una vista temporal; el registro terminado queda en el historial. Si se recarga, se vuelve a Inicio/Progreso y no se pierde el entrenamiento.
- Las pruebas JS/Python se ejecutan localmente. En este entorno Chromium estaba bloqueado por política del navegador: se requiere QA visual en Safari iPhone y Mac antes de cerrar v1.6.
- Sigue pendiente auditoría de RLS efectiva y concurrencia transaccional para el lanzamiento público. Esta versión está pensada para el piloto cerrado, no un lanzamiento masivo.
