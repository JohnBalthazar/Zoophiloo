# 🔐 Sécurité & RGPD — YoupiZoo (youpizoo.fr)

> Document technique à l'usage du responsable de traitement.
> Mis à jour : 2026-05-26

---

## 1. Vue d'ensemble

YoupiZoo met en œuvre une **double sauvegarde** et un **chiffrement des données personnelles** conformément aux articles 5(1)(f) et 32 du **RGPD** (Règlement Général sur la Protection des Données).

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE SÉCURITÉ                    │
├─────────────────────────────────────────────────────────────┤
│  DONNÉES AU REPOS                                           │
│    Firestore → champs Telephone + Adresse chiffrés AES-256  │
│    Clé dérivée : PBKDF2-SHA256 (100 000 itérations)        │
│    Sel : CRYPTO_SALT (secret GitHub Actions)                │
│                                                             │
│  DOUBLE SAUVEGARDE CODE                                     │
│    1. Dépôt GitHub principal (branches + historique)        │
│    2. Archive ZIP horodatée (artifact GitHub, 90 jours)     │
│                                                             │
│  DOUBLE SAUVEGARDE DONNÉES                                  │
│    1. Firestore natif (réplication multi-zone GCP)          │
│    2. Export JSON chiffré quotidien (artifact GitHub, 30j)  │
│                                                             │
│  CONTRÔLE D'ACCÈS                                           │
│    Coordonnées affichées UNIQUEMENT aux utilisateurs auth   │
│    Règles Firestore strictes (propriétaire / admin)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Chiffrement des données personnelles

### Champs chiffrés dans Firestore
| Champ       | Type    | Raison                              |
|-------------|---------|-------------------------------------|
| `Telephone` | string  | Donnée sensible, risque de scraping |
| `Adresse`   | string  | Adresse physique précise            |

### Champs NON chiffrés (justification)
| Champ           | Raison                                           |
|-----------------|--------------------------------------------------|
| `Email_contact` | Utilisé pour matching auth / messagerie interne  |
| `Ville`         | Donnée publique nécessaire pour la carte/filtres |
| `Code_postal`   | Donnée publique nécessaire pour la carte/filtres |
| `Nom_contact`   | Semi-public (affiché dans l'annonce)             |

### Algorithme
- **Chiffrement** : AES-256-GCM (authentifié, résistant aux altérations)
- **Dérivation de clé** : PBKDF2-SHA256, 100 000 itérations
- **IV** : 12 octets aléatoires (unique par chiffrement)
- **Format** : `ENC:v1:<base64(IV[12] + ciphertext)>`
- **Rétrocompatibilité** : les champs sans préfixe `ENC:v1:` sont retournés tels quels

### Visibilité côté utilisateur
- **Non connecté** : bouton "Se connecter pour voir les coordonnées" (RGPD)
- **Connecté** : coordonnées déchiffrées et affichées normalement

---

## 3. Configuration des secrets GitHub Actions

Allez dans **GitHub → Settings → Secrets and variables → Actions** et ajoutez :

### Secrets existants (déjà configurés)
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_TOKEN`
- `IMGBB_KEY`
- `ADMIN_EMAIL`

### Nouveaux secrets à créer

#### `CRYPTO_SALT` — Sel pour le chiffrement des données perso
```bash
# Générer en ligne de commande :
openssl rand -base64 32
# Ou PowerShell :
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```
> ⚠️ **CRITIQUE** : Si ce secret est perdu, TOUTES les données chiffrées deviennent
> illisibles. Sauvegardez-le dans un gestionnaire de mots de passe (Bitwarden, 1Password…)

#### `BACKUP_ENCRYPTION_KEY` — Clé de chiffrement des sauvegardes
```bash
# Générer (64 caractères hexadécimaux = 32 octets) :
openssl rand -hex 32
# Ou PowerShell :
-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))
```
> ⚠️ **CRITIQUE** : Sauvegardez cette clé — elle est nécessaire pour restaurer vos données.

#### `FIREBASE_SERVICE_ACCOUNT` — Compte de service Firebase (pour les sauvegardes)
1. Ouvrez [Firebase Console](https://console.firebase.google.com)
2. **Paramètres du projet** → **Comptes de service**
3. Cliquez **Générer une nouvelle clé privée** (télécharge un fichier `.json`)
4. Copiez l'**intégralité du contenu JSON** comme valeur du secret

---

## 4. Workflows de sauvegarde automatique

### Sauvegarde des données Firestore (quotidienne)
**Fichier** : `.github/workflows/backup-data.yml`
- **Fréquence** : tous les jours à 2h00 UTC
- **Rétention** : 30 jours (artefacts GitHub)
- **Chiffrement** : AES-256-GCM avec `BACKUP_ENCRYPTION_KEY`
- **Déclenchement manuel** : GitHub → Actions → 🔐 Sauvegarde données → Run workflow

### Sauvegarde du code source (hebdomadaire)
**Fichier** : `.github/workflows/backup-code.yml`
- **Fréquence** : chaque dimanche à 3h00 UTC + chaque push sur `main`
- **Rétention** : 90 jours (artefacts GitHub)
- **Format** : archive ZIP du snapshot Git

### Télécharger une sauvegarde
1. GitHub → **Actions**
2. Sélectionnez le workflow (🔐 Sauvegarde ou 📦 Code)
3. Cliquez sur une exécution
4. Téléchargez dans la section **Artifacts**

---

## 5. Restauration des données

### Restaurer une sauvegarde Firestore

```bash
# 1. Installer les dépendances
cd scripts && npm install

