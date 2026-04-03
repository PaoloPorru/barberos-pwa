-- Utenti in auth.users senza riga in public.profiles (es. prima del trigger).
-- Esegui in SQL Editor (o psql con permessi su auth.users).
-- Metadata: stesso schema del trigger (raw_user_meta_data o alias).
INSERT INTO public.profiles (id, first_name, last_name, email, phone, role)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(COALESCE(m.meta->>'first_name', '')), ''), 'Utente'),
  COALESCE(NULLIF(TRIM(COALESCE(m.meta->>'last_name', '')), ''), 'Nuovo'),
  NULLIF(TRIM(COALESCE(jr.b->>'email', '')), ''),
  NULLIF(TRIM(COALESCE(m.meta->>'phone', '')), ''),
  'CLIENT'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
CROSS JOIN LATERAL (SELECT to_jsonb(u) AS b) AS jr
CROSS JOIN LATERAL (
  SELECT COALESCE(
    jr.b->'raw_user_meta_data',
    jr.b->'raw_user_metadata',
    jr.b->'user_metadata',
    '{}'::jsonb
  ) AS meta
) AS m
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
