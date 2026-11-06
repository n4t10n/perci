# Roadmap Percí · avance 05/11/2026

- Fase A: PRD, prototipo HTML v0.4, pruebas exploratorias del Product Owner. El feedback pendiente se conserva como hallazgos, sin obligar a volver a Figma.
- **Fase B / Paso 1: Aprobado para avanzar** tras validación en Safari del usuario creando una rutina en v0.5.
- **Fase B / Paso 2: Entregado para auditoría (v0.6).** Modelo relacional Supabase (8 tablas), RLS propuesta, prueba local de migración y respaldo no destructivo. Falta probar SQL y RLS en un proyecto DEV real.
- Fase B / Paso 3: configurar ambiente de desarrollo Supabase, Auth, importación con consentimiento y auditoría de permisos antes de conectar la nube.
- Fase B / Paso 4: sync offline-first, recuperación de borradores y manejo de conflictos.
- Fase B / Paso 5: QA cross-device, refinamiento de interfaz y accesibilidad Safari/Windows.

No hacer operaciones destructivas sobre los datos locales ni anunciar sincronización en v0.6.

## Fase B · Paso 3 (v0.7)
- [x] Preparar cliente Supabase DEV configurable con clave pública.
- [x] Registro / ingreso por correo y contraseña, cierre de sesión.
- [x] Verificación de identidad remota mediante getUser().
- [x] Importación explícita de datos seleccionados con respaldo local, verificación de lectura e idempotencia.
- [ ] Configurar URL y clave pública del proyecto DEV del usuario.
- [ ] Ejecutar SQL en Supabase DEV y validar RLS con dos usuarios.
- [ ] Probar alta, confirmación de email, ingreso, logout e importación en Safari Mac e iPhone.
- [ ] Activar sincronización continua bidireccional SOLO después de auditoría (paso posterior).

## Fase B · Paso 3.3 (v0.9) · Acceso de cuenta obligatorio

- Login y registro separados antes de la app; registro con nombre, correo, contraseña y confirmación.
- Datos locales aislados por ID de usuario, adopción explícita y no destructiva del estado legado.
- Avatar con inicial del nombre; modo offline solo para una cuenta autenticada online previamente.
- Work informó `perci-dev` con las ocho tablas y RLS, sin ejecutar nuevamente el SQL en esta versión.
- QA local: pruebas JS/Python y flujo de navegador con Supabase simulado.
- **Pendiente**: confirmar en Safari el registro/login reales, verificación de correo, cookies, RLS con dos cuentas, nube y duplicados.

## 06/11/2026 · Percí v1.1
- [x] Descarga automática desde `/api/cloud/data` al autenticar sesión online en un navegador nuevo.
- [x] Pantalla de carga previa a Inicio, sin acceso a funciones durante la reconciliación.
- [x] Rutinas y actividades de la nube + datos locales exclusivos: combinación por ID.
- [x] Divergencia en el mismo ID: sincronización pausada, elección explícita y respaldo antes de reemplazar.
- [x] Nuevo cache de PWA para evitar módulos viejos.
- [x] Pruebas unitarias y visuales con Supabase simulado (390 px/1280 px).
- [ ] Verificar v1.1 desplegada en Safari real, recuperación automática de Día 1 Full Body y persistencia de cookie.
- [ ] Probar RLS con dos usuarios y reconciliación de registros concurrentes en Supabase real.
- [ ] Implementar sincronización bidireccional robusta (incluidos borrados, versiones y resolución de conflictos). No declarar completa todavía.
- [ ] Conservar `rama-historica` en GitHub y adoptar `main` como rama de trabajo, verificando las variables de entorno en Production.
