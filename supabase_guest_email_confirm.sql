-- BarberOS — Email ospite + token conferma (DB già esistente)
-- Se il CHECK fallisce: SELECT id, guest_first_name FROM appointments WHERE client_id IS NULL AND (guest_email IS NULL OR btrim(guest_email) = '');
-- Poi imposta guest_email per quelle righe o eliminale.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_confirm_token UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_or_guest_chk;
ALTER TABLE appointments ADD CONSTRAINT appointments_client_or_guest_chk CHECK (
  client_id IS NOT NULL
  OR (
    guest_first_name IS NOT NULL AND btrim(guest_first_name) <> ''
    AND guest_last_name IS NOT NULL AND btrim(guest_last_name) <> ''
    AND guest_email IS NOT NULL AND btrim(guest_email) <> ''
  )
);

DROP POLICY IF EXISTS "apts_insert" ON appointments;
CREATE POLICY "apts_insert" ON appointments FOR INSERT WITH CHECK (
  client_id = auth.uid()
  OR get_my_role() = 'ADMIN'
  OR (
    get_my_role() = 'BARBER'
    AND barber_id = get_my_barber_id()
    AND client_id IS NULL
    AND guest_first_name IS NOT NULL AND btrim(guest_first_name) <> ''
    AND guest_last_name IS NOT NULL AND btrim(guest_last_name) <> ''
    AND guest_email IS NOT NULL AND btrim(guest_email) <> ''
  )
);

-- Deploy: supabase functions deploy notify apt-client-action
-- Dashboard → Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (coppia con VAPID_PUBLIC in index.html)
