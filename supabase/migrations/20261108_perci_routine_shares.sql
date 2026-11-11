-- Percí Share v1.6.5 | Migración ADITIVA, sin cambios en tablas de entrenamientos.
-- Ejecutar primero en perci-qa para probar, luego en perci-dev solo al aprobar la publicación.
-- No incluye datos personales, historial, pesos usados ni identidades en el payload compartido.
BEGIN;

CREATE TABLE IF NOT EXISTS public.perci_routine_shares (
  code text PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_routine_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  CONSTRAINT perci_share_code_format CHECK (code ~ '^PERC-[A-Za-z0-9_-]{16}$'),
  CONSTRAINT perci_share_source_len CHECK (length(source_routine_id) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS perci_share_active_source_unique
  ON public.perci_routine_shares(owner_id, source_routine_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS perci_share_owner_idx
  ON public.perci_routine_shares(owner_id);

ALTER TABLE public.perci_routine_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.perci_routine_shares FROM PUBLIC, anon, authenticated;

-- Las funciones operan con permisos del propietario y exigen auth.uid().
-- Es una capability URL: quien recibe el código puede ver solo la instantánea de esa rutina.
CREATE OR REPLACE FUNCTION public.perci_share_create(p_source_id text, p_payload jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_exercises jsonb := '[]'::jsonb;
  v_item jsonb;
  v_sets_text text;
  v_reps_text text;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para compartir.' USING ERRCODE='42501'; END IF;
  IF p_source_id IS NULL OR length(trim(p_source_id)) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Identificador de rutina inválido.' USING ERRCODE='22023';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(p_payload->'name') <> 'string'
     OR jsonb_typeof(p_payload->'exercises') <> 'array'
     OR jsonb_array_length(p_payload->'exercises') NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Rutina para compartir inválida.' USING ERRCODE='22023';
  END IF;
  v_name := trim(p_payload->>'name');
  IF length(v_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Nombre de rutina inválido.' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'exercises') LOOP
    IF jsonb_typeof(v_item) <> 'object'
       OR jsonb_typeof(v_item->'name') <> 'string'
       OR length(trim(v_item->>'name')) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'Ejercicio inválido.' USING ERRCODE='22023';
    END IF;
    v_sets_text := v_item->>'sets';
    v_reps_text := v_item->>'reps';
    IF v_sets_text IS NULL OR v_sets_text !~ '^[0-9]{1,2}$'
       OR v_reps_text IS NULL OR v_reps_text !~ '^[0-9]{1,3}$'
       OR v_sets_text::integer NOT BETWEEN 1 AND 15
       OR v_reps_text::integer NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Series y repeticiones inválidas.' USING ERRCODE='22023';
    END IF;
    v_exercises := v_exercises || jsonb_build_array(jsonb_build_object(
      'name', trim(v_item->>'name'),
      'sets', v_sets_text::integer,
      'reps', v_reps_text::integer
    ));
  END LOOP;

  -- Si compartís otra vez la misma rutina, mantiene un código estable
  -- y actualiza la instantánea. Los receptores conservan copias independientes.
  UPDATE public.perci_routine_shares
     SET payload = jsonb_build_object('name',v_name,'exercises',v_exercises),
         updated_at = now(), expires_at = now() + interval '90 days'
   WHERE owner_id = v_uid AND source_routine_id = p_source_id AND revoked_at IS NULL
   RETURNING code INTO v_code;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;

  IF (SELECT count(*) FROM public.perci_routine_shares
       WHERE owner_id = v_uid AND revoked_at IS NULL) >= 100 THEN
    RAISE EXCEPTION 'Alcanzaste el límite de rutinas compartidas.' USING ERRCODE='22023';
  END IF;

  -- 64 bits aleatorios, sin extensiones adicionales. Código de 16 caracteres.
  -- Usamos 2 UUID independientes para evitar los bits fijos de la versión UUID.
  v_code := 'PERC-' || upper(
    substr(replace(gen_random_uuid()::text,'-',''),1,12) ||
    substr(replace(gen_random_uuid()::text,'-',''),1,4));
  INSERT INTO public.perci_routine_shares(code,owner_id,source_routine_id,payload)
  VALUES (v_code,v_uid,p_source_id,jsonb_build_object('name',v_name,'exercises',v_exercises));
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.perci_share_get(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión para importar.' USING ERRCODE='42501'; END IF;
  IF p_code IS NULL OR p_code !~ '^PERC-[A-Za-z0-9_-]{16}$' THEN RETURN NULL; END IF;
  SELECT payload INTO v_payload
    FROM public.perci_routine_shares
   WHERE code = p_code AND revoked_at IS NULL AND expires_at > now();
  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.perci_share_revoke(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Iniciá sesión.' USING ERRCODE='42501'; END IF;
  UPDATE public.perci_routine_shares
    SET revoked_at = now(), updated_at = now()
    WHERE code = p_code AND owner_id = auth.uid() AND revoked_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.perci_share_create(text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perci_share_get(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.perci_share_revoke(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perci_share_create(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perci_share_get(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.perci_share_revoke(text) TO authenticated;

COMMIT;
