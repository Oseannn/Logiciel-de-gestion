-- ============================================
-- SCRIPT DE RESET COMPLET - RETAILOS
-- Supprime toutes les données pour repartir à zéro
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- Désactiver temporairement les triggers
SET session_replication_role = 'replica';

-- Supprimer les données dans l'ordre (respecter les foreign keys)
-- 1. Tables enfants d'abord
TRUNCATE TABLE public.sale_items CASCADE;
TRUNCATE TABLE public.cash_withdrawals CASCADE;
TRUNCATE TABLE public.refunds CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;

-- 2. Tables avec références
TRUNCATE TABLE public.sales CASCADE;
TRUNCATE TABLE public.cash_register CASCADE;
TRUNCATE TABLE public.clients CASCADE;

-- 3. Produits
TRUNCATE TABLE public.product_variants CASCADE;
TRUNCATE TABLE public.products CASCADE;

-- 4. Settings
TRUNCATE TABLE public.settings CASCADE;

-- 5. Profiles (doit être fait avant de supprimer les users auth)
TRUNCATE TABLE public.profiles CASCADE;

-- Réactiver les triggers
SET session_replication_role = 'origin';

-- ============================================
-- SUPPRIMER LES UTILISATEURS AUTH
-- ============================================
-- Cette partie doit être exécutée séparément si nécessaire
DELETE FROM auth.users;

-- ============================================
-- RESET TERMINÉ !
-- ============================================
SELECT 'Base de données réinitialisée ! Vous pouvez maintenant accéder à /login pour créer votre premier compte admin.' AS message;
