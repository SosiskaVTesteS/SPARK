/* SPARK PWA — install prompt, update notification, iOS hint */
(function () {
  'use strict';

  var _swReg = null;
  var _installEvent = null;
  var _bannerDismissed = false;

  // ── Platform detection ───────────────────────────────────────────────────
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function isStandalone() {
    return navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
  }

  // ── Banner ───────────────────────────────────────────────────────────────
  function showInstallBanner() {
    if (_bannerDismissed || isStandalone()) return;
    var banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.add('visible');
  }

  function hideInstallBanner() {
    var banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.remove('visible');
  }

  // ── iOS hint ─────────────────────────────────────────────────────────────
  function showIOSHint() {
    if (isStandalone()) return;
    var hint = document.getElementById('pwaIOSHint');
    if (hint) hint.classList.add('visible');
  }

  // ── Update toast ─────────────────────────────────────────────────────────
  function showUpdateToast() {
    var toast = document.getElementById('pwaUpdateToast');
    if (toast) toast.classList.add('visible');
  }

  // ── Service Worker registration ─────────────────────────────────────────
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      _swReg = reg;

      if (reg.waiting) {
        showUpdateToast();
      }

      reg.addEventListener('updatefound', function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast();
          }
        });
      });
    }).catch(function (err) {
      console.warn('[SPARK PWA] SW registration failed:', err.message);
    });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      window.location.reload();
    });
  }

  // ── DOM ready ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    registerSW();

    // Install button → triggers native prompt or shows iOS hint
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (isIOS()) { showIOSHint(); return; }
        if (!_installEvent) return;
        _installEvent.prompt();
        _installEvent.userChoice.then(function (choice) {
          _installEvent = null;
          if (choice.outcome === 'accepted') hideInstallBanner();
        });
      });
    }

    // Dismiss banner
    var dismissBtn = document.getElementById('pwaInstallDismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        _bannerDismissed = true;
        hideInstallBanner();
        try { localStorage.setItem('spark_pwa_dismissed', '1'); } catch (e) {}
      });
    }

    // Update button → skipWaiting
    var updateBtn = document.getElementById('pwaUpdateBtn');
    if (updateBtn) {
      updateBtn.addEventListener('click', function () {
        if (_swReg && _swReg.waiting) {
          _swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }

    // Close update toast
    var toastClose = document.getElementById('pwaToastClose');
    if (toastClose) {
      toastClose.addEventListener('click', function () {
        var toast = document.getElementById('pwaUpdateToast');
        if (toast) toast.classList.remove('visible');
      });
    }

    // Close iOS hint
    var iosClose = document.getElementById('pwaIOSClose');
    if (iosClose) {
      iosClose.addEventListener('click', function () {
        var hint = document.getElementById('pwaIOSHint');
        if (hint) hint.classList.remove('visible');
      });
    }

    // iOS: auto-show hint after delay (once per week)
    if (isIOS() && !isStandalone()) {
      var lastShown = 0;
      try { lastShown = parseInt(localStorage.getItem('spark_ios_hint') || '0', 10); } catch (e) {}
      if (Date.now() - lastShown > 7 * 24 * 3600 * 1000) {
        setTimeout(function () {
          showIOSHint();
          try { localStorage.setItem('spark_ios_hint', String(Date.now())); } catch (e) {}
        }, 4000);
      }
    }
  });

  // ── beforeinstallprompt ───────────────────────────────────────────────────
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _installEvent = e;
    try { if (localStorage.getItem('spark_pwa_dismissed')) return; } catch (e2) {}
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    _installEvent = null;
    hideInstallBanner();
    var hint = document.getElementById('pwaIOSHint');
    if (hint) hint.classList.remove('visible');
  });
})();
