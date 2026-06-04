
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS reaudit_threshold NUMERIC(5,2) DEFAULT NULL;

ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS needs_reaudit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.audit_sessions ADD COLUMN IF NOT EXISTS reaudit_cleared_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS audit_sessions_needs_reaudit_idx
  ON public.audit_sessions(needs_reaudit) WHERE needs_reaudit = true;

CREATE OR REPLACE FUNCTION public.set_reaudit_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_threshold NUMERIC(5,2);
BEGIN
  SELECT b.reaudit_threshold INTO v_threshold
  FROM public.employees e
  JOIN public.stores s ON s.id = e.store_id
  JOIN public.brands b ON b.id = s.brand_id
  WHERE e.id = NEW.employee_id;

  IF v_threshold IS NOT NULL AND NEW.score < v_threshold THEN
    NEW.needs_reaudit := true;
  ELSE
    NEW.needs_reaudit := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_reaudit_flag ON public.audit_sessions;
CREATE TRIGGER trg_set_reaudit_flag
  BEFORE INSERT ON public.audit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_reaudit_flag();

DROP POLICY IF EXISTS "Trainers/admins update sessions in scope" ON public.audit_sessions;
CREATE POLICY "Trainers/admins update sessions in scope"
  ON public.audit_sessions
  FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
    AND public.can_access_store((SELECT store_id FROM public.employees WHERE id = audit_sessions.employee_id))
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'trainer'))
    AND public.can_access_store((SELECT store_id FROM public.employees WHERE id = audit_sessions.employee_id))
  );
