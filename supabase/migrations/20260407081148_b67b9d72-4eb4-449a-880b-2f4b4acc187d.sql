
-- Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view products
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage products
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add product_id to work_orders
ALTER TABLE public.work_orders ADD COLUMN product_id uuid REFERENCES public.products(id);
