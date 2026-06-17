CREATE TABLE public.audit_section_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.audit_sessions(id) ON DELETE CASCADE,
  section_id UUID NULL REFERENCES public.audit_sections(id) ON DELETE SET NULL,
  score NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, section_id)
);
CREATE INDEX idx_audit_section_scores_session ON public.audit_section_scores(session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_section_scores TO authenticated;
GRANT ALL ON public.audit_section_scores TO service_role;

ALTER TABLE public.audit_section_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "section_scores_select_scoped" ON public.audit_section_scores
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.audit_sessions s
    JOIN public.employees e ON e.id = s.employee_id
    WHERE s.id = audit_section_scores.session_id AND public.can_access_store(e.store_id)
  ));

CREATE POLICY "section_scores_insert_scoped" ON public.audit_section_scores
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.audit_sessions s
    WHERE s.id = audit_section_scores.session_id AND s.conducted_by = auth.uid()
  ));

CREATE POLICY "section_scores_admin_write" ON public.audit_section_scores
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));