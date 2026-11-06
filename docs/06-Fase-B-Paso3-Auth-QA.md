# Percí · Fase B / Paso 3 · Checklist de Auth y RLS

## Pruebas exploratorias en Safari Mac (DEV)

- [ ] Abre Inicio cuando existe la rutina local **Día 1 Full Body**.
- [ ] Ajustes muestra «Mi cuenta y nube · DEV» sin modificar el estado local.
- [ ] Rechaza URL fuera de `*.supabase.co` y clave `sb_secret_` o service_role.
- [ ] Con URL y publishable key reales, conecta a Supabase DEV y no revela contraseña en pantalla ni consola.
- [ ] Registro por email muestra confirmación si está configurada.
- [ ] Inicio de sesión muestra usuario autenticado.
- [ ] Cerrar sesión no borra rutinas de Safari.
- [ ] Verificar lectura remota detecta tablas ausentes o falta de permisos.
- [ ] Previsualización propone únicamente rutinas si `demo:true`.
- [ ] Elegir grupos y confirmar solo después de exportar JSON.
- [ ] Importa rutinas/ejercicios y lee exactamente sus `client_id`.
- [ ] Reintenta la misma importación sin duplicar ni sobreescribir.
- [ ] Bloquea importar desde la misma copia local hacia una segunda cuenta tras éxito.
- [ ] Inicio, registro de sesiones y hábitos siguen funcionando incluso sin Supabase.
- [ ] A 375/390/430/1280/1920 y monitores mayores, sin desborde horizontal ni anchura del layout superior a 1920.

## Pruebas de RLS imprescindibles (con dos cuentas de prueba)

1. Crear usuario A y usuario B mediante Auth DEV.
2. Iniciar sesión A, insertar una rutina con `user_id=A.id` usando la clave pública y autenticación normal. Comprobar lectura propia.
3. Iniciar sesión B, consultar por ID de A: debe devolver cero filas.
4. Intentar insertar/actualizar/borrar como B una fila con `user_id=A.id`: debe fallar o no afectar filas.
5. Intentar consultar tablas estando `anon`: no debe poder leer ni escribir datos privados.
6. Comprobar las ocho tablas, incluidas referencias compuestas entre cuentas.
7. No dar por aprobado el paso hasta que RLS y privilegios resulten correctos **en el proyecto real**. Para test avanzado, automatizar con `supabase test db` y pgTAP.

## Criterio de aceptación del Paso 3

Autenticación real verificada en Safari, SQL instalado y permisos probados con dos usuarios, importación selectiva de rutina real verificada con lectura posterior y respaldo JSON preservado. **Esto NO implica sincronización continua**; habrá que diseñarla como tarea separada.
