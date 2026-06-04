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
/* ════════════════════════════════════════════════
   IntroEngine v2 — "SINGULARITY"

   Canvas draws:
   • 12 precision burst rays from logo center
   • 3 expanding pulse rings (purple → pink → gold)
   No random particles. Pure controlled geometry.

   Shows once per session (sessionStorage flag).
   STORAGE_KEY bumped to v2 → existing users see
   the new preloader on their next session.
════════════════════════════════════════════════ */
var IntroEngine = (function () {
  'use strict';

  var _canvas = null;
  var _ctx    = null;
  var _raf    = null;
  var _t0     = null;
  var _W = 0, _H = 0, _cx = 0, _cy = 0;

  /* Brand color palette [R, G, B] */
  var PALETTE = [
    [155,  95, 255],   /* purple  */
    [232,  90, 160],   /* pink    */
    [232, 197,  90],   /* gold    */
    [ 90, 232, 197],   /* teal    */
    [123,  92, 250],   /* violet  */
  ];

  /* ── Resize canvas to full viewport ── */
  function _resize() {
    if (!_canvas) return;
    var dpr = window.devicePixelRatio || 1;
    _W = window.innerWidth;
    _H = window.innerHeight;
    _canvas.width  = _W * dpr;
    _canvas.height = _H * dpr;
    _canvas.style.width  = _W + 'px';
    _canvas.style.height = _H + 'px';
    _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* Use actual logo DOM position for precise centering */
    var wrap = document.querySelector('.si-logo-wrap');
    if (wrap) {
      var r = wrap.getBoundingClientRect();
      _cx = r.left + r.width  / 2;
      _cy = r.top  + r.height / 2;
    } else {
      _cx = _W / 2;
      _cy = _H / 2 - 50;
    }
  }

  /* ── Animation tick ── */
  function _tick() {
    if (!_canvas) return;
    var t = performance.now() - _t0;
    if (t >= 1100) {
      _ctx.clearRect(0, 0, _W + 2, _H + 2);
      return;
    }
    _raf = requestAnimationFrame(_tick);
    _draw(t);
  }

  /* ── Main draw: rays + rings ── */
  function _draw(t) {
    _ctx.clearRect(0, 0, _W + 2, _H + 2);

    /* Burst rays: 0 → 620ms */
    if (t < 620) _rays(t / 620);

    /* Pulse rings: staggered start times */
    _ring(t,  55, 660, PALETTE[0], 0.52, 0.41); /* purple */
    _ring(t, 240, 660, PALETTE[1], 0.30, 0.46); /* pink   */
    _ring(t, 440, 580, PALETTE[2], 0.16, 0.52); /* gold   */
  }

  /* ── 12 burst rays from logo center ── */
  function _rays(p) {
    var N    = 12;
    var maxL = Math.min(_W, _H) * 0.36;

    for (var i = 0; i < N; i++) {
      var angle = (i / N) * Math.PI * 2 + 0.262; /* slight rotation offset */
      var lag   = (i % 2 === 0) ? 0.27 : 0.33;
      var ext   = Math.min(p / lag, 1);

      /* Alpha: ramp-up → plateau → ramp-down */
      var pk = (i % 2 === 0) ? 0.66 : 0.44;
      var a;
      if      (p < 0.18) a = (p / 0.18) * pk;
      else if (p < 0.40) a = pk;
      else               a = (1 - (p - 0.40) / 0.60) * pk;
      if (a < 0.006) continue;

      var len = maxL * ext;
      var col = PALETTE[i % PALETTE.length];
      var ex  = _cx + Math.cos(angle) * len;
      var ey  = _cy + Math.sin(angle) * len;
      var cc  = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',';

      var g = _ctx.createLinearGradient(_cx, _cy, ex, ey);
      g.addColorStop(0,    cc + (a * 1.10).toFixed(3) + ')');
      g.addColorStop(0.10, cc + (a * 0.88).toFixed(3) + ')');
      g.addColorStop(0.42, cc + (a * 0.40).toFixed(3) + ')');
      g.addColorStop(1,    cc + '0)');

      _ctx.save();
      _ctx.beginPath();
      _ctx.moveTo(_cx, _cy);
      _ctx.lineTo(ex, ey);
      _ctx.strokeStyle = g;
      _ctx.lineWidth   = i % 3 === 0 ? 1.9 : (i % 3 === 1 ? 1.2 : 0.75);
      _ctx.lineCap     = 'round';
      _ctx.stroke();
      _ctx.restore();
    }
  }

  /* ── Expanding pulse ring ── */
  function _ring(t, start, duration, col, maxAlpha, radiusFraction) {
    if (t < start || t > start + duration) return;
    var p     = Math.min((t - start) / duration, 1);
    var eased = 1 - Math.pow(1 - p, 2.7);
    var r     = Math.min(_W, _H) * radiusFraction * eased;
    var alpha = maxAlpha * (1 - p);
    var lw    = Math.max(0.3, 2.2 * (1 - p * 0.76));
    var c     = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + alpha.toFixed(3) + ')';

    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(_cx, _cy, r, 0, Math.PI * 2);
    _ctx.strokeStyle = c;
    _ctx.lineWidth   = lw;
    _ctx.stroke();
    _ctx.restore();
  }

  function _onResize() { if (_canvas) _resize(); }

  function _teardown() {
    if (_raf) cancelAnimationFrame(_raf);
    window.removeEventListener('resize', _onResize);
    _canvas = null;
    _ctx    = null;
  }

  /* ── Public API ── */
  return {
    STORAGE_KEY: 'spark_intro_v2',

    alreadyShown: function () {
      try { return sessionStorage.getItem(this.STORAGE_KEY) === '1'; }
      catch (e) { return false; }
    },

    markShown: function () {
      try { sessionStorage.setItem(this.STORAGE_KEY, '1'); }
      catch (e) {}
    },

    run: function () {
      var intro = document.getElementById('sparkIntro');
      if (!intro) return;

      if (this.alreadyShown()) {
        intro.classList.add('si-hidden');
        return;
      }

      document.body.classList.add('intro-active');
      this.markShown();

      _canvas = document.getElementById('siCanvas');
      if (!_canvas) return;
      _ctx = _canvas.getContext('2d');
      _resize();
      window.addEventListener('resize', _onResize);
      _t0 = performance.now();
      _tick();

      var self = this;
      setTimeout(function () {
        intro.classList.add('si-exiting');
        setTimeout(function () {
          intro.classList.add('si-hidden');
          document.body.classList.remove('intro-active');
          _teardown();
        }, 530);
      }, 1250);
    },

    stop: function () { _teardown(); }
  };
})();

