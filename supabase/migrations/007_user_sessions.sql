-- ============================================
-- MIGRATION 007: Suivi des sessions utilisateurs
-- Exécutez ce script dans Supabase SQL Editor
-- ============================================

-- Table pour suivre les sessions de connexion
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes rapides
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON public.user_sessions(created_at DESC);

-- Ajouter colonne is_online et last_seen aux profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- RLS pour user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Les admins peuvent voir toutes les sessions
CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Les utilisateurs peuvent insérer leurs propres sessions
CREATE POLICY "Users can insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Permissions
GRANT ALL ON public.user_sessions TO authenticated;

-- ============================================
-- MIGRATION TERMINÉE !
-- ============================================
SELECT 'Migration user_sessions terminée !' AS message;
