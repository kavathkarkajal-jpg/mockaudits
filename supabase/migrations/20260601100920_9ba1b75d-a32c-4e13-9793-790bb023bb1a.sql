ALTER TABLE public.audit_questions
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_score numeric NOT NULL DEFAULT 1;