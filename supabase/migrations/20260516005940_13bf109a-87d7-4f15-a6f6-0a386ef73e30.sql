-- 1) Add new occurrence types to enum
ALTER TYPE occurrence_type ADD VALUE IF NOT EXISTS 'SD';
ALTER TYPE occurrence_type ADD VALUE IF NOT EXISTS 'EX';

-- 2) Sanction fields on occurrences
ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS sanction_kind text,
  ADD COLUMN IF NOT EXISTS suspension_days int;

-- 3) Employee vacations table
CREATE TABLE IF NOT EXISTS public.employee_vacations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_employee_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_vacations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_vacations own all" ON public.employee_vacations;
CREATE POLICY "employee_vacations own all" ON public.employee_vacations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_updated_at_employee_vacations ON public.employee_vacations;
CREATE TRIGGER set_updated_at_employee_vacations
  BEFORE UPDATE ON public.employee_vacations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_employee_vacations_pe ON public.employee_vacations(period_employee_id);