
-- Give supervisors INSERT access to work_orders
CREATE POLICY "Supervisors can create work orders"
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'supervisor'::app_role));

-- Give supervisors UPDATE access to work_orders
CREATE POLICY "Supervisors can update work orders"
ON public.work_orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Give supervisors DELETE access to work_orders
CREATE POLICY "Supervisors can delete work orders"
ON public.work_orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));

-- Create supervisor_employees relationship table
CREATE TABLE public.supervisor_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (supervisor_id, employee_id)
);

ALTER TABLE public.supervisor_employees ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage supervisor_employees"
ON public.supervisor_employees
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Supervisors can view their own employees
CREATE POLICY "Supervisors can view their employees"
ON public.supervisor_employees
FOR SELECT
TO authenticated
USING (supervisor_id = auth.uid());
