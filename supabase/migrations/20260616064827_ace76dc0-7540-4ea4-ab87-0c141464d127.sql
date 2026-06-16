CREATE POLICY employees_trainer_brand_write ON public.employees
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'trainer')
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = employees.store_id
        AND s.brand_id = (SELECT p.brand_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'trainer')
    AND EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = employees.store_id
        AND s.brand_id = (SELECT p.brand_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);