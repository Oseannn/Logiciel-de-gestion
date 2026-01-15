-- Migration: Corriger les policies sur product_variants
-- À exécuter dans Supabase SQL Editor

-- Supprimer toutes les anciennes policies
DROP POLICY IF EXISTS "Anyone can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin and Manager can manage variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all authenticated to select variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all authenticated to update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow managers and admins to insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow managers and admins to delete variants" ON public.product_variants;

-- Créer des policies simples et permissives pour les utilisateurs authentifiés
CREATE POLICY "Authenticated can view variants"
  ON public.product_variants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Manager can insert variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update variants"
  ON public.product_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can delete variants"
  ON public.product_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- S'assurer que les grants sont corrects
GRANT ALL ON public.product_variants TO authenticated;
