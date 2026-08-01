ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.period_employees ADD COLUMN IF NOT EXISTS hire_date date;

CREATE OR REPLACE FUNCTION public.copy_employees_to_new_period()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.period_employees (user_id, period_id, source_employee_id, name, role, vacant, position, hire_date)
  SELECT user_id, NEW.id, source_employee_id, name, role, vacant, position, hire_date
  FROM public.period_employees
  WHERE period_id = v_prev_id;

  RETURN NEW;
END;
$function$;