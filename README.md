# Percí v1.1 · Recuperación automática de datos

Aplicación PWA mobile-first (iPhone/Safari, macOS y Windows), con autenticación Supabase mediante cookies gestionadas desde funciones Python en Vercel.

## Novedad principal

Al validar la sesión en Supabase, Percí consulta **GET `/api/cloud/data` antes de presentar Inicio**:

- Si el navegador no tiene datos propios, restaura automáticamente rutinas, actividades, hábitos y cumplimientos. No es necesario tocar **«Recuperar datos de mi cuenta»**.
- Si el navegador ya tiene datos, conserva los registros locales, agrega IDs nuevos de la nube y comprueba los IDs compartidos.
- Si un mismo ID tiene contenido diferente, pausa la sincronización y pide elegir entre la copia local y la remota. Conserva los registros exclusivos de cada copia y crea una copia de seguridad local antes de aplicar la elección.
- Si la nube no tiene registros, no elimina los locales.
- Si falla la conexión, muestra los datos locales disponibles y **pausa el respaldo** hasta poder reconciliar. El botón **«Reintentar sincronización»** en Mi cuenta permite probar nuevamente.
- El `service worker` cambia a `perci-shell-v1.1`, para evitar utilizar módulos anteriores y permitir la carga offline de los nuevos módulos.

**Alcance:** esta versión soluciona la **descarga automática** y el control básico de conflictos. Todavía NO implementa la sincronización bidireccional completa con control de versiones, borrados y conciliación de ediciones concurrentes; se mantiene como entorno de desarrollo hasta validar RLS con dos usuarios y la experiencia Safari iPhone/Mac.

## Estructura

- `public/`: PWA HTML/CSS/JS.
- `public/src/data/auto-hydration.js`: reconciliación pura, sin requests ni escrituras.
- `api/`: Python Functions de Vercel para auth y Supabase. No se necesitan claves secretas ni `service_role`.
- `server/`: lógica de los endpoints y servidor local DEV.
- `tests/`: pruebas de frontend, backend y reconciliación.
- `supabase/migrations/`: referencia SQL **ya aplicada** en perci-dev. NO ejecutar de nuevo sobre tablas existentes.

## Configuración Vercel

Proyecto existente `perci`, cuenta `valendemarco03-gmailcoms-projects`. La rama `main` es la principal de trabajo y Vercel publica automáticamente cada `git push` a `main`; no confundir el check `READY` con un test completo de login o RLS.

En **Project → Settings → Environment Variables**, configurar en el entorno que corresponda (Preview o Production):

```dotenv
SUPABASE_URL=https://faoilcfpfijyzichwdmj.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
```

La clave pública se copia del panel de Supabase y NO debe pegarse en conversaciones. Nunca subir `.env` ni claves `sb_secret_`/`service_role` a GitHub. La app utiliza `perci_at` y `perci_rt` como cookies `HttpOnly`, `Secure` en HTTPS y `SameSite=Lax`.

**Site URL y Redirect URLs** de Supabase Auth deben incluir el dominio final que use el usuario. Si cambia el dominio, actualizar esa configuración antes de registrar usuarios nuevos. Conservá el respaldo JSON de Día 1 Full Body.

## Pruebas

```bash
npm test
python3 -m unittest discover -s tests -p 'test_vercel_api.py' -v
python3 -m unittest discover -s tests -p 'test_cookie_server.py' -v
```

Prueba de navegador controlado (Chromium, mocks de `/api/auth/session` y `/api/cloud/data`): recuperación automática a 390/1280 px y resolución de conflicto en un navegador con copia local. El entorno de test no accede al proyecto real Supabase ni a Safari; ambos requieren QA posterior al deploy.

## Flujo GitHub

Se entrega el script `Perci_v1.1_Actualizar_Main.sh` para integrar de forma segura la rama existente `feat/perci-v1-vercel-supabase` en `main` sin reescribir el historial, conservarla como `rama-historica` y subir v1.1.

**Antes de ejecutar**, confirmá que la configuración **Production** de Vercel tiene las dos variables y que los datos de prueba estén respaldados. El script muestra cambios, corre pruebas y pide confirmación explícita para el push a `main`. Ese push puede generar un despliegue en Production. La antigua rama se borra solo después de una segunda confirmación.

## Validación manual obligatoria

1. Abrir Percí en incógnito, iniciar sesión y comprobar que **Día 1 Full Body** aparece sola, con **6 ejercicios y 23 series**, sin importar JSON.
2. Recargar Safari y verificar que la sesión persiste.
3. Entrar con otra cuenta: verificar que no ve rutinas ajenas (RLS con dos cuentas).
4. Editar una rutina desde dos dispositivos y revisar el aviso de conflicto antes de sincronizar.
5. Desconectar internet después de una sesión válida y registrar actividad local; volver a conectar y comprobar que no se pierde el progreso.
6. En producción, comprobar atributos reales de las cookies y Site URL de Supabase.

**Advertencia sobre datos antiguos:** `localhost:5173` y un dominio Vercel son orígenes distintos. Utilizá un JSON guardado para migrar rutinas locales antiguas. Las copias locales no están cifradas contra acceso físico al navegador.
