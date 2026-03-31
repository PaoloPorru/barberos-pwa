-- ============================================================
-- BARBEROS — Fix registrazione
-- Errore tipico: "Database error saving new user" / unexpected_failure
-- Esegui TUTTO in Supabase → SQL Editor → Run
-- ============================================================
--
-- Cause n°1: il trigger inserisce in profiles ma il ruolo interno di Auth
-- (supabase_auth_admin) non ha permesso su public.profiles → fallisce l'INSERT.
--
-- Cause n°2: SMTP / conferma email (Project Settings → Auth).
--
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
  ln text;
BEGIN
  fn := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  ln := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');

  INSERT INTO public.profiles (id, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(fn, 'Utente'),
    COALESCE(ln, 'Nuovo'),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    'CLIENT'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Proprietario postgres + permessi per Auth (hosted Supabase)
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Se la riga sopra dà errore di sintassi, in Postgres ≤14 usa:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
