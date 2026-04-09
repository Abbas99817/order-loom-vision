
-- Drop existing insert policy
DROP POLICY "Authenticated users can create progress logs" ON public.progress_logs;

-- New policy: employees can insert for themselves, admins/supervisors can insert for anyone
CREATE POLICY "Users can create progress logs"
ON public.progress_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = updated_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
);
