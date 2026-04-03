-- Migrazione: gestione salone per ruolo BARBER (ospiti + RLS).
-- Esegui se hai già un database creato prima di queste modifiche.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_first_name TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS guest_last_name TEXT;
ALTER TABLE appointments ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_client_or_guest_chk;
ALTER TABLE appointments ADD CONSTRAINT appointments_client_or_guest_chk CHECK (
  client_id IS NOT NULL
  OR (
    guest_first_name IS NOT NULL AND btrim(guest_first_name) <> ''
    AND guest_last_name IS NOT NULL AND btrim(guest_last_name) <> ''
  )
);

-- Poi esegui in SQL Editor le sezioni RLS aggiornate in supabase_schema.sql
-- da PROFILES fino ad APPOINTMENTS, oppure l’intero schema.
