/* ═══════════════════════════════════════════════════════════════════
   SPARK — spark-onboarding.js   OnboardingEngine v1  (SPARK Edition)
   Приветственный гид 9 слайдов — показывается ДО экрана авторизации.
   Автономный модуль. Нет внешних зависимостей.

   АДАПТАЦИИ ДЛЯ SPARK:
   • Использует spark_ob3_seen (совместимо с onboarding.js Phase1)
   • Открывает SPARK Auth Modal через tabSU/tabSI
   • Учитывает spark-presession (активная сессия → пропустить)
   • Совместим с intro-анимацией SPARK (spark_intro_v1)
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Bilingual support ─── */
  var _lang = (function() { try { return localStorage.getItem('spark_lang') || 'ru'; } catch(e) { return 'ru'; } })();
  function _L(en, ru) { return _lang === 'en' ? en : ru; }
  function _setLang(l) {
    _lang = l;
    try { localStorage.setItem('spark_lang', l); } catch(e) {}
    if (window.LANG !== undefined) window.LANG = l;
    /* Keep the underlying auth screen (login / register / all sub-steps) in sync */
    _syncAppLang();
  }
  /* Re-translate the main app's static UI (auth screen + sub-steps) to match _lang.
     Light-weight: applyStaticI18n() is null-safe and re-renders all auth labels. */
  function _syncAppLang() {
    if (typeof window.applyStaticI18n === 'function') {
      try { window.applyStaticI18n(); } catch (e) {}
    }
  }

  /* ─── Ключи хранилища ─── */
  var OB_KEY    = 'spark_ob3_seen';  /* совместимо с onboarding.js Phase1 */
  var INTRO_KEY = 'spark_intro_v1';

  /* ─── Проверка: есть ли сессия или уже видел онбординг ─── */
  function hasSession() {
    /* SPARK использует класс spark-presession на <html> при наличии активной сессии */
    if (document.documentElement.classList.contains('spark-presession')) return true;
    try {
      var r = localStorage.getItem('spark_auth');
      if (r) {
        var d = JSON.parse(r);
        return d && d.expires_at && Math.floor(Date.now() / 1000) < d.expires_at;
      }
    } catch (e) {}
    return false;
  }
  function seenBefore()    { try { return !!localStorage.getItem(OB_KEY); } catch(e){ return false; } }

  window.PreRegOnboarding = {
    run: function () {
      if (hasSession() || seenBefore()) return;
      boot();
    }
  };

  /* ══════════════════════════════════════
     ДАННЫЕ СЛАЙДОВ
  ══════════════════════════════════════ */
  function buildSlides() {
    return [

      /* 1. WELCOME */
      {
        kicker : _L('Welcome','Добро пожаловать'),
        title  : _L('SPARK — Idea Exchange','SPARK — Биржа Идей'),
        desc   : _L('A place where innovators post startup ideas and investors back the best ones with SPK tokens in real time.','Место, где инноваторы публикуют стартап-идеи, а инвесторы поддерживают лучшие из них SPK-токенами в реальном времени.'),
        visual : buildWelcomeVisual()
      },

      /* 2. IDEA FEED */
      {
        kicker : _L('Feature 1 of 8','Функция 1 из 8'),
        title  : _L('Live Idea Feed','Живая лента идей'),
        desc   : _L('Explore startup concepts. Sort by <b>New</b>, <b>Popular</b>, <b>Profitable</b> or <b>Deadline</b>. Filter by tags: <b>#AI</b>, <b>#DeFi</b>, <b>#Web3</b>.','Открывайте стартап-концепции. Сортируйте по <b>Новым</b>, <b>Популярным</b>, <b>Выгодным</b> или <b>Дедлайну</b>. Фильтруйте по тегам: <b>#AI</b>, <b>#DeFi</b>, <b>#Web3</b>.'),
        visual : buildFeedVisual()
      },

      /* 3. INVEST */
      {
        kicker : _L('Feature 2 of 8','Функция 2 из 8'),
        title  : _L('Invest SPK Tokens','Инвестируйте SPK-токены'),
        desc   : _L('Back ideas you believe in. Hold the button for <b>2 seconds</b> to confirm securely. Your <b>SPK balance</b> is always in the header.','Поддержите идею, в которую верите. Удержите кнопку <b>2 секунды</b> для безопасного подтверждения. Ваш <b>SPK-баланс</b> всегда в шапке.'),
        visual : buildInvestVisual()
      },

      /* 4. POST IDEA */
      {
        kicker : _L('Feature 3 of 8','Функция 3 из 8'),
        title  : _L('Post Your Idea','Опубликуйте свою идею'),
        desc   : _L('Describe your concept, set a minimum bet and <b>duration</b>. The community votes with tokens — the more <b>SPK</b> in the pool, the stronger the market signal.','Опишите концепцию, установите минимальную ставку и <b>срок</b>. Сообщество проголосует токенами — чем больше <b>SPK</b> в пуле, тем выше рыночный сигнал.'),
        visual : buildPostVisual()
      },

      /* 5. LEADERBOARD */
      {
        kicker : _L('Feature 4 of 8','Функция 4 из 8'),
        title  : _L('Prophet Leaderboard','Топ Пророков'),
        desc   : _L('<b>Ranking</b> of top investors updated in real time. Back ideas early, earn profit, and <b>climb the top</b>.','<b>Рейтинг</b> лучших инвесторов обновляется в реальном времени. Вкладывайтесь в идеи раньше рынка, зарабатывайте прибыль и попадайте в <b>топ</b>.'),
        visual : buildLeaderVisual()
      },

      /* 6. OBSERVATORY */
      {
        kicker : _L('Feature 5 of 8','Функция 5 из 8'),
        title  : _L('Market Observatory','Обсерватория рынка'),
        desc   : _L('Interactive orbital map: <b>Technology</b> (AI, SaaS, Web3), <b>Ecology</b> (Solar, Energy) and Society. Track where the idea market is heading.','Интерактивная орбитальная карта: <b>Технологии</b> (AI, SaaS, Web3), <b>Экология</b> (Solar, Energy) и Общество. Следите, куда движется рынок идей.'),
        visual : buildObsVisual()
      },

      /* 7. CHATS */
      {
        kicker : _L('Feature 6 of 8','Функция 6 из 8'),
        title  : _L('SPARK Chats','SPARK Чаты'),
        desc   : _L('Direct messages to idea authors. Team channels: <b>DeFi Prophets</b>, <b>AI Signals</b>, <b>SPARK Devs</b>. Real-time online status.','Личные сообщения авторам идей. Командные каналы: <b>DeFi Prophets</b>, <b>AI Signals</b>, <b>SPARK Devs</b>. Онлайн-статус в реальном времени.'),
        visual : buildChatsVisual()
      },

      /* 8. THEMES */
      {
        kicker : _L('Feature 7 of 8','Функция 7 из 8'),
        title  : _L('16 Themes','16 Тем оформления'),
        desc   : _L('<b>Cosmos</b>, <b>Cyberpunk</b>, <b>Neon</b>, <b>Aurora</b> and 12 more presets. Or create your own palette in the <b>Theme Studio</b> — make SPARK yours.','<b>Cosmos</b>, <b>Cyberpunk</b>, <b>Neon</b>, <b>Aurora</b> и 12 других пресетов. Или создайте собственную палитру в <b>Студии Тем</b> — SPARK будет вашим.'),
        visual : buildThemeVisual()
      },

      /* 8.5 ACHIEVEMENTS */
      {
        kicker : _L('Feature 8 of 8','Функция 8 из 8'),
        title  : _L('🏆 Achievements & Bonuses','🏆 Достижения и бонусы'),
        desc   : _L('Complete missions to earn <b>bonus SPK</b>: fill your profile <b>+100</b>, post 5 ideas <b>+100</b>, share a link on social media <b>+50</b>. Up to <b>+250 SPK</b> for free.','Выполняйте задания и зарабатывайте <b>бонусный SPK</b>: заполните профиль <b>+100</b>, опубликуйте 5 идей <b>+100</b>, поделитесь ссылкой в соцсетях <b>+50</b>. Всего до <b>+250 SPK</b> бесплатно.'),
        visual : buildAchievementsVisual()
      },

      /* 9. CTA */
      {
        kicker : _L('Ready','Всё готово'),
        title  : _L('Ready to spark an idea?','Готов разжечь искру?'),
        desc   : _L('Registration takes <b>30 seconds</b>. Post ideas, invest <b>SPK</b> and join the idea exchange of the future.','Регистрация занимает <b>30 секунд</b>. Публикуйте идеи, инвестируйте <b>SPK</b> и становитесь частью биржи идей будущего.'),
        visual : buildCtaVisual(),
        isCta  : true
      }
    ];
  }
  var SLIDES = buildSlides();

  /* ══════════════════════════════════════
     ВИЗУАЛЫ (SVG)
  ══════════════════════════════════════ */

  function buildWelcomeVisual() {
    return '<div class="ob-vis ob-vis-welcome">' +
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="obG1" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#9B5FFF"/>' +
            '<stop offset="50%" stop-color="#E85AA0"/>' +
            '<stop offset="100%" stop-color="#E8C55A"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<circle class="ob-ring ob-r1" cx="100" cy="100" r="78" fill="none" stroke="rgba(155,95,255,0.15)" stroke-width="1"/>' +
        '<circle class="ob-ring ob-r2" cx="100" cy="100" r="60" fill="none" stroke="rgba(232,90,160,0.12)" stroke-width="0.8"/>' +
        '<path class="ob-spark-s" d="M70 46C130 46 144 82 100 100C56 118 68 154 130 154" stroke="url(#obG1)" stroke-width="14" stroke-linecap="round" fill="none"/>' +
        '<circle class="ob-dot-top" cx="70" cy="46" r="8" fill="#9B5FFF"/>' +
        '<circle class="ob-dot-bot" cx="130" cy="154" r="8" fill="#E8C55A"/>' +
        '<circle class="ob-star"  cx="160" cy="55"  r="3" fill="#E8C55A" opacity="0.7"/>' +
        '<circle class="ob-star2" cx="40"  cy="148" r="2" fill="#5AE8C5" opacity="0.6"/>' +
        '<circle class="ob-star3" cx="155" cy="145" r="2" fill="#9B5FFF" opacity="0.5"/>' +
        '<circle class="ob-star4" cx="42"  cy="58"  r="2" fill="#E85AA0" opacity="0.6"/>' +
      '</svg>' +
    '</div>';
  }

  function buildFeedVisual() {
    return '<div class="ob-vis ob-vis-feed">' +
      '<svg viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="10" y="8"   width="200" height="50" rx="8" fill="rgba(123,92,250,0.08)" stroke="rgba(123,92,250,0.25)" stroke-width="1"/>' +
        '<rect x="20" y="18"  width="80"  height="6"  rx="3" fill="rgba(238,240,255,0.7)"/>' +
        '<rect x="20" y="30"  width="120" height="4"  rx="2" fill="rgba(110,112,153,0.5)"/>' +
        '<text x="178" y="30" fill="#E8C55A" font-size="9" font-family="Syne,sans-serif" font-weight="700">+1 240 SPK</text>' +
        '<rect x="130" y="18" width="70"  height="16" rx="4" fill="rgba(123,92,250,0.12)"/>' +
        '<rect class="ob-bar ob-bar1" x="130" y="18" width="0" height="16" rx="4" fill="rgba(123,92,250,0.55)"/>' +

        '<rect x="10" y="68"  width="200" height="50" rx="8" fill="rgba(90,232,197,0.06)" stroke="rgba(90,232,197,0.2)" stroke-width="1"/>' +
        '<rect x="20" y="78"  width="100" height="6"  rx="3" fill="rgba(238,240,255,0.7)"/>' +
        '<rect x="20" y="90"  width="90"  height="4"  rx="2" fill="rgba(110,112,153,0.5)"/>' +
        '<text x="178" y="90" fill="#5AE8C5" font-size="9" font-family="Syne,sans-serif" font-weight="700">+892 SPK</text>' +
        '<rect x="130" y="78" width="70"  height="16" rx="4" fill="rgba(90,232,197,0.1)"/>' +
        '<rect class="ob-bar ob-bar2" x="130" y="78" width="0" height="16" rx="4" fill="rgba(90,232,197,0.45)"/>' +

        '<rect x="10" y="128" width="200" height="38" rx="8" fill="rgba(232,90,160,0.06)" stroke="rgba(232,90,160,0.18)" stroke-width="1"/>' +
        '<rect x="20" y="138" width="75"  height="5"  rx="2" fill="rgba(238,240,255,0.6)"/>' +
        '<text x="178" y="150" fill="#E85AA0" font-size="9" font-family="Syne,sans-serif" font-weight="700">+340 SPK</text>' +
        '<rect x="130" y="138" width="70" height="16" rx="4" fill="rgba(232,90,160,0.08)"/>' +
        '<rect class="ob-bar ob-bar3" x="130" y="138" width="0" height="16" rx="4" fill="rgba(232,90,160,0.4)"/>' +
      '</svg>' +
    '</div>';
  }

  function buildInvestVisual() {
    return '<div class="ob-vis ob-vis-invest">' +
      '<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="obGCoin" x1="0%" y1="0%" x2="0%" y2="100%">' +
            '<stop offset="0%" stop-color="#F0D070"/>' +
            '<stop offset="100%" stop-color="#C8930A"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect x="20" y="8"   width="160" height="100" rx="14" fill="rgba(232,197,90,0.06)" stroke="rgba(232,197,90,0.22)" stroke-width="1"/>' +
        '<rect x="130" y="4"  width="60"  height="28"  rx="8"  fill="rgba(232,197,90,0.1)"  stroke="rgba(232,197,90,0.3)"  stroke-width="0.8"/>' +
        '<rect x="142" y="16" width="36"  height="4"   rx="2"  fill="rgba(232,197,90,0.6)"/>' +
        '<circle class="ob-coin" cx="100" cy="58" r="30" fill="url(#obGCoin)" opacity="0.9"/>' +
        '<circle cx="100" cy="58" r="24" fill="none" stroke="rgba(200,147,10,0.3)" stroke-width="1"/>' +
        '<text x="100" y="55" text-anchor="middle" fill="#05060F" font-size="8" font-family="Syne,sans-serif" font-weight="800" letter-spacing="1">SPK</text>' +
        '<text x="100" y="66" text-anchor="middle" fill="rgba(5,6,15,0.6)" font-size="7" font-family="Syne,sans-serif">TOKEN</text>' +
        '<text x="100" y="108" text-anchor="middle" fill="#E8C55A" font-size="13" font-family="Syne,sans-serif" font-weight="700">4 520 SPK</text>' +
        '<text x="100" y="120" text-anchor="middle" fill="rgba(110,112,153,0.8)" font-size="8" font-family="DM Sans,sans-serif">' + _L('Your balance','Ваш баланс') + '</text>' +
        '<rect x="20" y="136" width="160" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>' +
        '<rect class="ob-slider-fill" x="20" y="136" width="96" height="6" rx="3" fill="url(#obGCoin)" opacity="0.75"/>' +
        '<circle class="ob-slider-knob" cx="116" cy="139" r="9" fill="#E8C55A" stroke="rgba(5,6,15,0.9)" stroke-width="2"/>' +
        '<rect x="50" y="152" width="100" height="16" rx="8" fill="rgba(232,197,90,0.15)" stroke="rgba(232,197,90,0.4)" stroke-width="1"/>' +
        '<text x="100" y="163" text-anchor="middle" fill="#E8C55A" font-size="7" font-family="Syne,sans-serif" font-weight="700">' + _L('Hold to invest','Удерживайте для вложения') + '</text>' +
      '</svg>' +
    '</div>';
  }

  function buildPostVisual() {
    return '<div class="ob-vis ob-vis-post">' +
      '<svg viewBox="0 0 210 170" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="obGPost" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#9B5FFF"/>' +
            '<stop offset="100%" stop-color="#E85AA0"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect x="15" y="6" width="180" height="158" rx="14" fill="rgba(5,6,15,0.95)" stroke="rgba(123,92,250,0.35)" stroke-width="1"/>' +
        '<rect x="15" y="6" width="180" height="32" rx="14" fill="rgba(123,92,250,0.08)"/>' +
        '<rect x="15" y="30" width="180" height="8" fill="rgba(123,92,250,0.08)"/>' +
        '<text x="105" y="26" text-anchor="middle" fill="rgba(238,240,255,0.9)" font-size="10" font-family="Syne,sans-serif" font-weight="700">' + _L('New Idea 💡','Новая идея 💡') + '</text>' +
        '<rect x="28" y="46" width="154" height="22" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>' +
        '<text x="36" y="56" fill="rgba(110,112,153,0.7)" font-size="7" font-family="DM Sans,sans-serif">' + _L('Title','Заголовок') + '</text>' +
        '<rect class="ob-cursor" x="36" y="60" width="1" height="8" rx="1" fill="rgba(155,95,255,0.8)"/>' +
        '<rect x="28" y="74" width="154" height="36" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>' +
        '<text x="36" y="85" fill="rgba(110,112,153,0.5)" font-size="7" font-family="DM Sans,sans-serif">' + _L('Describe your idea...','Опишите вашу идею...') + '</text>' +
        '<text x="28" y="122" fill="rgba(110,112,153,0.7)" font-size="7" font-family="DM Sans,sans-serif">' + _L('Duration','Срок') + '</text>' +
        '<rect x="28" y="128" width="34" height="14" rx="5" fill="rgba(123,92,250,0.25)" stroke="rgba(123,92,250,0.6)" stroke-width="0.8"/>' +
        '<text x="45" y="138" text-anchor="middle" fill="#9B7CFF" font-size="7" font-family="Syne,sans-serif" font-weight="700">' + _L('24h','24ч') + '</text>' +
        '<rect x="68" y="128" width="34" height="14" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>' +
        '<text x="85" y="138" text-anchor="middle" fill="rgba(110,112,153,0.7)" font-size="7" font-family="Syne,sans-serif">' + _L('7d','7д') + '</text>' +
        '<rect x="108" y="128" width="34" height="14" rx="5" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>' +
        '<text x="125" y="138" text-anchor="middle" fill="rgba(110,112,153,0.5)" font-size="7" font-family="Syne,sans-serif">30д 👑</text>' +
        '<rect x="28" y="150" width="154" height="8" rx="4" fill="url(#obGPost)" opacity="0.85"/>' +
      '</svg>' +
    '</div>';
  }

  function buildLeaderVisual() {
    return '<div class="ob-vis ob-vis-leader">' +
      '<svg viewBox="0 0 200 175" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M82 8H118V52C118 68 108 78 100 82C92 78 82 68 82 52Z" fill="rgba(232,197,90,0.18)" stroke="rgba(232,197,90,0.5)" stroke-width="1.2" fill-rule="evenodd"/>' +
        '<path d="M82 22H68C68 38 76 48 82 52V22Z" fill="rgba(232,197,90,0.1)" stroke="rgba(232,197,90,0.3)" stroke-width="0.8"/>' +
        '<path d="M118 22H132C132 38 124 48 118 52V22Z" fill="rgba(232,197,90,0.1)" stroke="rgba(232,197,90,0.3)" stroke-width="0.8"/>' +
        '<rect x="94" y="82" width="12" height="18" rx="0" fill="rgba(232,197,90,0.25)" stroke="rgba(232,197,90,0.4)" stroke-width="0.8"/>' +
        '<rect x="82" y="98" width="36" height="6" rx="3" fill="rgba(232,197,90,0.35)" stroke="rgba(232,197,90,0.5)" stroke-width="0.8"/>' +
        '<text x="100" y="62" text-anchor="middle" fill="#E8C55A" font-size="16" font-family="Syne,sans-serif">★</text>' +
        '<rect class="ob-pod ob-pod2" x="30"  y="175" width="44" height="0" rx="4" fill="rgba(155,95,255,0.5)"  stroke="rgba(155,95,255,0.4)"  stroke-width="0.8"/>' +
        '<text x="52"  y="124" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="7" font-family="Syne,sans-serif" font-weight="700">@nova</text>' +
        '<text x="52"  y="134" text-anchor="middle" fill="rgba(155,95,255,0.8)"  font-size="7" font-family="Syne,sans-serif">3 840 SPK</text>' +
        '<text x="52"  y="147" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="11" font-family="Syne,sans-serif">2</text>' +
        '<rect class="ob-pod ob-pod1" x="78"  y="175" width="44" height="0" rx="4" fill="rgba(232,197,90,0.45)" stroke="rgba(232,197,90,0.5)"  stroke-width="0.8"/>' +
        '<text x="100" y="124" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="7" font-family="Syne,sans-serif" font-weight="700">@kira</text>' +
        '<text x="100" y="134" text-anchor="middle" fill="#E8C55A"              font-size="7" font-family="Syne,sans-serif">9 120 SPK</text>' +
        '<text x="100" y="147" text-anchor="middle" fill="rgba(238,240,255,0.7)" font-size="11" font-family="Syne,sans-serif">1</text>' +
        '<rect class="ob-pod ob-pod3" x="126" y="175" width="44" height="0" rx="4" fill="rgba(90,232,197,0.35)" stroke="rgba(90,232,197,0.35)" stroke-width="0.8"/>' +
        '<text x="148" y="124" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="7" font-family="Syne,sans-serif" font-weight="700">@rex</text>' +
        '<text x="148" y="134" text-anchor="middle" fill="rgba(90,232,197,0.8)"  font-size="7" font-family="Syne,sans-serif">2 560 SPK</text>' +
        '<text x="148" y="147" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="11" font-family="Syne,sans-serif">3</text>' +
      '</svg>' +
    '</div>';
  }

  function buildObsVisual() {
    return '<div class="ob-vis ob-vis-obs">' +
      '<svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="obGObs" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#9B5FFF"/>' +
            '<stop offset="100%" stop-color="#E8C55A"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<circle cx="100" cy="90" r="14" fill="url(#obGObs)" opacity="0.9"/>' +
        '<circle cx="100" cy="90" r="18" fill="none" stroke="rgba(232,197,90,0.2)" stroke-width="1"/>' +
        '<ellipse cx="100" cy="90" rx="42" ry="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>' +
        '<ellipse cx="100" cy="90" rx="72" ry="48" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>' +
        '<circle cx="100" cy="90" r="85" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="0.8"/>' +
        '<circle class="ob-planet1"  cx="142" cy="90" r="6" fill="#5AE8C5"/>' +
        '<text   class="ob-planet1"  x="153" y="86" fill="rgba(90,232,197,0.8)"  font-size="6" font-family="Syne,sans-serif">AI</text>' +
        '<circle class="ob-planet1b" cx="58"  cy="90" r="5" fill="#9B5FFF" opacity="0.8"/>' +
        '<text   class="ob-planet1b" x="35"  y="86" fill="rgba(155,95,255,0.8)" font-size="6" font-family="Syne,sans-serif">SaaS</text>' +
        '<circle class="ob-planet2"  cx="172" cy="90" r="7" fill="#E8C55A"/>' +
        '<text   class="ob-planet2"  x="184" y="86" fill="rgba(232,197,90,0.8)" font-size="6" font-family="Syne,sans-serif">DeFi</text>' +
        '<circle class="ob-planet2b" cx="28"  cy="90" r="5" fill="#E85AA0" opacity="0.85"/>' +
        '<text   class="ob-planet2b" x="3"   y="86" fill="rgba(232,90,160,0.8)" font-size="6" font-family="Syne,sans-serif">Solar</text>' +
        '<text x="100" y="16"  text-anchor="middle" fill="rgba(155,95,255,0.7)"  font-size="7" font-family="Syne,sans-serif" font-weight="700" letter-spacing="2">' + _L('TECHNOLOGY','ТЕХНОЛОГИИ') + '</text>' +
        '<text x="100" y="170" text-anchor="middle" fill="rgba(90,232,197,0.7)"  font-size="7" font-family="Syne,sans-serif" font-weight="700" letter-spacing="2">' + _L('ECOLOGY','ЭКОЛОГИЯ') + '</text>' +
        '<text x="180" y="96"  text-anchor="middle" fill="rgba(232,197,90,0.7)"  font-size="7" font-family="Syne,sans-serif" font-weight="700" letter-spacing="1">WEB3</text>' +
      '</svg>' +
    '</div>';
  }

  function buildChatsVisual() {
    return '<div class="ob-vis ob-vis-chats">' +
      '<svg viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="8" y="8" width="60" height="154" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" stroke-width="0.8"/>' +
        '<text x="38" y="24" text-anchor="middle" fill="rgba(238,240,255,0.5)" font-size="7" font-family="Syne,sans-serif" font-weight="700">' + _L('SPARK Chats','SPARK Чаты') + '</text>' +
        '<rect x="14" y="32" width="48" height="16" rx="5" fill="rgba(123,92,250,0.2)" stroke="rgba(123,92,250,0.4)" stroke-width="0.5"/>' +
        '<circle cx="22" cy="40" r="4" fill="rgba(155,95,255,0.6)"/>' +
        '<rect x="28" y="38" width="24" height="3" rx="1.5" fill="rgba(238,240,255,0.5)"/>' +
        '<circle cx="56" cy="40" r="3" fill="#5AE8C5"/>' +
        '<rect x="14" y="52" width="48" height="16" rx="5" fill="rgba(255,255,255,0.02)"/>' +
        '<circle cx="22" cy="60" r="4" fill="rgba(232,197,90,0.4)"/>' +
        '<rect x="28" y="58" width="18" height="3" rx="1.5" fill="rgba(110,112,153,0.4)"/>' +
        '<rect x="14" y="72" width="48" height="16" rx="5" fill="rgba(255,255,255,0.02)"/>' +
        '<circle cx="22" cy="80" r="4" fill="rgba(90,232,197,0.4)"/>' +
        '<rect x="28" y="78" width="22" height="3" rx="1.5" fill="rgba(110,112,153,0.4)"/>' +
        '<text x="14" y="102" fill="rgba(110,112,153,0.6)" font-size="6" font-family="Syne,sans-serif" font-weight="700" letter-spacing="1">' + _L('CHANNELS','КАНАЛЫ') + '</text>' +
        '<rect x="14" y="106" width="48" height="12" rx="4" fill="rgba(255,255,255,0.02)"/>' +
        '<text x="20" y="115" fill="rgba(110,112,153,0.5)" font-size="6" font-family="DM Sans,sans-serif"># defi-prophets</text>' +
        '<rect x="14" y="121" width="48" height="12" rx="4" fill="rgba(255,255,255,0.02)"/>' +
        '<text x="20" y="130" fill="rgba(110,112,153,0.5)" font-size="6" font-family="DM Sans,sans-serif"># ai-signals</text>' +
        '<rect x="74" y="8" width="138" height="154" rx="10" fill="rgba(5,6,15,0.6)" stroke="rgba(255,255,255,0.05)" stroke-width="0.8"/>' +
        '<rect class="ob-msg1" x="82" y="24" width="80" height="26" rx="8" fill="rgba(123,92,250,0.2)" stroke="rgba(123,92,250,0.3)" stroke-width="0.5"/>' +
        '<rect x="82" y="30" width="60" height="4" rx="2" fill="rgba(238,240,255,0.4)"/>' +
        '<rect x="82" y="38" width="40" height="3" rx="1.5" fill="rgba(110,112,153,0.4)"/>' +
        '<rect class="ob-msg2" x="134" y="60" width="74" height="26" rx="8" fill="rgba(232,197,90,0.12)" stroke="rgba(232,197,90,0.3)" stroke-width="0.5"/>' +
        '<rect x="142" y="66" width="55" height="4" rx="2" fill="rgba(238,240,255,0.4)"/>' +
        '<rect x="142" y="74" width="36" height="3" rx="1.5" fill="rgba(110,112,153,0.4)"/>' +
        '<rect x="82" y="102" width="50" height="18" rx="8" fill="rgba(123,92,250,0.1)" stroke="rgba(123,92,250,0.2)" stroke-width="0.5"/>' +
        '<circle class="ob-td1" cx="98"  cy="111" r="3" fill="rgba(155,95,255,0.7)"/>' +
        '<circle class="ob-td2" cx="107" cy="111" r="3" fill="rgba(155,95,255,0.7)"/>' +
        '<circle class="ob-td3" cx="116" cy="111" r="3" fill="rgba(155,95,255,0.7)"/>' +
        '<rect x="82" y="148" width="122" height="10" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>' +
        '<rect x="88" y="151" width="40" height="4" rx="2" fill="rgba(110,112,153,0.3)"/>' +
        '<circle cx="198" cy="153" r="5" fill="rgba(123,92,250,0.4)"/>' +
      '</svg>' +
    '</div>';
  }

  function buildThemeVisual() {
    var colors = [
      '#7B5CFA','#3B82F6','#F97316','#22C55E',
      '#F43F5E','#06B6D4','#8B5CF6','#D97706',
      '#00F260','#8B5CF6','#FF5E62','#4F46E5',
      '#EC4899','#F59E0B','#A855F7','#10B981'
    ];
    var labels = ['Cosmos','Ocean','Ember','Forest','Rose','Arctic','Void','Gold','Aurora','Cyber','Sunset','Nebula','Neon','Flare','Magic','Prism'];
    var circles = '';
    for (var i = 0; i < 16; i++) {
      var col = i % 4;
      var row = Math.floor(i / 4);
      var cx = 28 + col * 46;
      var cy = 30 + row * 38;
      circles += '<circle class="ob-tc" cx="' + cx + '" cy="' + cy + '" r="14" fill="' + colors[i] + '" opacity="0.85" style="animation-delay:' + (i * 0.06) + 's"/>';
      if (i === 0) { circles += '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="none" stroke="' + colors[i] + '" stroke-width="1.5" opacity="0.4"/>'; }
      circles += '<text x="' + cx + '" y="' + (cy + 22) + '" text-anchor="middle" fill="rgba(110,112,153,0.6)" font-size="5.5" font-family="Syne,sans-serif">' + labels[i] + '</text>';
    }
    return '<div class="ob-vis ob-vis-theme">' +
      '<svg viewBox="0 0 200 172" xmlns="http://www.w3.org/2000/svg">' +
        circles +
        '<path d="M174 86C174 100 170 114 164 124" fill="none" stroke="rgba(155,95,255,0.3)" stroke-width="12" stroke-linecap="round"/>' +
        '<text x="185" y="95" fill="rgba(155,95,255,0.5)" font-size="20" font-family="Syne,sans-serif">🎨</text>' +
      '</svg>' +
    '</div>';
  }

  function buildAchievementsVisual() {
    return '<div class="ob-vis ob-vis-ach">' +
      '<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<linearGradient id="obGAch1" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#E8C55A"/>' +
            '<stop offset="100%" stop-color="#FF8C00"/>' +
          '</linearGradient>' +
          '<linearGradient id="obGAch2" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#7B5CFA"/>' +
            '<stop offset="100%" stop-color="#5AE8C5"/>' +
          '</linearGradient>' +
          '<filter id="obGlow">' +
            '<feGaussianBlur stdDeviation="2.5" result="blur"/>' +
            '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
        '</defs>' +

        /* Card 1 — fill_profile (+100) */
        '<g class="ob-ach-card ob-ach-c1">' +
          '<rect x="12" y="10" width="196" height="44" rx="10" fill="rgba(232,197,90,0.07)" stroke="rgba(232,197,90,0.3)" stroke-width="1"/>' +
          '<text x="28" y="30" fill="rgba(238,240,255,0.85)" font-size="10" font-family="Syne,sans-serif" font-weight="700">👤 ' + _L('Complete Profile','Заполненный профиль') + '</text>' +
          '<text x="28" y="44" fill="rgba(110,112,153,0.8)" font-size="8" font-family="DM Sans,sans-serif">' + _L('Set nickname & fill Bio','Укажите ник и заполните Bio') + '</text>' +
          '<rect x="163" y="17" width="36" height="18" rx="6" fill="rgba(232,197,90,0.15)" stroke="rgba(232,197,90,0.4)" stroke-width="1"/>' +
          '<text x="181" y="30" fill="#E8C55A" font-size="9" font-family="Syne,sans-serif" font-weight="800" text-anchor="middle">+100</text>' +
          /* Checkmark появляется */
          '<circle class="ob-ach-check ob-ach-chk1" cx="148" cy="26" r="8" fill="rgba(90,232,197,0.15)" stroke="rgba(90,232,197,0.5)" stroke-width="1"/>' +
          '<path class="ob-ach-check ob-ach-chk1" d="M144 26 l3 3 l5-5" stroke="#5AE8C5" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
        '</g>' +

        /* Card 2 — create_5_ideas (+100) */
        '<g class="ob-ach-card ob-ach-c2">' +
          '<rect x="12" y="63" width="196" height="44" rx="10" fill="rgba(123,92,250,0.07)" stroke="rgba(123,92,250,0.25)" stroke-width="1"/>' +
          '<text x="28" y="83" fill="rgba(238,240,255,0.85)" font-size="10" font-family="Syne,sans-serif" font-weight="700">💡 ' + _L('Startup Generator','Генератор стартапов') + '</text>' +
          '<text x="28" y="97" fill="rgba(110,112,153,0.8)" font-size="8" font-family="DM Sans,sans-serif">' + _L('Post 5 ideas on the platform','Опубликуйте 5 идей на платформе') + '</text>' +
          /* Progress bar */
          '<rect x="28" y="102" width="100" height="3" rx="2" fill="rgba(255,255,255,0.07)"/>' +
          '<rect class="ob-ach-prog" x="28" y="102" width="0" height="3" rx="2" fill="url(#obGAch2)"/>' +
          '<rect x="163" y="70" width="36" height="18" rx="6" fill="rgba(123,92,250,0.12)" stroke="rgba(123,92,250,0.35)" stroke-width="1"/>' +
          '<text x="181" y="83" fill="#9B7CFF" font-size="9" font-family="Syne,sans-serif" font-weight="800" text-anchor="middle">+100</text>' +
        '</g>' +

        /* Card 3 — adv_repost (+50) */
        '<g class="ob-ach-card ob-ach-c3">' +
          '<rect x="12" y="116" width="196" height="44" rx="10" fill="rgba(90,232,197,0.06)" stroke="rgba(90,232,197,0.2)" stroke-width="1"/>' +
          '<text x="28" y="136" fill="rgba(238,240,255,0.85)" font-size="10" font-family="Syne,sans-serif" font-weight="700">📢 ' + _L('SPARK Ambassador','Амбассадор SPARK') + '</text>' +
          '<text x="28" y="150" fill="rgba(110,112,153,0.8)" font-size="8" font-family="DM Sans,sans-serif">' + _L('Share a link on social media','Поделитесь ссылкой в соцсетях') + '</text>' +
          '<rect x="163" y="123" width="36" height="18" rx="6" fill="rgba(90,232,197,0.08)" stroke="rgba(90,232,197,0.3)" stroke-width="1"/>' +
          '<text x="181" y="136" fill="#5AE8C5" font-size="9" font-family="Syne,sans-serif" font-weight="800" text-anchor="middle">+50</text>' +
        '</g>' +

        /* Итоговый бейдж внизу */
        '<g class="ob-ach-total">' +
          '<rect x="55" y="170" width="110" height="14" rx="7" fill="rgba(232,197,90,0.12)" stroke="rgba(232,197,90,0.4)" stroke-width="1" filter="url(#obGlow)"/>' +
          '<text x="110" y="181" fill="#E8C55A" font-size="9" font-family="Syne,sans-serif" font-weight="800" text-anchor="middle">' + _L('Up to +250 SPK total 🏆','Итого до +250 SPK 🏆') + '</text>' +
        '</g>' +

        /* Частицы */
        '<circle class="ob-ach-p1" cx="198" cy="58"  r="2.5" fill="#E8C55A" opacity="0"/>' +
        '<circle class="ob-ach-p2" cx="15"  cy="115" r="2"   fill="#9B7CFF" opacity="0"/>' +
        '<circle class="ob-ach-p3" cx="205" cy="140" r="2"   fill="#5AE8C5" opacity="0"/>' +
        '<circle class="ob-ach-p4" cx="8"   cy="62"  r="1.5" fill="#E8C55A" opacity="0"/>' +
      '</svg>' +
    '</div>';
  }

  function buildCtaVisual() {
    return '<div class="ob-vis ob-vis-cta">' +
      '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<radialGradient id="obGCta" cx="50%" cy="50%" r="50%">' +
            '<stop offset="0%" stop-color="rgba(123,92,250,0.3)"/>' +
            '<stop offset="100%" stop-color="rgba(5,6,15,0)"/>' +
          '</radialGradient>' +
          '<linearGradient id="obGCtaS" x1="0%" y1="0%" x2="100%" y2="100%">' +
            '<stop offset="0%" stop-color="#9B5FFF"/>' +
            '<stop offset="50%" stop-color="#E85AA0"/>' +
            '<stop offset="100%" stop-color="#E8C55A"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<circle cx="100" cy="100" r="90" fill="url(#obGCta)"/>' +
        '<circle class="ob-cta-ring ob-cr1" cx="100" cy="100" r="70" fill="none" stroke="rgba(155,95,255,0.12)" stroke-width="1"/>' +
        '<circle class="ob-cta-ring ob-cr2" cx="100" cy="100" r="52" fill="none" stroke="rgba(232,90,160,0.1)"  stroke-width="1"/>' +
        '<circle class="ob-cta-ring ob-cr3" cx="100" cy="100" r="36" fill="none" stroke="rgba(232,197,90,0.12)" stroke-width="1"/>' +
        '<path class="ob-spark-s ob-cta-s" d="M70 46C130 46 144 82 100 100C56 118 68 154 130 154" stroke="url(#obGCtaS)" stroke-width="12" stroke-linecap="round" fill="none"/>' +
        '<circle cx="70"  cy="46"  r="7" fill="#9B5FFF"/>' +
        '<circle cx="130" cy="154" r="7" fill="#E8C55A"/>' +
        '<path class="ob-sp1" d="M156 44L158 38L160 44L166 46L160 48L158 54L156 48L150 46Z" fill="#E8C55A" opacity="0.7"/>' +
        '<path class="ob-sp2" d="M38 134L39.5 130L41 134L45 135.5L41 137L39.5 141L38 137L34 135.5Z" fill="#9B5FFF" opacity="0.6"/>' +
        '<path class="ob-sp3" d="M160 140L161 137L162 140L165 141L162 142L161 145L160 142L157 141Z" fill="#5AE8C5" opacity="0.5"/>' +
        '<circle cx="45"  cy="55"  r="2" fill="#E85AA0" opacity="0.5"/>' +
        '<circle cx="158" cy="112" r="2" fill="#5AE8C5"  opacity="0.4"/>' +
        '<circle cx="36"  cy="100" r="1.5" fill="#E8C55A" opacity="0.5"/>' +
      '</svg>' +
    '</div>';
  }

  /* ══════════════════════════════════════
     СОСТОЯНИЕ
  ══════════════════════════════════════ */
  var state = { current: 0, total: SLIDES.length, overlay: null };

  /* ══════════════════════════════════════
     ОТКРЫТИЕ AUTH (SPARK)
  ══════════════════════════════════════ */
  function openAuth(tab) {
    /* Открываем SPARK Auth Modal */
    document.documentElement.classList.add('auth-active');
    var as = document.getElementById('authScreen');
    if (as) as.classList.remove('gone');
    /* Make sure the auth screen reflects the language chosen during onboarding */
    _syncAppLang();
    setTimeout(function() {
      var tabId = (tab === 'signin') ? 'tabSI' : 'tabSU';
      var t = document.getElementById(tabId);
      if (t) t.click();
    }, 120);
  }

  /* ══════════════════════════════════════
     ПОСТРОЕНИЕ DOM
  ══════════════════════════════════════ */
  function boot() {
    /* Дополнительная проверка при старте */
    if (hasSession() || seenBefore()) return;

    var overlay = document.createElement('div');
    overlay.className = 'ob-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', _L('SPARK — welcome guide','SPARK — приветственный гид'));

    /* Stars background */
    overlay.appendChild(buildStars());

    /* Ambient orbs */
    var orb1 = document.createElement('div');
    orb1.className = 'ob-orb ob-orb-1';
    overlay.appendChild(orb1);
    var orb2 = document.createElement('div');
    orb2.className = 'ob-orb ob-orb-2';
    overlay.appendChild(orb2);

    /* Card */
    var card = document.createElement('div');
    card.className = 'ob-card';

    /* Skip */
    var skip = document.createElement('button');
    skip.className = 'ob-skip';
    skip.textContent = _L('Skip','Пропустить');
    skip.setAttribute('aria-label', _L('Skip welcome guide','Пропустить приветственный гид'));
    skip.addEventListener('click', function() { finish('signup'); });
    card.appendChild(skip);

    /* Language switcher */
    var langSwitch = document.createElement('div');
    langSwitch.className = 'ob-lang-switch';
    langSwitch.id = 'obLangSwitch';
    langSwitch.innerHTML = '<button class="ob-lang-btn' + (_lang === 'ru' ? ' ob-lang-active' : '') + '" data-lang="ru">RU</button>' +
      '<span class="ob-lang-sep">|</span>' +
      '<button class="ob-lang-btn' + (_lang === 'en' ? ' ob-lang-active' : '') + '" data-lang="en">EN</button>';
    langSwitch.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-lang]');
      if (!btn) return;
      var l = btn.dataset.lang;
      if (l === _lang) return;
      _setLang(l);
      SLIDES = buildSlides();
      /* Re-render current slide */
      var wrap = document.getElementById('obSlidesWrap');
      if (wrap) { wrap.innerHTML = ''; renderSlide(state.current, null); }
      /* Update lang buttons */
      document.querySelectorAll('.ob-lang-btn').forEach(function(b) {
        b.classList.toggle('ob-lang-active', b.dataset.lang === l);
      });
      /* Update skip/nav text */
      var skipBtn = document.querySelector('.ob-skip');
      if (skipBtn) skipBtn.textContent = _L('Skip','Пропустить');
      var backBtn = document.getElementById('obBtnBack');
      if (backBtn) backBtn.textContent = _L('← Back','← Назад');
      var nextBtn = document.getElementById('obBtnNext');
      if (nextBtn && nextBtn.style.display !== 'none') {
        var isSecondToLast = state.current === SLIDES.length - 2;
        nextBtn.textContent = isSecondToLast ? _L('To finale 🎉','К финалу 🎉') : _L('Next →','Далее →');
      }
    });
    card.appendChild(langSwitch);

    /* Progress dots */
    var prog = document.createElement('div');
    prog.className = 'ob-progress';
    prog.setAttribute('aria-label', 'Прогресс');
    for (var i = 0; i < SLIDES.length; i++) {
      var dot = document.createElement('button');
      dot.className = 'ob-dot' + (i === 0 ? ' ob-active' : '');
      dot.setAttribute('aria-label', 'Слайд ' + (i + 1));
      dot.dataset.index = i;
      dot.addEventListener('click', function() { goTo(parseInt(this.dataset.index)); });
      prog.appendChild(dot);
    }
    card.appendChild(prog);

    /* Slides container */
    var slidesWrap = document.createElement('div');
    slidesWrap.className = 'ob-slides';
    slidesWrap.id = 'obSlidesWrap';
    card.appendChild(slidesWrap);

    /* Nav */
    card.appendChild(buildNav());

    overlay.appendChild(card);

    /* Set ob-visible BEFORE appending so the overlay renders at opacity:1 instantly —
       no 0→1 fade-in: the cinematic/short intro was already covering the screen,
       so a fade-in would briefly expose app content underneath. */
    overlay.classList.add('ob-visible');
    document.body.appendChild(overlay);
    state.overlay = overlay;

    renderSlide(0, null);

    /* Touch events */
    attachTouch(card);

    /* Keyboard */
    document.addEventListener('keydown', onKeyDown);
  }

  function buildStars() {
    var wrap = document.createElement('div');
    wrap.className = 'ob-stars';
    wrap.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 55; i++) {
      var s = document.createElement('div');
      s.className = 'ob-star-particle';
      var size = Math.random() * 2 + 0.5;
      s.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'left:' + (Math.random() * 100) + '%',
        'top:' + (Math.random() * 100) + '%',
        'opacity:' + (Math.random() * 0.35 + 0.04),
        'animation:obSparkle ' + (Math.random() * 4 + 3) + 's ease-in-out ' + (Math.random() * 5) + 's infinite'
      ].join(';');
      wrap.appendChild(s);
    }
    return wrap;
  }

  function buildNav() {
    var nav = document.createElement('div');
    nav.className = 'ob-nav';
    nav.id = 'obNav';

    var back = document.createElement('button');
    back.className = 'ob-btn-back hidden';
    back.id = 'obBtnBack';
    back.textContent = _L('← Back','← Назад');
    back.addEventListener('click', function() { goTo(state.current - 1); });

    var next = document.createElement('button');
    next.className = 'ob-btn-next';
    next.id = 'obBtnNext';
    next.textContent = _L('Next →','Далее →');
    next.addEventListener('click', function() { goTo(state.current + 1); });

    nav.appendChild(back);
    nav.appendChild(next);
    return nav;
  }

  /* ══════════════════════════════════════
     НАВИГАЦИЯ
  ══════════════════════════════════════ */
  function renderSlide(idx, direction) {
    var wrap = document.getElementById('obSlidesWrap');
    var slide = SLIDES[idx];
    var isCta = !!slide.isCta;

    var el = document.createElement('div');
    el.className = 'ob-slide' + (direction === 'right' ? ' ob-entering-right' : direction === 'left' ? ' ob-entering-left' : '');

    var visWrap = document.createElement('div');
    visWrap.className = 'ob-visual-wrap';
    visWrap.innerHTML = slide.visual;
    el.appendChild(visWrap);

    var content = document.createElement('div');
    content.className = 'ob-content';
    content.innerHTML =
      '<div class="ob-kicker">' + slide.kicker + '</div>' +
      '<h2 class="ob-title">' + slide.title + '</h2>' +
      '<p class="ob-desc">' + slide.desc + '</p>';
    el.appendChild(content);

    /* CTA */
    if (isCta) {
      var ctaWrap = document.createElement('div');
      ctaWrap.className = 'ob-cta-wrap';

      var ctaBtn = document.createElement('button');
      ctaBtn.className = 'ob-btn-cta';
      ctaBtn.textContent = _L('Create Account →','Создать аккаунт →');
      ctaBtn.addEventListener('click', function() { finish('signup'); });
      ctaWrap.appendChild(ctaBtn);

      var signInHint = document.createElement('div');
      signInHint.className = 'ob-signin-link';
      signInHint.innerHTML = _L('Already have an account? <span id="obSignIn">Sign In</span>','Уже есть аккаунт? <span id="obSignIn">Войти</span>');
      ctaWrap.appendChild(signInHint);

      el.appendChild(ctaWrap);
    }

    /* Remove old slide */
    var old = wrap.querySelector('.ob-slide:not(.ob-entering-right):not(.ob-entering-left):not(.ob-exiting)');
    if (old && direction) {
      old.classList.add('ob-exiting');
      old.style.transition = 'transform 0.38s cubic-bezier(0.4,0,0.2,1),opacity 0.38s ease';
      old.style.transform = direction === 'right' ? 'translateX(-52px)' : 'translateX(52px)';
      old.style.opacity = '0';
      var toRemove = old;
      setTimeout(function() { if (toRemove.parentNode) toRemove.parentNode.removeChild(toRemove); }, 400);
    } else if (old) {
      wrap.removeChild(old);
    }

    wrap.appendChild(el);

    if (direction) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          el.classList.remove('ob-entering-right', 'ob-entering-left');
          el.style.transform = '';
          el.style.opacity = '1';
        });
      });
    }

    /* Update dots */
    document.querySelectorAll('.ob-dot').forEach(function(d, i) {
      d.classList.toggle('ob-active', i === idx);
    });

    /* Update nav buttons */
    var back = document.getElementById('obBtnBack');
    var next = document.getElementById('obBtnNext');
    if (back) back.classList.toggle('hidden', idx === 0);

    var isLast = idx === SLIDES.length - 1;
    if (next) {
      if (isLast) {
        next.style.display = 'none';
      } else {
        next.style.display = '';
        next.textContent = idx === SLIDES.length - 2 ? _L('To finale 🎉','К финалу 🎉') : _L('Next →','Далее →');
      }
    }

    /* Sign-in link */
    setTimeout(function() {
      var siLink = document.getElementById('obSignIn');
      if (siLink) {
        siLink.addEventListener('click', function() {
          finish('signin');
        });
      }
    }, 50);
  }

  function goTo(idx) {
    if (idx < 0 || idx >= SLIDES.length) return;
    var dir = idx > state.current ? 'right' : 'left';
    state.current = idx;
    renderSlide(idx, dir);
  }

  /* ══════════════════════════════════════
     ЗАВЕРШЕНИЕ
  ══════════════════════════════════════ */
  function finish(tab) {
    try { localStorage.setItem(OB_KEY, '1'); } catch(e) {}
    document.removeEventListener('keydown', onKeyDown);
    var overlay = state.overlay;
    if (!overlay) return;
    /* Show auth screen BEFORE the overlay starts fading so it is visible
       beneath the closing animation — not a flash of raw app content. */
    openAuth(tab || 'signup');
    overlay.classList.add('ob-exit');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 600);
  }

  /* ══════════════════════════════════════
     TOUCH / SWIPE
  ══════════════════════════════════════ */
  function attachTouch(el) {
    var startX = 0;
    var startY = 0;
    el.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', function(e) {
      var dx = e.changedTouches[0].clientX - startX;
      var dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(dx) > 50 && dy < 60) {
        if (dx < 0 && state.current < SLIDES.length - 1) goTo(state.current + 1);
        else if (dx > 0 && state.current > 0) goTo(state.current - 1);
      }
    }, { passive: true });
  }

  /* ══════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════ */
  function onKeyDown(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(state.current + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(state.current - 1);
    else if (e.key === 'Escape') finish('signup');
  }

})();
