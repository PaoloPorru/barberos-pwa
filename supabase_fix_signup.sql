-- ============================================================
-- BARBEROS — Fix registrazione (solo public, niente auth.users)
-- ============================================================
-- Lo schema principale NON usa più il trigger su auth.users: l’app
-- crea la riga in profiles (policy profiles_insert_own + ensureProfile).
--
-- Per nuovi progetti: esegui supabase_schema.sql (SQL Editor o psql).
--
-- Se l’SQL Editor dà "Failed to fetch" (api.supabase.com), usa il DB diretto:
--   export DATABASE_URL="postgresql://postgres.[ref]:PASSWORD@db.[ref].supabase.co:5432/postgres"
--   ./scripts/run-sql.sh supabase_fix_public.sql
--
-- Progetto vecchio con trigger che rompe la signup:
--   ./scripts/run-sql.sh supabase_drop_trigger_auth.sql
--
-- Trigger automatico opzionale (solo se puoi eseguire SQL su auth.users):
--   supabase_optional_trigger_auth.sql
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (get_my_role() = 'ADMIN');

-- Rimuovi trigger legacy (se l’editor funziona; altrimenti psql + supabase_drop_trigger_auth.sql)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
