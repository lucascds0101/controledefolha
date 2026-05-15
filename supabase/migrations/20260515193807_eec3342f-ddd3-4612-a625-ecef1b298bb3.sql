
-- Drop existing FK that prevents the repoint
ALTER TABLE public.occurrences DROP CONSTRAINT IF EXISTS occurrences_employee_id_fkey;

-- 1. New per-period employees table
CREATE TABLE public.period_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_id uuid NOT NULL,
  source_employee_id uuid,
  name text NOT NULL,
  role text,
  vacant boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.period_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_employees own all" ON public.period_employees
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_period_employees_period ON public.period_employees(period_id);
CREATE INDEX idx_period_employees_user ON public.period_employees(user_id);

CREATE TRIGGER period_employees_updated_at
  BEFORE UPDATE ON public.period_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Backfill from existing employees x periods
INSERT INTO public.period_employees (user_id, period_id, source_employee_id, name, role, vacant, position)
SELECT DISTINCT ON (p.id, e.id)
  e.user_id,
  p.id AS period_id,
  e.id AS source_employee_id,
  e.name,
  e.role,
  COALESCE(e.vacant, false),
  COALESCE(e.position, 0)
FROM public.employees e
JOIN public.periods p ON p.user_id = e.user_id
WHERE e.active = true
ORDER BY p.id, e.id, e.position;

-- 3. Repoint occurrences.employee_id
UPDATE public.occurrences o
SET employee_id = pe.id
FROM public.period_employees pe
WHERE pe.period_id = o.period_id
  AND pe.source_employee_id = o.employee_id;

-- 4. Synthetic rows for orphan occurrences (employee deleted)
INSERT INTO public.period_employees (user_id, period_id, name, role, vacant, position)
SELECT DISTINCT o.user_id, o.period_id, '— removido —', null, false, 9999
FROM public.occurrences o
LEFT JOIN public.period_employees pe ON pe.id = o.employee_id
WHERE pe.id IS NULL;

UPDATE public.occurrences o
SET employee_id = pe.id
FROM public.period_employees pe
WHERE pe.period_id = o.period_id
  AND pe.name = '— removido —'
  AND NOT EXISTS (SELECT 1 FROM public.period_employees pe2 WHERE pe2.id = o.employee_id);

-- 5. Trigger: copy collaborators from most recent prior period when a new period is inserted
CREATE OR REPLACE FUNCTION public.copy_employees_to_new_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_id uuid;
BEGIN
  SELECT id INTO v_prev_id
  FROM public.periods
  WHERE user_id = NEW.user_id
    AND id <> NEW.id
  ORDER BY start_date DESC
  LIMIT 1;

  IF v_prev_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.period_employees (user_id, period_id, source_employee_id, name, role, vacant, position)
  SELECT user_id, NEW.id, source_employee_id, name, role, vacant, position
  FROM public.period_employees
  WHERE period_id = v_prev_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_period_created_copy_employees
  AFTER INSERT ON public.periods
  FOR EACH ROW EXECUTE FUNCTION public.copy_employees_to_new_period();
