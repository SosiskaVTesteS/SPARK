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
  canvas: null,
  ctx: null,
  particles: [],
  animationFrameId: null,
  phase: 'vortex', // 'vortex' | 'shockwave' | 'float'
  shockwaveTime: 820,
  exitTime: 2700,
  logoCenter: { x: 0, y: 0 },
  flashAlpha: 0,
  colors: ['rgba(155, 95, 255, ', 'rgba(232, 90, 160, ', 'rgba(232, 197, 90, ', 'rgba(90, 232, 197, ', 'rgba(123, 92, 250, '],

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

    document.body.classList.add('intro-active');
    this.markShown();

    this.initCanvas();

    /* Trigger shockwave at 820ms */
    setTimeout(function () {
      IntroEngine.triggerShockwave();
    }, this.shockwaveTime);

    /* Begin exit at 2700ms */
    setTimeout(function () {
      intro.classList.add('si-exiting');
      setTimeout(function () {
        intro.classList.add('si-hidden');
        document.body.classList.remove('intro-active');
        IntroEngine.stop();
      }, 900);
    }, this.exitTime);
  },

  initCanvas: function () {
    this.canvas = document.getElementById('siCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    this.particles = [];
    this.phase = 'vortex';
    this.flashAlpha = 0;
    
    // Spawn initial vortex particles
    var count = 180;
    for (var i = 0; i < count; i++) {
      this.particles.push(this.createVortexParticle(i, count));
    }

    this.tick();
  },

  handleResize: function () {
    if (IntroEngine.canvas) {
      IntroEngine.resizeCanvas();
    }
  },

  resizeCanvas: function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.logoCenter = { x: rect.width / 2, y: rect.height / 2 - 19 }; // Adjusted for logo offset (-19px)
  },

  createVortexParticle: function (idx, total) {
    var angle = (idx / total) * Math.PI * 2 * 6; // Spiral layout
    var maxRadius = Math.max(window.innerWidth, window.innerHeight) * 0.35;
    var radius = 25 + Math.random() * maxRadius;
    var speed = 0.025 + (1.2 - radius / maxRadius) * 0.04;
    var size = 0.8 + Math.random() * 2.2;
    var color = this.colors[idx % this.colors.length];
    
    return {
      type: 'vortex',
      angle: angle,
      radius: radius,
      speed: speed,
      size: size,
      color: color,
      alpha: 0,
      targetAlpha: 0.35 + Math.random() * 0.55,
      x: 0,
      y: 0
    };
  },

  triggerShockwave: function () {
    this.phase = 'shockwave';
    
    // Convert existing particles to shockwave particles, plus spawn a massive burst!
    var oldParticles = this.particles;
    this.particles = [];

    // Spark shockwave blast
    var blastCount = 200;
    for (var i = 0; i < blastCount; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 3.5 + Math.random() * 11; // Explosive speed
      var size = 0.9 + Math.random() * 2.4;
      var color = this.colors[Math.floor(Math.random() * this.colors.length)];
      var life = 0.7 + Math.random() * 0.8;
      
      this.particles.push({
        type: 'shockwave',
        x: this.logoCenter.x,
        y: this.logoCenter.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: size,
        color: color,
        alpha: 1,
        life: life,
        maxLife: life,
        friction: 0.965,
        gravity: 0.05
      });
    }

    // Add visual flash screen overlay or let canvas render a quick white lens flare!
    this.flashAlpha = 0.85;
  },

  stop: function () {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.handleResize);
    this.particles = [];
  },

  tick: function () {
    var self = IntroEngine;
    if (!self.canvas || !self.ctx) return;
    self.animationFrameId = requestAnimationFrame(self.tick);
    self.update();
    self.draw();
  },

  update: function () {
    var self = this;
    var center = self.logoCenter;
    
    if (self.flashAlpha > 0) {
      self.flashAlpha -= 0.05;
    }

    for (var i = self.particles.length - 1; i >= 0; i--) {
      var p = self.particles[i];

      if (self.phase === 'vortex' && p.type === 'vortex') {
        p.angle += p.speed;
        p.radius -= 1.8; // spiral inward
        if (p.radius < 5) p.radius = 5;
        p.alpha += (p.targetAlpha - p.alpha) * 0.08;
        
        p.x = center.x + Math.cos(p.angle) * p.radius;
        p.y = center.y + Math.sin(p.angle) * p.radius;
      } 
      else if (p.type === 'shockwave') {
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity; // fall down slightly
        p.x += p.vx;
        p.y += p.vy;
        
        p.life -= 0.016;
        p.alpha = Math.max(0, p.life / p.maxLife);
        
        if (p.life <= 0) {
          self.particles.splice(i, 1);
        }
      }
    }

    // Phase transitions or continuous floating sparks
    if (self.phase === 'shockwave' && self.particles.length < 80) {
      // Transition slowly to floating ambient sparks
      self.phase = 'float';
    }

    if (self.phase === 'float' && self.particles.length < 120) {
      // Spawn subtle floating upward sparks
      var x = Math.random() * window.innerWidth;
      var speedY = -(0.5 + Math.random() * 1.5);
      var speedX = (Math.random() - 0.5) * 0.6;
      var size = 0.8 + Math.random() * 1.8;
      var color = self.colors[Math.floor(Math.random() * self.colors.length)];
      var life = 1.0 + Math.random() * 1.5;
      
      self.particles.push({
        type: 'float',
        x: x,
        y: window.innerHeight + 10,
        vx: speedX,
        vy: speedY,
        size: size,
        color: color,
        alpha: 0,
        life: life,
        maxLife: life
      });
    }

    if (self.phase === 'float') {
      for (var i = self.particles.length - 1; i >= 0; i--) {
        var p = self.particles[i];
        if (p.type === 'float') {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.012;
          
          if (p.alpha < 0.6 && p.life > 0.4) {
            p.alpha += 0.04;
          } else {
            p.alpha = Math.max(0, p.life / p.maxLife * 0.6);
          }

          if (p.life <= 0 || p.y < -10) {
            self.particles.splice(i, 1);
          }
        }
      }
    }
  },

  draw: function () {
    var self = this;
    var ctx = self.ctx;
    var canvas = self.canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw particles
    for (var i = 0; i < self.particles.length; i++) {
      var p = self.particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha.toFixed(3) + ')';
      
      // Add subtle glow shadow to highlight larger sparks
      if (p.size > 1.8) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color + '0.5)';
      } else {
        ctx.shadowBlur = 0;
      }
      
      ctx.fill();
    }
    ctx.shadowBlur = 0; // reset shadow

    // Draw supernova flash flare
    if (self.flashAlpha > 0) {
      var grad = ctx.createRadialGradient(self.logoCenter.x, self.logoCenter.y, 0, self.logoCenter.x, self.logoCenter.y, 220);
      grad.addColorStop(0, 'rgba(255,255,255,' + self.flashAlpha + ')');
      grad.addColorStop(0.12, 'rgba(155,95,255,' + (self.flashAlpha * 0.5) + ')');
      grad.addColorStop(0.35, 'rgba(232,90,160,' + (self.flashAlpha * 0.2) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.beginPath();
      ctx.arc(self.logoCenter.x, self.logoCenter.y, 220, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
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
  /* Intro first — before anything else renders */
  IntroEngine.run();

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

