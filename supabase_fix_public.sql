-- Solo schema public (nessun accesso a auth.users).
-- Usabile se l’SQL Editor del dashboard dà "Failed to fetch" su api.supabase.com:
-- esegui con psql + DATABASE_URL (host db.xxx.supabase.co, non api.supabase.com).
--
--   ./scripts/run-sql.sh supabase_fix_public.sql

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (get_my_role() = 'ADMIN');

-- Se mancano anche select/update, esegui l’intero supabase_schema.sql (sezione RLS) via psql.
