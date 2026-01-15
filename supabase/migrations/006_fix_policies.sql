-- ============================================
-- FIX RLS POLICIES FOR RETAILOS
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- FIX SALES POLICIES
-- ============================================

-- Drop ALL existing sales policies
DROP POLICY IF EXISTS "Vendeuses can create sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can create sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Users can view their sales" ON public.sales;
DROP POLICY IF EXISTS "Vendeuses can view their sales" ON public.sales;
DROP POLICY IF EXISTS "Managers can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Allow all authenticated to insert sales" ON public.sales;
DROP POLICY IF EXISTS "Allow all authenticated to select sales" ON public.sales;
DROP POLICY IF EXISTS "Allow all authenticated to update sales" ON public.sales;

-- Create simple permissive policies
CREATE POLICY "Allow all authenticated to insert sales"
  ON public.sales FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated to select sales"
  ON public.sales FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated to update sales"
  ON public.sales FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX SALE_ITEMS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can insert sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Allow all authenticated to insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Allow all authenticated to select sale_items" ON public.sale_items;

CREATE POLICY "Allow all authenticated to insert sale_items"
  ON public.sale_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated to select sale_items"
  ON public.sale_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX CASH_REGISTER POLICIES
-- ============================================

DROP POLICY IF EXISTS "Vendeuses can manage their own cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Users can manage cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Users can view cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Users can insert cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Users can update cash register" ON public.cash_register;
DROP POLICY IF EXISTS "Allow all authenticated to manage cash_register" ON public.cash_register;

CREATE POLICY "Allow all authenticated to manage cash_register"
  ON public.cash_register FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- FIX CASH_WITHDRAWALS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view withdrawals" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Users can insert withdrawals" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Users can manage withdrawals" ON public.cash_withdrawals;
DROP POLICY IF EXISTS "Allow all authenticated to manage withdrawals" ON public.cash_withdrawals;

CREATE POLICY "Allow all authenticated to manage withdrawals"
  ON public.cash_withdrawals FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- FIX PRODUCT_VARIANTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Authenticated users can update variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all authenticated to select variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow all authenticated to update variants" ON public.product_variants;

CREATE POLICY "Allow all authenticated to select variants"
  ON public.product_variants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated to update variants"
  ON public.product_variants FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX CLIENTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all authenticated to select clients" ON public.clients;
DROP POLICY IF EXISTS "Allow all authenticated to update clients" ON public.clients;

CREATE POLICY "Allow all authenticated to select clients"
  ON public.clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow all authenticated to update clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX REFUNDS POLICIES (if table exists)
-- ============================================

DROP POLICY IF EXISTS "Admin can manage refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admins can manage refunds" ON public.refunds;
DROP POLICY IF EXISTS "Users can view refunds" ON public.refunds;
DROP POLICY IF EXISTS "Allow admins to manage refunds" ON public.refunds;
DROP POLICY IF EXISTS "Allow all authenticated to view refunds" ON public.refunds;

CREATE POLICY "Allow admins to manage refunds"
  ON public.refunds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Allow all authenticated to view refunds"
  ON public.refunds FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- FIX AUDIT_LOGS POLICIES (if table exists)
-- ============================================

DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow admins to view audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow all authenticated to insert audit_logs" ON public.audit_logs;

CREATE POLICY "Allow admins to view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Allow all authenticated to insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.sale_items TO authenticated;
GRANT ALL ON public.cash_register TO authenticated;
GRANT ALL ON public.cash_withdrawals TO authenticated;
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.product_variants TO authenticated;
GRANT ALL ON public.clients TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.refunds TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;

-- ============================================
-- VERIFY RLS IS ENABLED
-- ============================================

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;


-- ============================================
-- FIX PROFILES POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated to select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all authenticated to update profiles" ON public.profiles;

-- Permettre à tous les utilisateurs authentifiés de voir les profils
CREATE POLICY "Allow all authenticated to select profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Permettre l'insertion de profils (pour la création d'utilisateurs)
CREATE POLICY "Allow all authenticated to insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Permettre la mise à jour des profils
CREATE POLICY "Allow all authenticated to update profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- S'assurer que RLS est activé
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ============================================
-- ALLOW DELETE ON PROFILES (for admin user management)
-- ============================================

DROP POLICY IF EXISTS "Allow admins to delete profiles" ON public.profiles;

CREATE POLICY "Allow admins to delete profiles"
  ON public.profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- FIX PRODUCTS POLICIES (for image upload and CRUD)
-- ============================================

DROP POLICY IF EXISTS "Allow all authenticated to manage products" ON public.products;
DROP POLICY IF EXISTS "Allow all authenticated to insert products" ON public.products;
DROP POLICY IF EXISTS "Allow all authenticated to update products" ON public.products;
DROP POLICY IF EXISTS "Allow all authenticated to delete products" ON public.products;

CREATE POLICY "Allow all authenticated to select products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow managers and admins to insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Allow managers and admins to update products"
  ON public.products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Allow managers and admins to delete products"
  ON public.products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ============================================
-- FIX PRODUCT_VARIANTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Allow managers and admins to insert variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow managers and admins to delete variants" ON public.product_variants;

CREATE POLICY "Allow managers and admins to insert variants"
  ON public.product_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Allow managers and admins to delete variants"
  ON public.product_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );


-- ============================================
-- ALLOW DELETE ON ALL TABLES (for admin reset)
-- ============================================

-- Sales
DROP POLICY IF EXISTS "Allow admins to delete sales" ON public.sales;
CREATE POLICY "Allow admins to delete sales"
  ON public.sales FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Sale Items
DROP POLICY IF EXISTS "Allow admins to delete sale_items" ON public.sale_items;
CREATE POLICY "Allow admins to delete sale_items"
  ON public.sale_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Cash Register
DROP POLICY IF EXISTS "Allow admins to delete cash_register" ON public.cash_register;
CREATE POLICY "Allow admins to delete cash_register"
  ON public.cash_register FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Cash Withdrawals
DROP POLICY IF EXISTS "Allow admins to delete cash_withdrawals" ON public.cash_withdrawals;
CREATE POLICY "Allow admins to delete cash_withdrawals"
  ON public.cash_withdrawals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Refunds
DROP POLICY IF EXISTS "Allow admins to delete refunds" ON public.refunds;
CREATE POLICY "Allow admins to delete refunds"
  ON public.refunds FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Audit Logs
DROP POLICY IF EXISTS "Allow admins to delete audit_logs" ON public.audit_logs;
CREATE POLICY "Allow admins to delete audit_logs"
  ON public.audit_logs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Clients
DROP POLICY IF EXISTS "Allow admins to delete clients" ON public.clients;
CREATE POLICY "Allow admins to delete clients"
  ON public.clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
