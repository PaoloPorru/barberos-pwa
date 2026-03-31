-- ============================================================
-- BARBEROS — Fix registrazione (500 su /auth/v1/signup)
-- Esegui in Supabase → SQL Editor se la signup fallisce con
-- x_sb_error_code: unexpected_failure
-- ============================================================
--
-- Cause frequenti:
-- 1) Trigger handle_new_user: search_path non impostato, INSERT duplicato,
--    o ruolo nei metadata non valido per il CHECK su profiles.role
-- 2) Email: SMTP non configurato o errore invio → a volte 500 su signup
--    (Dashboard → Project Settings → Auth → SMTP / disabilita conferma email per test)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Se la riga sopra dà errore di sintassi (Postgres vecchio), usa:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
