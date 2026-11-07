# Percí v1.6.2 · Evitar conflictos duplicados entre dispositivos

Base publicada: v1.6.1 (GitHub `main`, SHA `c7112c66becc75771644141a4f70145f9a7317e4`).

## Problema observado en el piloto

Después de editar una rutina en Mac e iPhone simultáneamente, el iPhone detectó el conflicto. El usuario eligió conservar `TEST IPHONE 2`. Ambos dispositivos mostraron el nombre correcto, **pero la Mac volvió a pedir la misma decisión**. Esto causa fricción y el riesgo de revertir una decisión correcta.

## Corrección

- La reconciliación sin cambios pendientes ahora usa **la última copia remota confirmada para ese usuario** como referencia común: `baseline` + estado local + estado remoto.
- Si la copia de Mac no cambió desde esa referencia, una decisión posterior tomada desde iPhone se aplica automáticamente. **No aparece otro modal.**
- Si ambos dispositivos tienen modificaciones genuinas sobre el mismo registro desde esa referencia, sí se conserva la pantalla de conflicto.
- Si todavía no hay referencia sincronizada, se mantiene el comportamiento prudente anterior: pedir decisión sobre dos copias incompatibles.
- Al resolver un conflicto real del flujo inicial también se usa la misma lógica de tres vías, para no regresar al problema durante la resolución.
- La copia de seguridad local y la persistencia por cuenta existentes se conservan.

Sin cambios en Supabase, tablas SQL, API, cookies, credenciales, endpoints o esquema de datos.

## Controles técnicos

- 101 tests JavaScript, incluidos 7 tests de regresión de esta versión.
- 43 pruebas Python, sin utilizar credenciales ni datos reales de Supabase.
- Todas las referencias PWA e imports actualizadas a v1.6.2, sin mezclar caché antigua.

Las pruebas automatizadas de conciliación **no sustituyen** el ensayo real en Safari iPhone y Mac.

## QA real del Product Owner, solo con Xecloto

1. Antes de instalar, exportar respaldos JSON desde todas las cuentas usadas para entrenamiento real. No borrar datos ni cerrar sesiones necesarias para el respaldo.
2. Publicar con el script. Confirmar que Vercel termina en `READY` y que iPhone/Mac ejecutan v1.6.2.
3. En ambos dispositivos abrir una misma rutina ficticia, por ejemplo `TEST MAC 3`.
4. Desconectar iPhone, editar nombre a `TEST IPHONE 3` y guardar. En Mac, conectado, editar a `TEST MAC 4` y esperar que termine la sincronización.
5. Reconectar el iPhone, esperar el conflicto genuino y elegir **«Usar cambios de este dispositivo»**.
6. Confirmar que ambos dispositivos muestran `TEST IPHONE 3`, **sin que la Mac vuelva a mostrar un conflicto**. La Mac debe incorporar el cambio de manera automática.
7. Probar también un cambio normal hecho solo en un dispositivo: el otro debe actualizarse sin solicitar decisión.

Si hay un conflicto en Mac, no elegir «Usar cambios de este dispositivo» sin verificar primero el estado en la nube: podría devolver la rutina a una versión anterior. Registrar captura y detener la prueba. No realizarla sobre entrenamientos de Valen o Facu.

## Riesgo pendiente de arquitectura

El backend utiliza una comparación optimista de snapshots que no es una transacción atómica entre tablas. Se recomienda revisión atómica/por entidad antes de la beta abierta. Esta v1.6.2 corrige un falso conflicto de UI, **no declara resueltos todos los escenarios de carreras de escritura**.
