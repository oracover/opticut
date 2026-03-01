/**
 * OptiCut — Gestionnaire de consentement cookies RGPD
 * Conforme RGPD / ePrivacy
 * Intégrer ce script dans toutes les pages : <script src="../assets/js/cookie-consent.js"></script>
 * (ou <script src="assets/js/cookie-consent.js"></script> pour index.html)
 */

(function () {
  'use strict';

  var CONSENT_KEY  = 'opticut_cookie_consent';
  var CONSENT_ADS  = 'opticut_ads_consent';

  // Vérifie si le consentement a déjà été donné
  function hasConsented() {
    return localStorage.getItem(CONSENT_KEY) !== null;
  }

  // Active Google AdSense si consentement publicitaire accordé
  function enableAds() {
    if (localStorage.getItem(CONSENT_ADS) === 'true') {
      // Déclenche le chargement des annonces AdSense
      if (window.adsbygoogle) {
        var slots = document.querySelectorAll('.adsbygoogle');
        slots.forEach(function (ins) {
          try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
        });
      }
    }
  }

  // Crée et injecte le bandeau
  function createBanner() {
    // Chemin relatif vers les pages légales
    var isRoot   = !window.location.pathname.includes('/pages/');
    var basePath = isRoot ? 'pages/' : '';

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML =
      '<div class="cookie-text">' +
        '<strong>🍪 Ce site utilise des cookies</strong><br>' +
        'OptiCut n\'utilise aucun cookie propre. Des cookies publicitaires <strong>Google AdSense</strong> ' +
        'peuvent être déposés pour financer l\'hébergement de cet outil gratuit et open-source. ' +
        'Vous pouvez accepter, refuser ou personnaliser votre choix. ' +
        '<a href="' + basePath + 'confidentialite.html">En savoir plus →</a>' +
      '</div>' +
      '<div class="cookie-actions">' +
        '<button class="cookie-btn cookie-btn-refuse"  id="cookie-refuse">Refuser</button>' +
        '<button class="cookie-btn cookie-btn-accept"  id="cookie-accept">Accepter</button>' +
      '</div>';

    document.body.appendChild(banner);

    // Bouton Accepter
    document.getElementById('cookie-accept').addEventListener('click', function () {
      localStorage.setItem(CONSENT_KEY, 'true');
      localStorage.setItem(CONSENT_ADS,  'true');
      hideBanner();
      enableAds();
    });

    // Bouton Refuser
    document.getElementById('cookie-refuse').addEventListener('click', function () {
      localStorage.setItem(CONSENT_KEY, 'true');
      localStorage.setItem(CONSENT_ADS,  'false');
      hideBanner();
      // Masque les emplacements publicitaires si refus
      document.querySelectorAll('.ad-slot').forEach(function (el) {
        el.style.display = 'none';
      });
    });
  }

  function hideBanner() {
    var b = document.getElementById('cookie-banner');
    if (b) {
      b.style.animation = 'none';
      b.classList.add('hidden');
    }
  }

  // Injecte le CSS du bandeau
  function injectCSS() {
    var isRoot   = !window.location.pathname.includes('/pages/');
    var basePath = isRoot ? 'assets/css/' : '../assets/css/';
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = basePath + 'cookie-consent.css';
    document.head.appendChild(link);
  }

  // Point d'entrée
  function init() {
    injectCSS();
    if (!hasConsented()) {
      // Affiche le bandeau au chargement
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createBanner);
      } else {
        createBanner();
      }
    } else {
      // Consentement déjà enregistré — active les pubs si accepté
      enableAds();
      // Si refus précédent, masque les slots
      if (localStorage.getItem(CONSENT_ADS) === 'false') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () {
            document.querySelectorAll('.ad-slot').forEach(function (el) {
              el.style.display = 'none';
            });
          });
        } else {
          document.querySelectorAll('.ad-slot').forEach(function (el) {
            el.style.display = 'none';
          });
        }
      }
    }
  }

  init();

})();
