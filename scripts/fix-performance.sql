-- ============================================
-- SCRIPT DE FIX PERFORMANCE - RETAILOS
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- 1. Augmenter le timeout des requêtes
ALTER DATABASE postgres SET statement_timeout = '30s';

-- 2. Créer des index manquants pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_products_active_name ON public.products(active, name);
CREATE INDEX IF NOT EXISTS idx_products_id ON public.products(id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);

-- 3. Analyser les tables pour optimiser les requêtes
ANALYZE public.products;
ANALYZE public.product_variants;

-- 4. SOLUTION PRINCIPALE: Simplifier les politiques RLS pour products
-- Les politiques actuelles font des sous-requêtes qui ralentissent tout

-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Admin and Manager can manage products" ON public.products;

-- Créer une politique simple pour la lecture (tous les utilisateurs authentifiés peuvent lire)
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Créer une politique pour les modifications (admin et manager)
CREATE POLICY "Admin and Manager can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update products"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can delete products"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 5. Simplifier les politiques pour product_variants
DROP POLICY IF EXISTS "Anyone can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin and Manager can manage variants" ON public.product_variants;

CREATE POLICY "Authenticated users can view variants"
  ON public.product_variants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin and Manager can insert variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can update variants"
  ON public.product_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admin and Manager can delete variants"
  ON public.product_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- 6. Créer un index sur profiles pour accélérer les vérifications de rôle
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);

-- 7. Vérifier que tout fonctionne
SELECT 'Optimisation terminée !' AS message;
SELECT COUNT(*) AS total_products FROM public.products;
SELECT COUNT(*) AS total_variants FROM public.product_variants;
