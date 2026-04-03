-- ============================================================
-- BARBEROS — Schema v2 (incrementale)
-- Se hai già eseguito supabase_schema.sql AGGIORNATO, questo file
-- è in gran parte ridondante: puoi eseguirlo comunque (idempotente).
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_update" ON push_subscriptions;
DROP POLICY IF EXISTS "push_delete" ON push_subscriptions;
CREATE POLICY "push_select" ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_update" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

-- Webhook notify: Database → Webhooks → appointments INSERT/UPDATE
-- URL: https://<ref>.supabase.co/functions/v1/notify
-- Header: Authorization: Bearer <service_role>