# 2. Déchiffrer et afficher le contenu (sans restaurer)
BACKUP_ENCRYPTION_KEY=<votre_clé_hex> \
node scripts/restore-backup.mjs backups/firestore-backup-YYYY-MM-DDTHH-MM-SS.enc --dry-run

# 3. Exporter en JSON déchiffré pour inspection
BACKUP_ENCRYPTION_KEY=<votre_clé_hex> \
node scripts/restore-backup.mjs backups/firestore-backup-YYYY-MM-DDTHH-MM-SS.enc --json

# 4. Restaurer dans Firestore (ÉCRASE les données existantes)
FIREBASE_SERVICE_ACCOUNT='<json_service_account>' \
BACKUP_ENCRYPTION_KEY=<votre_clé_hex> \
node scripts/restore-backup.mjs backups/firestore-backup-YYYY-MM-DDTHH-MM-SS.enc
```

---

## 6. Mesures complémentaires en place

| Mesure                        | Statut | Détail                                              |
|-------------------------------|--------|-----------------------------------------------------|
| Auth Firebase                 | ✅     | Connexion requise pour déposer/éditer               |
| Règles Firestore strictes     | ✅     | Propriétaire + admin uniquement                     |
| HTTPS                         | ✅     | GitHub Pages (Let's Encrypt)                        |
| Bandeau cookies RGPD          | ✅     | Consentement GA4 + Brevo                            |
| CGU + Politique de confidentialité | ✅ | cgu.html                                           |
| Rappel légal vendeurs         | ✅     | Affiché sur deposer.html pour les ventes            |
| Chiffrement données perso     | ✅     | AES-256-GCM (Telephone, Adresse)                    |
| Coordonnées protégées         | ✅     | Login requis pour voir téléphone/email              |
| Sauvegarde données quotidienne| ✅     | Firestore → artifact chiffré GitHub                 |
| Sauvegarde code hebdomadaire  | ✅     | ZIP git → artifact GitHub                           |
| Droit à l'effacement          | ⚠️    | À implémenter : formulaire de suppression de compte |
| Registre des traitements      | ⚠️    | À documenter séparément (CNIL recommandé)           |

---

## 7. En cas d'incident de sécurité (fuite de données)

Selon l'article 33 du RGPD, une notification à la **CNIL** est requise sous **72 heures** si la fuite présente un risque pour les droits des personnes.

**Contact CNIL** : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles

**Actions immédiates** :
1. Révoquer les clés Firebase compromises (Firebase Console → Paramètres)
2. Regénérer `CRYPTO_SALT` et `BACKUP_ENCRYPTION_KEY` dans GitHub Secrets
3. Re-déployer l'application (GitHub Actions → Deploy → Run workflow)
4. Notifier les utilisateurs affectés par email (via Brevo)
5. Notifier la CNIL si nécessaire

---

*Document rédigé conformément au RGPD (UE) 2016/679 et à la recommandation CNIL.*
