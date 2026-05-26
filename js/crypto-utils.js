/**
 * YoupiZoo — Module de chiffrement RGPD
 * ======================================
 * Chiffrement AES-256-GCM des données personnelles avant stockage Firestore.
 * Conforme aux exigences de l'article 32 du RGPD (mesures techniques appropriées).
 *
 * FORMAT : "ENC:v1:<base64(IV[12 octets] + ciphertext)>"
 * Rétrocompatible : les champs NON préfixés "ENC:v1:" sont retournés tels quels.
 *
 * Clé : PBKDF2-SHA256 (100 000 itérations) dérivée depuis le sel plateforme.
 * Ce sel est INJECTÉ à la compilation par GitHub Actions — jamais stocké en clair
 * dans le dépôt source.
 */

/* global crypto */

// Sel injecté par GitHub Actions via le secret CRYPTO_SALT
const _YZ_PLATFORM_SALT = '__CRYPTO_SALT__';

// Cache de la clé dérivée (évite 100 000 itérations PBKDF2 à chaque appel)
let _yzCachedKey = null;

/**
 * Dérive et met en cache la clé AES-256-GCM depuis le sel plateforme.
 * @returns {Promise<CryptoKey>}
 */
async function _yzGetKey() {
  if (_yzCachedKey) return _yzCachedKey;

  // Vérification locale : si le sel n'est pas injecté, désactiver le chiffrement
  if (_YZ_PLATFORM_SALT === '__CRYPTO_SALT__') {
    console.warn('[YoupiZoo] CRYPTO_SALT non injecté — chiffrement transparent (dev local)');
    return null;
  }

  const enc = new TextEncoder();
  const rawKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(_YZ_PLATFORM_SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  _yzCachedKey = await crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       enc.encode('youpizoo-rgpd-v1'),
      iterations: 100000,
      hash:       'SHA-256'
    },
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return _yzCachedKey;
}

/**
 * Chiffre une chaîne de caractères avec AES-256-GCM.
 * @param {string|null} plaintext - Texte à chiffrer
 * @returns {Promise<string|null>} Format "ENC:v1:<base64>" ou null
 */
async function yzEncrypt(plaintext) {
  if (!plaintext) return null;

  const key = await _yzGetKey();
  // Si pas de clé (dev local), retourner en clair
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(String(plaintext))
  );

  // Concatène IV (12 octets) + ciphertext et encode en Base64
  const buf = new Uint8Array(12 + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), 12);

  return 'ENC:v1:' + btoa(String.fromCharCode(...buf));
}

/**
 * Déchiffre un champ chiffré par yzEncrypt.
 * Si le champ n'est pas préfixé "ENC:v1:", il est retourné tel quel (rétrocompatibilité).
 * @param {string|null} encrypted - Valeur (chiffrée ou en clair)
 * @returns {Promise<string|null>}
 */
async function yzDecrypt(encrypted) {
  if (!encrypted) return null;

  // Champ non chiffré (anciennes annonces ou champ en clair) → retour direct
  if (!encrypted.startsWith('ENC:v1:')) return encrypted;

  const key = await _yzGetKey();
  if (!key) {
    // Dev local sans sel : retourner un placeholder lisible
    return '[donnée protégée]';
  }

  try {
    const bytes  = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
    const iv     = bytes.slice(0, 12);
    const ct     = bytes.slice(12);
    const pt     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch (e) {
    console.error('[YoupiZoo] Déchiffrement échoué :', e.message);
    return null; // Ne jamais exposer de données partielles
  }
}

// ── Champs sensibles des annonces (RGPD) ─────────────────────────────────────
// Champs chiffrés au repos dans Firestore, déchiffrés côté client à l'affichage.
const _YZ_SENSITIVE_FIELDS = ['Telephone', 'Adresse'];

/**
 * Chiffre les champs sensibles d'un objet Firestore avant écriture.
 * @param {object} fields - Données de l'annonce (clés Firestore)
 * @returns {Promise<object>} Copie avec champs sensibles chiffrés
 */
async function yzEncryptRecord(fields) {
  const out = { ...fields };
  for (const k of _YZ_SENSITIVE_FIELDS) {
    if (out[k]) out[k] = await yzEncrypt(out[k]);
  }
  return out;
}

/**
 * Déchiffre les champs sensibles d'un objet Firestore après lecture.
 * @param {object} data - Données brutes de Firestore
 * @returns {Promise<object>} Copie avec champs sensibles déchiffrés
 */
async function yzDecryptRecord(data) {
  const out = { ...data };
  for (const k of _YZ_SENSITIVE_FIELDS) {
    if (out[k]) out[k] = await yzDecrypt(out[k]);
  }
  return out;
}
