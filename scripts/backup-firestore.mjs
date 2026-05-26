/**
 * YoupiZoo — Sauvegarde chiffrée Firestore
 * ==========================================
 * Exporte toutes les collections Firestore vers un fichier JSON chiffré AES-256-GCM.
 * Exécuté par GitHub Actions (workflow backup-data.yml) — NE PAS exécuter en local
 * sans configurer les variables d'environnement correspondantes.
 *
 * Variables d'environnement requises :
 *   FIREBASE_SERVICE_ACCOUNT  — JSON du compte de service Firebase (secret GitHub)
 *   BACKUP_ENCRYPTION_KEY     — Clé hex 64 caractères (32 octets) pour chiffrer la sauvegarde
 *   FIREBASE_PROJECT_ID       — ID du projet Firebase
 *
 * Format de sortie :
 *   backups/firestore-backup-YYYY-MM-DDTHH-MM-SS.enc  (chiffré)
 *   ou
 *   backups/firestore-backup-YYYY-MM-DDTHH-MM-SS.json (si clé manquante — DÉCONSEILLÉ)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore }         from 'firebase-admin/firestore';
import { createCipheriv, randomBytes } from 'crypto';
import { writeFileSync, mkdirSync }    from 'fs';
import { join, dirname }               from 'path';
import { fileURLToPath }               from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Initialisation Firebase Admin ─────────────────────────────────────────────
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT manquant. Voir SECURITE-RGPD.md pour la configuration.');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT : JSON invalide.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Collections à sauvegarder ─────────────────────────────────────────────────
const COLLECTIONS = [
  'annonces',
  'users',
  'conversations',
  'reports',
  'adminConfig',
  'moderation_logs'
];

// ── Export Firestore ───────────────────────────────────────────────────────────
async function exportCollection(name) {
  const snap = await db.collection(name).get();
  // Pour les conversations, inclure la sous-collection messages
  const docs = [];
  for (const doc of snap.docs) {
    const entry = { id: doc.id, data: doc.data() };
    if (name === 'conversations') {
      try {
        const msgSnap = await doc.ref.collection('messages').get();
        entry.messages = msgSnap.docs.map(m => ({ id: m.id, data: m.data() }));
      } catch {
        entry.messages = [];
      }
    }
    docs.push(entry);
  }
  return docs;
}

async function exportAll() {
  const backup = {
    schema_version: '1.0',
    timestamp:      new Date().toISOString(),
    projectId:      process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    collections:    {}
  };

  let totalDocs = 0;
  for (const col of COLLECTIONS) {
    try {
      backup.collections[col] = await exportCollection(col);
      const count = backup.collections[col].length;
      totalDocs += count;
      console.log(`  ✓ ${col.padEnd(20)} ${count} document(s)`);
    } catch (e) {
      console.warn(`  ⚠ ${col.padEnd(20)} erreur : ${e.message}`);
      backup.collections[col] = [];
    }
  }

  console.log(`\n  📊 Total : ${totalDocs} document(s) exporté(s)`);
  return JSON.stringify(backup, null, 2);
}

// ── Chiffrement AES-256-GCM ───────────────────────────────────────────────────
function encryptBackup(json, keyHex) {
  const key = Buffer.from(keyHex.trim(), 'hex');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY doit être un hex de 64 caractères (32 octets)');
  const iv         = randomBytes(16);
  const cipher     = createCipheriv('aes-256-gcm', key, iv);
  const encrypted  = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag        = cipher.getAuthTag();  // 16 octets d'authentification GCM
  // Format : [IV(16)] + [TAG(16)] + [ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n🔐 YoupiZoo — Sauvegarde Firestore');
console.log('─'.repeat(40));
console.log('  Démarrage :', new Date().toISOString());
console.log('  Projet    :', process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id);
console.log('');

const json       = await exportAll();
const backupKey  = process.env.BACKUP_ENCRYPTION_KEY;
const backupDir  = join(__dirname, '../backups');
const now        = new Date();
const dateStr    = now.toISOString().slice(0, 10);
const timeStr    = now.toISOString().slice(11, 19).replace(/:/g, '-');

mkdirSync(backupDir, { recursive: true });

if (backupKey && backupKey.trim().length === 64) {
  const encrypted = encryptBackup(json, backupKey);
  const filename  = `firestore-backup-${dateStr}T${timeStr}.enc`;
  writeFileSync(join(backupDir, filename), encrypted);
  const sizekb    = Math.round(encrypted.length / 1024);
  console.log(`\n  ✅ Sauvegarde CHIFFRÉE : ${filename} (${sizekb} Ko)`);
  console.log('     Format : AES-256-GCM | IV(16) + TAG(16) + ciphertext');
  console.log('     Outil de restauration : scripts/restore-backup.mjs\n');
} else {
  // Fallback sans chiffrement — émet une alerte claire
  const filename = `firestore-backup-${dateStr}T${timeStr}.json`;
  writeFileSync(join(backupDir, filename), json);
  const sizekb   = Math.round(json.length / 1024);
  console.warn(`\n  ⚠️  Sauvegarde NON chiffrée : ${filename} (${sizekb} Ko)`);
  console.warn('      → Ajoutez le secret BACKUP_ENCRYPTION_KEY dans GitHub pour activer le chiffrement.\n');
}
