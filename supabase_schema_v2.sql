-- ============================================================
-- BARBEROS — Schema Aggiornato v2
-- Aggiunte: push_subscriptions + reminder_sent su appointments
-- Incolla nell'SQL Editor di Supabase dopo il primo schema
-- ============================================================

-- Colonna reminder_sent su appointments (se non già presente)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Tabella push subscriptions (per notifiche push Web)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_own" ON push_subscriptions FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- DATABASE WEBHOOK per notifiche email automatiche
-- 
-- In Supabase Dashboard:
-- 1. Database → Webhooks → Create a new hook
-- 2. Nome: notify-on-appointment
-- 3. Table: appointments
-- 4. Events: INSERT, UPDATE
-- 5. URL: https://XXXX.supabase.co/functions/v1/notify
-- 6. HTTP Headers: Authorization: Bearer <service_role_key>
-- ============================================================
