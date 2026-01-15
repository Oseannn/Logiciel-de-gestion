-- Migration: Ajouter les champs de remise aux ventes
-- À exécuter dans Supabase SQL Editor

-- Ajouter les colonnes de remise à la table sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_reason TEXT,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);

-- Commentaires pour documentation
COMMENT ON COLUMN public.sales.discount_type IS 'Type de remise: percentage ou fixed';
COMMENT ON COLUMN public.sales.discount_value IS 'Valeur de la remise (pourcentage ou montant fixe)';
COMMENT ON COLUMN public.sales.discount_reason IS 'Raison de la remise';
COMMENT ON COLUMN public.sales.subtotal IS 'Sous-total avant remise';
