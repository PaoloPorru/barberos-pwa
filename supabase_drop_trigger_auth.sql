-- Rimuove il trigger su auth.users (se esiste ancora da uno schema vecchio).
-- NON passa da api.supabase.com: usa psql con la connection string del DATABASE.
-- Dashboard → Project Settings → Database → Connection string → URI (Direct o Transaction).
--
--   export DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@db.[ref].supabase.co:5432/postgres"
--   ./scripts/run-sql.sh supabase_drop_trigger_auth.sql

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
