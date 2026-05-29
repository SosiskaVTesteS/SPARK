/* ═══════════════════════════════════════════════════════════════════════
   SPARK — onboarding.js   v3  "Galactic Edition"
   ─────────────────────────────────────────────────────────────────────
   PHASE 1  Pre-registration  Welcome Slider (Glassmorphism cards)
            • Language switcher RU / EN on slide 1
            • 4 cinematic slides  with  inline SVG visuals
            • Swipe + keyboard + dot navigation
            • Ends by triggering the Register tab

   PHASE 2  Post-registration  SpotlightTour v3
            • Spotlight engine: 4-panel clipping technique — the target
              element is NEVER covered. It sits above the overlay via a
              temporary z-index lift (original styles are fully restored
              afterwards, no layout shifts).
            • Pulsing neon ring animates around the target.
            • Glassmorphism tooltip: desktop = smart-positioned card,
              mobile = bottom-sheet with swipe-to-dismiss.
            • 11 steps, all tied to real SPARK selectors.
            • Shepherd.js NOT required — zero external dependencies.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Persistent keys ─────────────────────────────────────────────────── */
var _OB_KEY   = 'spark_ob3_seen';
var _TOUR_KEY = 'spark_tour3_seen';
var _LANG_KEY = 'spark_lang';

/* ─── Shared utilities ────────────────────────────────────────────────── */
function _getLang()  { try { return localStorage.getItem(_LANG_KEY) || 'ru'; } catch(e){ return 'ru'; } }
function _setLang(l) { try { localStorage.setItem(_LANG_KEY, l); if (window.LANG !== undefined) window.LANG = l; } catch(e){} }
function _isMob()    { return window.innerWidth < 768; }


/* ════════════════════════════════════════════════════════════════════════
   ██████╗ ██╗  ██╗ █████╗ ███████╗███████╗     1
   ██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝     PRE-REGISTRATION
   ██████╔╝███████║███████║███████╗█████╗       WELCOME SLIDER
   ██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝
   ██║     ██║  ██║██║  ██║███████║███████╗
   ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝
   ════════════════════════════════════════════════════════════════════════ */
