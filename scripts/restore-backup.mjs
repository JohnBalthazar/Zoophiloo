/**
 * YoupiZoo — Restauration d'une sauvegarde Firestore chiffrée
 * ============================================================
 * Déchiffre un fichier .enc produit par backup-firestore.mjs.
 *
 * Usage :
 *   BACKUP_ENCRYPTION_KEY=<clé_hex_64_chars> \
 *   node scripts/restore-backup.mjs <fichier.enc> [--dry-run]
 *
 * Options :
 *   --dry-run   Affiche le contenu sans restaurer dans Firestore
 *   --json      Exporte le JSON déchiffré sans restaurer
 *
 * ⚠️  ATTENTION : la restauration écrase les documents existants dans Firestore.
 *     Utilisez --dry-run pour vérifier avant de restaurer.
 */

import { createDecipheriv } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const [, , filePath, ...flags] = process.argv;
const isDryRun  = flags.includes('--dry-run');
const isJsonOut = flags.includes('--json');

if (!filePath) {
  console.error('Usage : node restore-backup.mjs <fichier.enc> [--dry-run] [--json]');
  process.exit(1);
}

const backupKey = process.env.BACKUP_ENCRYPTION_KEY;
if (!backupKey || backupKey.trim().length !== 64) {
  console.error('❌ BACKUP_ENCRYPTION_KEY manquante ou invalide (hex 64 chars requis).');
  process.exit(1);
}

// ── Déchiffrement ─────────────────────────────────────────────────────────────
function decryptBackup(buffer, keyHex) {
  const key    = Buffer.from(keyHex.trim(), 'hex');
  const iv     = buffer.slice(0, 16);
  const tag    = buffer.slice(16, 32);
  const ct     = buffer.slice(32);
  const cipher = createDecipheriv('aes-256-gcm', key, iv);
  cipher.setAuthTag(tag);
  const decrypted = Buffer.concat([cipher.update(ct), cipher.final()]);
  return decrypted.toString('utf8');
}

console.log('\n🔓 YoupiZoo — Restauration de sauvegarde');
console.log('─'.repeat(40));
console.log('  Fichier :', filePath);

const buffer  = readFileSync(filePath);
let json;
try {
  json = decryptBackup(buffer, backupKey);
} catch (e) {
  console.error('❌ Déchiffrement échoué :', e.message);
  console.error('   → Vérifiez que BACKUP_ENCRYPTION_KEY est la bonne clé.');
  process.exit(1);
}

const backup = JSON.parse(json);
console.log('  Timestamp :', backup.timestamp);
console.log('  Projet    :', backup.projectId);

const collections = Object.keys(backup.collections);
for (const col of collections) {
  console.log(`  ✓ ${col.padEnd(20)} ${backup.collections[col].length} document(s)`);
}

if (isJsonOut) {
  const outFile = filePath.replace('.enc', '-decrypted.json');
  writeFileSync(outFile, json, 'utf8');
  console.log(`\n  📄 JSON exporté : ${outFile}`);
}

if (isDryRun || isJsonOut) {
  console.log('\n  Mode --dry-run : aucune restauration Firestore effectuée.\n');
  process.exit(0);
}

// ── Restauration Firestore ────────────────────────────────────────────────────
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT requis pour la restauration.');
  process.exit(1);
}

const { initializeApp, cert } = await import('firebase-admin/app');
const { getFirestore }        = await import('firebase-admin/firestore');

initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
const db = getFirestore();

console.log('\n  ⏳ Restauration en cours (BATCH WRITE) …\n');
let restored = 0;
for (const [colName, docs] of Object.entries(backup.collections)) {
  const batch = db.batch();
  for (const { id, data } of docs) {
    batch.set(db.collection(colName).doc(id), data, { merge: true });
    restored++;
  }
  await batch.commit();
  console.log(`  ✓ ${colName} restauré (${docs.length} documents)`);
}

console.log(`\n  ✅ ${restored} documents restaurés dans Firestore.\n`);
