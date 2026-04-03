-- Il trigger su auth.users è incluso in supabase_schema.sql.
-- Usa questo file solo se hai rimosso il trigger e vuoi riattivarlo senza rieseguire tutto lo schema.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rowj jsonb;
  meta jsonb;
  em text;
  fn text;
  ln text;
BEGIN
  SELECT to_jsonb(t) INTO rowj FROM auth.users AS t WHERE t.id = NEW.id;
  IF rowj IS NULL THEN
    RETURN NEW;
  END IF;

  meta := COALESCE(
    rowj->'raw_user_meta_data',
    rowj->'raw_user_metadata',
    rowj->'user_metadata',
    '{}'::jsonb
  );
  em := NULLIF(TRIM(COALESCE(rowj->>'email', '')), '');
  fn := NULLIF(TRIM(COALESCE(meta->>'first_name', '')), '');
  ln := NULLIF(TRIM(COALESCE(meta->>'last_name', '')), '');

  INSERT INTO public.profiles (id, first_name, last_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(fn, 'Utente'),
    COALESCE(ln, 'Nuovo'),
    em,
    NULLIF(TRIM(COALESCE(meta->>'phone', '')), ''),
    'CLIENT'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
