CREATE TABLE public.custom_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
  period_employee_id uuid NOT NULL REFERENCES public.period_employees(id) ON DELETE CASCADE,
  source_employee_id uuid,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_occurrences TO authenticated;
GRANT ALL ON public.custom_occurrences TO service_role;

ALTER TABLE public.custom_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_occurrences own all" ON public.custom_occurrences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX custom_occurrences_period_idx ON public.custom_occurrences (period_id);
CREATE INDEX custom_occurrences_pe_idx ON public.custom_occurrences (period_employee_id);

CREATE TRIGGER custom_occurrences_set_updated_at
  BEFORE UPDATE ON public.custom_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();