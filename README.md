# RetailOS - Système de Point de Vente

Application moderne de gestion de point de vente pour boutiques, développée avec Next.js 14 et Supabase.

## 📱 Progressive Web App (PWA)

RetailOS est une PWA installable sur mobile et desktop :
- **iOS** : Ouvrir dans Safari > Partager > "Sur l'écran d'accueil"
- **Android** : Chrome affichera une bannière d'installation
- **Desktop** : Cliquer sur l'icône d'installation dans la barre d'adresse

## 🚀 Installation

### Prérequis
- Node.js 18+
- Compte Supabase (gratuit sur supabase.com)

### 1. Configuration Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans SQL Editor et exécutez le contenu de `scripts/setup-database.sql`
3. Copiez vos clés API depuis Settings > API

### 2. Configuration locale

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
# Créez un fichier .env.local avec :
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role

# Lancer le serveur
npm run dev
```

### 3. Premier lancement

1. Accédez à `http://localhost:3000`
2. L'application détecte qu'aucun admin n'existe et vous redirige vers `/setup`
3. Créez votre compte administrateur
4. Connectez-vous et commencez à utiliser l'application

## 👥 Rôles Utilisateurs

- **Admin** : Gestion complète (utilisateurs, produits, rapports, paramètres)
- **Manager** : Gestion des produits, stocks et ventes
- **Vendeuse** : Point de vente, caisse et clients

## 📱 Fonctionnalités

- Point de vente tactile optimisé mobile
- Gestion des produits avec variantes (taille/couleur)
- Gestion de caisse avec ouverture/fermeture
- Suivi des clients et historique d'achats
- Rapports et statistiques de vente
- Export des données

## 🛠 Technologies

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Database)
- Zustand (State Management)
- next-pwa (Progressive Web App)

## 📄 Licence

Projet privé - Tous droits réservés
