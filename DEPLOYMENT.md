# 🚀 Guide de Déploiement RetailOS

## Prérequis

- Node.js 18.17+ 
- Compte Supabase avec projet configuré
- Compte sur une plateforme d'hébergement (Vercel, Railway, etc.)

---

## 1. Configuration Supabase

### 1.1 Exécuter les migrations SQL

Dans le **SQL Editor** de Supabase, exécutez dans l'ordre :

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_functions.sql
supabase/migrations/004_seed_data.sql
supabase/migrations/005_cash_register.sql
supabase/migrations/006_audit_refunds.sql
supabase/migrations/007_user_sessions.sql
supabase/migrations/008_sales_discount.sql
supabase/migrations/009_settings_logo.sql
supabase/migrations/010_fix_variants_policies.sql
```

### 1.2 Configurer le Storage

1. Créer un bucket `images` (public)
2. Ajouter les policies RLS pour permettre l'upload

### 1.3 Désactiver la confirmation email (optionnel)

Dans **Authentication > Providers > Email** :
- Désactiver "Confirm email"

---

## 2. Déploiement sur Vercel (Recommandé)

### 2.1 Connexion du repo

1. Connectez votre repo GitHub à Vercel
2. Sélectionnez le dossier `retailos-nextjs`

### 2.2 Variables d'environnement

Ajoutez ces variables dans **Settings > Environment Variables** :

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon publique |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (secrète) |
| `NEXT_PUBLIC_APP_URL` | URL de production (ex: https://retailos.vercel.app) |
| `NEXT_PUBLIC_APP_NAME` | RetailOS |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | XAF |

### 2.3 Build Settings

- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`

### 2.4 Déployer

Cliquez sur **Deploy** - Vercel s'occupe du reste !

---

## 3. Déploiement avec Docker

### 3.1 Build de l'image

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx \
  --build-arg NEXT_PUBLIC_APP_URL=https://votre-domaine.com \
  -t retailos:latest .
```

### 3.2 Lancer le conteneur

```bash
docker run -p 3000:3000 \
  -e SUPABASE_SERVICE_ROLE_KEY=xxx \
  retailos:latest
```

### 3.3 Docker Compose (optionnel)

```yaml
version: '3.8'
services:
  retailos:
    build: .
    ports:
      - "3000:3000"
    environment:
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    restart: unless-stopped
```

---

## 4. Déploiement sur Railway

1. Connectez votre repo GitHub
2. Ajoutez les variables d'environnement
3. Railway détecte automatiquement Next.js
4. Déployez !

---

## 5. Post-Déploiement

### 5.1 Créer le premier admin

Utilisez l'interface de connexion avec les identifiants par défaut :
- Email: `admin@retailos.com`
- Mot de passe: `admin123`

**⚠️ IMPORTANT: Changez ce mot de passe immédiatement !**

### 5.2 Configurer les paramètres

1. Allez dans **Admin > Paramètres**
2. Configurez le nom de la boutique
3. Uploadez le logo
4. Configurez les informations de contact

### 5.3 Créer les utilisateurs

1. Allez dans **Admin > Utilisateurs**
2. Créez les comptes vendeuses et managers

---

## 6. Maintenance

### Mises à jour

```bash
git pull origin main
npm install
npm run build
```

### Logs

- Vercel: Dashboard > Deployments > Logs
- Docker: `docker logs retailos`

### Backup Supabase

Configurez des backups automatiques dans Supabase Dashboard.

---

## 7. Sécurité

### Checklist Production

- [ ] Mot de passe admin changé
- [ ] Variables d'environnement sécurisées
- [ ] HTTPS activé
- [ ] RLS Supabase activé
- [ ] Confirmation email configurée (optionnel)
- [ ] Backups configurés

### Headers de sécurité

Les headers suivants sont automatiquement ajoutés :
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block

---

## Support

En cas de problème :
1. Vérifiez les logs de déploiement
2. Vérifiez les variables d'environnement
3. Testez la connexion Supabase