var SparkOnboarding = (function () {

  /* ── bilingual copy ── */
  var C = {
    en: {
      slides: [
        {
          icon:'⚡', tag:'Welcome to SPARK',
          title:'Where Ideas\nBecome Investments',
          body:'SPARK is the live marketplace where startup concepts meet early backers. Every SPK token you invest earns returns — and a place in the Prophet Leaderboard.',
          vis:'hero'
        },
        {
          icon:'💡', tag:'Live Idea Feed',
          title:'Find the Next\nBig Thing First',
          body:'Real-time cards filtered by sector — AI, DeFi, CleanEnergy, Hardware, Web3. Sort by New · Popular · Profitable · Ending Soon. Every card carries a live investment growth chart.',
          vis:'feed'
        },
        {
          icon:'🚀', tag:'Invest & Earn',
          title:'Back Ideas You\nActually Believe In',
          body:'Slide to your amount, hold the button 2 seconds to confirm. 2-sec hold-guard prevents accidents. Each investment builds your track record — visible to every Prophet on the board.',
          vis:'invest'
        },
        {
          icon:'🌟', tag:'Join for Free',
          title:'Light Up\nThe Future',
          body:'Sign up in seconds and pocket 4,520 SPK on day one. Log in daily for a compounding bonus. Your ideas. Your portfolio. Your legend.',
          vis:'cta', cta:true
        }
      ],
      skip:'Skip', next:'Continue →', back:'← Back',
      ctaBtn:'Create Free Account →', ctaSub:'Free forever · No card needed',
      bonus:'🎁 4,520 SPK on signup'
    },
    ru: {
      slides: [
        {
          icon:'⚡', tag:'Добро пожаловать в SPARK',
          title:'Где идеи\nстановятся инвестициями',
          body:'SPARK — живая биржа, где стартап-концепции встречают ранних инвесторов. Каждый вложенный SPK-токен приносит доход — и место в Топе Пророков.',
          vis:'hero'
        },
        {
          icon:'💡', tag:'Живая лента',
          title:'Находите следующий\nбольшой хит первыми',
          body:'Карточки в реальном времени по секторам — AI, DeFi, CleanEnergy, Hardware, Web3. Сортировка: Новые · Популярные · Прибыльные · Скоро заканчиваются. На каждой карточке — живой график роста.',
          vis:'feed'
        },
        {
          icon:'🚀', tag:'Инвестируй и зарабатывай',
          title:'Поддерживайте то,\nв чём уверены',
          body:'Выберите сумму слайдером и удержите кнопку 2 секунды для подтверждения. Защита от случайных нажатий. Каждое вложение строит ваш публичный рейтинг среди Пророков.',
          vis:'invest'
        },
        {
          icon:'🌟', tag:'Вступай бесплатно',
          title:'Зажги\nбудущее',
          body:'Регистрация за несколько секунд — и сразу 4 520 SPK на счёт. Ежедневный бонус накапливается при каждом входе. Ваши идеи. Ваш портфель. Ваша легенда.',
          vis:'cta', cta:true
        }
      ],
      skip:'Пропустить', next:'Далее →', back:'← Назад',
      ctaBtn:'Создать аккаунт бесплатно →', ctaSub:'Бесплатно навсегда · Без карты',
      bonus:'🎁 4 520 SPK при регистрации'
    }
  };

  /* ── Inline SVGs ── */
  var SVG = {
    hero: `<svg viewBox="0 0 300 175" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hg" x1="0" y1="0" x2="300" y2="175" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9B5FFF"/><stop offset=".48" stop-color="#E85AA0"/><stop offset="1" stop-color="#E8C55A"/>
    </linearGradient>
    <radialGradient id="hr" cx="50%" cy="50%" r="50%">
      <stop stop-color="#9B5FFF" stop-opacity=".28"/><stop offset="1" stop-color="#9B5FFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="hglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="150" cy="87" rx="110" ry="80" fill="url(#hr)"/>
  <circle cx="150" cy="87" r="52" stroke="url(#hg)" stroke-width=".8" opacity=".45"/>
  <circle cx="150" cy="87" r="73" stroke="url(#hg)" stroke-width=".35" stroke-dasharray="4 9" opacity=".22"/>
  <path d="M120 54C161 54 168 72 150 82S130 104 167 104" stroke="url(#hg)" stroke-width="8" stroke-linecap="round" filter="url(#hglow)"/>
  <circle cx="120" cy="54" r="6" fill="#9B5FFF"/>
  <circle cx="167" cy="104" r="6" fill="#E8C55A"/>
  <circle cx="74" cy="32" r="2.5" fill="#E8C55A" opacity=".5"/>
  <circle cx="226" cy="142" r="2" fill="#9B5FFF" opacity=".5"/>
  <circle cx="240" cy="48" r="3" fill="#E85AA0" opacity=".4"/>
  <circle cx="58" cy="122" r="2" fill="#5AE8C5" opacity=".4"/>
  <text x="150" y="160" text-anchor="middle" fill="rgba(255,255,255,.5)" font-family="sans-serif" font-size="10" font-weight="700" letter-spacing="6">SPARK</text>
</svg>`,

    feed: `<svg viewBox="0 0 300 175" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fa" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E8C55A"/><stop offset="1" stop-color="#E87A5A"/></linearGradient>
    <linearGradient id="fb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#5AE8C5"/><stop offset="1" stop-color="#5A90E8"/></linearGradient>
    <linearGradient id="fc" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#E85A7A"/><stop offset="1" stop-color="#C55AE8"/></linearGradient>
  </defs>
  <!-- filter bar -->
  <rect x="8" y="5" width="284" height="18" rx="5" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.06)"/>
  <rect x="12" y="10" width="55" height="6" rx="3" fill="rgba(255,255,255,.14)"/>
  <rect x="72" y="10" width="42" height="6" rx="3" fill="rgba(123,92,250,.6)"/>
  <rect x="118" y="10" width="42" height="6" rx="3" fill="rgba(255,255,255,.07)"/>
  <!-- cards row 1 -->
  <rect x="8" y="30" width="138" height="65" rx="10" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)"/>
  <rect x="8" y="30" width="138" height="8" rx="4" fill="url(#fa)" opacity=".9"/>
  <rect x="16" y="46" width="65" height="4" rx="2" fill="rgba(255,255,255,.38)"/>
  <rect x="16" y="55" width="105" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="16" y="63" width="85" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="16" y="74" width="44" height="8" rx="4" fill="url(#fa)" opacity=".9"/>
  <rect x="154" y="30" width="138" height="65" rx="10" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)"/>
  <rect x="154" y="30" width="138" height="8" rx="4" fill="url(#fb)" opacity=".9"/>
  <rect x="162" y="46" width="72" height="4" rx="2" fill="rgba(255,255,255,.38)"/>
  <rect x="162" y="55" width="110" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="162" y="63" width="90" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="162" y="74" width="44" height="8" rx="4" fill="url(#fb)" opacity=".9"/>
  <!-- cards row 2 -->
  <rect x="8" y="104" width="138" height="60" rx="10" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)"/>
  <rect x="8" y="104" width="138" height="8" rx="4" fill="url(#fc)" opacity=".9"/>
  <rect x="16" y="120" width="58" height="4" rx="2" fill="rgba(255,255,255,.38)"/>
  <rect x="16" y="129" width="98" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="16" y="143" width="44" height="8" rx="4" fill="url(#fc)" opacity=".9"/>
  <rect x="154" y="104" width="138" height="60" rx="10" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)"/>
  <rect x="154" y="104" width="138" height="8" rx="4" fill="url(#fa)" opacity=".6"/>
  <rect x="162" y="120" width="68" height="4" rx="2" fill="rgba(255,255,255,.38)"/>
  <rect x="162" y="129" width="104" height="3" rx="2" fill="rgba(255,255,255,.16)"/>
  <rect x="162" y="143" width="44" height="8" rx="4" fill="url(#fa)" opacity=".5"/>
</svg>`,

    invest: `<svg viewBox="0 0 300 175" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ig" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7B5CFA" stop-opacity="0"/><stop offset=".38" stop-color="#E8C55A"/><stop offset="1" stop-color="#E8C55A" stop-opacity=".25"/>
    </linearGradient>
  </defs>
  <rect x="40" y="22" width="220" height="130" rx="16" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)"/>
  <text x="150" y="42" text-anchor="middle" fill="rgba(255,255,255,.35)" font-family="sans-serif" font-size="9">Invest 🚀</text>
  <text x="150" y="61" text-anchor="middle" fill="#E8C55A" font-family="sans-serif" font-size="15" font-weight="800">4,520 SPK</text>
  <!-- slider track -->
  <rect x="62" y="72" width="176" height="4" rx="2" fill="rgba(255,255,255,.07)"/>
  <rect x="62" y="72" width="115" height="4" rx="2" fill="url(#ig)"/>
  <circle cx="177" cy="74" r="9" fill="#E8C55A" filter="drop-shadow(0 0 6px rgba(232,197,90,.7))"/>
  <!-- presets -->
  <rect x="76" y="88" width="35" height="16" rx="6" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.09)"/>
  <text x="93" y="100" text-anchor="middle" fill="rgba(255,255,255,.5)" font-family="sans-serif" font-size="8">100</text>
  <rect x="120" y="88" width="35" height="16" rx="6" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.09)"/>
  <text x="137" y="100" text-anchor="middle" fill="rgba(255,255,255,.5)" font-family="sans-serif" font-size="8">500</text>
  <rect x="164" y="88" width="35" height="16" rx="6" fill="rgba(123,92,250,.3)" stroke="rgba(123,92,250,.55)"/>
  <text x="181" y="100" text-anchor="middle" fill="#9B7CFF" font-family="sans-serif" font-size="8">1 000</text>
  <!-- CTA button -->
  <rect x="62" y="116" width="176" height="26" rx="9" fill="#7B5CFA" filter="drop-shadow(0 4px 16px rgba(123,92,250,.55))"/>
  <text x="150" y="133" text-anchor="middle" fill="white" font-family="sans-serif" font-size="11" font-weight="700">Hold to Invest</text>
  <!-- line chart -->
  <path d="M52 158 L94 126 L140 140 L212 96 L252 74" stroke="url(#ig)" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`,

    cta: `<svg viewBox="0 0 300 175" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cg" x1="0" y1="0" x2="300" y2="175" gradientUnits="userSpaceOnUse">
      <stop stop-color="#9B5FFF"/><stop offset=".5" stop-color="#E85AA0"/><stop offset="1" stop-color="#E8C55A"/>
    </linearGradient>
    <radialGradient id="cr" cx="50%" cy="50%" r="50%">
      <stop stop-color="#9B5FFF" stop-opacity=".4"/><stop offset="1" stop-color="#9B5FFF" stop-opacity="0"/>
    </radialGradient>
    <filter id="cglow2"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="150" cy="87" rx="120" ry="84" fill="url(#cr)"/>
  <circle cx="150" cy="87" r="62" stroke="url(#cg)" stroke-width=".9" stroke-dasharray="3 8" opacity=".5"/>
  <circle cx="150" cy="87" r="38" stroke="url(#cg)" stroke-width="1.5" opacity=".9"/>
  <path d="M122 58C166 58 172 73 150 84S129 104 169 104" stroke="url(#cg)" stroke-width="7" stroke-linecap="round" filter="url(#cglow2)"/>
  <circle cx="122" cy="58" r="5" fill="#9B5FFF"/>
  <circle cx="169" cy="104" r="5" fill="#E8C55A"/>
  <circle cx="80" cy="30" r="3" fill="#E8C55A" opacity=".55"/>
  <circle cx="220" cy="140" r="2.5" fill="#9B5FFF" opacity=".5"/>
  <circle cx="238" cy="44" r="2.5" fill="#E85AA0" opacity=".45"/>
  <circle cx="58" cy="120" r="2" fill="#5AE8C5" opacity=".45"/>
  <text x="150" y="160" text-anchor="middle" fill="rgba(255,255,255,.65)" font-family="sans-serif" font-size="10" font-weight="700" letter-spacing="4">LIGHT UP THE FUTURE</text>
</svg>`
  };

  /* ── state ── */
  var _lang  = 'ru';
  var _slide = 0;
  var _total = 0;

  /* ── storage ── */
  function _seen()  { try { return !!localStorage.getItem(_OB_KEY); }  catch(e){ return false; } }
  function _mark()  { try { localStorage.setItem(_OB_KEY,'1'); }        catch(e){} }

  /* ── open auth register tab ── */
  function _openAuth() {
    document.documentElement.classList.add('auth-active');
    var as = document.getElementById('authScreen');
    if (as) as.classList.remove('gone');
    setTimeout(function(){
      var t = document.getElementById('tabSU');
      if (t) t.click();
    }, 90);
  }

  /* ── INJECT PHASE-1 STYLES ── */
  function _css() {
    if (document.getElementById('spk-ob3-css')) return;
    var s = document.createElement('style');
    s.id = 'spk-ob3-css';
    s.textContent = `
/* ═══ Phase 1 Overlay ═══ */
#spk-ob3 {
  position:fixed; inset:0; z-index:99998;
  display:flex; align-items:center; justify-content:center;
  background:rgba(3,4,12,.88);
  backdrop-filter:blur(18px) saturate(140%);
  -webkit-backdrop-filter:blur(18px) saturate(140%);
  padding:14px; box-sizing:border-box;
  animation:ob3In .4s ease forwards;
}
@keyframes ob3In{from{opacity:0}to{opacity:1}}

/* Modal card – glassmorphism */
#spk-ob3-modal {
  position:relative; width:100%; max-width:510px;
  background:linear-gradient(155deg,rgba(14,18,42,.97),rgba(8,11,28,.99));
  border:1px solid rgba(255,255,255,.08);
  border-radius:24px;
  box-shadow:
    0 40px 90px rgba(0,0,0,.85),
    0 0 0 1px rgba(255,255,255,.04) inset,
    0 0 80px rgba(123,92,250,.1);
  overflow:hidden; display:flex; flex-direction:column;
  max-height:calc(100svh - 28px);
  animation:ob3Slide .42s cubic-bezier(.34,1.56,.64,1) forwards;
  will-change:transform,opacity;
}
@keyframes ob3Slide{from{transform:translateY(30px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}

/* Progress track at the very top edge of the modal */
.ob3-prog {
  height:4px;
  background:rgba(255,255,255,.03);
  flex-shrink:0;
  overflow:hidden;
}
.ob3-fill {
  height:100%;
  background:linear-gradient(90deg,#7B5CFA 0%,#E85AA0 50%,#E8C55A 100%);
  transition:width .55s cubic-bezier(.4,0,.2,1);
}

/* Top bar */
.ob3-topbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 20px 2px; flex-shrink:0; gap:8px;
}

/* ─ Language switcher ─ */
.ob3-lang {
  display:flex; gap:3px; align-items:center;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
  border-radius:9px; padding:3px;
}
.ob3-lang-btn {
  padding:4px 12px; border-radius:6px; border:none;
  background:transparent; color:rgba(255,255,255,.3);
  font-family:'Syne',sans-serif; font-size:11px; font-weight:700;
  cursor:pointer; transition:all .22s; letter-spacing:.06em;
  line-height:1;
}
.ob3-lang-btn.on {
  background:linear-gradient(135deg,rgba(123,92,250,.3),rgba(232,90,160,.2));
  border:1px solid rgba(123,92,250,.4);
  color:#C4ADFF;
  box-shadow:0 0 12px rgba(123,92,250,.25);
}

/* ─ Skip ─ */
.ob3-skip {
  background:transparent; border:none; cursor:pointer;
  color:rgba(255,255,255,.25); font-family:'DM Sans',sans-serif;
  font-size:12px; padding:5px 8px; border-radius:7px; transition:all .2s;
}
.ob3-skip:hover { color:rgba(255,255,255,.6); background:rgba(255,255,255,.05); }

/* ─ Slide track ─ */
.ob3-track { overflow:hidden; flex:1; min-height:0; }
.ob3-slide {
  display:none; flex-direction:column; align-items:center;
  padding:20px 26px 16px; text-align:center; box-sizing:border-box;
  overflow-y:auto; scrollbar-width:none;
  max-height:calc(100svh - 185px);
}
.ob3-slide::-webkit-scrollbar{display:none}
.ob3-slide.on  { display:flex; animation:ob3SlIn .38s cubic-bezier(.4,0,.2,1) forwards; }
.ob3-slide.rev { animation:ob3SlInR .38s cubic-bezier(.4,0,.2,1) forwards; }
@keyframes ob3SlIn  {from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
@keyframes ob3SlInR {from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}

/* ─ Visual ─ */
.ob3-vis {
  width:100%; max-width:278px; height:155px; flex-shrink:0;
  margin-bottom:20px; border-radius:14px; overflow:hidden;
  background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07);
  box-shadow:0 8px 32px rgba(0,0,0,.5);
}
.ob3-vis svg { width:100%; height:100%; }

/* ─ Tag chip ─ */
.ob3-tag {
  display:inline-block; font-size:10px; font-weight:700; letter-spacing:.07em;
  text-transform:uppercase; color:#5AE8C5;
  background:rgba(90,232,197,.09); border:1px solid rgba(90,232,197,.18);
  border-radius:20px; padding:3px 11px; margin-bottom:11px;
}

/* ─ Title ─ */
.ob3-title {
  font-size:clamp(19px,5vw,26px); font-weight:800; line-height:1.18;
  color:#fff; font-family:'Syne',sans-serif; margin-bottom:12px;
  white-space:pre-line; letter-spacing:-.01em;
}

/* ─ Body ─ */
.ob3-body {
  font-size:13px; color:rgba(255,255,255,.48); line-height:1.68;
  max-width:410px; font-family:'DM Sans',sans-serif; margin-bottom:6px;
}

/* ─ Bonus badge ─ */
.ob3-bonus {
  display:inline-flex; align-items:center; gap:6px;
  background:rgba(232,197,90,.09); border:1px solid rgba(232,197,90,.2);
  border-radius:20px; padding:5px 14px; font-size:12px; color:#E8C55A;
  font-family:'Syne',sans-serif; font-weight:700; margin-bottom:14px;
  animation:ob3Pulse 2.4s ease-in-out infinite;
}
@keyframes ob3Pulse{0%,100%{box-shadow:0 0 0 0 rgba(232,197,90,.0)}50%{box-shadow:0 0 0 6px rgba(232,197,90,.08)}}

/* ─ CTA button ─ */
.ob3-cta-btn {
  display:block; width:100%; max-width:310px; margin:16px auto 6px;
  padding:15px 24px;
  background:linear-gradient(135deg,#7B5CFA,#E85AA0);
  color:#fff; font-size:14px; font-weight:700;
  font-family:'Syne',sans-serif; border:none; border-radius:13px;
  cursor:pointer;
  box-shadow:0 8px 30px rgba(123,92,250,.5), 0 0 0 1px rgba(255,255,255,.06) inset;
  transition:transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease;
  letter-spacing:.03em;
  will-change:transform;
}
.ob3-cta-btn:hover { transform:translateY(-2px); box-shadow:0 14px 40px rgba(123,92,250,.6); }
.ob3-cta-btn:active { transform:translateY(0) scale(.97); }
.ob3-cta-sub { text-align:center; font-size:11px; color:rgba(255,255,255,.22); font-family:'DM Sans',sans-serif; }

/* ─ Nav bar ─ */
.ob3-nav {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 22px 18px; border-top:1px solid rgba(255,255,255,.05); flex-shrink:0;
}
.ob3-dots { display:flex; align-items:center; gap:6px; }
.ob3-dot {
  width:7px; height:7px; border-radius:50%;
  background:rgba(255,255,255,.13); transition:all .32s; cursor:pointer;
}
.ob3-dot.on {
  background:linear-gradient(135deg,#7B5CFA,#E85AA0);
  width:22px; border-radius:4px;
  box-shadow:0 0 8px rgba(123,92,250,.5);
}
.ob3-btn {
  background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.08);
  color:rgba(255,255,255,.55); font-size:13px; font-family:'Syne',sans-serif;
  font-weight:600; padding:9px 18px; border-radius:10px; cursor:pointer;
  transition:all .2s; min-width:78px; text-align:center; line-height:1;
}
.ob3-btn:hover { background:rgba(255,255,255,.1); color:#fff; }
.ob3-btn.prim {
  background:linear-gradient(135deg,#7B5CFA,#5A3FD0);
  border-color:rgba(123,92,250,.5); color:#fff;
  box-shadow:0 4px 18px rgba(123,92,250,.38);
}
.ob3-btn.prim:hover { box-shadow:0 6px 24px rgba(123,92,250,.55); transform:translateY(-1px); }
.ob3-btn:disabled { opacity:.25; cursor:not-allowed; transform:none!important; }

/* ── Mobile ── */
@media(max-width:480px){
  #spk-ob3-modal { border-radius:20px; }
  .ob3-slide { padding:16px 17px 14px; }
  .ob3-vis { max-width:230px; height:132px; }
  .ob3-title { font-size:19px; }
  .ob3-body { font-size:12.5px; }
  .ob3-nav { padding:10px 15px 15px; }
  .ob3-btn { padding:7px 13px; font-size:12px; min-width:66px; }
  .ob3-topbar { padding:12px 16px 2px; }
}
@media(max-height:620px){
  .ob3-vis { height:105px; }
  .ob3-slide { padding:12px 20px 10px; }
  .ob3-title { font-size:17px; margin-bottom:7px; }
  .ob3-body { font-size:12px; }
}
    `;
    document.head.appendChild(s);
  }

  /* ── BUILD ── */
  function _build() {
    var cp = C[_lang] || C.ru;
    _total = cp.slides.length;

    var slides = cp.slides.map(function(sl, i) {
      var isCta   = !!sl.cta;
      var bonus   = isCta ? '<div class="ob3-bonus">' + cp.bonus + '</div>' : '';
      var ctaHtml = isCta
        ? '<button class="ob3-cta-btn" id="spk-ob3-cta">' + cp.ctaBtn + '</button>'
          + '<div class="ob3-cta-sub">' + cp.ctaSub + '</div>'
        : '';
      return '<div class="ob3-slide' + (i===0?' on':'') + '" data-si="' + i + '">'
        + '<div class="ob3-vis">' + (SVG[sl.vis]||'') + '</div>'
        + '<span class="ob3-tag">' + sl.icon + ' ' + sl.tag + '</span>'
        + '<div class="ob3-title">' + sl.title + '</div>'
        + '<div class="ob3-body">' + sl.body + '</div>'
        + bonus + ctaHtml + '</div>';
    }).join('');

    var dots = cp.slides.map(function(_,i){
      return '<span class="ob3-dot' + (i===0?' on':'') + '" data-di="' + i + '"></span>';
    }).join('');

    var el = document.createElement('div');
    el.id = 'spk-ob3';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.innerHTML = '<div id="spk-ob3-modal">'
      + '<div class="ob3-prog"><div class="ob3-fill" id="ob3-fill" style="width:' + Math.round(100/_total) + '%"></div></div>'
      + '<div class="ob3-topbar">'
      + '<div class="ob3-lang">'
      + '<button class="ob3-lang-btn' + (_lang==='ru'?' on':'') + '" data-l="ru">RU</button>'
      + '<button class="ob3-lang-btn' + (_lang==='en'?' on':'') + '" data-l="en">EN</button>'
      + '</div>'
      + '<button class="ob3-skip" id="ob3-skip">' + cp.skip + '</button>'
      + '</div>'
      + '<div class="ob3-track" id="ob3-track">' + slides + '</div>'
      + '<div class="ob3-nav">'
      + '<button class="ob3-btn" id="ob3-back" disabled>' + cp.back + '</button>'
      + '<div class="ob3-dots" id="ob3-dots">' + dots + '</div>'
      + '<button class="ob3-btn prim" id="ob3-next">' + cp.next + '</button>'
      + '</div>'
      + '</div>';
    return el;
  }

  /* ── NAVIGATE ── */
  function _go(idx, rev) {
    if (idx < 0 || idx >= _total) return;
    var cur = document.querySelector('.ob3-slide.on');
    if (cur) cur.classList.remove('on','rev');
    var sl = document.querySelectorAll('.ob3-slide')[idx];
    if (sl) {
      sl.classList.remove('rev');
      if (rev) sl.classList.add('rev');
      sl.classList.add('on');
      sl.scrollTop = 0;
    }
    document.querySelectorAll('.ob3-dot').forEach(function(d,i){ d.classList.toggle('on',i===idx); });
    var f = document.getElementById('ob3-fill');
    if (f) f.style.width = Math.round((idx+1)/_total*100) + '%';
    var bk = document.getElementById('ob3-back');
    var nx = document.getElementById('ob3-next');
    if (bk) bk.disabled = idx === 0;
    if (nx) nx.style.display = idx === _total-1 ? 'none' : '';
    _slide = idx;
  }

  /* ── DESTROY ── */
  function _destroy() {
    var el = document.getElementById('spk-ob3');
    if (el) {
      el.style.transition='opacity .3s ease';
      el.style.opacity='0';
      setTimeout(function(){ el.remove(); },320);
    }
    document.removeEventListener('keydown',_key);
  }

  /* ── REBUILD WITH NEW LANG ── */
  function _rebuildLang(l) {
    _setLang(l); _lang = l;
    var prev = _slide;
    var old = document.getElementById('spk-ob3');
    if (old) old.remove();
    document.body.appendChild(_build());
    _wire();
    _go(prev, false);
  }

  /* ── KEY HANDLER ── */
  function _key(e) {
    if (!document.getElementById('spk-ob3')) { document.removeEventListener('keydown',_key); return; }
    if (e.key==='ArrowRight'||e.key==='Enter') { if(_slide<_total-1)_go(_slide+1,false); else{_mark();_destroy();_openAuth();} }
    if (e.key==='ArrowLeft'&&_slide>0) _go(_slide-1,true);
    if (e.key==='Escape') { _mark();_destroy();_openAuth(); }
  }

  /* ── WIRE EVENTS ── */
  function _wire() {
    /* lang buttons */
    document.querySelectorAll('[data-l]').forEach(function(b){
      b.addEventListener('click',function(){ var l=b.getAttribute('data-l'); if(l!==_lang) _rebuildLang(l); });
    });
    /* skip */
    var sk = document.getElementById('ob3-skip');
    if (sk) sk.addEventListener('click',function(){ _mark();_destroy();_openAuth(); });
    /* back */
    var bk = document.getElementById('ob3-back');
    if (bk) bk.addEventListener('click',function(){ if(_slide>0)_go(_slide-1,true); });
    /* next */
    var nx = document.getElementById('ob3-next');
    if (nx) nx.addEventListener('click',function(){ if(_slide<_total-1)_go(_slide+1,false); else{_mark();_destroy();_openAuth();} });
    /* cta button inside last slide */
    document.addEventListener('click',function _cc(e){
      if(e.target&&e.target.id==='spk-ob3-cta'){ _mark();_destroy();_openAuth(); document.removeEventListener('click',_cc); }
    });
    /* dots */
    document.querySelectorAll('.ob3-dot').forEach(function(d){
      d.addEventListener('click',function(){ var i=parseInt(d.dataset.di,10); _go(i,i<_slide); });
    });
    /* swipe */
    var tr = document.getElementById('ob3-track');
    if (tr) {
      var sx=0;
      tr.addEventListener('touchstart',function(e){ sx=e.changedTouches[0].clientX; },{passive:true});
      tr.addEventListener('touchend',function(e){
        var dx=e.changedTouches[0].clientX-sx;
        if(Math.abs(dx)>46){ if(dx<0&&_slide<_total-1)_go(_slide+1,false); else if(dx>0&&_slide>0)_go(_slide-1,true); }
      },{passive:true});
    }
    document.addEventListener('keydown',_key);
  }

  /* ── PUBLIC ── */
  function launch() { _lang=_getLang(); _slide=0; _css(); document.body.appendChild(_build()); _wire(); }
  function init()   { if(document.documentElement.classList.contains('spark-presession'))return; if(_seen()){_openAuth();return;} setTimeout(launch,550); }
  function reset()  { try{localStorage.removeItem(_OB_KEY);}catch(e){} }

  return { init:init, launch:launch, reset:reset };
})();
window.SparkOnboarding = SparkOnboarding;


