UPDATE public.employee_blocks
SET end_date = start_date + INTERVAL '6 days'
WHERE origin = 'auto'
  AND end_date = start_date + INTERVAL '7 days';