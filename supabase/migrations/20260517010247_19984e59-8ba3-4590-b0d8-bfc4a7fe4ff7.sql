ALTER TABLE public.employee_vacations
  ADD COLUMN IF NOT EXISTS source_employee_id uuid;

-- Backfill from period_employees.source_employee_id where possible
UPDATE public.employee_vacations v
SET source_employee_id = pe.source_employee_id
FROM public.period_employees pe
WHERE v.period_employee_id = pe.id
  AND v.source_employee_id IS NULL
  AND pe.source_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_vacations_source
  ON public.employee_vacations (source_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_vacations_user
  ON public.employee_vacations (user_id);