/* ════════════════════════════════════════════════════════════════════════
   ██████╗ ██╗  ██╗ █████╗ ███████╗███████╗     2
   ██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝     POST-REGISTRATION
   ██████╔╝███████║███████║███████╗█████╗       SPOTLIGHT TOUR v3
   ██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝
   ██║     ██║  ██║██║  ██║███████║███████╗
   ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝

   SPOTLIGHT TECHNIQUE  (fixes the "element covered" bug)
   ───────────────────────────────────────────────────────
   We create a full-screen tinted overlay using FOUR separate <div>
   panels arranged around the target like a picture frame:

       ┌───────────────────────────[TOP]───────────────────────────┐
       │                                                           │
       │   [LEFT]   ┌──────────────────┐   [RIGHT]                 │
       │            │  TARGET ELEMENT  │                           │
       │            │  (fully sharp,   │                           │
       │            │   clickable)     │                           │
       │            └──────────────────┘                           │
       │                                                           │
       └─────────────────────────[BOTTOM]──────────────────────────┘

   The target element is temporarily given a higher z-index so it
   renders above all four panels. No blur. No coverage. No layout
   shifts. All original styles are stored and fully restored when
   the step ends.

   A PULSING NEON RING is rendered as a 5th absolutely-positioned
   div that tracks the element's bounding rect.
   ════════════════════════════════════════════════════════════════════════ */
