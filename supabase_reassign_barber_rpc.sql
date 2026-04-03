-- Esegui su Supabase SQL Editor se il DB esiste già (rimozione barbiere + appuntamenti).

CREATE OR REPLACE FUNCTION public.reassign_appointments_to_barber(p_from uuid, p_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('BARBER','ADMIN') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE id = p_from) THEN
    RAISE EXCEPTION 'barber not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.barbers WHERE id = p_to) THEN
    RAISE EXCEPTION 'target barber not found';
  END IF;
  IF p_from = p_to THEN
    RETURN;
  END IF;
  UPDATE public.appointments SET barber_id = p_to WHERE barber_id = p_from;
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_appointments_to_barber(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reassign_appointments_to_barber(uuid, uuid) TO authenticated;
