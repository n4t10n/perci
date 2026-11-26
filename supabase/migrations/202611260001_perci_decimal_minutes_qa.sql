-- QA ONLY: project vafurtauwarukdcopjnh. Verify project in dashboard before execution.
-- No UPDATE/DELETE of activity rows; integer -> numeric preserves existing values exactly.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $migration$
DECLARE
  fn text;
  fn_oid regprocedure := to_regprocedure('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)');
  old text := $a$(v_item->>'minutes')::integer$a$;
  replacement text := $a$(v_item->>'minutes')::numeric$a$;
  column_type text;
BEGIN
  IF fn_oid IS NULL THEN RAISE EXCEPTION 'STOP: missing atomic RPC'; END IF;
  SELECT pg_get_functiondef(fn_oid) INTO fn;
  IF position($a$exerciseContextVersion' is distinct from '3'$a$ IN fn)=0
     OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn_oid) THEN
    RAISE EXCEPTION 'STOP: unexpected RPC version or security';
  END IF;
  SELECT data_type INTO column_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='perci_activity_records' AND column_name='minutes';
  IF column_type IS DISTINCT FROM 'integer'
     OR (length(fn)-length(replace(fn,old,'')))/length(old)<>1 THEN
    RAISE EXCEPTION 'STOP: schema or RPC anchor changed; inspect before migration';
  END IF;
  ALTER TABLE public.perci_activity_records ALTER COLUMN minutes TYPE numeric USING minutes::numeric;
  EXECUTE replace(fn,old,replacement);
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=fn_oid)
     OR position(replacement IN pg_get_functiondef(fn_oid))=0
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.perci_activity_records'::regclass) THEN
    RAISE EXCEPTION 'STOP: failed postcondition';
  END IF;
END;
$migration$;
COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT data_type='numeric' AND numeric_scale IS NULL AS decimal_minutes
FROM information_schema.columns WHERE table_schema='public' AND table_name='perci_activity_records' AND column_name='minutes';
SELECT position($a$(v_item->>'minutes')::numeric$a$ IN pg_get_functiondef('perci_private.perci_commit_snapshot_impl(bigint,jsonb,jsonb)'::regprocedure))>0 AS decimal_rpc;
