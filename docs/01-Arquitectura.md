# Percí v0.5 · Fase B, Paso 1: arquitectura

## Qué se entregó
Se preservó la interfaz funcional del HTML v0.4 y se reorganizó como aplicación web estática:

```
index.html              entrada HTML y metadatos PWA
src/styles.css          estilos existentes; SIN rediseño
src/app.js              interfaz y flujos del prototipo v0.4
src/brand.js            referencias a los 6 logos oficiales SVG
src/domain/initial-state.js  datos demo, fecha y semilla
src/data/repository.js  adaptador de localStorage, respaldo
src/pwa.js              registro del service worker
sw.js                   caché offline del shell de la aplicación
manifest.webmanifest    instalación en pantalla de inicio
assets/                 logo original, iconos PWA
legacy/                 HTML v0.4 original sin cambios
```

## Decisiones
- Sin framework ni dependencias de NPM en el paso inicial. Se prioriza fidelidad y evolución segura.
- Módulos nativos ES para dividir responsabilidades. La lógica interactiva todavía se mantiene en `app.js`; extraer servicios/componentes gradualmente en próximos pasos.
- Se mantiene la clave existente `perci_paso3_review_v2`, evitando migraciones destructivas para quienes abren la v0.5 desde el **mismo origen** web donde usaron la v0.4.
- La instalación offline cubre HTML/CSS/JS/SVG/íconos. Fotos de Unsplash y tipografías de Google pueden requerir internet; hay degradación visual por colores/tipografía de respaldo.
- No existe autenticación, Supabase, sincronización, GPS ni acceso a datos de Salud de Apple. No usar para almacenar datos sensibles.
- Los 46 frames de Figma siguen como referencia secundaria, no fuente ejecutable.

## Antes de agregar Supabase
1. Definir esquema, restricciones e identidades de usuario.
2. Crear ambiente de desarrollo seguro y políticas Row Level Security.
3. Definir sincronización offline-first y estrategia de conflictos, sin afirmar sincronización antes de que exista.
4. Probar migración desde localStorage con respaldo, consentimiento y posibilidad de reversión.
5. Mover `app.js` hacia módulos UI/controlador sin alterar flujos probados.
