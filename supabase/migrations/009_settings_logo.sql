-- Migration: Ajouter le logo et autres infos à la table settings
-- À exécuter dans Supabase SQL Editor

-- Ajouter les colonnes pour le logo et les infos de contact
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT 'Votre Boutique Mode',
ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Merci de votre visite !';

-- Commentaires pour documentation
COMMENT ON COLUMN public.settings.logo_url IS 'URL du logo de la boutique pour les tickets';
COMMENT ON COLUMN public.settings.phone IS 'Numéro de téléphone de la boutique';
COMMENT ON COLUMN public.settings.address IS 'Adresse de la boutique';
COMMENT ON COLUMN public.settings.tagline IS 'Slogan affiché sur les tickets';
COMMENT ON COLUMN public.settings.receipt_footer IS 'Message de pied de page sur les tickets';
