# Percí v1.6.1 · Correo confirmado, regreso directo al login

Base funcional: v1.6 (SHA b24cfa7b2457737c8f1b6cedaeec737a58ec79eb). No modifica la base de datos, políticas RLS, rutinas ni registros.

## Cambio

Al crear una cuenta, el servidor envía `redirect_to` a Supabase Auth con el destino canónico y estable de Percí:

`https://perci-gamma.vercel.app/?auth=verified`

El callback abre el formulario de inicio de sesión de Percí y muestra un texto prudente: «Si ya confirmaste tu correo, iniciá sesión con tu contraseña». No adopta tokens del fragmento de Supabase: la sesión verdadera se crea al iniciar sesión mediante el servidor y cookies HttpOnly. El navegador elimina de la barra de direcciones el fragmento con tokens, sin guardarlos.

La URL es constante, del lado servidor. Nunca se construye desde parámetros `Host`, `Origin` o datos aportados por el cliente.

## Acción obligatoria en Supabase (una vez)

Dashboard del proyecto Supabase → Authentication → URL Configuration:

- **Site URL:** `https://perci-gamma.vercel.app`
- **Redirect URLs:** agregar **exactamente** `https://perci-gamma.vercel.app/?auth=verified`.

Dashboard → Authentication → Email Templates → Confirm signup:
- El vínculo de verificación debe utilizar `{{ .ConfirmationURL }}` (configuración estándar). Si la plantilla usa una URL fija de Vercel o `{{ .SiteURL }}`, actualizar el enlace a `{{ .ConfirmationURL }}` para que respete el destino solicitado.
- No colocar tokens ni contraseñas en plantillas manualmente.

**Nota:** La primera parte del ajuste está en este ZIP; la segunda reside en el panel de Supabase y no se puede cambiar desde GitHub/Vercel. Si no se actualiza el panel, Supabase podría seguir enviando a la URL anterior. La modificación afecta a enlaces nuevos, no reescribe enlaces antiguos ya emitidos.

## QA piloto

1. Respaldar los datos de Valen y Facu, sin cerrar sus sesiones ni tocar sus cuentas reales.
2. Publicar la v1.6.1 con el script y confirmar estado READY en Vercel.
3. En Supabase, configurar Site URL / Redirect URLs y confirmar el template.
4. Crear **una cuenta nueva de prueba** con un correo válido que nunca haya usado Percí.
5. Abrir el correo y pulsar su enlace. Debe terminar en `https://perci-gamma.vercel.app/`, con el formulario de login y el texto de confirmación.
6. Iniciar sesión con el correo de prueba. Confirmar que no aparecen datos de las cuentas de Valen y Facu.
7. Si vuelve a Vercel, revisar Site URL, allowlist, plantilla y que el correo sea nuevo. No repetir registros sobre cuentas reales.

El script no edita Supabase, no ejecuta migraciones y preserva `rama-historica`.
