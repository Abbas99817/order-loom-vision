
CREATE POLICY "Admins and supervisors can update progress logs"
ON public.progress_logs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role));

CREATE POLICY "Supervisors can delete progress logs"
ON public.progress_logs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'supervisor'::app_role));
