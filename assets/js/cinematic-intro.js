/* ═══════════════════════════════════════════════════════════
   SPARK — cinematic-intro.js
   CinematicIntroEngine — brand film, ~6 seconds.

   Canvas logic extracted from new/spark-intro-12.html.
   Wrapped as an IIFE module compatible with animations.js.

   Shown when shouldShow() returns true (see below).
   All other sessions get the short SINGULARITY via IntroEngine.
   ═══════════════════════════════════════════════════════════ */
'use strict';

var CinematicIntroEngine = (function () {

  /* ── Storage keys ──────────────────────────────────────────
     KEY_EVER    localStorage  permanent "user has visited once"
     KEY_LAST    localStorage  ms timestamp of last page load
     KEY_SESSION sessionStorage shared with IntroEngine; either
                 intro sets it so the other one never reruns.
  ───────────────────────────────────────────────────────────── */
  var KEY_EVER    = 'spark_ever_visited';
  var KEY_LAST    = 'spark_last_visit';
  var KEY_SESSION = 'spark_intro_v2';

  var LONG_ABSENCE_MS = 30 * 24 * 60 * 60 * 1000; /* 30 days */

  /* ── Canvas / overlay refs ── */
  var _canvas  = null;
  var _ctx     = null;
  var _overlay = null;
  var _raf     = null;
  var _alive   = false;
  var _onDone  = null;

  var _W = 0, _H = 0, _CX = 0, _CY = 0, _PR = 1;
  var _isMobile = false;

  /* ── Per-run animation state (reset in run()) ── */
  var _dotGrid       = [];
  var _ripples       = [];
  var _rippleSpawned = false;
  var _orbitStart    = -1;
  var _t0            = null;

  /* ── Timings in seconds ── */
  var T = {
    LINE_IN_END   : 0.55,
    LINE_WAIT_END : 1.00,
    STAR_RISE_END : 1.55,
    STAR_MOVE_END : 2.80,
    HOLD_END      : 5.40,
    FADE_END      : 6.00
  };

  /* Orbit arc */
  var ARC_DUR   = 1.1;
  var ARC_HOLD  = 0.12;
  var ARC_FADE  = 0.45;
  var SPARK_DUR = 0.55;
  var SPARK_ANG = -Math.PI / 2 + Math.PI / 4;

  var LETTERS = ['S', 'P', 'A', 'R', 'K'];

  /* ── Utilities ── */
  function _clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function _prog(t, a, b)  { return _clamp((t - a) / (b - a), 0, 1); }
  function _lerp(a, b, t)  { return a + (b - a) * t; }
  function _eOut(t, p)     { return 1 - Math.pow(1 - t, p || 3); }
  function _eIn(t, p)      { return Math.pow(t, p || 3); }
  function _eInOut(t)      { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ── Canvas resize ── */
  function _resize() {
    if (!_canvas) return;
    _PR = Math.min(window.devicePixelRatio || 1, _isMobile ? 1.5 : 2);
    _W  = window.innerWidth;
    _H  = window.innerHeight;
    _canvas.width  = Math.round(_W * _PR);
    _canvas.height = Math.round(_H * _PR);
    _canvas.style.width  = _W + 'px';
    _canvas.style.height = _H + 'px';
    _ctx.setTransform(1, 0, 0, 1, 0, 0);
    _ctx.scale(_PR, _PR);
    _CX = _W / 2;
    _CY = _H / 2;
    _buildDotGrid();
  }

  /* ── Dot grid ── */
  function _buildDotGrid() {
    _dotGrid = [];
    var s    = Math.min(_W, _H);
    var step = s * 0.072;
    var cols = Math.ceil(_W / step) + 2;
    var rows = Math.ceil(_H / step) + 2;
    var offX = (_W - (cols - 1) * step) / 2;
    var offY = (_H - (rows - 1) * step) / 2;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        _dotGrid.push({ x: offX + c * step, y: offY + r * step });
      }
    }
  }

  function _drawDotGrid(now, gA) {
    if (_isMobile) return;
    var a = _eOut(_prog(now, 0, 0.6), 2) * gA * 0.09;
    if (a < 0.004) return;
    var r = Math.max(0.8, Math.min(_W, _H) * 0.0018);
    _ctx.save();
    _ctx.fillStyle = 'rgba(255,255,255,' + a + ')';
    for (var i = 0; i < _dotGrid.length; i++) {
      var d = _dotGrid[i];
      _ctx.beginPath();
      _ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      _ctx.fill();
    }
    _ctx.restore();
  }

  /* ── Ripple waves from disc birth ── */
  function _spawnRipples(x, y, r) {
    for (var i = 0; i < 3; i++) {
      _ripples.push({ x: x, y: y, born: 0, delay: i * 0.13,
        maxR: r * (3.5 + i * 2.2), baseR: r });
    }
  }

  function _drawRipples(now, gA) {
    if (!_ripples.length) return;
    _ctx.save();
    for (var i = _ripples.length - 1; i >= 0; i--) {
      var rp  = _ripples[i];
      if (!rp.born) rp.born = now;
      var age = now - rp.born - rp.delay;
      if (age < 0) continue;
      var t  = Math.min(age / 0.85, 1);
      var cr = _lerp(rp.baseR * 0.5, rp.maxR, _eOut(t, 2));
      var a  = (1 - _eIn(t, 2)) * 0.22 * gA;
      if (a < 0.005) { if (t >= 1) _ripples.splice(i, 1); continue; }
      _ctx.beginPath();
      _ctx.arc(rp.x, rp.y, cr, 0, Math.PI * 2);
      _ctx.strokeStyle = 'rgba(255,170,0,' + a + ')';
      _ctx.lineWidth   = Math.max(0.5, rp.baseR * 0.04 * (1 - t));
      if (!_isMobile) {
        _ctx.shadowColor = 'rgba(255,170,0,' + (a * 0.7) + ')';
        _ctx.shadowBlur  = rp.baseR * 0.5;
      }
      _ctx.stroke();
      _ctx.shadowBlur = 0;
      if (t >= 1) _ripples.splice(i, 1);
    }
    _ctx.restore();
  }

  /* ── Orbit arc + spark ── */
  function _drawOrbitArc(x, y, r, orbTime, gA) {
    if (orbTime < 0) return;
    var totalDur = ARC_DUR + ARC_HOLD + SPARK_DUR;
    if (orbTime >= totalDur) return;
    var lw       = Math.max(0.8, r * 0.04);
    var arcR     = r + lw * 0.5;
    var drawT    = Math.min(orbTime / ARC_DUR, 1);
    var fadeSt   = ARC_DUR + ARC_HOLD;
    var fadeT    = orbTime > fadeSt ? Math.min((orbTime - fadeSt) / ARC_FADE, 1) : 0;
    var arcAlpha = (1 - _eIn(fadeT, 2)) * gA;
    var sparkT   = orbTime > fadeSt ? Math.min((orbTime - fadeSt) / SPARK_DUR, 1) : 0;
    var spkA     = sparkT < 0.2 ? _eOut(sparkT / 0.2, 2) : _eIn(1 - (sparkT - 0.2) / 0.8, 1.6);
    var spkAlpha = spkA * gA;

    _ctx.save();

    if (arcAlpha > 0.005) {
      var startA = -Math.PI / 2;
      _ctx.beginPath();
      _ctx.arc(x, y, arcR, startA, startA + Math.PI * 2 * _eOut(drawT, 2), false);
      _ctx.strokeStyle = 'rgba(255,210,80,' + (arcAlpha * 0.75) + ')';
      _ctx.lineWidth   = lw;
      _ctx.lineCap     = 'round';
      if (!_isMobile) {
        _ctx.shadowColor = 'rgba(255,190,40,' + (arcAlpha * 0.9) + ')';
        _ctx.shadowBlur  = lw * 6;
      }
      _ctx.stroke();
      _ctx.shadowBlur = 0;
      if (drawT > 0.15) {
        var tailLen = Math.min(drawT, 0.35) * Math.PI * 2;
        _ctx.beginPath();
        _ctx.arc(x, y, arcR, startA, startA + tailLen * 0.4, false);
        _ctx.strokeStyle = 'rgba(255,210,80,' + (arcAlpha * 0.08) + ')';
        _ctx.lineWidth   = lw * 0.6;
        _ctx.stroke();
      }
    }

    if (spkAlpha > 0.005) {
      var sx = x + Math.cos(SPARK_ANG) * arcR;
      var sy = y + Math.sin(SPARK_ANG) * arcR;
      if (!_isMobile) {
        var outerG = _ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.1);
        outerG.addColorStop(0,   'rgba(255,255,200,' + (spkAlpha * 0.55) + ')');
        outerG.addColorStop(0.3, 'rgba(255,200,60,'  + (spkAlpha * 0.28) + ')');
        outerG.addColorStop(0.7, 'rgba(255,100,180,' + (spkAlpha * 0.08) + ')');
        outerG.addColorStop(1,   'rgba(0,0,0,0)');
        _ctx.fillStyle = outerG;
        _ctx.beginPath();
        _ctx.arc(sx, sy, r * 1.1, 0, Math.PI * 2);
        _ctx.fill();
      }
      var innerG = _ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.5);
      innerG.addColorStop(0,   'rgba(255,255,240,' + (spkAlpha * 0.95) + ')');
      innerG.addColorStop(0.4, 'rgba(255,220,80,'  + (spkAlpha * 0.65) + ')');
      innerG.addColorStop(1,   'rgba(255,150,50,0)');
      _ctx.fillStyle = innerG;
      _ctx.beginPath();
      _ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2);
      _ctx.fill();

      _ctx.beginPath();
      _ctx.arc(sx, sy, lw * 1.8, 0, Math.PI * 2);
      _ctx.fillStyle = 'rgba(255,255,255,' + spkAlpha + ')';
      if (!_isMobile) {
        _ctx.shadowColor = 'rgba(255,240,120,' + spkAlpha + ')';
        _ctx.shadowBlur  = lw * 14;
      }
      _ctx.fill();
      _ctx.shadowBlur = 0;

      var rayLen = r * 0.55 * spkAlpha;
      for (var ri = 0; ri < 4; ri++) {
        var ang  = (ri / 4) * Math.PI * 2;
        var rg   = _ctx.createLinearGradient(sx, sy,
          sx + Math.cos(ang) * rayLen, sy + Math.sin(ang) * rayLen);
        rg.addColorStop(0, 'rgba(255,255,200,' + (spkAlpha * 0.9) + ')');
        rg.addColorStop(1, 'rgba(255,200,60,0)');
        _ctx.beginPath();
        _ctx.moveTo(sx + Math.cos(ang) * lw * 2, sy + Math.sin(ang) * lw * 2);
        _ctx.lineTo(sx + Math.cos(ang) * rayLen,  sy + Math.sin(ang) * rayLen);
        _ctx.strokeStyle = rg;
        _ctx.lineWidth   = Math.max(0.6, lw * 0.5);
        _ctx.lineCap     = 'round';
        _ctx.stroke();
      }
    }
    _ctx.restore();
  }

  /* ── Corner viewfinder marks ── */
  function _drawCornerMarks(now, gA) {
    var t = _prog(now, T.STAR_MOVE_END, T.HOLD_END);
    if (t <= 0) return;
    var a   = _eOut(t, 3) * gA * 0.22;
    var s   = Math.min(_W, _H);
    var sm  = s * 0.04;
    var m   = s * 0.05;
    var lw  = Math.max(0.5, s * 0.001);
    var corners = [
      [m,      m,      1,  1],
      [_W - m, m,     -1,  1],
      [m,      _H - m, 1, -1],
      [_W - m, _H - m,-1, -1]
    ];
    _ctx.save();
    _ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
    _ctx.lineWidth   = lw;
    _ctx.lineCap     = 'square';
    for (var i = 0; i < corners.length; i++) {
      var co = corners[i];
      _ctx.beginPath();
      _ctx.moveTo(co[0] + co[2] * sm, co[1]);
      _ctx.lineTo(co[0],               co[1]);
      _ctx.lineTo(co[0],               co[1] + co[3] * sm);
      _ctx.stroke();
    }
    _ctx.restore();
  }

  /* ── Tagline ── */
  function _drawTagline(p, now, gA) {
    var t = _prog(now, T.STAR_MOVE_END + 0.15, T.HOLD_END);
    if (t <= 0) return;
    var a  = _eOut(t, 4) * gA * 0.52;
    var s  = Math.min(_W, _H);
    var fs = s * 0.018;
    var y  = p.lineY + p.lineThick * 6 + fs;
    _ctx.save();
    _ctx.font          = '300 ' + fs + 'px \'Helvetica Neue\',Helvetica,Arial,sans-serif';
    _ctx.textAlign     = 'center';
    _ctx.textBaseline  = 'middle';
    _ctx.letterSpacing = (fs * 0.38) + 'px';
    _ctx.fillStyle     = 'rgba(255,255,255,' + a + ')';
    _ctx.fillText('LIGHT UP THE FUTURE', _CX, y);
    var tw    = _ctx.measureText('LIGHT UP THE FUTURE').width + fs * 0.38 * 18;
    var dashW = Math.min(_W * 0.04, tw * 0.28);
    var dGap  = fs * 0.9;
    var lw2   = Math.max(0.3, fs * 0.04);
    _ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.55) + ')';
    _ctx.lineWidth   = lw2;
    _ctx.lineCap     = 'round';
    _ctx.beginPath();
    _ctx.moveTo(_CX - tw * 0.5 - dGap - dashW, y);
    _ctx.lineTo(_CX - tw * 0.5 - dGap, y);
    _ctx.stroke();
    _ctx.beginPath();
    _ctx.moveTo(_CX + tw * 0.5 + dGap, y);
    _ctx.lineTo(_CX + tw * 0.5 + dGap + dashW, y);
    _ctx.stroke();
    _ctx.restore();
  }

  /* ── Adaptive layout params (computed every frame) ── */
  function _params() {
    var s        = Math.min(_W, _H);
    var ball     = s * 0.072;
    var fontSize = s * 0.115;
    var wordW    = fontSize * 3.65;
    var gap      = ball * 0.6;
    var totalW   = ball * 2 + gap + wordW;
    var logoLeft = _CX - totalW / 2;
    var logoY    = _CY - s * 0.02;
    return {
      ball:       ball,
      fontSize:   fontSize,
      totalW:     totalW,
      ballFinalX: logoLeft + ball,
      ballY:      logoY,
      ballStartX: _CX,
      textX:      logoLeft + ball * 2 + gap,
      textY:      logoY,
      lineY:      logoY + ball * 1.38,
      lineLen:    totalW * 0.92,
      lineThick:  Math.max(1.5, s * 0.004),
      lineCX:     _CX
    };
  }

  /* ── Horizontal line with pointed ends ── */
  function _drawLine(cx, cy, halfLen, thick, alpha) {
    if (alpha < 0.002 || halfLen < 1) return;
    _ctx.save();
    var body = halfLen * 0.75, h = thick / 2;
    _ctx.beginPath();
    _ctx.moveTo(cx - halfLen, cy);
    _ctx.lineTo(cx - body,    cy - h);
    _ctx.lineTo(cx + body,    cy - h);
    _ctx.lineTo(cx + halfLen, cy);
    _ctx.lineTo(cx + body,    cy + h);
    _ctx.lineTo(cx - body,    cy + h);
    _ctx.closePath();
    var gr = _ctx.createLinearGradient(cx - halfLen, 0, cx + halfLen, 0);
    gr.addColorStop(0,    'rgba(120,30,255,0)');
    gr.addColorStop(0.15, 'rgba(120,30,255,' + alpha + ')');
    gr.addColorStop(0.48, 'rgba(255,170,0,'  + alpha + ')');
    gr.addColorStop(0.80, 'rgba(240,30,130,' + alpha + ')');
    gr.addColorStop(1,    'rgba(240,30,130,0)');
    if (!_isMobile) {
      _ctx.save();
      _ctx.filter    = 'blur(' + (thick * 2.5) + 'px)';
      _ctx.fillStyle = 'rgba(200,80,180,' + (alpha * 0.35) + ')';
      _ctx.beginPath();
      _ctx.ellipse(cx, cy + thick * 2.5, halfLen * 0.7, thick * 1.2, 0, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.filter = 'none';
      _ctx.restore();
      _ctx.shadowColor = 'rgba(255,140,0,' + (alpha * 0.85) + ')';
      _ctx.shadowBlur  = thick * 10;
    }
    _ctx.fillStyle = gr;
    _ctx.fill();
    _ctx.restore();
  }

  /* ── 2D gradient disc (badge-style) ── */
  function _drawBall(x, y, r, alpha) {
    if (alpha < 0.002) return;
    _ctx.save();
    _ctx.globalAlpha = alpha;
    if (!_isMobile) {
      var shG = _ctx.createRadialGradient(x + r * 0.28, y + r * 0.5, 0, x + r * 0.28, y + r * 0.5, r * 1.6);
      shG.addColorStop(0, 'rgba(80,0,80,0.55)'); shG.addColorStop(0.5, 'rgba(40,0,60,0.22)'); shG.addColorStop(1, 'rgba(0,0,0,0)');
      _ctx.fillStyle = shG;
      _ctx.beginPath();
      _ctx.ellipse(x + r * 0.28, y + r * 0.5, r * 1.25, r * 0.7, 0, 0, Math.PI * 2);
      _ctx.fill();
      var glowG = _ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2);
      glowG.addColorStop(0, 'rgba(255,170,0,0.42)'); glowG.addColorStop(0.4, 'rgba(240,30,140,0.20)');
      glowG.addColorStop(0.8, 'rgba(120,30,255,0.07)'); glowG.addColorStop(1, 'rgba(0,0,0,0)');
      _ctx.fillStyle = glowG;
      _ctx.beginPath();
      _ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      _ctx.fill();
    }
    var body = _ctx.createLinearGradient(x - r, y - r * 0.3, x + r, y + r * 0.3);
    body.addColorStop(0, 'rgba(255,215,30,1)'); body.addColorStop(0.38, 'rgba(255,100,0,1)');
    body.addColorStop(0.68, 'rgba(240,30,130,1)'); body.addColorStop(1, 'rgba(120,30,255,1)');
    if (!_isMobile) { _ctx.shadowColor = 'rgba(220,40,180,0.75)'; _ctx.shadowBlur = r * 1.4; }
    _ctx.fillStyle = body;
    _ctx.beginPath();
    _ctx.arc(x, y, r, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.shadowBlur = 0;
    var stroke = _ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    stroke.addColorStop(0, 'rgba(255,255,200,0.55)'); stroke.addColorStop(0.5, 'rgba(255,180,100,0.18)'); stroke.addColorStop(1, 'rgba(100,40,160,0.06)');
    _ctx.strokeStyle = stroke;
    _ctx.lineWidth   = Math.max(1, r * 0.055);
    _ctx.beginPath();
    _ctx.arc(x, y, r - _ctx.lineWidth * 0.5, 0, Math.PI * 2);
    _ctx.stroke();
    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(x, y, r, 0, Math.PI * 2);
    _ctx.clip();
    var crest = _ctx.createLinearGradient(x - r, y - r, x, y - r * 0.1);
    crest.addColorStop(0, 'rgba(255,255,255,0.22)'); crest.addColorStop(0.6, 'rgba(255,255,255,0.06)'); crest.addColorStop(1, 'rgba(255,255,255,0)');
    _ctx.fillStyle = crest;
    _ctx.fillRect(x - r, y - r, r * 2, r);
    _ctx.restore();
    _ctx.restore();
  }

  /* ── SPARK letters flow out of the disc ── */
  function _drawText(ballX, ballR, textX, textY, fontSize, moveP, alpha) {
    if (alpha < 0.002) return;
    _ctx.save();
    _ctx.font         = '900 ' + fontSize + 'px \'Arial Black\',\'Helvetica Neue\',Arial,sans-serif';
    _ctx.textAlign    = 'left';
    _ctx.textBaseline = 'middle';
    var letterW = fontSize * 0.73;
    LETTERS.forEach(function (ch, i) {
      var lx       = textX + i * letterW;
      var revealAt = i / LETTERS.length;
      var lp       = _clamp((moveP - revealAt) / (1.2 / LETTERS.length), 0, 1);
      var a        = _eOut(lp, 3) * alpha;
      if (a < 0.005) return;
      var curLX = _lerp(ballX + ballR + fontSize * 0.1, lx, _eOut(lp, 4));
      var offY  = _lerp(fontSize * 0.18, 0, _eOut(lp, 3));
      var gr    = _ctx.createLinearGradient(textX, 0, textX + LETTERS.length * letterW, 0);
      gr.addColorStop(0, 'rgba(255,200,20,' + a + ')'); gr.addColorStop(0.45, 'rgba(240,30,140,' + a + ')'); gr.addColorStop(1, 'rgba(120,30,255,' + a + ')');
      _ctx.save();
      _ctx.globalAlpha = a;
      if (!_isMobile) {
        _ctx.shadowColor = 'rgba(220,20,150,' + (a * 0.75) + ')';
        _ctx.shadowBlur  = fontSize * 0.28;
        _ctx.shadowOffsetX = fontSize * 0.018;
        _ctx.shadowOffsetY = fontSize * 0.025;
      }
      _ctx.fillStyle = gr;
      _ctx.fillText(ch, curLX, textY + offY);
      if (!_isMobile) {
        _ctx.shadowColor = 'rgba(255,170,0,' + (a * 0.45) + ')';
        _ctx.shadowBlur  = fontSize * 0.07;
        _ctx.shadowOffsetX = 0;
        _ctx.shadowOffsetY = 0;
        _ctx.fillText(ch, curLX, textY + offY);
        if (lp > 0.7) {
          var chrA  = (lp - 0.7) / 0.3 * a * 0.13;
          var shift = fontSize * 0.009;
          _ctx.shadowBlur = 0;
          _ctx.globalCompositeOperation = 'screen';
          _ctx.fillStyle = 'rgba(255,60,60,' + chrA + ')';
          _ctx.fillText(ch, curLX - shift, textY + offY);
          _ctx.fillStyle = 'rgba(60,80,255,' + chrA + ')';
          _ctx.fillText(ch, curLX + shift, textY + offY);
          _ctx.globalCompositeOperation = 'source-over';
        }
      }
      _ctx.restore();
    });
    _ctx.restore();
  }

  /* ── Main animation loop ── */
  function _frame(ts) {
    if (!_alive) return;
    if (!_t0) _t0 = ts;
    var now = (ts - _t0) / 1000;

    _ctx.fillStyle = '#08070c';
    _ctx.fillRect(0, 0, _W, _H);

    var p = _params();

    var gA = now >= T.HOLD_END
      ? 1 - _eIn(_prog(now, T.HOLD_END, T.FADE_END), 2)
      : 1;

    /* Line */
    var lineLen = 0, lineA = 0;
    if (now < T.LINE_IN_END) {
      lineLen = p.lineLen * _eOut(_prog(now, 0, T.LINE_IN_END), 4);
      lineA   = _eOut(_prog(now, 0, T.LINE_IN_END), 2);
    } else if (now < T.LINE_WAIT_END) {
      lineLen = p.lineLen * (1 + Math.sin(_prog(now, T.LINE_IN_END, T.LINE_WAIT_END) * Math.PI * 2.2) * 0.025);
      lineA   = 1;
    } else if (now < T.STAR_RISE_END) {
      lineLen = p.lineLen * _lerp(1, 0.88, _eIn(_prog(now, T.LINE_WAIT_END, T.STAR_RISE_END), 2));
      lineA   = 1;
    } else {
      lineLen = p.lineLen * 0.88;
      lineA   = 1;
    }

    /* Ball */
    var ballX = p.ballStartX, ballY = p.ballY, ballA = 0, moveP = 0;
    if (now >= T.LINE_WAIT_END && now < T.STAR_RISE_END) {
      var rt = _eOut(_prog(now, T.LINE_WAIT_END, T.STAR_RISE_END), 3);
      ballY  = _lerp(p.lineY, p.ballY, rt);
      ballA  = _eOut(_prog(now, T.LINE_WAIT_END, T.STAR_RISE_END), 2);
      if (!_rippleSpawned && ballA > 0.08) { _spawnRipples(ballX, ballY, p.ball); _rippleSpawned = true; }
    } else if (now >= T.STAR_RISE_END) {
      ballA  = 1;
      moveP  = _eInOut(_prog(now, T.STAR_RISE_END, T.STAR_MOVE_END));
      ballX  = _lerp(p.ballStartX, p.ballFinalX, moveP);
      if (moveP >= 1 && _orbitStart < 0) _orbitStart = now;
      if (now >= T.STAR_MOVE_END) {
        ballY = p.ballY + p.ball * Math.sin((now - T.STAR_MOVE_END) * Math.PI * 1.8) * 0.012;
      }
    }

    /* Render */
    _ctx.save();
    _ctx.globalAlpha = gA;

    _drawDotGrid(now, gA);

    if (ballA > 0.01 && !_isMobile) {
      var holdP = now >= T.STAR_MOVE_END
        ? 1 + Math.sin((now - T.STAR_MOVE_END) * Math.PI * 0.9) * 0.07 : 1;
      var ambR = p.totalW * 0.65;
      var amb  = _ctx.createRadialGradient(_CX, p.ballY + p.ball * 0.1, 0, _CX, p.ballY + p.ball * 0.1, ambR * holdP);
      amb.addColorStop(0,   'rgba(220,40,120,'  + (ballA * 0.16) + ')');
      amb.addColorStop(0.5, 'rgba(100,20,220,'  + (ballA * 0.09) + ')');
      amb.addColorStop(1,   'rgba(0,0,0,0)');
      _ctx.fillStyle = amb;
      _ctx.beginPath();
      _ctx.ellipse(_CX, p.ballY + p.ball * 0.2, ambR * holdP, ambR * 0.45 * holdP, 0, 0, Math.PI * 2);
      _ctx.fill();
    }

    _drawLine(p.lineCX, p.lineY, lineLen, p.lineThick, lineA);
    _drawRipples(now, gA);
    if (now >= T.STAR_RISE_END) _drawText(ballX, p.ball, p.textX, p.textY, p.fontSize, moveP, 1);
    if (ballA > 0.005)          _drawBall(ballX, ballY, p.ball, ballA);
    if (_orbitStart > 0)        _drawOrbitArc(ballX, ballY, p.ball, now - _orbitStart, gA);
    _drawTagline(p, now, gA);
    _drawCornerMarks(now, gA);

    _ctx.restore();

    if (now < T.FADE_END) {
      _raf = requestAnimationFrame(_frame);
    } else {
      _finish();
    }
  }

  /* ── Fade out overlay then hand off to the site ── */
  function _finish() {
    _alive = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    window.removeEventListener('resize', _onResize);
    if (_overlay) _overlay.classList.add('active');
    setTimeout(function () {
      var el = document.getElementById('cinematicIntro');
      if (el) el.classList.add('ci-hidden');
      document.body.classList.remove('intro-active');
      if (_onDone) _onDone();
    }, 600);
  }

  function _onResize() { if (_canvas) _resize(); }

  /* ═══════════════════════════════════════════════
     Public API
  ═══════════════════════════════════════════════ */
  return {

    /*
     * shouldShow() — two criteria (either → cinematic):
     *
     * 1. Absolute first visit  (localStorage 'spark_ever_visited' absent)
     *    The highest-impact moment: brand introduction before any commitment.
     *    A 6-second film creates emotional resonance that the 1.75s pulse can't.
     *
     * 2. Long absence  (last visit > 30 days ago per 'spark_last_visit')
     *    Re-engagement moment. The full brand story reminds a dormant user why
     *    SPARK is worth returning to.
     *
     * Guard: if KEY_SESSION already set (another intro ran this session), skip.
     */
    shouldShow: function () {
      try {
        if (sessionStorage.getItem(KEY_SESSION) === '1') return false;
        if (!localStorage.getItem(KEY_EVER)) return true;
        var last = parseInt(localStorage.getItem(KEY_LAST) || '0', 10);
        if (last > 0 && (Date.now() - last) > LONG_ABSENCE_MS) return true;
        if (last > 0 && new Date(last).toDateString() !== new Date().toDateString()) return true;
        return false;
      } catch (e) { return false; }
    },

    /*
     * markVisit() — call once per bootAnimations() boot regardless of which
     * intro runs. Keeps KEY_LAST current so the long-absence window is accurate.
     */
    markVisit: function () {
      try {
        localStorage.setItem(KEY_EVER, '1');
        localStorage.setItem(KEY_LAST, String(Date.now()));
      } catch (e) {}
    },

    run: function (onDone) {
      var el = document.getElementById('cinematicIntro');
      if (!el) return;

      _canvas  = document.getElementById('ciCanvas');
      _overlay = document.getElementById('ciFadeOverlay');
      if (!_canvas) return;
      _ctx  = _canvas.getContext('2d');
      if (!_ctx) return;

      _onDone   = onDone || null;
      _isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

      /* Set session flag immediately — prevents double-play on fast tab refresh */
      try { sessionStorage.setItem(KEY_SESSION, '1'); } catch (e) {}

      document.body.classList.add('intro-active');

      /* Reset per-run state */
      _alive         = true;
      _t0            = null;
      _ripples       = [];
      _rippleSpawned = false;
      _orbitStart    = -1;

      _resize();
      window.addEventListener('resize', _onResize);
      _raf = requestAnimationFrame(_frame);
    },

    stop: function () {
      _alive = false;
      if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
      window.removeEventListener('resize', _onResize);
      var el = document.getElementById('cinematicIntro');
      if (el) el.classList.add('ci-hidden');
      document.body.classList.remove('intro-active');
    }
  };
})();
