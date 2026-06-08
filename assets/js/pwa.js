/* SPARK PWA — install prompt, update notification, iOS/OEM/WebView browser detection */
(function () {
  'use strict';

  var _swReg = null;
  var _installEvent = null;
  var _bannerDismissed = false;

  // ── Platform / Browser detection ──────────────────────────────────────────

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent);
  }

  // Detect in-app WebViews (Telegram, VK, Instagram, FB, etc.)
  // These never fire beforeinstallprompt, so we need a separate hint.
  function isWebView() {
    var ua = navigator.userAgent;
    if (/telegram|instagram|fbav|fban|vkApp|VKAndroid/i.test(ua)) return true;
    // Generic Android WebView: Chrome injects "; wv)" when running inside a WebView host
    if (isAndroid() && /\bwv\b/.test(ua)) return true;
    return false;
  }

  // True only for stock Google Chrome (and Chromium derivatives that DON'T spoof targetSdkVersion)
  function isGoogleChrome() {
    var ua = navigator.userAgent;
    if (!/Chrome|CriOS/i.test(ua)) return false;
    // OEM browsers that piggyback on the Chrome UA string but use outdated minting servers
    if (/SamsungBrowser|MiuiBrowser|HeyTapBrowser|OppoBrowser|VivoBrowser|OPR\/|YaBrowser|UCBrowser|Kiwi|DuckDuckGo|Focus/i.test(ua)) return false;
    if (/Firefox|FxiOS/i.test(ua)) return false;
    if (isWebView()) return false;
    return true;
  }

  function isStandalone() {
    return navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
  }

  function getSiteURL() {
    return window.location.origin + '/';
  }

  // ── Banner mode rendering ─────────────────────────────────────────────────

  // Mutates the banner into "OEM warning" mode when a non-Chrome Android browser is detected.
  // Called only once, just before making the banner visible.
  function applyOEMMode(banner) {
    banner.dataset.mode = 'oem';

    var iconEl = banner.querySelector('.pwa-banner__icon');
    if (iconEl) {
      iconEl.classList.add('pwa-banner__icon--warn');
      iconEl.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' +
        '</svg>';
    }

    var titleEl = banner.querySelector('.pwa-banner__title');
    if (titleEl) titleEl.textContent = 'Рекомендуем Google Chrome';

    var subEl = banner.querySelector('.pwa-banner__sub');
    if (subEl) subEl.textContent = 'Для установки без ложных предупреждений Play Защиты откройте SPARK в Chrome';

    var actionsEl = banner.querySelector('.pwa-banner__actions');
    if (actionsEl) {
      actionsEl.innerHTML =
        '<button class="pwa-banner__btn pwa-banner__btn--copy" id="pwaCopyLinkBtn">Скопировать ссылку</button>' +
        '<button class="pwa-banner__btn pwa-banner__btn--install" id="pwaInstallBtn">Всё равно установить</button>' +
        '<button class="pwa-banner__btn pwa-banner__btn--dismiss" id="pwaInstallDismiss">Позже</button>';
    }
  }

  // ── Banner show / hide ────────────────────────────────────────────────────

  function showInstallBanner() {
    if (_bannerDismissed || isStandalone()) return;
    var banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;

    // Apply OEM mode once (idempotent guard via data-mode)
    if (isAndroid() && !isGoogleChrome() && !isWebView() && !banner.dataset.mode) {
      applyOEMMode(banner);
      // Re-bind buttons because we just rewrote the DOM
      bindBannerButtons();
    }

    banner.classList.add('visible');
  }

  function hideInstallBanner() {
    var banner = document.getElementById('pwaInstallBanner');
    if (banner) banner.classList.remove('visible');
  }

  // ── Copy-link helper ──────────────────────────────────────────────────────

  function copyLink(btn) {
    var url = getSiteURL();
    var label = btn.textContent;
    function done() {
      btn.textContent = '✓ Скопировано!';
      setTimeout(function () { btn.textContent = label; }, 2500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(function () { fallbackCopy(url); done(); });
    } else {
      fallbackCopy(url);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ── Button bindings ────────────────────────────────────────────────────────

  function bindBannerButtons() {
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      // Remove any stale listener by replacing the node
      var fresh = installBtn.cloneNode(true);
      installBtn.parentNode.replaceChild(fresh, installBtn);
      fresh.addEventListener('click', function () {
        if (isIOS()) { showIOSHint(); return; }
        if (!_installEvent) return;
        _installEvent.prompt();
        _installEvent.userChoice.then(function (choice) {
          _installEvent = null;
          if (choice.outcome === 'accepted') hideInstallBanner();
        });
      });
    }

    var copyBtn = document.getElementById('pwaCopyLinkBtn');
    if (copyBtn) {
      var freshCopy = copyBtn.cloneNode(true);
      copyBtn.parentNode.replaceChild(freshCopy, copyBtn);
      freshCopy.addEventListener('click', function () { copyLink(freshCopy); });
    }

    var dismissBtn = document.getElementById('pwaInstallDismiss');
    if (dismissBtn) {
      var freshDismiss = dismissBtn.cloneNode(true);
      dismissBtn.parentNode.replaceChild(freshDismiss, dismissBtn);
      freshDismiss.addEventListener('click', function () {
        _bannerDismissed = true;
        hideInstallBanner();
        try { localStorage.setItem('spark_pwa_dismissed', '1'); } catch (e) {}
      });
    }
  }

  // ── Hints ─────────────────────────────────────────────────────────────────

  function showIOSHint() {
    if (isStandalone()) return;
    var el = document.getElementById('pwaIOSHint');
    if (el) el.classList.add('visible');
  }

  function showWebViewHint() {
    if (isStandalone()) return;
    var el = document.getElementById('pwaWebViewHint');
    if (el) el.classList.add('visible');
  }

  // ── Update toast ──────────────────────────────────────────────────────────

  function showUpdateToast() {
    var el = document.getElementById('pwaUpdateToast');
    if (el) el.classList.add('visible');
  }

  // ── Service Worker ────────────────────────────────────────────────────────

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      _swReg = reg;
      if (reg.waiting) showUpdateToast();
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
    bindBannerButtons();

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
        var el = document.getElementById('pwaIOSHint');
        if (el) el.classList.remove('visible');
      });
    }

    // Close WebView hint
    var wvClose = document.getElementById('pwaWebViewClose');
    if (wvClose) {
      wvClose.addEventListener('click', function () {
        var el = document.getElementById('pwaWebViewHint');
        if (el) el.classList.remove('visible');
      });
    }

    // iOS: auto-show hint once per week
    if (isIOS() && !isStandalone()) {
      var lastIOS = 0;
      try { lastIOS = parseInt(localStorage.getItem('spark_ios_hint') || '0', 10); } catch (e) {}
      if (Date.now() - lastIOS > 7 * 24 * 3600 * 1000) {
        setTimeout(function () {
          showIOSHint();
          try { localStorage.setItem('spark_ios_hint', String(Date.now())); } catch (e) {}
        }, 4000);
      }
    }

    // Android WebView: auto-show hint once per week
    // (beforeinstallprompt never fires in WebViews, so we trigger manually)
    if (isAndroid() && isWebView() && !isStandalone()) {
      var lastWV = 0;
      try { lastWV = parseInt(localStorage.getItem('spark_wv_hint') || '0', 10); } catch (e) {}
      if (Date.now() - lastWV > 7 * 24 * 3600 * 1000) {
        setTimeout(function () {
          showWebViewHint();
          try { localStorage.setItem('spark_wv_hint', String(Date.now())); } catch (e) {}
        }, 3000);
      }
    }
  });

  // ── beforeinstallprompt ───────────────────────────────────────────────────
  // e.preventDefault() suppresses Chrome's own mini-infobar so we can show our
  // custom banner instead.  The stored _installEvent is used by the install
  // button's click handler to call .prompt() — this is the correct custom-UX
  // pattern.  The console warning "Banner not shown: ...preventDefault() called"
  // is Chrome confirming the suppression and is expected / intentional.

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();   // intentional — we own the install UX via #pwaInstallBtn
    _installEvent = e;
    try { if (localStorage.getItem('spark_pwa_dismissed')) return; } catch (e2) {}
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    _installEvent = null;
    hideInstallBanner();
    ['pwaIOSHint', 'pwaWebViewHint'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('visible');
    });
  });
})();
