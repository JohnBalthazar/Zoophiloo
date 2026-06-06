/**
 * import-spa-firestore.js
 * ────────────────────────────────────────────────────────────────────
 * Importe toutes les SPAs/refuges de import-spa-data.json dans Firestore.
 *
 * PRÉREQUIS :
 *   1. Télécharger la clé admin Firebase :
 *      Console Firebase → Paramètres du projet → Comptes de service
 *      → Générer une nouvelle clé privée → sauvegarder sous "serviceAccountKey.json"
 *      dans CE dossier.
 *
 *   2. Installer les dépendances (une seule fois) :
 *      npm install firebase-admin
 *
 *   3. Lancer le script :
 *      node import-spa-firestore.js
 *
 * Le script :
 *   - Lit import-spa-data.json
 *   - Vérifie les doublons (même nom + code_postal déjà en base)
 *   - Insère les nouveaux refuges avec visible: false (pour relecture avant publication)
 *   - Affiche un résumé à la fin
 * ────────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Config ─────────────────────────────────────────────────────────
const KEY_PATH  = path.join(__dirname, 'serviceAccountKey.json');
const DATA_PATH = path.join(__dirname, 'import-spa-data.json');
const COLLECTION = 'refuges';
// ───────────────────────────────────────────────────────────────────

// Vérifications préalables
if (!fs.existsSync(KEY_PATH)) {
  console.error('\n❌ Fichier "serviceAccountKey.json" introuvable dans ce dossier.');
  console.error('   → Console Firebase > Paramètres > Comptes de service > Générer une clé privée\n');
  process.exit(1);
}
if (!fs.existsSync(DATA_PATH)) {
  console.error('\n❌ Fichier "import-spa-data.json" introuvable.\n');
  process.exit(1);
}

// Initialisation Firebase Admin
const serviceAccount = require(KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Utilitaire : slug lisible
function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`\n📦 ${data.length} refuges à traiter...\n`);

  // Charger les refuges existants pour détection des doublons
  const existingSnap = await db.collection(COLLECTION).get();
  const existingKeys = new Set();
  existingSnap.forEach(doc => {
    const d = doc.data();
    if (d.nom && d.code_postal) {
      existingKeys.add(`${d.nom.toLowerCase()}__${d.code_postal}`);
    }
  });
  console.log(`🔍 ${existingKeys.size} refuges déjà en base.\n`);

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  // Import par batchs de 400 (limite Firestore: 500 ops/batch)
  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const refuge of data) {
    const dupKey = `${(refuge.nom || '').toLowerCase()}__${refuge.code_postal || ''}`;

    if (existingKeys.has(dupKey)) {
      console.log(`⏭  Ignoré (doublon) : ${refuge.nom} — ${refuge.code_postal}`);
      skipped++;
      continue;
    }

    try {
      const docRef = db.collection(COLLECTION).doc(); // ID auto-généré
      // Normalisation des champs : site_web → website (refuge.html utilise d.website)
      const { site_web, ...refugeRest } = refuge;
      const docData = {
        ...refugeRest,
        website:  site_web || refuge.website || '',  // champ canonique
        slug:     toSlug(refuge.nom || ''),
        visible:  false,                             // À publier manuellement après relecture
        spa_page: `/spa/${toSlug(refuge.nom || '')}.html`, // lien vers fiche statique YoupiZoo
        created_at:    admin.firestore.FieldValue.serverTimestamp(),
        import_source: 'import-spa-firestore.js'
      };

      batch.set(docRef, docData);
      existingKeys.add(dupKey);
      batchCount++;
      inserted++;

      // Commit du batch quand il atteint BATCH_SIZE
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        console.log(`   ✅ Batch de ${batchCount} documents envoyé.`);
        batch = db.batch();
        batchCount = 0;
      }
    } catch (err) {
      console.error(`   ❌ Erreur pour ${refuge.nom}: ${err.message}`);
      errors++;
    }
  }

  // Commit du dernier batch partiel
  if (batchCount > 0) {
    await batch.commit();
    console.log(`   ✅ Dernier batch de ${batchCount} documents envoyé.`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Import terminé !
   Insérés  : ${inserted}
   Ignorés  : ${skipped} (doublons)
   Erreurs  : ${errors}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Les refuges sont créés avec visible: false.
   Pour les publier : Console Firebase → Firestore
   → collection "refuges" → passer visible à true
   sur les fiches que vous souhaitez afficher.
`);

  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});
