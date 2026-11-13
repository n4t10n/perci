# Percí QA v1.11.0 · Biblioteca de ejercicios por grupo muscular

## Alcance
- Sin cambiar rutinas ni registros existentes: se conservan los 12 ejercicios anteriores exactamente por nombre.
- Se agregan 7 ejercicios, uno por grupo: pecho, espalda, piernas/glúteos, hombros, bíceps, tríceps y core.
- La biblioteca tiene filtros accesibles por músculo, contadores y búsqueda por nombre tolerante a tildes.
- Se permite combinar filtros y buscar, agregar ejercicios nuevos o conservar el flujo personalizado.
- Cada ejercicio canónico tiene identificador estable para vincular futuras animaciones GIF en v1.12.0. **Los GIF todavía no están incluidos.**
- No se imponen máximos artificiales de 7 ejercicios por rutina; se preservan los límites vigentes y compartir mediante código.
- Sin migraciones Supabase: catálogo estático público, planes compartidos conservan `name`, `sets`, `reps`.

## Aceptación manual
1. Abrir QA-A en iPhone Safari PWA, Actividad > Crear rutina > Añadir ejercicio. Deben verse 19 ejercicios y 7 categorías más Todos.
2. Seleccionar Pecho, Espalda, Piernas y glúteos, Hombros, Bíceps, Tríceps, Core. Confirmar contenido y contador.
3. Buscar `CURL DE BICEPS` o `Pajaros`, sin tilde; combinar con filtro y comprobar el estado vacío.
4. Añadir «Extensión de tríceps en polea» a la rutina, comprobar 3 series/10 reps predeterminadas, modificar, reordenar y guardar.
5. Cerrar y reabrir PWA, comprobar rutina y sincronización QA-A en Mac; verificar que QA-B no ve esa rutina.
6. Ver que la edición de series históricas y el campo Fecha de v1.10.1 no sufrieron regresiones.
7. Revisar modo claro/oscuro y anchos 320, 375, 390, 430, 768, 1440 y 1920 px.

## Estado
Implementada para ejecutar suite y desplegar a QA. Requiere validación manual del Product Owner antes de iniciar v1.12.0.
