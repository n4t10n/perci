-- Percí v1.5: auditoría de lectura de RLS en Supabase DEV.
-- SOLO SELECT. No cambia tablas, permisos, políticas ni datos.
-- Copiar el resultado del informe a QA, NUNCA compartir claves ni datos de usuarios.
WITH tablas(nombre) AS (
  VALUES ('perci_profiles'),('perci_routines'),('perci_routine_exercises'),
         ('perci_activity_records'),('perci_workout_sets'),('perci_habits'),
         ('perci_habit_checks'),('perci_workout_drafts')
),
base AS (
  SELECT t.nombre, c.relrowsecurity AS rls_habilitada,
         c.relforcerowsecurity AS rls_forzada,
         has_table_privilege('anon', c.oid, 'SELECT') AS anon_lectura,
         has_table_privilege('anon', c.oid, 'INSERT') AS anon_escritura,
         has_table_privilege('anon', c.oid, 'UPDATE') AS anon_actualizacion,
         has_table_privilege('anon', c.oid, 'DELETE') AS anon_borrado
    FROM tablas t
    LEFT JOIN pg_class c ON c.relname = t.nombre
    LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
),
pol AS (
  SELECT t.nombre,
         count(p.policyname) AS politicas,
         count(p.policyname) FILTER (WHERE p.cmd = 'SELECT' AND 'authenticated' = ANY(p.roles) AND p.qual LIKE '%auth.uid()%') AS propia_lectura,
         count(p.policyname) FILTER (WHERE p.cmd = 'INSERT' AND 'authenticated' = ANY(p.roles) AND p.with_check LIKE '%auth.uid()%') AS propia_insercion,
         count(p.policyname) FILTER (WHERE p.cmd = 'UPDATE' AND 'authenticated' = ANY(p.roles) AND p.qual LIKE '%auth.uid()%' AND p.with_check LIKE '%auth.uid()%') AS propia_edicion,
         count(p.policyname) FILTER (WHERE p.cmd = 'DELETE' AND 'authenticated' = ANY(p.roles) AND p.qual LIKE '%auth.uid()%') AS propia_eliminacion
    FROM tablas t
    LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename=t.nombre
   GROUP BY t.nombre
)
SELECT b.nombre, b.rls_habilitada, b.rls_forzada, p.politicas,
       p.propia_lectura, p.propia_insercion, p.propia_edicion, p.propia_eliminacion,
       b.anon_lectura, b.anon_escritura, b.anon_actualizacion, b.anon_borrado
  FROM base b JOIN pol p USING (nombre)
 ORDER BY b.nombre;
-- Resultado esperado por tabla: RLS habilitada = true; 4 políticas;
-- una política por operación; accesos anon a estas tablas = false.
-- Nota: la revisión de SQL NO sustituye pruebas de acceso real con JWTs A/B.