/* ════════════════════════════════════════════════
   RIPPLE ENGINE
   Adds material-style ripple on all interactive els.
   ════════════════════════════════════════════════ */
var RippleEngine = {
  SELECTOR: 'button, .binv, .bcontact, .auth-btn, .btn-post, .fbtn, .tchip, .rbbl, .mob-tab, .dur-btn, .pbtn, .prs-btn, .hbtn, .vm-btn, .spark-btn-submit, .spark-btn-danger',

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

      /* overflow: hidden is now handled in CSS */

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
   V3 — STAR FIELD ENGINE
   Generates 80 twinkling micro-dots in #sparkBg
   ════════════════════════════════════════════════ */
var StarFieldEngine = {
  COUNT: (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) ? 25 : 80,

  init: function () {
    var container = document.getElementById('sparkBg');
    if (!container) return;

    /* Use DocumentFragment for one-shot DOM write */
    var frag = document.createDocumentFragment();
    var colors = ['#fff', '#C4B5FD', '#A5F3FC', '#FDE68A', '#FDA4AF', '#BBFBD4'];

    for (var i = 0; i < this.COUNT; i++) {
      var dot  = document.createElement('span');
      dot.className = 'star-dot';
      var size  = (0.8 + Math.random() * 1.8).toFixed(2);
      var left  = (Math.random() * 100).toFixed(2);
      var top   = (Math.random() * 100).toFixed(2);
      var dur   = (2.2 + Math.random() * 4).toFixed(2);
      var del   = (Math.random() * 6).toFixed(2);
      var minOp = (0.08 + Math.random() * 0.1).toFixed(2);
      var maxOp = (0.35 + Math.random() * 0.45).toFixed(2);
      var color = colors[Math.floor(Math.random() * colors.length)];

      dot.style.cssText = [
        'width:'       + size + 'px',
        'height:'      + size + 'px',
        'left:'        + left + '%',
        'top:'         + top  + '%',
        'background:'  + color,
        '--star-dur:'  + dur  + 's',
        '--star-del:'  + del  + 's',
        '--star-min:'  + minOp,
        '--star-max:'  + maxOp
      ].join(';');

      frag.appendChild(dot);
    }
    container.appendChild(frag);
  }
};

/* ════════════════════════════════════════════════
   V3 — AURORA ENGINE
   Tracks mouse inside each .card, updates --mx/--my
   so the card::after radial-gradient follows the cursor
   ════════════════════════════════════════════════ */
var AuroraEngine = {
  init: function () {
    /* Skip on coarse-pointer (touch) devices — CSS already hides the ::after */
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest('.card');
      if (!card) return;
      var r  = card.getBoundingClientRect();
      var mx = ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%';
      var my = ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%';
      card.style.setProperty('--mx', mx);
      card.style.setProperty('--my', my);
    }, { passive: true });
  }
};

