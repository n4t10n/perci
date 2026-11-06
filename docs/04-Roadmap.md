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

## 06/11/2026 · Percí v1.2 · Entrega para QA
- [x] Guardado automático de borradores del editor de rutinas por cuenta.
- [x] Registro de series y valores en sesión abierta, sin necesidad de red.
- [x] Conservación de peso/repeticiones de cada serie completada en la tabla ya existente perci_workout_sets, con lectura remota verificada.
- [x] Cola persistente de cambios por cuenta, con replay solo tras comparación de 3 vías.
- [x] Confirmación POST + lectura remota y revisión de versión de cola antes de descartarla.
- [x] UI de modo borrador / pendiente / conflicto, pantalla de carga centrada en 390 px.
- [x] Caché PWA versionada para módulos actualizados.
- [x] Pruebas unitarias JS y Python.
- [ ] Publicar código en `main` y validar el flujo offline real desde Safari iPhone / navegador Mac.
- [ ] Enviar un borrador desde iPhone, reconectar y validar lectura en Mac, y viceversa.
- [ ] Probar concurrencia contra Supabase con dos sesiones simultáneas y dos usuarios (RLS).
- [ ] Implementar borrados sincronizados con tombstones/versiones y transacciones, sin perder datos.


## 06/11/2026 · Percí v1.4 · Entrega para QA
- [x] Eliminar rutinas y hábitos por cuenta; eliminación de dependientes en Supabase mediante FKs existentes.
- [x] Replay offline y confirmación de ausencia en lectura remota.
- [x] Proteger edición concurrente vs borrado, incluyendo cumplimientos de hábitos.
- [x] Suite automatizada ampliada con cuentas simuladas y validación de propietario.
- [ ] Publicar tras respaldo JSON y probar con datos de demostración en Mac+iPhone reales.
- [ ] RLS real de dos cuentas y resolución atómica con tombstones/versiones de servidor.
- [ ] Beta externa de la Fase C, accesibilidad y pruebas de usabilidad completas.
