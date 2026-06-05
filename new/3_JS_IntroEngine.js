/*
  ══════════════════════════════════════════════════════════════
  SPARK PRELOADER v2 — JS PATCH
  В файле assets/js/animations.js найди блок:
    "var IntroEngine = { ... };"
  и замени его целиком на этот код.
  ══════════════════════════════════════════════════════════════
*/

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
