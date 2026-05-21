/* ═══════════════════════════════════════════════════════════
   SPARK — animations.js
   IntroEngine · RippleEngine · MagneticEngine
   RevealEngine · NavEngine · CountUpEngine
   ═══════════════════════════════════════════════════════════ */
'use strict';

/* ════════════════════════════════════════════════
   INTRO ENGINE
   Shows animated logo sequence once per session.
   ════════════════════════════════════════════════ */
var IntroEngine = {
  STORAGE_KEY: 'spark_intro_v1',

  alreadyShown: function () {
    try { return sessionStorage.getItem(this.STORAGE_KEY) === '1'; } catch (e) { return true; }
  },

  markShown: function () {
    try { sessionStorage.setItem(this.STORAGE_KEY, '1'); } catch (e) {}
  },

  run: function () {
    var intro = document.getElementById('sparkIntro');
    if (!intro) return;

    if (this.alreadyShown()) {
      intro.classList.add('si-hidden');
      return;
    }

    /* Mark body so CSS can hide launchOverlay */
    document.body.classList.add('intro-active');
    this.markShown();

    /* Spawn particles at ~0.8 s (after stroke finishes) */
    setTimeout(function () { IntroEngine.spawnParticles(); }, 820);

    /* Begin exit at 2.7 s, fully remove at 3.6 s */
    setTimeout(function () {
      intro.classList.add('si-exiting');
      setTimeout(function () {
        intro.classList.add('si-hidden');
        document.body.classList.remove('intro-active');
      }, 900);
    }, 2700);
  },

  spawnParticles: function () {
    var container = document.getElementById('siParticles');
    if (!container) return;
    var colors  = ['#9B5FFF', '#E85AA0', '#E8C55A', '#5AE8C5', '#7B5CFA', '#FF9EDB'];
    var count   = 20;

    for (var i = 0; i < count; i++) {
      (function (idx) {
        var p = document.createElement('div');
        p.className = 'si-particle';

        var angle    = (idx / count) * 360;
        var dist     = 65 + Math.random() * 90;
        var tx       = Math.cos(angle * Math.PI / 180) * dist;
        var ty       = Math.sin(angle * Math.PI / 180) * dist;
        var size     = 2 + Math.random() * 3.5;
        var color    = colors[idx % colors.length];
        var dur      = (0.75 + Math.random() * 0.55).toFixed(2);
        var del      = (Math.random() * 0.28).toFixed(2);

        p.style.cssText =
          'top:50%;left:50%;' +
          'width:'  + size + 'px;height:' + size + 'px;' +
          'background:' + color + ';' +
          '--ptx:' + tx.toFixed(1) + 'px;' +
          '--pty:' + ty.toFixed(1) + 'px;' +
          '--p-dur:' + dur + 's;' +
          '--p-del:' + del + 's;';

        container.appendChild(p);

        /* Double-rAF to allow paint before class adds */
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { p.classList.add('active'); });
        });
      })(i);
    }
  }
};

/* ════════════════════════════════════════════════
   RIPPLE ENGINE
   Adds material-style ripple on all interactive els.
   ════════════════════════════════════════════════ */
var RippleEngine = {
  SELECTOR: 'button, .binv, .bcrit, .auth-btn, .btn-post, .fbtn, .tchip, .rbbl, .mob-tab, .dur-btn, .pbtn, .prs-btn, .hbtn, .vm-btn, .spark-btn-submit, .spark-btn-danger',

  init: function () {
    document.addEventListener('pointerdown', function (e) {
      var target = e.target.closest(RippleEngine.SELECTOR);
      if (!target) return;
      if (target.disabled || target.classList.contains('locked')) return;

      var rect = target.getBoundingClientRect();
      var x    = e.clientX - rect.left;
      var y    = e.clientY - rect.top;

      var r    = document.createElement('span');
      r.className  = 'spark-ripple';
      r.style.left = x + 'px';
      r.style.top  = y + 'px';

      /* Ensure overflow hidden */
      var pos = window.getComputedStyle(target).position;
      if (pos === 'static') target.style.position = 'relative';
      target.style.overflow = 'hidden';

      target.appendChild(r);
      setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
    }, { passive: true });
  }
};

/* ════════════════════════════════════════════════
   MAGNETIC ENGINE
   Subtle cursor-attraction on large CTA buttons (desktop only).
   ════════════════════════════════════════════════ */
var MagneticEngine = {
  STRENGTH: 0.14,

  init: function () {
    /* Skip on touch devices */
    if (window.matchMedia('(pointer: coarse)').matches) return;

    var targets = document.querySelectorAll('.btn-post, .auth-btn, .vm-btn, .hbtn-gold');
    targets.forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r  = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width  / 2)) * MagneticEngine.STRENGTH;
        var dy = (e.clientY - (r.top  + r.height / 2)) * MagneticEngine.STRENGTH;
        btn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      }, { passive: true });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      }, { passive: true });
    });
  }
};

