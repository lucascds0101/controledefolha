CREATE TABLE public.employee_swaps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_employee_id uuid NOT NULL REFERENCES public.period_employees(id) ON DELETE CASCADE,
  source_employee_id uuid NULL,
  partner_period_employee_id uuid NULL REFERENCES public.period_employees(id) ON DELETE SET NULL,
  partner_source_employee_id uuid NULL,
  work_date date NOT NULL,
  off_date date NOT NULL,
  work_confirmed boolean NOT NULL DEFAULT false,
  work_confirmed_at timestamptz NULL,
  off_confirmed boolean NOT NULL DEFAULT false,
  off_confirmed_at timestamptz NULL,
  canceled boolean NOT NULL DEFAULT false,
  canceled_at timestamptz NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_swaps_dates_diff CHECK (work_date <> off_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_swaps TO authenticated;
GRANT ALL ON public.employee_swaps TO service_role;

ALTER TABLE public.employee_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own swaps"
  ON public.employee_swaps
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_employee_swaps_updated_at
  BEFORE UPDATE ON public.employee_swaps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_employee_swaps_pe ON public.employee_swaps(period_employee_id);
CREATE INDEX idx_employee_swaps_source ON public.employee_swaps(source_employee_id);
CREATE INDEX idx_employee_swaps_dates ON public.employee_swaps(work_date, off_date);