/* ════════════════════════════════════════════════
   V3 — MOBILE HEADER ENGINE
   Hides header on scroll-down, reveals on scroll-up
   ════════════════════════════════════════════════ */
var MobileHeaderEngine = {
  _lastY:   0,
  _ticking: false,

  init: function () {
    /* Only on narrow screens */
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    var hdr = document.querySelector('header');
    if (!hdr) return;

    window.addEventListener('scroll', function () {
      if (MobileHeaderEngine._ticking) return;
      MobileHeaderEngine._ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y > MobileHeaderEngine._lastY + 8 && y > 60) {
          hdr.classList.add('hdr-hidden');
        } else if (y < MobileHeaderEngine._lastY - 5 || y < 40) {
          hdr.classList.remove('hdr-hidden');
        }
        MobileHeaderEngine._lastY = y;
        MobileHeaderEngine._ticking = false;
      });
    }, { passive: true });
  }
};

/* ════════════════════════════════════════════════
   V3 — NUMBER GLOW ENGINE
   Flashes gold text-shadow on SPK balance when it changes
   ════════════════════════════════════════════════ */
var NumberGlowEngine = {
  pulse: function (el) {
    if (!el) return;
    el.classList.remove('spk-glow');
    void el.offsetHeight; /* force reflow to restart animation */
    el.classList.add('spk-glow');
    setTimeout(function () { el.classList.remove('spk-glow'); }, 1200);
  },

  /* Observe SPK balance element and pulse on text change */
  observe: function (elId) {
    var el = document.getElementById(elId);
    if (!el || !window.MutationObserver) return;
    var prev = el.textContent;
    var obs  = new MutationObserver(function () {
      if (el.textContent !== prev) {
        prev = el.textContent;
        NumberGlowEngine.pulse(el);
      }
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }
};

/* ════════════════════════════════════════════════
   HEADER LOGO ANIMATION REFRESH
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
  /* ── Two-level intro selection ──────────────────────────────
     1. CinematicIntroEngine (~6s)
        — absolute first visit (localStorage 'spark_ever_visited' absent)
        — long absence (last visit > 30 days)
     2. IntroEngine / SINGULARITY (~1.75s)
        — all other new sessions (sessionStorage 'spark_intro_v2' absent)
     3. Nothing — same session, intro already shown
     markVisit() is always called to keep the last-visit timestamp fresh.
  ─────────────────────────────────────────────────────────── */
  if (typeof CinematicIntroEngine !== 'undefined') {
    CinematicIntroEngine.markVisit();
    if (CinematicIntroEngine.shouldShow()) {
      var shortIntro = document.getElementById('sparkIntro');
      if (shortIntro) shortIntro.classList.add('si-hidden');
      CinematicIntroEngine.run();
    } else {
      IntroEngine.run();
    }
  } else {
    IntroEngine.run();
  }

  /* Ripples — always on */
  RippleEngine.init();

  /* Star field — V3 background effect */
  StarFieldEngine.init();

  /* Aurora — cursor-tracked glow inside cards (desktop) */
  AuroraEngine.init();

  /* Mobile header scroll-hide */
  MobileHeaderEngine.init();

  /* Magnetic & 3D tilt — after a tick so DOM is settled */
  setTimeout(function () {
    MagneticEngine.init();
    CardTiltEngine.init();
  }, 400);

  /* Nav bounce, scroll-reveal, and number glow */
  setTimeout(function () {
    NavEngine.init();
    RevealEngine.init();
    NumberGlowEngine.observe('hdrSpk');
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
  IntroEngine:       IntroEngine,
  CountUpEngine:     CountUpEngine,
  RevealEngine:      RevealEngine,
  StarFieldEngine:   StarFieldEngine,
  AuroraEngine:      AuroraEngine,
  NumberGlowEngine:  NumberGlowEngine,
  MobileHeaderEngine: MobileHeaderEngine,
  refreshLogo:       refreshLogoAnimation
};

