-- Role change history (audit trail for kanban movements)
CREATE TABLE public.employee_role_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_employee_id uuid,
  employee_name text NOT NULL,
  from_role text,
  to_role text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

ALTER TABLE public.employee_role_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_role_history own all"
  ON public.employee_role_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_erh_source ON public.employee_role_history(source_employee_id);
CREATE INDEX idx_erh_user_date ON public.employee_role_history(user_id, changed_at DESC);

-- Mark period_days as manually edited so auto-schedule inference doesn't overwrite them
ALTER TABLE public.period_days
  ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false;
