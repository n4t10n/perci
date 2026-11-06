# Modelo de datos propuesto · NO implementado en backend

Este paso conserva el esquema v0.4 en localStorage y define entidades candidatas para Fase B.

| Entidad | Campos principales | Relación |
|---|---|---|
| Perfil | id, preferencias, tema, zona horaria | 1 perfil por usuario |
| Rutina | id, perfil_id, nombre, estado | 1:N ejercicios planificados |
| Ejercicio de rutina | id, rutina_id, nombre, orden, series, reps_objetivo | catálogo o personalizado |
| Sesión | id, perfil_id, rutina_id?, fecha, duración, estado | 1:N series realizadas |
| Serie realizada | id, sesion_id, ejercicio, orden, peso_kg?, reps, completada | distingue plan de ejecución |
| Actividad libre | id, perfil_id, tipo, disciplina?, fecha, minutos, distancia_km?, nota | caminar, correr, bici, deporte, otra |
| Hábito | id, perfil_id, nombre, días programados, pausado | 1:N completados |
| Cumplimiento de hábito | id, habito_id, fecha, completado | por fecha local |
| Evento de sincronización | id, tipo, estado, actualizado_en, revisión | futuro; sin implementar |

**Reglas:** gimnasio no obligatorio; preferencias no bloquean actividades; historial reúne sesiones y actividades libres con métricas contextuales; datos solo del usuario autenticado; idempotencia y marcas de tiempo para resolver duplicados; nunca declarar éxito remoto sin confirmación real.
