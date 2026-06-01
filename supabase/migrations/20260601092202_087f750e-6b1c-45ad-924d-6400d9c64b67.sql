
-- =========================================
-- ENUM: app_role
-- =========================================
CREATE TYPE public.app_role AS ENUM (
  'store_manager',
  'regional_manager',
  'trainer',
  'business_head',
  'admin'
);

-- =========================================
-- TABLES
-- =========================================

CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  primary_color TEXT NOT NULL DEFAULT '#0EA5E9',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  store_code TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stores_brand_id_idx ON public.stores(brand_id);
CREATE INDEX stores_region_idx ON public.stores(region);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  employee_code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, employee_code)
);
CREATE INDEX employees_store_id_idx ON public.employees(store_id);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_code TEXT NOT NULL UNIQUE,
  full_name TEXT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  conducted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_sessions_employee_idx ON public.audit_sessions(employee_id);
CREATE INDEX audit_sessions_week_idx ON public.audit_sessions(week_start_date);
CREATE UNIQUE INDEX audit_sessions_employee_week_unique
  ON public.audit_sessions(employee_id, week_start_date);

CREATE TABLE public.audit_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'yes_no',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================
-- FUNCTIONS
-- =========================================

-- Compute Monday of a given timestamp
CREATE OR REPLACE FUNCTION public.week_monday(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT (date_trunc('week', ts AT TIME ZONE 'UTC'))::date;
$$;

-- Set week_start_date on insert
CREATE OR REPLACE FUNCTION public.set_audit_week()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.week_start_date := public.week_monday(COALESCE(NEW.submitted_at, now()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_audit_week
BEFORE INSERT ON public.audit_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_audit_week();

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_brand_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_region()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT region FROM public.profiles WHERE id = auth.uid();
$$;

-- Can this user view a given store?
CREATE OR REPLACE FUNCTION public.can_access_store(_store_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_brand UUID;
  v_store UUID;
  v_region TEXT;
  s_brand UUID;
  s_region TEXT;
BEGIN
  SELECT public.current_user_role() INTO v_role;
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role IN ('admin','trainer') THEN RETURN TRUE; END IF;

  SELECT brand_id, region INTO s_brand, s_region FROM public.stores WHERE id = _store_id;
  IF s_brand IS NULL THEN RETURN FALSE; END IF;

  SELECT brand_id, store_id, region INTO v_brand, v_store, v_region
    FROM public.profiles WHERE id = auth.uid();

  IF v_role = 'store_manager' THEN
    RETURN v_store = _store_id;
  ELSIF v_role = 'regional_manager' THEN
    RETURN v_brand = s_brand AND v_region = s_region;
  ELSIF v_role = 'business_head' THEN
    RETURN v_brand = s_brand;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_brand(_brand_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_brand UUID;
BEGIN
  SELECT public.current_user_role() INTO v_role;
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role IN ('admin','trainer') THEN RETURN TRUE; END IF;
  SELECT brand_id INTO v_brand FROM public.profiles WHERE id = auth.uid();
  RETURN v_brand = _brand_id;
END;
$$;

-- =========================================
-- GRANTS
-- =========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

GRANT ALL ON public.brands TO service_role;
GRANT ALL ON public.stores TO service_role;
GRANT ALL ON public.employees TO service_role;
GRANT ALL ON public.audit_sessions TO service_role;
GRANT ALL ON public.audit_questions TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_roles TO service_role;

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- BRANDS
CREATE POLICY "brands_select_all_auth" ON public.brands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "brands_admin_write" ON public.brands
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STORES
CREATE POLICY "stores_select_all_auth" ON public.stores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stores_admin_write" ON public.stores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- EMPLOYEES
CREATE POLICY "employees_select_scoped" ON public.employees
  FOR SELECT TO authenticated
  USING (public.can_access_store(store_id));
CREATE POLICY "employees_admin_write" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- AUDIT_SESSIONS
CREATE POLICY "audit_select_scoped" ON public.audit_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id AND public.can_access_store(e.store_id)
    )
  );
CREATE POLICY "audit_insert_scoped" ON public.audit_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    conducted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_id AND public.can_access_store(e.store_id)
    )
  );
CREATE POLICY "audit_admin_write" ON public.audit_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- AUDIT_QUESTIONS
CREATE POLICY "questions_select_all_auth" ON public.audit_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_admin_write" ON public.audit_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PROFILES
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_admin_write" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- USER_ROLES
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_write" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
