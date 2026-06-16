
CREATE TABLE public.audit_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_sections TO authenticated;
GRANT ALL ON public.audit_sections TO service_role;

ALTER TABLE public.audit_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sections_select_all_auth" ON public.audit_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sections_admin_write" ON public.audit_sections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX audit_sections_brand_id_idx ON public.audit_sections(brand_id, display_order);

ALTER TABLE public.audit_questions
  ADD COLUMN section_id uuid REFERENCES public.audit_sections(id) ON DELETE SET NULL;

CREATE INDEX audit_questions_section_id_idx ON public.audit_questions(section_id);
