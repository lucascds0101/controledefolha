CREATE TABLE public.employee_medical_leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_employee_id uuid NOT NULL REFERENCES public.period_employees(id) ON DELETE CASCADE,
  source_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  days integer NOT NULL CHECK (days >= 1),
  end_date date NOT NULL,
  cid text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_medical_leaves TO authenticated;
GRANT ALL ON public.employee_medical_leaves TO service_role;

ALTER TABLE public.employee_medical_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own medical leaves"
ON public.employee_medical_leaves FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_employee_medical_leaves
BEFORE UPDATE ON public.employee_medical_leaves
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_medleaves_pe ON public.employee_medical_leaves(period_employee_id);
CREATE INDEX idx_medleaves_source ON public.employee_medical_leaves(source_employee_id);