/* ════════════════════════════════════════════════
   REVEAL ENGINE
   IntersectionObserver: fade-up cards and list items.
   ════════════════════════════════════════════════ */
var RevealEngine = {
  observer: null,

  init: function () {
    if (!window.IntersectionObserver) return;

    this.observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('sr-visible');
          RevealEngine.observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    /* Observe leaderboard rows and trend items in sidebars */
    document.querySelectorAll('.li, .trend-item').forEach(function (el, i) {
      el.classList.add('sr-init');
      el.style.setProperty('--sr-delay', (i * 55) + 'ms');
      RevealEngine.observer.observe(el);
    });
  }
};

/* ════════════════════════════════════════════════
   NAV ENGINE
   Bounce animation on mobile tab icons.
   ════════════════════════════════════════════════ */
var NavEngine = {
  init: function () {
    document.querySelectorAll('.mob-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var iconEl = tab.querySelector('svg') || tab.querySelector('.tab-icon-wrap');
        if (!iconEl) return;
        /* Re-trigger animation */
        iconEl.style.animation = 'none';
        void iconEl.offsetHeight; /* reflow */
        iconEl.style.animation = 'tabBounce 0.42s var(--ease-spring) forwards';
      }, { passive: true });
    });
  }
};

/* ════════════════════════════════════════════════
   COUNT-UP ENGINE
   Animates a numeric element from 'from' to 'to'.
   ════════════════════════════════════════════════ */
var CountUpEngine = {
  format: function (n, suffix) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M' + (suffix || '');
    if (n >= 1000)    return n.toLocaleString() + (suffix || '');
    return n.toFixed(0) + (suffix || '');
  },

  run: function (el, from, to, duration, suffix) {
    if (!el) return;
    duration = duration || 900;
    var start = performance.now();
    el.classList.add('num-in');

    function tick (now) {
      var elapsed  = now - start;
      var progress = Math.min(elapsed / duration, 1);
      /* Ease-out cubic */
      var eased    = 1 - Math.pow(1 - progress, 3);
      var current  = Math.round(from + (to - from) * eased);
      el.textContent = CountUpEngine.format(current, suffix);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
};

/* ════════════════════════════════════════════════
   CARD TILT ENGINE
   Subtle 3-D perspective tilt on hover (desktop).
   ════════════════════════════════════════════════ */
var CardTiltEngine = {
  MAX_ANGLE: 3.5,

  init: function () {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest('.card');
      document.querySelectorAll('.card.card-tilted').forEach(function (c) {
        if (c !== card) {
          c.style.transform = '';
          c.classList.remove('card-tilted');
        }
      });
      if (!card) return;

      var r   = card.getBoundingClientRect();
      var rx  =  ((e.clientY - r.top  - r.height / 2) / r.height) * CardTiltEngine.MAX_ANGLE;
      var ry  = -((e.clientX - r.left - r.width  / 2) / r.width)  * CardTiltEngine.MAX_ANGLE;
      card.style.transform = 'perspective(900px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) translateZ(4px)';
      card.classList.add('card-tilted');
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      document.querySelectorAll('.card.card-tilted').forEach(function (c) {
        c.style.transform = '';
        c.classList.remove('card-tilted');
      });
    }, { passive: true });
  }
};

/* ════════════════════════════════════════════════
   HEADER LOGO — re-apply iridescent animation after
   dynamic content changes (called by app.js if needed)
   ════════════════════════════════════════════════ */
function refreshLogoAnimation () {
  var logos = document.querySelectorAll('.logo, .auth-logo');
  logos.forEach(function (el) {
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
  });
}

/* ════════════════════════════════════════════════
   BOOT — initialise all engines on DOMContentLoaded
   ════════════════════════════════════════════════ */
function bootAnimations () {
  /* Intro first — before anything else renders */
  IntroEngine.run();

  /* Ripples — always on */
  RippleEngine.init();

  /* Magnetic & tilt — after a tick so DOM is settled */
  setTimeout(function () {
    MagneticEngine.init();
    CardTiltEngine.init();
  }, 400);

  /* Nav bounce — after panels are wired by app.js */
  setTimeout(function () {
    NavEngine.init();
    RevealEngine.init();
  }, 600);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAnimations);
} else {
  bootAnimations();
}

/* ════════════════════════════════════════════════
   GLOBAL EXPORT  (used by app.js showToast, etc.)
   ════════════════════════════════════════════════ */
window.SparkAnimations = {
  IntroEngine:    IntroEngine,
  CountUpEngine:  CountUpEngine,
  RevealEngine:   RevealEngine,
  refreshLogo:    refreshLogoAnimation
};
