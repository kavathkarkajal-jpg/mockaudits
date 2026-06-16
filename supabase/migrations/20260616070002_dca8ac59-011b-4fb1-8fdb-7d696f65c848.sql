ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_head';

CREATE OR REPLACE FUNCTION public.can_access_store(_store_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.app_role; v_brand UUID; v_store UUID; v_region TEXT; s_brand UUID; s_region TEXT;
BEGIN
  SELECT public.current_user_role() INTO v_role;
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role = 'admin' THEN RETURN TRUE; END IF;
  SELECT brand_id, region INTO s_brand, s_region FROM public.stores WHERE id = _store_id;
  IF s_brand IS NULL THEN RETURN FALSE; END IF;
  SELECT brand_id, store_id, region INTO v_brand, v_store, v_region FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'trainer' THEN RETURN v_brand = s_brand;
  ELSIF v_role = 'operations_head' THEN RETURN v_brand = s_brand;
  ELSIF v_role = 'business_head' THEN RETURN v_brand = s_brand;
  ELSIF v_role = 'store_manager' THEN RETURN v_store = _store_id;
  ELSIF v_role = 'regional_manager' THEN RETURN v_brand = s_brand AND v_region = s_region;
  END IF;
  RETURN FALSE;
END; $$;

DROP POLICY IF EXISTS "employees_trainer_write" ON public.employees;
CREATE POLICY "employees_trainer_write" ON public.employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'trainer') AND public.can_access_store(store_id))
  WITH CHECK (public.has_role(auth.uid(), 'trainer') AND public.can_access_store(store_id));