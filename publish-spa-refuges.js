/**
 * publish-spa-refuges.js
 * ──────────────────────────────────────────────────────────────────────
 * Passe tous les refuges importés depuis import-spa-data.json
 * à visible: true dans Firestore.
 *
 * Usage :
 *   node publish-spa-refuges.js           → publie TOUS les refuges SPA
 *   node publish-spa-refuges.js --dry-run → liste sans modifier
 * ──────────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const KEY_PATH = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('\n❌ serviceAccountKey.json introuvable.\n');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

async function main() {
  console.log('\n🔍 Recherche des refuges SPA importés (visible: false)…\n');

  // On cible uniquement les docs importés par notre script
  const snap = await db.collection('refuges')
    .where('visible', '==', false)
    .where('import_source', '==', 'import-spa-firestore.js')
    .get();

  if (snap.empty) {
    console.log('✅ Aucun refuge en attente de publication.\n');
    process.exit(0);
  }

  console.log(`📦 ${snap.size} refuges à publier :\n`);
  snap.forEach(doc => {
    const d = doc.data();
    console.log(`  ${DRY_RUN ? '[DRY]' : '✅'} ${d.nom} — ${d.ville || ''} (${d.code_postal || ''})`);
  });

  if (DRY_RUN) {
    console.log(`\n🔎 Dry-run : aucune modification. Relancez sans --dry-run pour publier.\n`);
    process.exit(0);
  }

  // Publication par batchs
  const BATCH_SIZE = 400;
  const docs = snap.docs;
  let published = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(doc => batch.update(doc.ref, { visible: true }));
    await batch.commit();
    published += chunk.length;
    console.log(`\n   ✅ Batch envoyé : ${published}/${docs.length}`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Publication terminée !
   ${published} refuges sont maintenant visibles sur YoupiZoo.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Erreur :', err.message);
  process.exit(1);
});
