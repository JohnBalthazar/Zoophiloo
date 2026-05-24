/* ================================================
   YOUPIZOO — Gestion du consentement cookies
   RGPD / CNIL — v1.1
   ================================================
   Cookies gérés :
   1. Firebase Auth      → fonctionnels, toujours actifs
   2. Google Analytics 4 → consentement requis, chargé dynamiquement
   3. Brevo              → consentement requis
   ================================================ */

(function () {
  'use strict';

  var GA_ID     = 'G-PYR4KQ6XLZ';
  var KEY_PREFS = 'youpizoo_cookies_accepted';
  var KEY_DATE  = 'youpizoo_cookies_date';

  /* ---- Lecture / écriture des préférences ---- */

  function getPrefs() {
    try {
      var raw = localStorage.getItem(KEY_PREFS);
      if (!raw) return null;

      // RGPD / CNIL : le consentement expire après 13 mois (≈ 395 jours)
      var savedDate = localStorage.getItem(KEY_DATE);
      if (savedDate) {
        var ageMs    = Date.now() - new Date(savedDate).getTime();
        var limitMs  = 13 * 30 * 24 * 60 * 60 * 1000; // 13 mois
        if (ageMs > limitMs) {
          localStorage.removeItem(KEY_PREFS);
          localStorage.removeItem(KEY_DATE);
          return null; // expiration → re-demander le consentement
        }
      }

      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(KEY_PREFS, JSON.stringify(prefs));
      localStorage.setItem(KEY_DATE, new Date().toISOString());
    } catch (e) {}
  }

  /* ---- Chargement dynamique de GA4 ---- */

  function loadGA4() {
    // Évite un double chargement
    if (window._yzGA4Loaded) return;
    window._yzGA4Loaded = true;

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    var s   = document.createElement('script');
    s.async = true;
    s.src   = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    s.onload = function () {
      gtag('js', new Date());
      gtag('config', GA_ID, { anonymize_ip: true });
    };
  }

  /* ---- Appliquer silencieusement les préférences sauvegardées ---- */

  function applyPrefs(prefs) {
    if (prefs && prefs.analytics) loadGA4();
  }

  /* ---- Affichage du bandeau ---- */

  function showBanner() {
    var banner = document.getElementById('yz-cookie-banner');
    if (!banner) return;
    banner.style.display = 'flex';
    // Double requestAnimationFrame pour que le navigateur applique
    // display:flex avant de déclencher la transition CSS
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('yz-visible');
      });
    });
  }

  function hideBanner() {
    var banner = document.getElementById('yz-cookie-banner');
    if (!banner) return;
    banner.classList.remove('yz-visible');
    // On masque après la fin de la transition (450 ms + marge)
    setTimeout(function () {
      banner.style.display = 'none';
    }, 480);
  }

  /* ---- Actions utilisateur ---- */

  function acceptAll() {
    savePrefs({ analytics: true, brevo: true });
    loadGA4();
    hideBanner();
  }

  function refuseAll() {
    savePrefs({ analytics: false, brevo: false });
    hideBanner();
  }

  function saveCustom() {
    var elAnalytics = document.getElementById('yz-toggle-analytics');
    var elBrevo     = document.getElementById('yz-toggle-brevo');
    var prefs = {
      analytics: elAnalytics ? elAnalytics.checked : false,
      brevo:     elBrevo     ? elBrevo.checked     : false
    };
    savePrefs(prefs);
    if (prefs.analytics) loadGA4();
    hideBanner();
  }

  /* ---- Navigation entre panneaux ---- */

  function showPanel() {
    var main  = document.getElementById('yz-main');
    var panel = document.getElementById('yz-panel');
    if (main)  main.style.display  = 'none';
    if (panel) panel.style.display = 'block';
  }

  function showMain() {
    var main  = document.getElementById('yz-main');
    var panel = document.getElementById('yz-panel');
    if (main)  main.style.display  = '';
    if (panel) panel.style.display = 'none';
  }

  /* ---- Liaison des boutons (idempotente) ---- */
  // Utilise un flag pour éviter les doublons d'écouteurs si appelée plusieurs fois

  var _buttonsBound = false;

  function bindButtons() {
    if (_buttonsBound) return;
    _buttonsBound = true;

    function on(id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }
    on('yz-accept-all',   acceptAll);
    on('yz-accept-all-2', acceptAll);
    on('yz-refuse',       refuseAll);
    on('yz-customize',    showPanel);
    on('yz-back',         showMain);
    on('yz-save',         saveCustom);
  }

  /* ---- Réouverture depuis le footer ---- */
  // Appelé par :  onclick="yzReopenCookies()"

  window.yzReopenCookies = function () {
    var prefs       = getPrefs();
    var elAnalytics = document.getElementById('yz-toggle-analytics');
    var elBrevo     = document.getElementById('yz-toggle-brevo');

    // Pré-remplir les toggles avec les choix actuels
    if (elAnalytics) elAnalytics.checked = prefs ? !!prefs.analytics : false;
    if (elBrevo)     elBrevo.checked     = prefs ? !!prefs.brevo     : false;

    // S'assurer que les boutons sont liés (cas où init() a court-circuité)
    bindButtons();
    showMain();
    showBanner();
  };

  /* ---- Initialisation ---- */

  function init() {
    // Les boutons sont TOUJOURS liés — la fonction est idempotente
    bindButtons();

    var prefs = getPrefs();

    if (prefs !== null) {
      // L'utilisateur a déjà fait un choix → on l'applique sans afficher le bandeau
      applyPrefs(prefs);
      return;
    }

    // Aucun choix enregistré (ou consentement expiré) → afficher le bandeau après un court délai
    setTimeout(showBanner, 900);
  }

  // Attendre que le DOM soit prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
