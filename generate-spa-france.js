/**
 * generate-spa-france.js
 * Génère spa-france.html — annuaire complet des SPAs de France classé par région.
 */

const fs   = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'import-spa-data.json'), 'utf8'));

function toSlug(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Assigner les slugs (mêmes règles que generate-spa-pages.js)
const slugCount = {};
data.forEach(r => {
  let slug = toSlug(r.nom || 'refuge');
  if (slugCount[slug]) { slugCount[slug]++; slug = slug + '-' + (r.code_postal || slugCount[slug]); }
  else { slugCount[slug] = 1; }
  r._slug = slug;
});

// Grouper par région
const byRegion = {};
data.forEach(r => {
  const reg = r.region || 'Autres';
  if (!byRegion[reg]) byRegion[reg] = [];
  byRegion[reg].push(r);
});

// Emoji par région
const regionEmoji = {
  'Auvergne-Rhône-Alpes':           '🏔',
  'Bourgogne-Franche-Comté':        '🍷',
  'Bretagne':                        '⚓',
  'Centre-Val de Loire':             '🏰',
  'Grand Est':                       '🥨',
  'Guadeloupe':                      '🌴',
  'Hauts-de-France':                 '🌾',
  'La Réunion':                      '🌋',
  'Martinique':                      '🌺',
  'Normandie':                       '🍎',
  'Nouvelle-Aquitaine':              '🌊',
  'Occitanie':                       '☀️',
  'Pays de la Loire':                '🌿',
  'Polynésie française':             '🐠',
  "Provence-Alpes-Côte d'Azur":     '🌞',
  'Île-de-France':                   '🗼'
};

function typeEmoji(t) {
  if (t === 'SPA')         return '🐾';
  if (t === 'Association') return '🤝';
  return '🏠';
}

// Tri : métropole puis DOM-TOM
const DOM = ['Guadeloupe', 'Martinique', 'La Réunion', 'Polynésie française'];
const regions = Object.keys(byRegion).sort((a, b) => {
  const aD = DOM.includes(a), bD = DOM.includes(b);
  if (aD && !bD) return 1;
  if (!aD && bD) return -1;
  return a.localeCompare(b, 'fr');
});

// Build region-nav
const regionNav = regions.map(reg =>
  `<a href="#region-${toSlug(reg)}" class="region-pill">${regionEmoji[reg] || '📍'} ${esc(reg)}</a>`
).join('\n');

// Build sections
let regionsHTML = '';
for (const reg of regions) {
  const refuges = byRegion[reg].slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const emoji   = regionEmoji[reg] || '📍';

  let cards = '';
  for (const r of refuges) {
    cards += `
          <a class="spa-card" href="spa/${r._slug}.html">
            <div class="spa-card-head">
              <span class="spa-type-badge">${typeEmoji(r.type)} ${esc(r.type)}</span>
              <span class="spa-dept">${esc(r.code_postal || '')}</span>
            </div>
            <div class="spa-card-name">${esc(r.nom)}</div>
            <div class="spa-card-loc">${esc(r.ville || '')}</div>
            ${r.telephone ? `<div class="spa-card-tel">${esc(r.telephone)}</div>` : ''}
          </a>`;
  }

  regionsHTML += `
      <section class="region-section" id="region-${toSlug(reg)}">
        <div class="region-header">
          <span class="region-emoji">${emoji}</span>
          <h2 class="region-name">${esc(reg)}</h2>
          <span class="region-count">${refuges.length} refuge${refuges.length > 1 ? 's' : ''}</span>
        </div>
        <div class="region-grid">${cards}
        </div>
      </section>`;
}

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<!-- Google Analytics : chargé conditionnellement par cookies.js (RGPD) -->
<meta charset="UTF-8">
<meta name="theme-color" content="#c2410c">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Toutes les SPAs de France — Annuaire refuges SPA | YoupiZoo</title>
<meta name="description" content="Annuaire complet des 179 refuges SPA et associations de protection animale en France. Trouvez la SPA la plus proche et adoptez un animal abandonné.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://www.youpizoo.fr/spa-france.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Toutes les SPAs de France — YoupiZoo">
<meta property="og:description" content="Annuaire complet des 179 refuges SPA et associations de protection animale en France. Trouvez la SPA près de chez vous.">
<meta property="og:url" content="https://www.youpizoo.fr/spa-france.html">
<meta property="og:image" content="https://www.youpizoo.fr/og-image.jpg">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="YoupiZoo">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "Annuaire des SPAs et refuges animaux de France",
  "description": "Liste complète des refuges SPA et associations de protection animale en France métropolitaine et DOM",
  "url": "https://www.youpizoo.fr/spa-france.html",
  "numberOfItems": 179
}
</script>
<style>
  :root {
    --green: #5a9e1a; --green-dark: #478015; --green-light: #f0f8e6;
    --purple: #7c3aed; --purple-dark: #6d28d9; --purple-light: #f5f3ff;
    --orange: #c2410c; --orange-dark: #9a3412; --orange-light: #fff7ed;
    --text: #1a1a1a; --text-muted: #6b6b6b; --border: #e8e8e4;
    --bg: #fafaf8; --white: #ffffff;
    --font-display: 'Syne', sans-serif; --font-body: 'DM Sans', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-body); background: var(--bg); color: var(--text); min-height: 100vh; display: flex; flex-direction: column; }

  header { background: var(--white); border-bottom: 1px solid var(--border); padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; position: sticky; top: 0; z-index: 100; }
  .logo { text-decoration: none; display: inline-flex; align-items: center; }
  .logo-img { height: 51px; width: auto; display: block; }
  .tagline { font-size: 12px; color: var(--text-muted); font-weight: 300; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--border); }
  .header-left { display: flex; align-items: center; }
  .header-right { display: flex; align-items: center; gap: 8px; }
  .btn-ghost { font-family: var(--font-body); font-size: 13px; padding: 6px 14px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: var(--text); cursor: pointer; transition: all 0.15s; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; }
  .btn-ghost:hover { border-color: var(--green); background: var(--green-light); }
  .btn-primary { font-family: var(--font-body); font-size: 13px; font-weight: 500; padding: 6px 16px; border: none; border-radius: 8px; background: var(--green); color: white; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; transition: background 0.15s; }
  .btn-primary:hover { background: var(--green-dark); }

  .breadcrumb { padding: 10px 24px; font-size: 12px; color: var(--text-muted); background: var(--white); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .breadcrumb a { color: var(--text-muted); text-decoration: none; }
  .breadcrumb a:hover { color: var(--orange); }
  .breadcrumb .sep { opacity: 0.4; }

  .hero-banner { background: linear-gradient(135deg, #c2410c 0%, #9a3412 50%, #7c2d12 100%); padding: 40px 24px 36px; text-align: center; color: white; }
  .hero-banner h1 { font-family: var(--font-display); font-size: 28px; font-weight: 700; margin-bottom: 10px; }
  .hero-banner p { font-size: 15px; opacity: 0.88; max-width: 560px; margin: 0 auto 20px; line-height: 1.6; }
  .hero-stats { display: flex; justify-content: center; gap: 32px; font-size: 13px; opacity: 0.85; }
  .hero-stat strong { font-size: 22px; font-weight: 700; display: block; }
  .hero-spa-logo { font-size: 48px; margin-bottom: 12px; display: block; }

  .region-nav { background: var(--white); border-bottom: 1px solid var(--border); padding: 10px 24px; display: flex; gap: 6px; flex-wrap: wrap; }
  .region-pill { font-size: 12px; padding: 4px 12px; border: 1px solid var(--border); border-radius: 20px; text-decoration: none; color: var(--text-muted); white-space: nowrap; transition: all 0.15s; }
  .region-pill:hover { border-color: var(--orange); color: var(--orange); background: var(--orange-light); }

  .sticky-search { position: sticky; top: 64px; z-index: 90; background: var(--white); border-bottom: 1px solid var(--border); padding: 10px 24px; display: flex; align-items: center; gap: 12px; }
  .search-bar { display: flex; align-items: center; gap: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px 14px; flex: 1; max-width: 420px; }
  .search-bar input { flex: 1; border: none; outline: none; font-family: var(--font-body); font-size: 14px; background: transparent; color: var(--text); }
  .search-bar input::placeholder { color: var(--text-muted); }
  .total-count { font-size: 13px; color: var(--text-muted); margin-left: auto; }
  .total-count strong { color: var(--text); }

  main { flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; padding: 32px 24px 60px; display: flex; flex-direction: column; gap: 40px; }

  .region-section {}
  .region-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--border); }
  .region-emoji { font-size: 22px; }
  .region-name { font-family: var(--font-display); font-size: 20px; font-weight: 700; color: var(--text); }
  .region-count { font-size: 12px; font-weight: 500; background: var(--orange-light); color: var(--orange); padding: 3px 10px; border-radius: 12px; border: 1px solid #fed7aa; margin-left: auto; }
  .region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }

  .spa-card { background: var(--white); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 5px; transition: all 0.15s; }
  .spa-card:hover { border-color: var(--orange); box-shadow: 0 4px 14px rgba(194,65,12,0.1); transform: translateY(-2px); }
  .spa-card-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .spa-type-badge { font-size: 10px; font-weight: 700; color: var(--orange); background: var(--orange-light); padding: 2px 7px; border-radius: 9px; border: 1px solid #fed7aa; }
  .spa-dept { font-size: 11px; color: var(--text-muted); font-family: monospace; letter-spacing: 0.04em; }
  .spa-card-name { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.35; }
  .spa-card-loc { font-size: 12px; color: var(--text-muted); }
  .spa-card-tel { font-size: 12px; color: var(--purple-dark); font-weight: 500; }

  .eco-banner { background: linear-gradient(90deg, #d8f0b0 0%, #e8f8d0 100%); border-bottom: 1px solid #a0d860; padding: 6px 44px 6px 16px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #4a7a12; position: relative; flex-shrink: 0; text-align: center; line-height: 1.4; }
  .eco-banner a { color: #4a7a12; font-weight: 500; text-decoration: underline; text-underline-offset: 2px; }
  .eco-banner-dismiss { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 22px; height: 22px; border-radius: 50%; border: none; background: rgba(90,158,26,0.12); color: #4a7a12; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
  .eco-banner-dismiss:hover { background: rgba(90,158,26,0.25); }
  .hidden { display: none !important; }

  @media (max-width: 680px) {
    .eco-banner, footer { display: none !important; }
    .tagline { display: none; }
    .hero-banner h1 { font-size: 22px; }
    .hero-stats { gap: 16px; }
    main { padding: 16px 16px 40px; gap: 28px; }
    .region-grid { grid-template-columns: 1fr; }
    .sticky-search { padding: 8px 16px; flex-wrap: wrap; }
    .total-count { margin-left: 0; }
  }
</style>
<link rel="stylesheet" href="cookies.css">
</head>
<body>

<div class="eco-banner" id="ecoBanner">
  🌿 <strong>Site écoresponsable</strong> · Hébergé chez <a href="https://www.infomaniak.com/fr/ecologie" target="_blank" rel="noopener noreferrer">Infomaniak</a> &nbsp;·&nbsp; Engagement pour le bien-être animal 🐾
  <button class="eco-banner-dismiss" onclick="dismissEcoBanner()" title="Fermer" aria-label="Fermer le bandeau">✕</button>
</div>

<header>
  <div class="header-left">
    <a href="index.html" class="logo"><img src="logo.png" alt="YoupiZoo" class="logo-img"></a>
    <span class="tagline">Trouvez vos animaux près de chez vous</span>
  </div>
  <div class="header-right">
    <a href="refuges.html" class="btn-ghost">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      Refuges partenaires
    </a>
    <a href="deposer.html" class="btn-primary">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Déposer une annonce
    </a>
  </div>
</header>

<nav class="breadcrumb">
  <a href="index.html">Accueil</a>
  <span class="sep">›</span>
  <a href="refuges.html">Refuges &amp; Associations</a>
  <span class="sep">›</span>
  <span>Annuaire SPAs France</span>
</nav>

<div class="hero-banner">
  <span class="hero-spa-logo">🐾</span>
  <h1>Toutes les SPAs de France</h1>
  <p>Annuaire complet des refuges SPA et associations de protection animale. Partenariat officiel YoupiZoo × La SPA.</p>
  <div class="hero-stats">
    <div class="hero-stat"><strong>179</strong>refuges &amp; SPAs</div>
    <div class="hero-stat"><strong>16</strong>régions couvertes</div>
    <div class="hero-stat"><strong>87</strong>départements</div>
  </div>
</div>

<nav class="region-nav" aria-label="Navigation par région">
${regionNav}
</nav>

<div class="sticky-search">
  <div class="search-bar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" id="searchInput" placeholder="Rechercher une SPA ou une ville…" oninput="filterCards()" autocomplete="off">
  </div>
  <span class="total-count"><strong id="visibleCount">179</strong> refuges affichés</span>
</div>

<main id="mainContent">
${regionsHTML}
</main>

<script src="cookies.js"></script>
<footer style="text-align:center;padding:8px 16px 14px;font-size:12px;color:#888;border-top:1px solid #eee;">
  © 2025 YoupiZoo &nbsp;·&nbsp;
  <a href="index.html" style="color:#5a9e1a;text-decoration:none;">Annonces</a> &nbsp;·&nbsp;
  <a href="refuges.html" style="color:#7c3aed;text-decoration:none;">🏠 Refuges</a> &nbsp;·&nbsp;
  <a href="apropos.html" style="color:#5a9e1a;text-decoration:none;">À propos</a> &nbsp;·&nbsp;
  <a href="https://www.la-spa.fr/" target="_blank" rel="noopener noreferrer" style="color:#c2410c;text-decoration:none;">🐾 La SPA nationale</a>
</footer>

<script>
(function() {
  if (sessionStorage.getItem('eco_banner_dismissed') === '1') {
    var b = document.getElementById('ecoBanner'); if (b) b.style.display = 'none';
  }
})();
function dismissEcoBanner() {
  var b = document.getElementById('ecoBanner'); if (b) b.style.display = 'none';
  sessionStorage.setItem('eco_banner_dismissed', '1');
}
function filterCards() {
  var q = document.getElementById('searchInput').value.toLowerCase().trim();
  var cards = document.querySelectorAll('.spa-card');
  var visible = 0;
  cards.forEach(function(card) {
    var text = card.textContent.toLowerCase();
    if (!q || text.includes(q)) { card.classList.remove('hidden'); visible++; }
    else { card.classList.add('hidden'); }
  });
  document.querySelectorAll('.region-section').forEach(function(sec) {
    var anyVisible = sec.querySelectorAll('.spa-card:not(.hidden)').length > 0;
    sec.style.display = anyVisible ? '' : 'none';
  });
  document.getElementById('visibleCount').textContent = visible;
}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'spa-france.html'), html, 'utf8');
console.log('✅ spa-france.html créé (' + Math.round(html.length / 1024) + ' KB, ' + data.length + ' refuges)');
