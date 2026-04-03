-- BarberOS — Fix: i barbieri non potevano creare disponibilità per colleghi aggiunti dal team (RLS).
-- + backfill Lun–Sab 09–19 per barbieri senza righe in availability.

DROP POLICY IF EXISTS "avail_all" ON availability;
CREATE POLICY "avail_all" ON availability FOR ALL USING (
  get_my_role() IN ('ADMIN','BARBER')
) WITH CHECK (
  get_my_role() IN ('ADMIN','BARBER')
);

DROP POLICY IF EXISTS "blocked_all" ON blocked_slots;
CREATE POLICY "blocked_all" ON blocked_slots FOR ALL USING (
  get_my_role() IN ('ADMIN','BARBER')
) WITH CHECK (
  get_my_role() IN ('ADMIN','BARBER')
);

INSERT INTO availability (barber_id, day_of_week, start_time, end_time, is_active)
SELECT b.id, t.dow, TIME '09:00', TIME '19:00', TRUE
FROM barbers b
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6)) AS t(dow)
WHERE NOT EXISTS (
  SELECT 1 FROM availability a WHERE a.barber_id = b.id AND a.day_of_week = t.dow
);
