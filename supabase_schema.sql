-- ============================================================
-- BARBEROS — Supabase Schema Completo
-- Incolla questo nell'editor SQL di Supabase e clicca "Run"
-- ============================================================

-- ── PROFILES (estende auth.users) ───────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'CLIENT'
                CHECK (role IN ('CLIENT','BARBER','ADMIN')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── BARBERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  bio           TEXT,
  photo_url     TEXT,
  slot_duration INTEGER NOT NULL DEFAULT 30,
  is_accepting  BOOLEAN NOT NULL DEFAULT TRUE,
  color_hex     TEXT NOT NULL DEFAULT '#c9a84c',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SERVICES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(8,2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── AVAILABILITY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(barber_id, day_of_week)
);

-- ── BLOCKED SLOTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocked_slots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id      UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime   TIMESTAMPTZ NOT NULL,
  reason         TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── APPOINTMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES profiles(id),
  barber_id      UUID NOT NULL REFERENCES barbers(id),
  service_id     UUID NOT NULL REFERENCES services(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime   TIMESTAMPTZ NOT NULL,
  status         TEXT NOT NULL DEFAULT 'CONFIRMED'
                   CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','COMPLETED')),
  price_snapshot NUMERIC(8,2) NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_apts_barber_date ON appointments(barber_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_apts_client      ON appointments(client_id, status);
CREATE INDEX IF NOT EXISTS idx_apts_date        ON appointments(start_datetime);
CREATE INDEX IF NOT EXISTS idx_avail_barber     ON availability(barber_id, day_of_week);

-- ============================================================
-- HELPER FUNCTION — legge il ruolo dell'utente corrente
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_barber_id()
RETURNS UUID AS $$
  SELECT id FROM barbers WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id OR get_my_role() = 'ADMIN');

-- BARBERS
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barbers_select"  ON barbers FOR SELECT  USING (true);
CREATE POLICY "barbers_insert"  ON barbers FOR INSERT  WITH CHECK (get_my_role() = 'ADMIN');
CREATE POLICY "barbers_update"  ON barbers FOR UPDATE  USING (user_id = auth.uid() OR get_my_role() = 'ADMIN');

-- SERVICES
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_select" ON services FOR SELECT  USING (true);
CREATE POLICY "services_insert" ON services FOR INSERT  WITH CHECK (get_my_role() = 'ADMIN');
CREATE POLICY "services_update" ON services FOR UPDATE  USING (get_my_role() = 'ADMIN');

-- AVAILABILITY
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avail_select" ON availability FOR SELECT  USING (true);
CREATE POLICY "avail_all"    ON availability FOR ALL     USING (
  (SELECT user_id FROM barbers WHERE id = barber_id) = auth.uid()
  OR get_my_role() = 'ADMIN'
);

-- BLOCKED SLOTS
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocked_select" ON blocked_slots FOR SELECT USING (true);
CREATE POLICY "blocked_all"    ON blocked_slots FOR ALL    USING (
  (SELECT user_id FROM barbers WHERE id = barber_id) = auth.uid()
  OR get_my_role() = 'ADMIN'
);

-- APPOINTMENTS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apts_select" ON appointments FOR SELECT USING (
  client_id = auth.uid()
  OR barber_id = get_my_barber_id()
  OR get_my_role() = 'ADMIN'
);
CREATE POLICY "apts_insert" ON appointments FOR INSERT WITH CHECK (
  client_id = auth.uid() OR get_my_role() = 'ADMIN'
);
CREATE POLICY "apts_update" ON appointments FOR UPDATE USING (
  client_id = auth.uid()
  OR barber_id = get_my_barber_id()
  OR get_my_role() = 'ADMIN'
);

-- ============================================================
-- SEED DATA — Servizi di default
-- ============================================================
INSERT INTO services (name, description, price, duration_minutes, sort_order) VALUES
  ('Taglio Classico',     'Taglio capelli con lavaggio e asciugatura inclusi.',    18, 30, 1),
  ('Taglio + Barba',      'Taglio capelli e rifilatura barba completa con rasoio.',28, 45, 2),
  ('Solo Barba',          'Rifilatura e modellatura barba con prodotti premium.',   15, 20, 3),
  ('Taglio Bambino',      'Taglio per bambini fino a 12 anni.',                     12, 20, 4),
  ('Trattamento Capelli', 'Maschera nutriente e massaggio cuoio capelluto.',        35, 60, 5),
  ('Combo Premium',       'Taglio + barba + trattamento. Il pacchetto completo.',   55, 90, 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- NOTA: Per creare il primo Admin
-- 1. Registrati normalmente nell'app
-- 2. Esegui questa query sostituendo la tua email:
--
-- UPDATE profiles SET role = 'ADMIN'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'tua@email.it');
--
-- Per creare un Barbiere dall'Admin, usa il pannello Admin nell'app.
-- ============================================================
