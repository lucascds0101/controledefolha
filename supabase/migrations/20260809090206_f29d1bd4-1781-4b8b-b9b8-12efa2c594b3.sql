CREATE TABLE public.employee_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_employee_id uuid,
  source_employee_id uuid,
  employee_name text NOT NULL,
  reason text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  origin text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'ativo',
  source_kind text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_blocks_origin_chk CHECK (origin IN ('auto','manual')),
  CONSTRAINT employee_blocks_status_chk CHECK (status IN ('ativo','encerrado')),
  CONSTRAINT employee_blocks_kind_chk CHECK (source_kind IS NULL OR source_kind IN ('falta','atestado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_blocks TO authenticated;
GRANT ALL ON public.employee_blocks TO service_role;

ALTER TABLE public.employee_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_blocks own all" ON public.employee_blocks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX employee_blocks_source_uq ON public.employee_blocks (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX employee_blocks_user_idx ON public.employee_blocks (user_id, start_date);

CREATE TRIGGER employee_blocks_set_updated_at
  BEFORE UPDATE ON public.employee_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();