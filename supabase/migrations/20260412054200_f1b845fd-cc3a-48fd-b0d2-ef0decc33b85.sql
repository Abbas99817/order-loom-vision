
CREATE POLICY "Admins can delete process steps"
ON public.process_steps
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete progress logs"
ON public.progress_logs
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