var SparkTour = (function () {

  /* ── helpers ── */
  function _taken()  { try{return !!localStorage.getItem(_TOUR_KEY);}catch(e){return false;} }
  function _mark()   { try{localStorage.setItem(_TOUR_KEY,'1');}catch(e){} }
  function _T(en,ru) { return _getLang()==='ru' ? ru : en; }

  /* ── DOM refs kept during tour ── */
  var _overlay     = null;  // container div
  var _panels      = {};    // {top,right,bottom,left}
  var _ring        = null;  // pulsing neon ring
  var _tip         = null;  // tooltip card
  var _sheet       = null;  // mobile bottom-sheet
  var _target      = null;  // current highlighted element
  var _savedStyles = null;  // {position,zIndex,isolation,outline} of _target
  var _idx         = 0;
  var _steps       = [];
  var _raf         = null;  // requestAnimationFrame id for ring tracking
  var _sheetDrag   = null;  // touch tracking for swipe-dismiss

  /* ─────────────────────────────────────────────────────
     STEP DEFINITIONS  (tied to real SPARK selectors)
  ───────────────────────────────────────────────────── */
  function _buildSteps() {
    return [
      {
        id:'welcome', el:null, elMob:null,
        t:_T('🎉 Welcome aboard!','🎉 Добро пожаловать!'),
        b:_T(
          'Your account is live and 4,520 SPK are already in your wallet. This quick tour will have you investing like a Prophet in under 60 seconds.',
          'Аккаунт создан, и 4 520 SPK уже на вашем балансе. Этот тур научит вас инвестировать как Пророк менее чем за 60 секунд.'
        )
      },
      {
        id:'wallet', el:'.wallet-badge', elMob:'.wallet-badge',
        t:_T('💰 SPK Wallet','💰 SPK-кошелёк'),
        b:_T(
          'Your balance lives here. You received 4,520 SPK as a welcome gift — that\'s real investing power. Every idea you back increases this number.',
          'Здесь ваш баланс. Вы получили 4 520 SPK в подарок — это реальные инвестиционные ресурсы. Каждая поддержанная идея увеличивает эту цифру.'
        )
      },
      {
        id:'post', el:'#btnPostIdea', elMob:'#btnPostIdea',
        t:_T('💡 Post Your First Idea','💡 Опубликуйте первую идею'),
        b:_T(
          'Got a startup idea? Click here — fill in title, sector, duration, and minimum bet, then hold the Publish button for 2 seconds. Your idea goes live instantly.',
          'Есть стартап-идея? Кликните сюда — заполните заголовок, сектор, срок и минимальную ставку, затем удержите кнопку публикации 2 секунды. Идея появится мгновенно.'
        )
      },
      {
        id:'search', el:'#srchIn', elMob:'#srchIn',
        t:_T('🔍 Search Ideas','🔍 Поиск идей'),
        b:_T(
          'Type any keyword to filter the feed in real time. The results update as you type — no page reload needed.',
          'Введите ключевое слово, и лента обновится прямо во время ввода. Никаких перезагрузок.'
        )
      },
      {
        id:'sort', el:'.frow', elMob:'.frow',
        t:_T('📊 Sort & Discover','📊 Сортировка и поиск'),
        b:_T(
          'Sort the feed by New, Popular, Profitable or Ending Soon. One click — the entire feed reorders instantly. Chase momentum.',
          'Сортируйте ленту: Новые, Популярные, Прибыльные или Скоро заканчиваются. Один клик — и лента мгновенно перестраивается. Ловите импульс.'
        )
      },
      {
        id:'tags', el:'.trow', elMob:'.trow',
        t:_T('#️⃣ Sector Tags','#️⃣ Теги секторов'),
        b:_T(
          'Filter by sector: AI · DeFi · CleanEnergy · Hardware · Web3 · B2B SaaS. Stack multiple tags to narrow your focus down to exactly what you\'re hunting.',
          'Фильтр по сектору: AI · DeFi · CleanEnergy · Hardware · Web3 · B2B SaaS. Комбинируйте теги, чтобы найти именно то, что ищете.'
        )
      },
      {
        id:'card', el:'.card:first-child', elMob:'.card:first-child',
        t:_T('📈 Idea Card','📈 Карточка идеи'),
        b:_T(
          'Each card shows: title, description, active investors, SPK pool, time remaining, and a live investment growth chart. Tap "Invest" to back it with your SPK.',
          'Каждая карточка: заголовок, описание, инвесторы, пул SPK, оставшееся время и живой график. Нажмите «Вложить», чтобы поддержать идею своими SPK.'
        )
      },
      {
        id:'trending', el:'#trendListDesk', elMob:'#trendListMob',
        t:_T('🔥 Trending Now','🔥 В тренде прямо сейчас'),
        b:_T(
          'The left sidebar ranks the hottest sectors by total SPK invested in the last hour. Watch it to spot momentum surges before they become obvious.',
          'Левая панель ранжирует горячие секторы по SPK за последний час. Следите за ней, чтобы замечать рост раньше других.'
        )
      },
      {
        id:'leaderboard', el:'#leaderListDesk', elMob:'#leaderListMob',
        t:_T('🏆 Prophet Leaderboard','🏆 Топ Пророков'),
        b:_T(
          'Top investors ranked by portfolio performance. Back the right ideas early → climb the ranks → earn the Prophet title. Your name could be here.',
          'Топ инвесторов по результатам портфеля. Поддерживайте нужные идеи первыми → поднимайтесь в рейтинге → заработайте статус Пророка. Ваше имя может быть здесь.'
        )
      },
      {
        id:'chats', el:'#btnChatsDesk', elMob:'#panel-chats',
        t:_T('💬 SPARK Chats','💬 Чаты SPARK'),
        b:_T(
          'Direct messages + thematic team channels. Share analytics dashboards, discuss ideas before investing, pin key intel, and search your conversation history.',
          'Личные сообщения + тематические каналы. Делитесь аналитикой, обсуждайте идеи до вложений, закрепляйте ключевые данные и ищите по истории чата.'
        )
      },
      {
        id:'profile', el:'#btnProfDesk', elMob:'#panel-profile',
        t:_T('👤 Your Profile','👤 Ваш профиль'),
        b:_T(
          'Edit username, bio, avatar colour, and theme. The Theme Studio packs 16 presets — Cosmos, Cyberpunk, Aurora, and more — plus custom colour pickers.',
          'Никнейм, bio, цвет аватара и тема. Студия тем: 16 пресетов — Космос, Киберпанк, Аврора и другие — плюс кастомные цветовые пикеры.'
        )
      },
      {
        id:'finish', el:null, elMob:null,
        t:_T('🚀 You\'re a SPARK Insider!','🚀 Вы — инсайдер SPARK!'),
        b:_T(
          'Tour complete. 🎯 Your daily login bonus is already ticking. Come back every day to compound your SPK. The leaderboard awaits — go light up the future.',
          'Тур завершён. 🎯 Ваш ежедневный бонус уже начисляется. Заходите каждый день для накопления SPK. Таблица лидеров ждёт — зажигайте будущее.'
        )
      }
    ];
  }

  /* ─────────────────────────────────────────────────────
     CSS INJECTION  (Phase 2 — tour styles)
  ───────────────────────────────────────────────────── */
  function _css() {
    if (document.getElementById('spk-tour3-css')) return;
    var s = document.createElement('style');
    s.id = 'spk-tour3-css';
    s.textContent = `
/* ══ Tour overlay container ══ */
#spk-tour3 { position:fixed; inset:0; z-index:99980; pointer-events:none; }

/* ── Four backdrop panels ── */
.spk-t3-panel {
  position:fixed;
  background:rgba(3,4,12,.82);
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
  pointer-events:all;
  transition:all .35s cubic-bezier(.4,0,.2,1);
  will-change:transform;
}
/* top,right,bottom,left panels each get explicit coords in JS */

/* ── Pulsing neon ring (tracks target element) ── */
.spk-t3-ring {
  position:fixed;
  border-radius:10px;
  pointer-events:none;
  z-index:99982;
  will-change:opacity,transform;
  animation:t3Ring 1.8s ease-in-out infinite;
}
@keyframes t3Ring {
  0%,100% { box-shadow: 0 0 0 0 rgba(123,92,250,.0), 0 0 0 0 rgba(232,90,160,.0); }
  40%     { box-shadow: 0 0 0 6px rgba(123,92,250,.45), 0 0 0 12px rgba(232,90,160,.2); }
  70%     { box-shadow: 0 0 0 10px rgba(123,92,250,.18), 0 0 0 20px rgba(232,90,160,.06); }
}

/* ── Desktop tooltip card (glassmorphism) ── */
.spk-t3-tip {
  position:fixed;
  width:340px;
  background:linear-gradient(155deg,rgba(14,18,44,.97),rgba(8,12,30,.99));
  border:1px solid rgba(123,92,250,.3);
  border-radius:18px;
  padding:20px 22px 16px;
  box-shadow:
    0 24px 60px rgba(0,0,0,.75),
    0 0 0 1px rgba(255,255,255,.04) inset,
    0 0 40px rgba(123,92,250,.12);
  z-index:99984;
  pointer-events:all;
  will-change:transform,opacity;
  animation:t3TipIn .35s cubic-bezier(.34,1.56,.64,1) forwards;
}
@keyframes t3TipIn{from{opacity:0;transform:scale(.92) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}

/* arrow pointer */
.spk-t3-tip::before {
  content:'';
  position:absolute;
  width:10px; height:10px;
  background:rgba(14,18,44,.97);
  border-left:1px solid rgba(123,92,250,.25);
  border-top:1px solid rgba(123,92,250,.25);
  border-radius:2px;
}
.spk-t3-tip.arrow-bottom::before { top:auto; bottom:-6px; transform:rotate(225deg); left:28px; }
.spk-t3-tip.arrow-top::before    { top:-6px;             transform:rotate(45deg);  left:28px; }
.spk-t3-tip.arrow-right::before  { right:-6px; top:20px; transform:rotate(135deg); }
.spk-t3-tip.arrow-left::before   { left:-6px;  top:20px; transform:rotate(-45deg); }
.spk-t3-tip.arrow-none::before   { display:none; }

/* counter chip */
.spk-t3-counter {
  display:inline-block; font-size:10px; font-weight:700; letter-spacing:.06em;
  text-transform:uppercase; color:#5AE8C5;
  background:rgba(90,232,197,.09); border:1px solid rgba(90,232,197,.18);
  border-radius:20px; padding:2px 10px; margin-bottom:10px;
}
.spk-t3-title {
  font-size:15px; font-weight:800; color:#fff;
  font-family:'Syne',sans-serif; margin-bottom:8px; line-height:1.22;
}
.spk-t3-body {
  font-size:12.5px; color:rgba(255,255,255,.48); line-height:1.62;
  font-family:'DM Sans',sans-serif; margin-bottom:15px;
}

/* nav row */
.spk-t3-nav {
  display:flex; align-items:center; justify-content:space-between; gap:6px;
}
.spk-t3-btn {
  padding:7px 14px; border-radius:8px; cursor:pointer; font-size:12px;
  font-family:'Syne',sans-serif; font-weight:700; line-height:1;
  border:1px solid rgba(255,255,255,.09);
  background:rgba(255,255,255,.055); color:rgba(255,255,255,.55);
  transition:all .2s; flex-shrink:0;
}
.spk-t3-btn:hover { background:rgba(255,255,255,.1); color:#fff; }
.spk-t3-btn.prim {
  background:linear-gradient(135deg,#7B5CFA,#5A3FD0);
  border-color:rgba(123,92,250,.45); color:#fff;
  box-shadow:0 4px 16px rgba(123,92,250,.38);
}
.spk-t3-btn.prim:hover { box-shadow:0 6px 22px rgba(123,92,250,.55); transform:translateY(-1px); }
.spk-t3-btn.skip { background:transparent; border-color:transparent; color:rgba(255,255,255,.28); font-size:11px; }
.spk-t3-btn.skip:hover { color:rgba(255,255,255,.6); }

/* lang switcher inside tip */
.spk-t3-lang {
  position:absolute; top:14px; right:15px;
  display:flex; gap:3px; align-items:center;
  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
  border-radius:7px; padding:2px;
}
.spk-t3-lang-btn {
  padding:3px 9px; border-radius:5px; border:none;
  background:transparent; color:rgba(255,255,255,.28);
  font-family:'Syne',sans-serif; font-size:10px; font-weight:700;
  cursor:pointer; transition:all .2s; letter-spacing:.05em;
}
.spk-t3-lang-btn.on {
  background:rgba(123,92,250,.25); border:1px solid rgba(123,92,250,.35);
  color:#C4ADFF;
}

/* ════ Mobile bottom-sheet ════ */
.spk-t3-sheet {
  position:fixed; bottom:0; left:0; right:0; z-index:99986;
  background:linear-gradient(180deg,rgba(12,16,36,.96),rgba(8,11,26,.99));
  border-top:1px solid rgba(123,92,250,.28);
  border-radius:22px 22px 0 0;
  padding:0 20px 28px;
  box-shadow:0 -20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.04) inset;
  pointer-events:all;
  transform:translateY(100%);
  will-change:transform;
  transition:transform .38s cubic-bezier(.4,0,.2,1);
  max-height:72svh; overflow-y:auto;
}
.spk-t3-sheet.open { transform:translateY(0); }
.spk-t3-sheet-handle {
  width:42px; height:5px; border-radius:3px;
  background:rgba(255,255,255,.15); margin:14px auto 18px;
  flex-shrink:0;
}
.spk-t3-sheet-inner { padding-bottom:8px; }

/* mobile tip uses same typography classes */
.spk-t3-sheet .spk-t3-counter,
.spk-t3-sheet .spk-t3-title,
.spk-t3-sheet .spk-t3-body { text-align:left; }
.spk-t3-sheet .spk-t3-nav  { padding-top:4px; }

/* ── Mobile responsiveness ── */
@media(max-width:480px){
  .spk-t3-tip { width:calc(100vw - 28px); }
}
    `;
    document.head.appendChild(s);
  }

  /* ─────────────────────────────────────────────────────
     SPOTLIGHT  core logic
  ───────────────────────────────────────────────────── */

  /* Elevate target element above overlay */
  function _liftTarget(el) {
    if (!el) return;
    var cs = window.getComputedStyle(el);
    _savedStyles = {
      position:  el.style.position,
      zIndex:    el.style.zIndex,
      isolation: el.style.isolation,
      outline:   el.style.outline
    };
    el.style.position  = (cs.position === 'static') ? 'relative' : cs.position;
    el.style.zIndex    = '99983';
    el.style.isolation = 'isolate';
  }

  /* Restore target to original styles */
  function _dropTarget(el) {
    if (!el || !_savedStyles) return;
    el.style.position  = _savedStyles.position;
    el.style.zIndex    = _savedStyles.zIndex;
    el.style.isolation = _savedStyles.isolation;
    el.style.outline   = _savedStyles.outline;
    _savedStyles = null;
  }

  /* Place four panels around a bounding rect */
  var PAD = 10;
  function _placePanels(rect) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    
    if (!rect) {
      _panels.top.style.cssText    = 'top:0;left:0;width:' + vw + 'px;height:' + vh + 'px;';
      _panels.bottom.style.cssText = 'top:0;left:0;width:0;height:0;';
      _panels.left.style.cssText   = 'top:0;left:0;width:0;height:0;';
      _panels.right.style.cssText  = 'top:0;left:0;width:0;height:0;';
      return;
    }
    
    var x1 = rect.left   - PAD;
    var y1 = rect.top    - PAD;
    var x2 = rect.right  + PAD;
    var y2 = rect.bottom + PAD;

    // top
    _panels.top.style.cssText    = 'top:0;left:0;width:' + vw + 'px;height:' + Math.max(0,y1) + 'px;';
    // bottom
    _panels.bottom.style.cssText = 'top:' + Math.min(vh,y2) + 'px;left:0;width:' + vw + 'px;height:' + Math.max(0,vh-y2) + 'px;';
    // left
    _panels.left.style.cssText   = 'top:' + Math.max(0,y1) + 'px;left:0;width:' + Math.max(0,x1) + 'px;height:' + Math.max(0,y2-y1) + 'px;';
    // right
    _panels.right.style.cssText  = 'top:' + Math.max(0,y1) + 'px;left:' + Math.min(vw,x2) + 'px;width:' + Math.max(0,vw-x2) + 'px;height:' + Math.max(0,y2-y1) + 'px;';
  }

  /* Place pulsing ring */
  function _placeRing(rect) {
    _ring.style.cssText =
      'left:'   + (rect.left   - PAD) + 'px;'
      + 'top:'  + (rect.top    - PAD) + 'px;'
      + 'width:' + (rect.width + PAD*2) + 'px;'
      + 'height:'+ (rect.height+ PAD*2) + 'px;'
      + 'border:2px solid rgba(123,92,250,.55);'
      + 'box-shadow:0 0 18px rgba(123,92,250,.4),0 0 36px rgba(232,90,160,.18);';
  }

  /* requestAnimationFrame loop to keep panels/ring in sync with target */
  function _trackLoop() {
    if (!_target) return;
    var r = _target.getBoundingClientRect();
    _placePanels(r);
    _placeRing(r);
    _raf = requestAnimationFrame(_trackLoop);
  }

  /* ─────────────────────────────────────────────────────
     TOOLTIP CARD  (desktop)
  ───────────────────────────────────────────────────── */
  function _buildTip(step, isFirst, isLast, total, idx) {
    var tip = document.createElement('div');
    tip.className = 'spk-t3-tip';

    /* Lang switcher — only on first step */
    var langHtml = isFirst
      ? '<div class="spk-t3-lang">'
        + '<button class="spk-t3-lang-btn' + (_getLang()==='ru'?' on':'') + '" data-tl="ru">RU</button>'
        + '<button class="spk-t3-lang-btn' + (_getLang()==='en'?' on':'') + '" data-tl="en">EN</button>'
        + '</div>'
      : '';

    tip.innerHTML = langHtml
      + '<div class="spk-t3-counter">' + (idx+1) + ' / ' + total + '</div>'
      + '<div class="spk-t3-title">'   + step.t  + '</div>'
      + '<div class="spk-t3-body">'    + step.b  + '</div>'
      + '<div class="spk-t3-nav">'
      + (idx > 0
        ? '<button class="spk-t3-btn" id="t3-back">' + _T('← Back','← Назад') + '</button>'
        : '<span></span>')
      + '<button class="spk-t3-btn skip" id="t3-skip">' + _T('Skip','Пропустить') + '</button>'
      + '<button class="spk-t3-btn prim" id="t3-next">'
        + (isLast ? _T('Finish 🚀','Готово 🚀') : _T('Next →','Далее →'))
        + '</button>'
      + '</div>';

    return tip;
  }

  /* Smart placement: below → above → right → left → centre */
  function _positionTip(tip, rect) {
    tip.classList.remove('arrow-top','arrow-bottom','arrow-left','arrow-right','arrow-none');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var tw = 340;
    var th = 210; /* approx */
    var gap = 18;

    if (!rect) {
      /* centred (no element) */
      tip.style.left      = '50%';
      tip.style.top       = '50%';
      tip.style.transform = 'translate(-50%,-50%)';
      tip.classList.add('arrow-none');
      return;
    }
    tip.style.transform = '';

    var left = Math.max(8, Math.min(vw - tw - 8, rect.left));

    if (rect.bottom + gap + th < vh) {
      /* below */
      tip.style.left = left + 'px';
      tip.style.top  = (rect.bottom + gap) + 'px';
      tip.style.bottom = 'auto';
      tip.classList.add('arrow-top');
    } else if (rect.top - gap - th > 0) {
      /* above */
      tip.style.left   = left + 'px';
      tip.style.bottom = (vh - rect.top + gap) + 'px';
      tip.style.top    = 'auto';
      tip.classList.add('arrow-bottom');
    } else if (rect.left - gap - tw > 0) {
      /* left side */
      tip.style.left  = (rect.left - tw - gap) + 'px';
      tip.style.top   = Math.max(8, Math.min(vh - th - 8, rect.top)) + 'px';
      tip.style.bottom = 'auto';
      tip.classList.add('arrow-right');
    } else if (rect.right + gap + tw < vw) {
      /* right side */
      tip.style.left  = (rect.right + gap) + 'px';
      tip.style.top   = Math.max(8, Math.min(vh - th - 8, rect.top)) + 'px';
      tip.style.bottom = 'auto';
      tip.classList.add('arrow-left');
    } else {
      /* fallback centre */
      tip.style.left      = '50%';
      tip.style.top       = '50%';
      tip.style.transform = 'translate(-50%,-50%)';
      tip.classList.add('arrow-none');
    }
  }

  /* ─────────────────────────────────────────────────────
     BOTTOM SHEET  (mobile)
  ───────────────────────────────────────────────────── */
  function _buildSheet(step, isFirst, isLast, total, idx) {
    var sh = document.createElement('div');
    sh.className = 'spk-t3-sheet';

    var langHtml = isFirst
      ? '<div class="spk-t3-lang" style="float:right;margin-top:-4px">'
        + '<button class="spk-t3-lang-btn' + (_getLang()==='ru'?' on':'') + '" data-tl="ru">RU</button>'
        + '<button class="spk-t3-lang-btn' + (_getLang()==='en'?' on':'') + '" data-tl="en">EN</button>'
        + '</div><div style="clear:both"></div>'
      : '';

    sh.innerHTML = '<div class="spk-t3-sheet-handle"></div>'
      + '<div class="spk-t3-sheet-inner">'
      + langHtml
      + '<div class="spk-t3-counter">' + (idx+1) + ' / ' + total + '</div>'
      + '<div class="spk-t3-title">'   + step.t  + '</div>'
      + '<div class="spk-t3-body">'    + step.b  + '</div>'
      + '<div class="spk-t3-nav">'
      + (idx > 0
        ? '<button class="spk-t3-btn" id="t3-back">' + _T('← Back','← Назад') + '</button>'
        : '<span></span>')
      + '<button class="spk-t3-btn skip" id="t3-skip">' + _T('Skip','Пропустить') + '</button>'
      + '<button class="spk-t3-btn prim" id="t3-next">'
        + (isLast ? _T('Finish 🚀','Готово 🚀') : _T('Next →','Далее →'))
        + '</button>'
      + '</div>'
      + '</div>';
    return sh;
  }

  /* ─────────────────────────────────────────────────────
     WIRE nav buttons + lang switch
  ───────────────────────────────────────────────────── */
  function _wireNav() {
    var nx = document.getElementById('t3-next');
    var bk = document.getElementById('t3-back');
    var sk = document.getElementById('t3-skip');
    if (nx) nx.addEventListener('click', function(){ _idx < _steps.length-1 ? _render(_idx+1) : _finish(); });
    if (bk) bk.addEventListener('click', function(){ if(_idx>0) _render(_idx-1); });
    if (sk) sk.addEventListener('click', _finish);

    /* lang switches (both tip and sheet have same data-tl attr) */
    document.querySelectorAll('[data-tl]').forEach(function(b){
      b.addEventListener('click', function(){
        var l = b.getAttribute('data-tl');
        if (l !== _getLang()) {
          _setLang(l);
          _steps = _buildSteps(); /* rebuild with new lang */
          _render(_idx);
        }
      });
    });
  }

  /* Mobile swipe-to-dismiss sheet */
  function _wireSheetSwipe(sh) {
    var startY = 0;
    var startH = 0;
    sh.addEventListener('touchstart', function(e){
      /* only dismiss if touching handle area */
      var handle = sh.querySelector('.spk-t3-sheet-handle');
      if (!handle || !handle.contains(e.target)) return;
      startY = e.touches[0].clientY;
      startH = sh.getBoundingClientRect().height;
      _sheetDrag = true;
    }, {passive:true});
    sh.addEventListener('touchmove', function(e){
      if (!_sheetDrag) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 0) sh.style.transform = 'translateY(' + dy + 'px)';
    }, {passive:true});
    sh.addEventListener('touchend', function(e){
      if (!_sheetDrag) return;
      _sheetDrag = false;
      var dy = e.changedTouches[0].clientY - startY;
      if (dy > 80) {
        /* dismissed — treat as "next" */
        sh.style.transition = 'transform .25s ease';
        sh.style.transform = 'translateY(100%)';
        setTimeout(function(){ _idx < _steps.length-1 ? _render(_idx+1) : _finish(); }, 260);
      } else {
        sh.style.transform = '';
      }
    }, {passive:true});
  }

  /* ─────────────────────────────────────────────────────
     RENDER A STEP
  ───────────────────────────────────────────────────── */
  function _render(idx) {
    /* clean up previous step */
    _cleanStep();
    _idx = idx;
    var step   = _steps[idx];
    var mob    = _isMob();

    /* Switch mobile panel programmatically to reveal the element */
    if (mob && typeof window.openPanel === 'function') {
      var targetPanel = 'feed';
      if (step.id === 'trending') targetPanel = 'trends';
      else if (step.id === 'leaderboard') targetPanel = 'leaders';
      else if (step.id === 'chats') targetPanel = 'chats';
      else if (step.id === 'profile') targetPanel = 'profile';
      window.openPanel(targetPanel);
    }

    var selStr = mob ? step.elMob : step.el;
    var el     = null;
    if (selStr) { try { el = document.querySelector(selStr); } catch(e){} }

    /* Scroll target into view */
    if (el) el.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });

    var rect = null;
    if (el) {
      /* Give element a brief moment to settle after scroll */
      setTimeout(function() {
        rect = el.getBoundingClientRect();
        _liftTarget(el);
        _target = el;
        _placePanels(rect);
        _placeRing(rect);
        _raf = requestAnimationFrame(_trackLoop);
      }, 280);
    } else {
      _placePanels(null);
    }

    var isFirst = idx === 0;
    var isLast  = idx === _steps.length - 1;

    if (mob) {
      /* ── bottom sheet ── */
      _sheet = _buildSheet(step, isFirst, isLast, _steps.length, idx);
      document.body.appendChild(_sheet);
      requestAnimationFrame(function(){ _sheet.classList.add('open'); });
      _wireSheetSwipe(_sheet);
    } else {
      /* ── desktop tooltip ── */
      _tip = _buildTip(step, isFirst, isLast, _steps.length, idx);
      document.body.appendChild(_tip);
      /* position after a paint frame so dimensions are available */
      requestAnimationFrame(function(){
        var r2 = el ? el.getBoundingClientRect() : null;
        _positionTip(_tip, r2);
      });
    }
    _wireNav();
  }

  /* Remove current step's DOM additions (leave overlay panels — they fade out on step change) */
  function _cleanStep() {
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_target) { _dropTarget(_target); _target = null; }
    if (_tip)    { _tip.remove();    _tip   = null; }
    if (_sheet)  { _sheet.remove();  _sheet = null; }
  }

  /* ─────────────────────────────────────────────────────
     BUILD / DESTROY overlay scaffolding
  ───────────────────────────────────────────────────── */
  function _buildOverlay() {
    _overlay = document.createElement('div');
    _overlay.id = 'spk-tour3';

    _panels.top    = document.createElement('div');
    _panels.right  = document.createElement('div');
    _panels.bottom = document.createElement('div');
    _panels.left   = document.createElement('div');
    ['top','right','bottom','left'].forEach(function(k){
      _panels[k].className = 'spk-t3-panel';
      _overlay.appendChild(_panels[k]);
    });

    _ring = document.createElement('div');
    _ring.className = 'spk-t3-ring';
    document.body.appendChild(_ring);

    document.body.appendChild(_overlay);
  }

  function _destroyOverlay() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    if (_ring)    { _ring.remove();    _ring    = null; }
    _panels = {};
  }

  /* ─────────────────────────────────────────────────────
     FINISH / CLEANUP
  ───────────────────────────────────────────────────── */
  function _finish() {
    _mark();
    _cleanStep();

    /* fade out overlay */
    if (_overlay) {
      _overlay.style.transition = 'opacity .35s ease';
      _overlay.style.opacity = '0';
      setTimeout(_destroyOverlay, 380);
    } else {
      _destroyOverlay();
    }
    document.removeEventListener('keydown', _tourKey);
  }

  /* Keyboard: → next, ← prev, Esc skip */
  function _tourKey(e) {
    if (!_overlay) { document.removeEventListener('keydown',_tourKey); return; }
    if (e.key==='ArrowRight'||e.key==='Enter') { _idx<_steps.length-1 ? _render(_idx+1) : _finish(); }
    if (e.key==='ArrowLeft'&&_idx>0) _render(_idx-1);
    if (e.key==='Escape') _finish();
  }

  /* ─────────────────────────────────────────────────────
     PUBLIC API
  ───────────────────────────────────────────────────── */
  function launch() {
    if (_taken()) return;
    _css();
    _steps = _buildSteps();
    _idx   = 0;
    _buildOverlay();
    /* Defer render so app UI has fully painted */
    setTimeout(function(){
      _render(0);
      document.addEventListener('keydown', _tourKey);
    }, 1100);
  }

  function init()  { if (!_taken()) launch(); }
  function reset() { try{localStorage.removeItem(_TOUR_KEY);}catch(e){} }

  return { init:init, launch:launch, reset:reset };
})();
window.SparkTour = SparkTour;
