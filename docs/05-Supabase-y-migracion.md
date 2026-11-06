# Fase B · Paso 2: modelo Supabase y migración segura

## Situación real

- Percí v0.5/v0.6 funciona mediante `localStorage` con clave `perci_paso3_review_v2`.
- Tener el HTML funcionando y crear una rutina en Safari **no** implica sincronización entre Mac y iPhone.
- **v0.6 no inicia sesión, no hace peticiones a Supabase, no modifica información existente ni sube datos**.
- Al entrar, genera si es posible una copia puntual del estado antes de comenzar la nueva etapa; para respaldo frente a pérdida del navegador exportar JSON sigue siendo obligatorio.

## Entidades SQL

| Entidad | Descripción |
|---|---|
| perci_profiles | Usuario autenticado, tema, preferencia y zona horaria |
| perci_routines | Rutinas; client_id guarda la identidad legada del navegador |
| perci_routine_exercises | Ejercicios planificados y orden; solo para rutinas |
| perci_activity_records | Historial único: gym, walk, run, cycle, sport, other |
| perci_workout_sets | Detalle real de series; no se inventa información histórica |
| perci_habits | Días programados y pausado |
| perci_habit_checks | Cumplimientos por fecha local del usuario |
| perci_workout_drafts | Un borrador de sesión activo por usuario |

Todos los datos están vinculados por `user_id` a `auth.users`. Los hijos que referencian otros objetos utilizan **foreign keys compuestas con user_id** para impedir referencias cruzadas entre cuentas incluso ante IDs conocidos.

## Seguridad

- RLS en las ocho tablas, políticas separadas `select / insert / update / delete` solo para el propietario `(select auth.uid()) = user_id`.
- Se revocan privilegios de `anon` y `public`; se concede solo CRUD a `authenticated`.
- Índices por usuario, restricciones de dominio y `unique(user_id,client_id)` para prevenir duplicados de importación.
- En esta versión el SQL **no se ejecutó en Supabase**. Hay que probar tanto acceso propio como bloqueo ajeno/anon desde una base real antes de usarlo.
- No usar `service_role` en el navegador. Los registros son privados; no se almacenan diagnósticos ni información médica.

## Correspondencia desde v0.4

1. Se preservan los IDs de navegador como `client_id = perci-v04:<entidad>:<id>`; el servidor asignará un UUID real. El identificador legacy mantiene la idempotencia.
2. Las rutinas crean filas `perci_routines`, seguidas por `perci_routine_exercises` con orden y objetivos.
3. `state.records` migra a `perci_activity_records`; en `gym` el registro histórico puede tener solo totales `setsDone` y `volume`, no serie por serie.
4. `state.habits` se convierte en `perci_habits` y `state.checks` en `perci_habit_checks` con fechas locales.
5. `state.draft` queda en `perci_workout_drafts`; si hay sesión activa se recomienda terminarla antes de una migración real.
6. `state.demo === true` **no asegura** que todos los datos sean ficticios: pueden convivir rutinas creadas por vos y los ejemplos iniciales. La próxima herramienta debe permitir seleccionar cuáles migrar.

## Protocolo de migración futuro (NO implementado en v0.6)

1. Crear proyecto Supabase **de desarrollo**, correr migración SQL y verificar políticas con dos usuarios diferentes.
2. Habilitar login (correo y contraseña o magic link) con sesión segura; nunca asumir qué usuario es dueño del almacenamiento local.
3. Hacer `Exportar datos JSON` del navegador. Validar esquema local y mostrar vista previa explícita (incluido el aviso de datos demo).
4. Pedir confirmación del usuario para importar. Guardar respaldo y registrar estado de lote.
5. Crear perfil, rutinas y ejercicios, historial y hábitos, vinculados siempre al usuario autenticado, con claves client_id estables.
6. Verificar lectura completa con la sesión del usuario antes de mostrar éxito remoto. Reconciliar cantidades y comprobaciones de integridad.
7. Mantener el estado local intacto durante una ventana de rollback. Resolver discrepancias antes de activar sync bidireccional.

## Para el siguiente paso

**Fase B · Paso 3:** configurar Supabase DEV, probar permisos, agregar Auth, implementar importación explícita con respaldo reversible y verificación de escritura. Se necesitará la URL pública y `publishable key` del proyecto de desarrollo; nunca una `service_role` key. Evitar compartir contraseñas.

Ver documentación oficial: https://supabase.com/docs/guides/database/postgres/row-level-security
