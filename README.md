# Percí v1.0 · GitHub + Vercel + Supabase (DEV)

> **Estado:** código preparado para publicación. **No está desplegado** en GitHub/Vercel ni validado contra Supabase real. No reemplaza la verificación en Safari, RLS con dos cuentas y migración de datos personales.

## Arquitectura

- `public/`: PWA HTML/CSS/JS; Vercel sirve estos archivos estáticos.
- `api/`: Python Functions de Vercel para auth y respaldo; usa la clave **publishable** y el JWT del usuario. Sin `service_role` y sin almacenar credenciales en archivos persistentes.
- `api/shared.py`: cookies host-only `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS (Vercel); access/refresh tokens gestionados del lado servidor, con consulta a Supabase Auth en cada petición privada y renovación al expirar.
- `server/perci_server.py`: lógica reutilizada de Supabase Auth/PostgREST y utilitario de servidor local heredado. **No se ejecuta como proceso persistente en Vercel.**
- `supabase/migrations/`: migración de referencia **ya aplicada** en `perci-dev`; NO ejecutarla otra vez.
- `tests/`: pruebas locales sin consumir la cuenta de Supabase.
- `.github/workflows/qa.yml`: corre pruebas en GitHub Actions en cada push/PR.

**No se alteró Supabase** ni se modificaron tablas en esta entrega.

## Publicar por primera vez (GitHub + Vercel)

1. **Respaldo:** desde Percí en Safari, exportá el JSON actualizado. Guardalo fuera del repositorio. No borres tus datos de `localhost`.
2. **GitHub:** creá un repositorio **privado** y vacío, p. ej. `perci` en una cuenta que controles. El repositorio debe contener los archivos de esta carpeta en su raíz (`public`, `api`, `.gitignore`, `vercel.json`, etc.).
3. En Terminal, dentro de esta carpeta, corré:

   ```bash
   git init
   git add .
   git commit -m "feat: Percí DEV para Vercel con sesiones seguras"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/perci.git
   git push -u origin main
   ```

   Reemplazá `TU-USUARIO`. GitHub puede requerir autenticación. **Verificá con `git status` que `.env` no figure como agregado** antes de publicar.
4. **Vercel:** [New Project](https://vercel.com/new) → Import Git Repository → elegí `perci`. Framework preset: **Other** (el proyecto incluye Python Functions nativas). Root Directory: `./`; no fijar un build command propio ni output directory. Vercel servirá `public/` y `/api/*`.
5. En Vercel, **Settings → Environment Variables**, añadí exactamente:

   ```dotenv
   SUPABASE_URL=https://faoilcfpfijyzichwdmj.supabase.co
   SUPABASE_PUBLISHABLE_KEY=<COPIAR_DESDE_SUPABASE_API_KEYS>
   ```

   Aplicá las variables a Preview y Production **solo mientras ambos despliegues sean de desarrollo**, y desplegá nuevamente si las añadiste después del primer deploy. La clave publishable es pública, pero no incluyas ninguna `sb_secret_` ni `service_role`.
6. Una vez Vercel asigne `https://<tu-proyecto>.vercel.app`, agregá en **Supabase → Authentication → URL Configuration** esa dirección como **Site URL** y `https://<tu-proyecto>.vercel.app/**` en Redirect URLs. Conservá `http://localhost:5173/**` en Redirect URLs si querés seguir probando localmente.
7. Abrí el dominio Vercel en Safari: Registro → Confirmación de email → Login → Mi cuenta. Validá en DevTools que la cookie tenga `HttpOnly; Secure; SameSite=Lax`. El registro y el login tienen que funcionar antes de migrar tus datos.
8. **Solo cuando el login funcione**, en el dominio Vercel iniciá sesión, abrí **Ajustes → Importar copia JSON** y seleccioná tu respaldo de Percí. Si el respaldo tiene `demo: true`, este código elimina rutinas/actividades/hábitos de ejemplo y conserva rutinas reales. Revisá `Día 1 Full Body` antes de utilizar **Mi cuenta → Guardar mis rutinas en la nube**. Confirmá ejercicios y series en Supabase, volvé a importar sólo tras revisar duplicados. Conservá el JSON de respaldo.
9. Hacé pruebas de RLS con una segunda cuenta antes de considerar seguro el uso público. La protección offline de v0.9 aún utiliza localStorage no cifrado y se considera **DEV**, no producción clínica.

**Cada `git push` a `main` provocará un despliegue nuevo en Vercel si la integración Git está conectada.** Cambios en archivos de Descargas, en esta conversación o en la copia local **no se suben solos**: hay que confirmar un commit y pushearlo. Los pull requests pueden generar previews. [Documentación Vercel Git](https://vercel.com/docs/git).

## Diagnóstico de `.env` local

La captura de v0.9 con `Percí: modo local disponible` significa que **faltó detectar uno o ambos valores**. `server/perci_server.py` busca el archivo exactamente en la misma carpeta donde están `index.html` y `server/`, y lee **solo `.env`**, no `.env.example`.

Desde la raíz de este proyecto podés ejecutar, sin mostrar claves:

```bash
python3 scripts/check_env.py
```

En Vercel no necesitás subir `.env`: las dos variables van en el dashboard de Vercel.

Para iniciar una prueba local de esta arquitectura (opcional):

```bash
python3 -m api.shared
# http://localhost:5173
```

## Pruebas automatizadas ejecutadas

```bash
npm test
python3 -m unittest discover -s tests -p 'test_vercel_api.py' -v
python3 -m unittest discover -s tests -p 'test_cookie_server.py' -v
```

**Pendiente:** build real de Vercel, sesión Safari y email de confirmación contra Supabase, renovación de cookie bajo HTTPS real, aislamiento entre dos usuarios y migración real sin duplicados.

## Nota importante sobre datos de localhost

`localStorage` es por **origen** (`localhost:5173` y `tu-proyecto.vercel.app` son distintos). Por eso **no** se recuperará automáticamente `Día 1 Full Body` en el dominio nuevo. Necesitás importarlo mediante el JSON o primero respaldarlo a Supabase desde la versión local.

## Seguridad / límites

- La cookie en HTTPS es `HttpOnly; Secure; SameSite=Lax`, sin atributo Domain y con Max-Age hasta 30 días. La verificación de identidad utiliza `/auth/v1/user` con el JWT, y un refresh token puede renovarlo. Supabase RLS controla el acceso real a los datos.
- Para offline, la PWA recuerda el último usuario autenticado y conserva datos en `localStorage` no cifrado. No se debe presentar como seguro contra alguien con acceso físico o DevTools. Para un lanzamiento real habrá que implementar persistencia cifrada y sincronización bidireccional con resolución de conflictos.
- Se habilitó seguridad de origen para POST JSON, pero quedan pendientes limitación de tasa, recuperación de contraseña, auditoría RLS real y revisión de seguridad del despliegue.
- Nunca uses claves de servicio en frontend ni en este proyecto sin revisión técnica explícita.
