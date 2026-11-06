# Percí v1.5.1 · Auditoría visual transversal

Versión de pulido sobre v1.5, sin cambios a Supabase ni a los flujos de autenticación, sincronización o entrenamiento.

## Cambios

- Estado vacío «Mis hábitos»: jerarquía accesible, separación de 16 px entre descripción y CTA (sin `<br/>`).
- Rail desktop: misma grilla y centro del ícono para navegación principal, Mi cuenta y Ajustes. Ícono personal distinto de Inicio.
- Sidebar online: «Cuenta conectada» en lugar de afirmar que existe un respaldo confirmado.
- Accesibilidad: objetivos táctiles de 44 px para controles pequeños, estado seleccionado accesible en tipo de actividad y filtros, contraste reforzado en tema claro.
- Robustez responsive: nombres de hábitos y rutinas, correos largos, cabeceras y grids internos toleran pantallas angostas.
- Footer: elimina detalles técnicos de implementación del texto para usuarios.
- Cache del service worker y grafo de módulos sincronizados en `?v=1.5.1`.

## Cobertura

Auditoría estática de Inicio, Actividad, Rutinas, Biblioteca, Sesión, Progreso, Historial, Hábitos, Cuenta, Ajustes, formularios, estados vacíos y navegación mobile/desktop.

Tests JavaScript y Python automáticos se ejecutan desde el script de actualización. No sustituye validación visual real en Safari iPhone, Mac o Windows. Se recomienda verificar a 375 / 390 / 430 / 768 / 1024 / 1440 px, temas claro y oscuro.

## No se toca

Tablas, políticas SQL, autenticación, cuentas, RLS, rutinas, historial, hábitos guardados, sincronización offline, resolución de conflictos y endpoints.
