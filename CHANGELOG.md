# Changelog — Zoophiloo

Toutes les modifications notables sont documentées ici, dans l'ordre chronologique inverse (plus récent en tête).

---

## [2026-05-14] — Upload photos Imgbb, vignettes liste, menu utilisateur

### `deposer.html` — Upload photos Imgbb

#### Améliorations UX
- **Compteur de photos** (`0 / 5`) affiché en badge dans le coin supérieur droit de la zone de dépôt, mis à jour en temps réel
- **Zone de dépôt désactivée** visuellement (opacité + curseur `default`) quand le quota de 5 photos est atteint, avec message d'aide adapté
- **Feedback d'erreur inline** sous la zone : photo trop lourde (> 10 Mo), type non image, quota dépassé → message auto-effacé après 4 secondes
- **Badge "1ère"** sur la miniature de la photo principale (celle qui sera affichée en vignette dans les listings)
- **Badge de poids** (Ko / Mo) sur chaque miniature pour que l'utilisateur sache ce qu'il upload
- **Bouton de suppression** en hover uniquement (overlay propre, moins encombrant)
- **Animation d'entrée** (`thumbIn`) sur chaque miniature ajoutée
- Grille de previews passée de 4 → **5 colonnes** (correspond au quota de 5 photos)
- Réinitialisation du `<input type="file">` après chaque sélection : le même fichier peut être resélectionné après suppression

#### Barre de progression
- **Pourcentage numérique** affiché à droite (`0 %` → `100 %`) pendant l'upload
- Label plus clair : `Photo X / N…` au lieu de `Upload photo X/N...`
- Gradient vert sur la barre de progression
- **Auto-masquage** de la barre 2 secondes après la fin de l'upload
- Message de succès : `✅ N photo(s) uploadée(s)`

#### Validation renforcée
- Vérification du type MIME (`image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- Vérification du poids avant lecture FileReader (pas d'attente inutile)
- Constantes `MAX_PHOTOS = 5` et `MAX_SIZE_MB = 10` centralisées

---

### `index.html` — Vignette photo dans la liste des annonces

**Déjà implémenté correctement** : la card `.ad-card` contient un `.ad-img` qui affiche `<img src="${photoUrl}">` si `f['Photos']?.[0]?.url` existe, sinon l'emoji de l'espèce en fallback. Aucune modification nécessaire — comportement conforme au cahier des charges (LeBonCoin style).

---

### `index.html` + `annonce.html` — Menu utilisateur (dropdown)

#### Suppression du label statique "MON COMPTE"
- L'ancien en-tête `<div>Mon compte</div>` (non cliquable, stylistiquement ambigu) est **supprimé**

#### Ajout d'un vrai item "Mon compte"
- Remplacement par un **lien cliquable** `<a href="mon-espace.html">` avec icône profil (silhouette utilisateur)
- Style `font-weight: 600` + séparateur inférieur (`border-bottom`) pour en faire un item premium visuellement distinct
- Le dropdown complet est donc :
  1. **Mon compte** → `mon-espace.html` (nouveau, style gras + séparateur)
  2. **Mes annonces** → `mon-espace.html` (existant)
  3. **Déposer une annonce** → `deposer.html` (existant)
  4. — séparateur —
  5. **Se déconnecter** (existant, rouge au hover)

#### Fichiers modifiés
- `index.html` — dans la fonction `renderHeaderAuth(user)` (script Firebase en bas de page)
- `annonce.html` — dans la même fonction `renderHeaderAuth(user)` (script Firebase en bas de page)

---

## Fichiers non modifiés dans cette session

| Fichier | Raison |
|---|---|
| `login.html` | Non concerné par les demandes |
| `mon-espace.html` | Non concerné (cible des liens, pas modifiée) |
| `editer.html` | Non concerné |
| `cgu.html` | Non concerné |
| `deploy.yml` | Aucun nouveau secret à injecter |

---

## Stack de référence

| Composant | Détail |
|---|---|
| Hébergement | GitHub Pages (statique) |
| Auth | Firebase Auth (`__FIREBASE_*__` → GitHub Actions secrets) |
| Données | Airtable `appepwMYbNUv2k3f9` / table `Annonces` |
| Photos | Imgbb API (`__IMGBB_KEY__` → GitHub Actions secret) |
| Polices | Syne + DM Sans |
| Couleur principale | `#1a9e6e` |
