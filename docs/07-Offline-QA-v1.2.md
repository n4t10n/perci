# Percí v1.2 · Pruebas que faltan en dispositivos reales

**No empezar hasta exportar el JSON actualizado de la cuenta.** Conservar el archivo fuera del dispositivo de pruebas.

## Escenario A · Borrador de rutina (iPhone Safari)
1. Abrir Percí en línea e iniciar sesión. Esperar que aparezcan Día 1 Full Body y Rutina 2.
2. Cortar internet desde el dispositivo, sin cerrar Safari. Entrar a Actividad → Crear rutina.
3. Confirmar «Crear borrador». Escribir un nombre, agregar ejercicios y editar series/reps.
4. Salir sin pulsar Guardar. Volver a Actividad: debe aparecer «Retomar borrador».
5. Cerrar y reabrir la app offline. Comprobar que «Retomar borrador» conserva nombre, ejercicios y objetivos.
6. Guardar el borrador, conectar internet y esperar sincronización.
7. Abrir Percí en Mac, recargar y comprobar que la nueva rutina se recupera una sola vez.

## Escenario B · Entrenamiento con series sin conexión
1. Comenzar con conexión autenticada y la rutina local descargada.
2. Cortar internet y pulsar Empezar → «Empezar borrador».
3. Introducir peso y repeticiones en una serie. Cerrar y reabrir sin conexión; verificar los valores aunque la serie todavía no esté marcada como completada.
4. Completar algunas series y finalizar el entrenamiento offline. Debe aparecer en el historial local con peso/reps individuales.
5. Reconectar, esperar confirmación de sincronización y entrar con esa cuenta desde otra sesión de Safari o Mac.
6. Comprobar el registro completo de la sesión, volumen y cada serie individual en Progreso → Detalle.
7. Si hay sesión activa al reconectar, debe permanecer local. No se publica en Supabase hasta Finalizar.

## Escenario C · Cambios simultáneos y protección
1. En dos dispositivos, cargar la misma rutina desde Supabase.
2. Desconectar uno y modificar las repeticiones; mantener internet en el otro y modificar el mismo ejercicio con otro valor.
3. Reconectar el primero. Percí debe pedir elegir versión; no debe enviar el borrador a ciegas.
4. Confirmar una elección y verificar que la versión elegida se recupera en otro navegador.
5. Intentar eliminar un registro vinculado: el sistema debe avisar que los borrados todavía no se sincronizan. No marcarlo como guardado en nube.

## Escenario D · Seguridad y PWA
- Primer registro/login completamente offline: debe pedir conexión.
- Después de login online previo, poder reabrir la PWA desde ese dispositivo offline. Limpiar datos del navegador borra los borradores, por eso debe conservarse el respaldo externo.
- Cerrar sesión y entrar con otra cuenta: no ver datos de la cuenta anterior.
- Revisar `perci_at` y `perci_rt` en Safari/DevTools: HttpOnly; Secure; SameSite=Lax bajo HTTPS.
- Verificar en Supabase (dos usuarios) que RLS impida leer/escribir registros del otro.
- Abrir en 375px, 390px, 430px y desktop, revisar que «Preparando tu progreso» centre el párrafo.

**Límite de esta entrega:** no hay sincronización push en tiempo real; cada dispositivo recupera cambios al abrir/recargar Percí. Las eliminaciones aún no se sincronizan. No confundir pruebas con datos simulados y validación contra Supabase real.
