# Percí v1.5 · Seguridad y estabilidad

**Base:** `main` en `af0fe80e994697f04b3ddbf9129e92c1316a55ce` (Percí v1.4.2). **Estado:** entrega preparada para publicar, pendiente de QA real iPhone/Mac y Supabase DEV. **Sin cambios de esquema** ni nuevas variables de entorno.

## 1. Causa estructural encontrada y resuelta

La v1.4.2 tenía URLs de módulos distintas en `app.js`, `account.js` y `account-ui.js`: en ciertos lugares se cargaba `account.js?v=1.4.1` y en otros `?v=1.4.2`. Además, `index.html` seguía solicitando `app.js?v=1.4.1`. El navegador puede evaluar la misma ruta física como **módulos JavaScript independientes** si las URLs difieren, creando **dos instancias diferentes de estado de cuenta** y fragmentos de interfaz desactualizados.

- Todas las dependencias activas tienen exactamente `?v=1.5` como identidad de módulo, incluidos `account.js`, `account-ui.js`, `offline-outbox.js` y `auto-hydration.js`.
- `index.html`, `sw.js` y las importaciones usan la misma versión; una prueba recorre recursivamente el grafo y falla si encuentra URLs distintas para un mismo módulo.
- El service worker cachea todos los módulos requeridos por esa versión (y nunca cachea `/api`).
- Percí solicita actualizaciones de su SW mientras está visible, ante foco o reconexión y periódicamente. Al activarse una nueva versión, recarga **sólo cuando no hay sesión, formulario, modal ni conflicto abierto**. Un primer cierre y apertura después de instalar v1.5 sigue siendo aconsejable porque v1.4.2 no tenía aún ese observador.

## 2. Ediciones entre dispositivos

- La comparación de tres vías ya contemplaba ediciones simultáneas de un mismo elemento; v1.5 añade **una comprobación del snapshot remoto en el servidor** antes de aceptar una sincronización nueva.
- Si algún dispositivo cambió los registros o los checks entre lectura y envío, la API responde HTTP `409` **sin ejecutar upserts**, y el cliente vuelve a consultar para fusionar o solicitar decisión en caso de conflicto.
- Las solicitudes explícitas de eliminación se ejecutan **después** de pasar la comprobación optimista y se validan contra el estado leído nuevamente.
- **Límite técnico:** todavía no es un compare-and-swap atómico, ni una transacción única sobre las tablas de Supabase. Una carrera dentro de la ventana entre comprobación y escritura requiere en una fase futura una RPC/operación transaccional con revisiones por entidad.

## 3. Auditoría de seguridad

Revisada estáticamente la migración existente: 8 tablas tienen RLS habilitada, 4 políticas por operación con `auth.uid()=user_id`, FKs compuestas para las entidades hijas y el backend usa JWT del usuario con clave pública de Supabase. El cliente no puede determinar el propietario mediante `user_id` enviado: lo establece el servidor desde la sesión autenticada.

**No se verificó RLS en Supabase real.** Para hacerlo sin modificar datos, copiar en el *SQL Editor* de Supabase DEV el archivo de lectura `supabase/audits/20261106_perci_rls_readonly.sql`: deben aparecer 8 tablas, con RLS activada, las 4 políticas y los privilegios `anon` denegados. Además hay que hacer pruebas de lectura/escritura cruzada con JWT A y JWT B de dos cuentas de prueba. No subir credenciales, tokens ni capturas con datos privados al repositorio.

## 4. Publicación y QA de aceptación

1. Exportar JSON por cuenta desde iPhone/Mac antes de la actualización. No borrar caché/almacenamiento ni desinstalar la PWA.
2. Publicar con `Perci_v1.5_Actualizar_Main.sh`, que crea `perci-v1.4.2-stable` y preserva `rama-historica`.
3. Reabrir la PWA iPhone **una vez** al pasar desde v1.4.2 a v1.5; verificar que el HTML se actualizó. Las futuras versiones deberían poder aplicar la actualización automáticamente al terminar una actividad segura.
4. Cuenta A: crear un hábito en iPhone, verificar Mac sin usar «Recuperar mis datos». Hacer la prueba inversa.
5. Cuenta B: confirmar que ninguna rutina/hábito de A aparece. Con los JWTs reales de prueba, verificar las ocho tablas y acceso cruzado usando RLS.
6. Con una misma rutina de prueba abierta en ambos dispositivos, modificar series/repeticiones de forma distinta cuando el otro todavía no refrescó: la app debe detener el conflicto y no sobrescribir silenciosamente. Probar también una edición no conflictiva de dos rutinas distintas.
7. Probar un borrado offline y su confirmación en el otro dispositivo al reconectar.
8. Editar una rutina en iPhone y forzar una nueva versión PWA: la actualización no debe interrumpir el formulario; luego de salir de la edición puede aplicarse.

**Criterio de aprobación:** antes de marcar «v1.5 validada», comprobar los puntos de QA real y el informe RLS. Las pruebas automáticas y la auditoría SQL estática no son sustitutos.
