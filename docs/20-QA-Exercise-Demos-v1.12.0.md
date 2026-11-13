# Percí · v1.12.0 · Demostraciones ilustrativas GIF (QA)

## Alcance

Se añaden 19 GIFs originales generados para el prototipo (uno por cada ejercicio precargado de v1.11.0) y 19 posters WebP estáticos. Cada animación muestra de forma **esquemática** las posiciones del movimiento. No se usan GIFs externos de terceros ni se pretende reemplazar indicaciones técnicas profesionales.

La interacción es deliberada para no reproducir 19 animaciones simultáneas: en la biblioteca, en el detalle/editor de rutina, en una sesión y en el historial aparece la miniatura estática con botón **Ver movimiento**; al tocarlo se abre una demostración animada en un diálogo accesible. Se mantiene la búsqueda y los filtros por músculo sin modificar los datos de rutina.

## Personalizados equivalentes

La app normaliza los nombres (mayúsculas, tildes y espacios redundantes) con `findCatalogExercise`. Si un ejercicio personalizado coincide **exactamente** con un nombre de catálogo tras normalizar, reutiliza la demostración correspondiente, sin modificar el objeto original, su nombre guardado, sus pesos, su historial ni los metadatos de rutina. Los nombres parecidos, pero diferentes, no reciben GIF por accidente.

## Offline, accesibilidad y rendimiento

- 19 WebP de vista previa precacheados por Service Worker. Los GIFs no se precachean: solo se descargan cuando se solicitan; evita añadir peso a la actualización de la PWA.
- Si no hay conexión y falla cargar el GIF, si falla la imagen animada, o si el sistema tiene `prefers-reduced-motion: reduce`, se muestra la versión estática.
- Alt descriptivo, botón con nombre del ejercicio, diálogo accesible, foco inicial y cierre por Escape implementados sobre la base de v1.9.
- 320–1920 px: miniatura fija, modal responsive, sin cambios en el modelo de datos ni en Supabase.

## Fuente y propiedad de los archivos

Los 19 GIFs y 19 WebP se crearon programáticamente para Percí como ilustraciones esquemáticas originales. No contienen imágenes de Gymvisual, ExerciseDB, RepDB, wger u otros terceros; no requieren adquisición ni atribución de bibliotecas externas. Los diagramas no son instrucciones clínicas ni garantía de una técnica de ejercicio correcta.

## Plan manual QA

- [ ] Abrir biblioteca y comprobar 19 miniaturas; filtrar los 7 grupos y buscar sin tilde.
- [ ] Abrir una animación, cerrarla con botón y Escape (Mac); verificar retorno del foco.
- [ ] Agregar ejercicio precargado, crear rutina y abrir demostración desde rutina y desde sesión en curso.
- [ ] Crear un personalizado llamado `  PÁJAROS   CON MANCUERNAS `, comprobar que muestra mismo GIF; `Pájaros con banda` no debe tener GIF.
- [ ] Comprobar modo offline tras abrir la app, imagen estática de respaldo y que no se pierda el entrenamiento.
- [ ] Activar reducir movimiento en iPhone/Mac: sólo poster estático.
- [ ] Confirmar que los 19 GIFs son distintos y adecuados para una prueba conceptual de diseño. Reemplazar si se detecta alguna representación engañosa.
- [ ] Confirmar sincronización y aislación QA-A/QA-B, sin errores en rutinas ni historial.

**Restricción:** QA Preview únicamente. `main` y Vercel producción permanecen en v1.9.0; nunca usar claves o datos de producción en QA.
