-- Add new enum value
ALTER TYPE occurrence_type ADD VALUE IF NOT EXISTS 'TC';

-- Extend occurrences with detail fields
ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS arrival_time time,
  ADD COLUMN IF NOT EXISTS partner_name text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS covered boolean,
  ADD COLUMN IF NOT EXISTS covered_by text,
  ADD COLUMN IF NOT EXISTS exit_time time,
  ADD COLUMN IF NOT EXISTS return_time time;

-- Vacant flag on employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS vacant boolean NOT NULL DEFAULT false;

-- Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles own all" ON public.roles;
CREATE POLICY "roles own all" ON public.roles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Period days (Plantão / Folga marker per date)
CREATE TABLE IF NOT EXISTS public.period_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_id uuid NOT NULL,
  date date NOT NULL,
  day_type text NOT NULL CHECK (day_type IN ('plantao','folga')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, date)
);
ALTER TABLE public.period_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "period_days own all" ON public.period_days;
CREATE POLICY "period_days own all" ON public.period_days
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER period_days_set_updated_at
  BEFORE UPDATE ON public.period_days
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Update handle_new_user to seed default roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start DATE;
  v_end DATE;
  v_label TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  v_start := date_trunc('month', CURRENT_DATE)::date + 15;
  v_end   := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date + 14;
  v_label := to_char(v_start, 'DD/MM/YYYY') || ' - ' || to_char(v_end, 'DD/MM/YYYY');

  INSERT INTO public.periods (user_id, label, start_date, end_date)
  VALUES (NEW.id, v_label, v_start, v_end);

  INSERT INTO public.roles (user_id, name, position) VALUES
    (NEW.id, 'Supervisão', 0),
    (NEW.id, 'Coordenação', 1),
    (NEW.id, 'Backoffice', 2),
    (NEW.id, 'PA', 3),
    (NEW.id, 'Operador de monitoramento', 4),
    (NEW.id, 'Operador de comunicação', 5);

  RETURN NEW;
END; $function$;
