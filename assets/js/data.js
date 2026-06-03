/**
 * Загрузчик конфигурации SPARK (браузер).
 * Читает window.SPARK_CONFIG из config.js и применяет значения по умолчанию.
 */
(function (global) {
  var DEFAULTS = {
    SUPABASE_URL: 'https://urban-newt-63.7-melty-7.deno.net',
    SUPABASE_ANON_KEY: 'sb_publishable_9uAFLjS4AaElHus4hiUuQQ_PMSFNkb8',
    ALLOW_LEGACY_INVEST_FALLBACK: true,
    ENABLE_CLIENT_TELEMETRY: false
  };

  var raw = global.SPARK_CONFIG || {};
  var cfg = {};
  Object.keys(DEFAULTS).forEach(function (key) {
    if (raw[key] !== undefined && raw[key] !== null) {
      cfg[key] = raw[key];
    } else {
      cfg[key] = DEFAULTS[key];
    }
  });

  function isPlaceholder(value) {
    if (!value || typeof value !== 'string') return true;
    var v = value.trim();
    if (!v) return true;
    return (
      v.indexOf('your-') === 0 ||
      v.indexOf('YOUR_') === 0 ||
      v === 'https://your-project-ref.supabase.co'
    );
  }

  function isValidSupabaseUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      var u = new URL(url.trim());
      // Разрешаем стандартные URL Supabase и любые HTTPS-прокси (например, Cloudflare Workers)
      return u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function isValidAnonKey(key) {
    if (!key || typeof key !== 'string') return false;
    var k = key.trim();
    if (isPlaceholder(k)) return false;
    if (k.indexOf('sb_publishable_') === 0) return k.length > 24;
    var parts = k.split('.');
    return parts.length === 3 && parts[2].length > 20;
  }

  var supabaseReady = isValidSupabaseUrl(cfg.SUPABASE_URL) && isValidAnonKey(cfg.SUPABASE_ANON_KEY);

  global.SPARK_RUNTIME = {
    get: function (key) {
      return cfg[key];
    },
    all: function () {
      return Object.assign({}, cfg);
    },
    isSupabaseConfigured: function () {
      return supabaseReady;
    },
    integrationStatus: function () {
      return {
        supabase: supabaseReady ? 'ready' : 'unconfigured',
        telemetry: supabaseReady && cfg.ENABLE_CLIENT_TELEMETRY ? 'enabled' : 'disabled',
        legacyInvest: !!cfg.ALLOW_LEGACY_INVEST_FALLBACK
      };
    },
    supabaseAuthOptions: function () {
      return {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'spark_auth',
        flowType: 'pkce'
      };
    }
  };
})(window);

var supa = null;
var SUPABASE_URL = '';
var SUPABASE_ANON_KEY = '';
var ALLOW_LEGACY_INVEST_FALLBACK = true;
var ENABLE_CLIENT_TELEMETRY = false;
var REALTIME_MODE = 'polling'; // 'websocket' | 'polling' | 'none'
var SUPABASE_CONFIGURED = false;

var runtime = window.SPARK_RUNTIME;
if (runtime) {
  SUPABASE_URL = runtime.get('SUPABASE_URL') || '';
  SUPABASE_ANON_KEY = runtime.get('SUPABASE_ANON_KEY') || '';
  ALLOW_LEGACY_INVEST_FALLBACK = runtime.get('ALLOW_LEGACY_INVEST_FALLBACK') !== false;
  ENABLE_CLIENT_TELEMETRY = !!runtime.get('ENABLE_CLIENT_TELEMETRY');
  REALTIME_MODE = runtime.get('REALTIME_MODE') || 'polling';
  SUPABASE_CONFIGURED = runtime.isSupabaseConfigured();
}

try {
  if (SUPABASE_CONFIGURED && typeof supabase !== 'undefined') {
    var clientOptions = { auth: runtime ? runtime.supabaseAuthOptions() : { persistSession: true, storageKey: 'spark_auth' } };
    
    // If the configured URL is a proxied URL (e.g. Vercel deployment), route Realtime WebSockets directly to standard Supabase to bypass Vercel WebSocket limitations
    if (SUPABASE_URL && SUPABASE_URL.indexOf('supabase.co') === -1) {
      clientOptions.realtime = {
        url: 'wss://ppehttbtrlavnrytoweu.supabase.co/realtime/v1/websocket'
      };
    }
    
    supa = supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      clientOptions
    );
  } else if (!SUPABASE_CONFIGURED) {
    console.warn('Supabase config is missing or invalid. Running in demo mode.');
  }
} catch (e) {
  console.warn('Supabase init failed - demo mode', e);
  supa = null;
}
var db = supa;

var ME = null;
var PROFILE = { username: '@user', spk_balance: 0, ideas_count: 0, rank: null, investments_count: 0, profit_pct: 0, bio: '', avatar_color: 0 };
var PENDING_EMAIL = '';
var PENDING_NICK = '';
var PENDING_REG_PASSWORD = '';
var REGISTRATION_STEP = 1;
var appEntered = false;
var authListenerBound = false;

var CC = '#e8c55a';
var EMOJIS = ['💀', '🗿', '🔥', '💎', '🚀', '❤️', '👍', '👎', '👏', '🎉', '😢', '😮', '🤔', '👀', '💯'];
var FIRE_T = 100;
var RS = {};

function getRS(id) {
  if (!RS[id]) {
    var storedPick = null;
    try {
      storedPick = localStorage.getItem('spark_pick_' + id);
    } catch (e) {}
    RS[id] = { counts: Object.fromEntries(EMOJIS.map(function (e) { return [e, 0]; })), pick: storedPick || null };
  }
  return RS[id];
}
// No mock reaction seeds — real data loaded from DB

// SEEDS cleared — feed now loads from Supabase database
var SEEDS = [];
var LIVE = [];

var I18N = {
  en: {
    iot: 'Interest over time', cinv: 'investors', cpool: 'pool', cleft: 'left', binv: 'Invest', bcrit: 'Critique', noResults: 'No ideas match',
    launchCheckingSession: 'Syncing market signals...',
    launchPreparingWorkspace: 'Preparing your workspace...',
    signIn: 'Sign In', register: 'Register', rememberMe: 'Remember me', createAccount: 'Create Account →', signInBtn: 'Sign In →',
    nickname: 'Nickname', email: 'Email', password: 'Password', repeatPassword: 'Repeat Password', passMin: 'Password (8+ chars)',
    verifyTitle: 'Verify your email', verifyText: 'Registration is almost complete. Open',
    verifyText2: 'your inbox', verifyText3: 'and click the confirmation link.',
    verifyDone: '✅ I confirmed', resendMail: 'Send email again',
    profile: 'Profile', postIdea: '+ Post Idea', wallet: 'Wallet', trendingNow: 'Trending Now', leaderboard: 'Prophet Leaderboard',
    liveActivity: 'Live Activity', sortLabel: 'Sort:', tagLabel: 'Tag:', all: 'All', newSort: '🕐 New', popularSort: '🔥 Popular',
    profitSort: '📈 Profitable', endingSort: '⏱ Ending soon', feed: 'Explore', leaders: 'Leaders', chats: 'Chats', trends: 'Trends',
    chatDms: '💬 DMs', chatTopics: '🗂 Topics', newIdea: 'New Idea 💡', title: 'Title', description: 'Description',
    minBet: 'Min. bet (SPK)', targetOpt: 'Target (optional)', duration: 'Idea Name', holdPublish: 'Hold to Publish',
    holdInvest: 'Hold to Invest', holdHint: 'Hold 2 seconds to confirm', investModal: 'Invest 🚀', yourBalance: 'Your balance',
    language: 'Language', notifications: 'Notifications', privacy: 'Privacy', logout: 'Log out', availableBalance: 'Available balance',
    authVisualKicker: 'Premium Access', authVisualTitle: 'SPARK Market Intelligence',
    authVisualText: 'Trade ideas, follow momentum, and invest with high-signal insights in a secure environment.',
    ideas: 'Ideas', profit: 'Profit', invested: 'Invested', rank: 'Rank', settings: 'Settings', verifiedInvestor: '✓ Verified Investor',
    marketObservatory: 'Market Observatory', obsTech: 'Technology', obsEco: 'Ecology', obsSocial: 'Society',
    insufficientBalance: 'Insufficient balance',
    amountBelowMinBet: 'Amount is below minimum bet',
    ideaNotFound: 'Idea no longer exists',
    signInRequired: 'Sign in required',
    secureInvestFailed: 'Secure invest failed. Contact support.',
    legacyInvestMode: 'Server migration is missing. Running compatibility mode.',
    integration_auth: 'Sign-in is unavailable. Check Supabase keys in config.js.',
    integration_database: 'Live data unavailable. Demo content is still available.',
    integration_realtime: 'Live updates are temporarily unavailable.',
    integration_invest: 'Investing is temporarily unavailable.',
    integration_publish: 'Publishing is temporarily unavailable.',
    integration_registration: 'Email verification is unavailable. Deploy register-* edge functions.',
    regCodeSent: 'Verification code sent. Check your inbox and Spam folder.',
    regEnterCode: 'Enter the 6-digit code from your email',
    regVerifyBtn: 'Complete registration →',
    regBack: '← Back',
    regResendCode: 'Send code again',
    regCodeLabel: 'Verification code',
    regInvalidCode: 'Invalid or expired code',
    editProfile: 'Edit Profile', avatarColor: 'Avatar Colour', usernameLetters: '(letters, numbers, _)',
    bioLabel: 'Bio', bioPlaceholder: 'A short bio about you…', saveChanges: 'Save Changes', saving: 'Saving…',
    min3chars: 'Minimum 3 characters', onlyLettersNums: 'Only letters, numbers, _', saved: '✓ Saved',
    profileUpdated: '✓ Profile updated!', networkError: '✗ Network error. Try again.',
    myIdeas: 'My Ideas', noMyIdeas: 'You have not published any ideas yet.',
    themeStudioTitle: '🎨 Theme Studio', presets: 'Presets', customColors: 'Custom Colours',
    resetDefault: '↺ Reset Default', applyTheme: 'Apply →', themeApplied: 'Theme applied ✓',
    tsPrimary: 'Primary / Buttons', tsPrimaryTip: 'Invest button, active tabs, links',
    tsAccent: 'SPK / Gold Accent', tsAccentTip: 'Balance display, number highlights',
    tsSecondary: 'Cyan / Secondary', tsSecondaryTip: 'Verified badge, countdown, success',
    tsGraph: 'Graph Line', tsGraphTip: 'Investment chart line',
    tsMuted: 'Muted Text', tsMutedTip: 'Secondary labels, timestamps',
    cosmos: 'Cosmos', ocean: 'Ocean', ember: 'Ember', forest: 'Forest', rose: 'Rose', arctic: 'Arctic', void: 'Void', gold: 'Gold',
    aurora: 'Aurora', cyberpunk: 'Cyberpunk', sunset: 'Sunset', nebula: 'Nebula', neon: 'Neon', flare: 'Flare', magic: 'Magic', prism: 'Prism',
    regComplete: 'Account created. Signing you in…',
    reg_err_migration: 'Registration database is not ready. Run: supabase db push (migration 20260516_pending_registrations).',
    reg_err_email: 'Email is not configured on the server. Set SMTP credentials in Edge Function secrets.',
    reg_err_functions: 'Registration service not found. Deploy register-send-code and register-verify edge functions.',
    reg_err_network: 'Cannot reach the server. Check your connection or site CSP (connect-src must allow *.supabase.co).',
    reg_err_invalid: 'Check email format, password (8+ chars), and nickname (1–30 characters).',
    reg_err_rate_limit: 'Too many attempts. Please wait 15 minutes.',
    configSetup: 'Supabase is not configured. Copy assets/js/config.example.js to config.js and set your project URL and anon key.',
    aboutUs: 'About Us',
    achTitle: 'Achievements',
    achFillProfileTitle: 'Complete Profile', achFillProfileDesc: 'Set a unique username and fill in your Bio',
    achCreate5IdeasTitle: 'Startup Generator', achCreate5IdeasDesc: 'Publish at least 5 ideas on SPARK',
    achAdvRepostTitle: 'SPARK Ambassador', achAdvRepostDesc: 'Share a link to SPARK on social media and get rewarded',
    achLocked: 'Complete the requirements', achClaimed: '✓ Claimed',
    achEmpty: 'Sign in to earn achievements', achEmptyFail: 'Could not load achievements',
    achHowTitle: 'How it works',
    achCodeLabel: 'Your verification code — paste it into the post text:',
    achHowStep1: 'Include the code shown above in your post text — it confirms the post was written by you.',
    achHowStep2Intro: 'Create a <strong>public</strong> post on any social network (VK, Telegram, X/Twitter, Reddit) containing:',
    achHowStep2Link: '• Link: <strong>sparksie.vercel.app</strong>',
    achHowStep2Code: '• Your code: {code}',
    achHowStep3Intro: 'Copy the direct link to the post (the specific message, not the channel). Examples:',
    achHowStep4: 'Paste the link below and click <strong>Check</strong>.',
    achCheckBtn: 'Check', achInputPlaceholder: 'https://t.me/channel/123',
    achCodeCopied: 'Code copied!',
    achUnlocked: '🏆 Achievement unlocked! +{reward} SPK!',
    achErrBio: 'Fill in your Bio in profile', achErrUsername: 'Set a unique username',
    achErrIdeas: '{n} more ideas needed', achErrRepost: 'Complete the repost verification first',
    achErrClaimed: 'Already claimed', achErrGeneric: 'Could not claim achievement',
    achErrPrevRank: 'Claim the previous rank first',
    achErrBioLength: 'Your Bio is too short for this rank',
    achErrAvatar: 'Change your avatar color in your profile',
    achErrBioLink: 'Add a website or social media link to your Bio',
    achErrBioMax: 'Fill your Bio to the maximum (160 characters)',
    achAllRanksDone: '✓ Master · All ranks claimed',
    achNextRank: 'Claim rank {label} · +{reward} SPK',
    achRankUnlocked: '🏆 Rank {label} unlocked! +{reward} SPK!',
    achIdeasUnit: 'ideas', achRepostsUnit: 'reposts',
    achFillProfileDesc1: 'Set a unique username and fill in your Bio',
    achFillProfileDesc2: 'Bio longer than 50 characters and custom avatar',
    achFillProfileDesc3: 'Bio longer than 100 characters',
    achFillProfileDesc4: 'Bio contains a link to a website or social media',
    achFillProfileDesc5: 'Fill Bio to the maximum — true SPARK Master',
    achIdeasDesc1: 'Publish 5 ideas',  achIdeasDesc2: 'Publish 15 ideas',
    achIdeasDesc3: 'Publish 30 ideas', achIdeasDesc4: 'Publish 60 ideas',
    achIdeasDesc5: 'Publish 100 ideas',
    achRepostDesc1: '1 confirmed SPARK repost',
    achRepostDesc2: '3 confirmed SPARK reposts',
    achRepostDesc3: '7 confirmed SPARK reposts',
    achRepostDesc4: '15 confirmed SPARK reposts',
    achRepostDesc5: '30 confirmed reposts — SPARK Ambassador Master',
    repostErrEmpty: 'Paste the post link', repostErrUrl: 'Invalid URL',
    repostErrRate: 'Wait {n} sec before the next attempt',
    repostErrServer: 'Server error, please try again',
    repostOkApproved: '✓ Repost confirmed! Now claim your reward.',
    repostPending: '⏳ Post queued for manual review. Make sure your code {code} is in the post text.',
    repostAccountAge: 'Account too new — submission available in:',
    repostErrAccountAge: 'Your account must be at least 24 hours old to submit a repost.',
    achChecking: 'AI is checking…', achClaiming: 'Claiming…',
    myIdeasSwipe: 'Swipe to browse',
    pwdUpdated: 'Password successfully updated',
    pwdErr: 'Error updating password',
    delCodeSent: 'Verification code for deletion sent to your email',
    delSuccess: 'Account permanently deleted',
    delErr: 'Error during account deletion',
    notifTitle: 'NOTIFICATIONS',
    notifSub: 'Configure terminal update signal frequency.',
    notifVibTitle: 'Terminal Vibration',
    notifVibSub: 'Haptic feedback on clicks and navigation.',
    notifEmailTitle: 'Important Announcements',
    notifEmailSub: 'Emails about key platform updates to your registered address.',
    notifNewPostsTitle: 'New Post Alerts',
    notifNewPostsSub: 'Show a notification when a new idea appears in the feed.',
    shareIdea: 'Share',
    shareTitle: 'Share Idea',
    shareCopyLink: 'Copy Link',
    shareCopied: '✓ Link copied!',
    privTitle: 'PRIVACY',
    privSub: 'Manage terminal access and profile security configuration.',
    privSecTitle: 'Security',
    privSecSub: 'Update your system access key (password).',
    privCurrPwd: 'Current password',
    privNewPwd: 'New password',
    privUpdatePwd: 'Update password',
    privDelTitle: 'Delete Terminal',
    privDelSub: 'Complete profile deletion. All your sparks will be irreversibly consumed by a black hole.',
    privDelBtn: 'Delete Account',
    delModal1Title: 'CRITICAL ACTION',
    delModal1Sub: 'To initiate terminal liquidation, enter your current password. A confirmation code will be sent to your email.',
    delModal1Pwd: 'Current password',
    delSendCode: 'Send confirmation code',
    delModal2Title: 'ORBITAL CONFIRMATION',
    delModal2Sub: 'The system sent a 6-digit code to your email. Enter it to permanently erase your data. Check your spam folder if needed.',
    delFinalBtn: 'Permanently erase system'
  },
  ru: {
    iot: 'Интерес орбиты', cinv: 'инвесторов', cpool: 'пул', cleft: 'осталось', binv: 'Вложить', bcrit: 'Критика', noResults: 'Идеи не найдены',
    launchCheckingSession: 'Синхронизация рыночных сигналов...',
    launchPreparingWorkspace: 'Подготовка рабочего пространства...',
    signIn: 'Войти', register: 'Регистрация', rememberMe: 'Запомнить меня', createAccount: 'Создать аккаунт →', signInBtn: 'Войти →',
    nickname: 'Никнейм', email: 'Почта', password: 'Пароль', repeatPassword: 'Повторите пароль', passMin: 'Пароль (8+ символов)',
    verifyTitle: 'Подтвердите почту', verifyText: 'Регистрация почти завершена. Перейдите на',
    verifyText2: 'вашу почту', verifyText3: 'и нажмите на ссылку для подтверждения.',
    verifyDone: '✅ Я подтвердил(а)', resendMail: 'Отправить письмо повторно',
    profile: 'Профиль', postIdea: '+ Опубликовать идею', wallet: 'Кошелек', trendingNow: 'В тренде', leaderboard: 'Топ Пророков',
    liveActivity: 'Активность', sortLabel: 'Сортировка:', tagLabel: 'Тег:', all: 'Все', newSort: '🕐 Новые', popularSort: '🔥 Популярные',
    profitSort: '📈 Выгодные', endingSort: '⏱ Скоро конец', feed: 'Лента', leaders: 'Лидеры', chats: 'Чаты', trends: 'Тренды',
    chatDms: '💬 ЛС', chatTopics: '🗂 Темы', newIdea: 'Новая идея 💡', title: 'Заголовок', description: 'Описание',
    minBet: 'Мин. ставка (SPK)', targetOpt: 'Цель (опц.)', duration: 'Название идеи', holdPublish: 'Удерживайте для публикации',
    holdInvest: 'Удерживайте для вложения', holdHint: 'Удерживайте 2 секунды для подтверждения', investModal: 'Инвестировать 🚀', yourBalance: 'Ваш баланс',
    language: 'Язык', notifications: 'Уведомления', privacy: 'Приватность', logout: 'Выйти', availableBalance: 'Доступный баланс',
    authVisualKicker: 'Премиальный доступ', authVisualTitle: 'SPARK Рыночная аналитика',
    authVisualText: 'Публикуйте идеи, отслеживайте импульс рынка и инвестируйте в защищенной среде.',
    ideas: 'Идеи', profit: 'Прибыль', invested: 'Инвестировано', rank: 'Ранг', settings: 'Настройки', verifiedInvestor: '✓ Проверенный инвестор',
    marketObservatory: 'Обсерватория рынка', obsTech: 'Технологии', obsEco: 'Экология', obsSocial: 'Социум',
    insufficientBalance: 'Недостаточно средств',
    amountBelowMinBet: 'Сумма ниже минимальной ставки',
    ideaNotFound: 'Идея больше не доступна',
    signInRequired: 'Требуется вход в аккаунт',
    secureInvestFailed: 'Безопасное инвестирование не выполнено. Обратитесь в поддержку.',
    legacyInvestMode: 'Серверная миграция не применена. Включен режим совместимости.',
    integration_auth: 'Вход недоступен. Проверьте ключи Supabase в config.js.',
    integration_database: 'Живые данные недоступны. Демо-контент доступен.',
    integration_realtime: 'Обновления в реальном времени временно недоступны.',
    integration_invest: 'Инвестирование временно недоступно.',
    integration_publish: 'Публикация временно недоступна.',
    integration_registration: 'Подтверждение почты недоступно. Разверните edge functions register-*.',
    regCodeSent: 'Код отправлен. Проверьте почту (и папку Спам).',
    regEnterCode: 'Введите 6-значный код из письма',
    regVerifyBtn: 'Завершить регистрацию →',
    regBack: '← Назад',
    regResendCode: 'Отправить код еще раз',
    regCodeLabel: 'Код подтверждения',
    regInvalidCode: 'Неверный или просроченный код',
    editProfile: 'Редактировать профиль', avatarColor: 'Цвет Аватара', usernameLetters: '(буквы, цифры, _)',
    bioLabel: 'О себе', bioPlaceholder: 'Коротко о себе…', saveChanges: 'Сохранить изменения', saving: 'Сохранение…',
    min3chars: 'Минимум 3 символа', onlyLettersNums: 'Только буквы, цифры, _', saved: '✓ Сохранено',
    profileUpdated: '✓ Профиль обновлен!', networkError: '✗ Ошибка сети. Попробуйте еще раз.',
    myIdeas: 'Мои идеи', noMyIdeas: 'Вы еще не опубликовали ни одной идеи.',
    themeStudioTitle: '🎨 Студия Тем', presets: 'Пресеты', customColors: 'Свои цвета',
    resetDefault: '↺ По умолчанию', applyTheme: 'Применить →', themeApplied: 'Тема применена ✓',
    tsPrimary: 'Основной / Кнопки', tsPrimaryTip: 'Кнопка инвеста, активные вкладки',
    tsAccent: 'Акцент / Золото', tsAccentTip: 'Баланс, выделение цифр',
    tsSecondary: 'Вторичный / Циан', tsSecondaryTip: 'Галочка, таймер, успехи',
    tsGraph: 'Линия графика', tsGraphTip: 'Линия на графике инвестиций',
    tsMuted: 'Приглушенный текст', tsMutedTip: 'Второстепенные подписи, время',
    cosmos: 'Космос', ocean: 'Океан', ember: 'Угли', forest: 'Лес', rose: 'Роза', arctic: 'Арктика', void: 'Пустота', gold: 'Золото',
    aurora: 'Аврора', cyberpunk: 'Киберпанк', sunset: 'Закат', nebula: 'Туманность', neon: 'Неон', flare: 'Вспышка', magic: 'Магия', prism: 'Призма',
    regComplete: 'Аккаунт создан. Выполняем вход…',
    reg_err_migration: 'База для регистрации не настроена. Выполните: supabase db push (миграция pending_registrations).',
    reg_err_email: 'Почта на сервере не настроена. Укажите параметры SMTP в секретах Edge Functions.',
    reg_err_functions: 'Сервис регистрации не найден. Разверните edge functions register-send-code и register-verify.',
    reg_err_network: 'Нет связи с сервером. Проверьте интернет или CSP сайта (connect-src должен разрешать *.supabase.co).',
    reg_err_invalid: 'Проверьте почту, пароль (от 8 символов) и ник (1–30 символов).',
    reg_err_rate_limit: 'Слишком много попыток. Пожалуйста, подождите 15 минут.',
    configSetup: 'Supabase не настроен. Скопируйте assets/js/config.example.js в config.js и укажите URL проекта и anon-ключ.',
    aboutUs: 'О нас',
    achTitle: 'Достижения',
    achFillProfileTitle: 'Заполненный профиль', achFillProfileDesc: 'Укажите уникальный никнейм и заполните Bio',
    achCreate5IdeasTitle: 'Генератор стартапов', achCreate5IdeasDesc: 'Опубликуйте минимум 5 идей на SPARK',
    achAdvRepostTitle: 'Амбассадор SPARK', achAdvRepostDesc: 'Поделитесь ссылкой на SPARK в соцсетях и получите награду',
    achLocked: 'Выполните условия', achClaimed: '✓ Получено',
    achEmpty: 'Войдите в аккаунт, чтобы получать достижения', achEmptyFail: 'Не удалось загрузить достижения',
    achHowTitle: 'Инструкция',
    achCodeLabel: 'Ваш код верификации — вставьте его в текст поста:',
    achHowStep1: 'Вставьте код, показанный выше, в текст поста — он подтверждает, что пост написан именно вами.',
    achHowStep2Intro: 'Создайте <strong>публичный</strong> пост в любой соцсети (ВКонтакте, Telegram-канал, X/Twitter, Reddit). Пост должен содержать:',
    achHowStep2Link: '• Ссылку: <strong>sparksie.vercel.app</strong>',
    achHowStep2Code: '• Ваш код: {code}',
    achHowStep3Intro: 'Скопируйте прямую ссылку на пост (на конкретное сообщение). Примеры:',
    achHowStep4: 'Вставьте ссылку в поле ниже и нажмите <strong>Проверить</strong>.',
    achCheckBtn: 'Проверить', achInputPlaceholder: 'https://t.me/канал/123',
    achCodeCopied: 'Код скопирован!',
    achUnlocked: '🏆 Достижение разблокировано! +{reward} SPK!',
    achErrBio: 'Заполните Bio в профиле', achErrUsername: 'Задайте уникальный никнейм',
    achErrIdeas: 'Нужно ещё {n} идей', achErrRepost: 'Сначала пройдите проверку репоста',
    achErrClaimed: 'Ачивка уже получена', achErrGeneric: 'Не удалось получить достижение',
    achErrPrevRank: 'Сначала получите предыдущий ранг',
    achErrBioLength: 'Bio слишком короткое для этого ранга',
    achErrAvatar: 'Смените цвет аватара в профиле',
    achErrBioLink: 'Добавьте ссылку на сайт или соцсеть в Bio',
    achErrBioMax: 'Заполните Bio до максимума (160 символов)',
    achAllRanksDone: '✓ Мастер · Все ранги получены',
    achNextRank: 'Забрать ранг {label} · +{reward} SPK',
    achRankUnlocked: '🏆 Ранг {label} разблокирован! +{reward} SPK!',
    achIdeasUnit: 'идей', achRepostsUnit: 'репостов',
    achFillProfileDesc1: 'Укажи уникальный никнейм и заполни Bio',
    achFillProfileDesc2: 'Bio длиннее 50 символов и аватар не по умолчанию',
    achFillProfileDesc3: 'Bio длиннее 100 символов',
    achFillProfileDesc4: 'В bio есть ссылка на сайт или соцсеть',
    achFillProfileDesc5: 'Bio заполнен до максимума — настоящий мастер SPARK',
    achIdeasDesc1: 'Опубликуй 5 идей',   achIdeasDesc2: 'Опубликуй 15 идей',
    achIdeasDesc3: 'Опубликуй 30 идей',  achIdeasDesc4: 'Опубликуй 60 идей',
    achIdeasDesc5: 'Опубликуй 100 идей',
    achRepostDesc1: '1 подтверждённый репост о SPARK',
    achRepostDesc2: '3 подтверждённых репоста',
    achRepostDesc3: '7 подтверждённых репостов',
    achRepostDesc4: '15 подтверждённых репостов',
    achRepostDesc5: '30 репостов — Амбассадор SPARK Мастер',
    repostErrEmpty: 'Вставьте ссылку на пост', repostErrUrl: 'Некорректная ссылка',
    repostErrRate: 'Подождите {n} сек. перед следующей попыткой',
    repostErrServer: 'Ошибка сервера, попробуйте позже',
    repostOkApproved: '✓ Репост подтверждён! Теперь заберите награду.',
    repostPending: '⏳ Пост поставлен на ручную проверку. Убедитесь, что в тексте поста есть ваш код {code}.',
    repostAccountAge: 'Аккаунт слишком новый — отправка будет доступна через:',
    repostErrAccountAge: 'Аккаунт должен быть создан не менее 24 часов назад.',
    achChecking: 'ИИ проверяет…', achClaiming: 'Начисляем…',
    myIdeasSwipe: 'Листайте, чтобы смотреть',
    pwdUpdated: 'Пароль успешно обновлен',
    pwdErr: 'Ошибка обновления пароля',
    delCodeSent: 'Код для удаления отправлен на вашу почту',
    delSuccess: 'Аккаунт безвозвратно удален',
    delErr: 'Ошибка удаления аккаунта',
    notifTitle: 'УВЕДОМЛЕНИЯ',
    notifSub: 'Настройте частоту сигналов обновления терминала.',
    notifVibTitle: 'Вибрация терминала',
    notifVibSub: 'Вибрационные отклики терминала при кликах и переходах.',
    notifEmailTitle: 'Важные анонсы',
    notifEmailSub: 'Письма о ключевых обновлениях платформы на привязанный email.',
    notifNewPostsTitle: 'Уведомления о новых постах',
    notifNewPostsSub: 'Показывать уведомление при появлении новой идеи в ленте.',
    shareIdea: 'Поделиться',
    shareTitle: 'Поделиться идеей',
    shareCopyLink: 'Скопировать ссылку',
    shareCopied: '✓ Ссылка скопирована!',
    privTitle: 'ПРИВАТНОСТЬ',
    privSub: 'Управление доступом к вашему терминалу и конфигурация безопасности профиля.',
    privSecTitle: 'Безопасность',
    privSecSub: 'Обновление ключа доступа (пароля) к вашей системе.',
    privCurrPwd: 'Текущий пароль',
    privNewPwd: 'Новый пароль',
    privUpdatePwd: 'Обновить пароль',
    privDelTitle: 'Удаление терминала',
    privDelSub: 'Полное удаление профиля. Все ваши искры будут безвозвратно поглощены черной дырой.',
    privDelBtn: 'Стереть аккаунт',
    delModal1Title: 'КРИТИЧЕСКОЕ ДЕЙСТВИЕ',
    delModal1Sub: 'Для запуска процедуры ликвидации терминала введите ваш текущий пароль. На вашу почту будет отправлен секретный код подтверждения.',
    delModal1Pwd: 'Текущий пароль',
    delSendCode: 'Выслать код подтверждения',
    delModal2Title: 'ПОДТВЕРЖДЕНИЕ С ОРБИТЫ',
    delModal2Sub: 'Система отправила письмо с 6-значным кодом на ваш email. Введите его для окончательного стирания данных. Если не можете найти ключ, посмотрите в папке «Спам».',
    delFinalBtn: 'Окончательно стереть систему'
  }
};
var LANG = localStorage.getItem('spark_lang') || 'ru';
function T(k) { return (I18N[LANG] || I18N.en)[k] || I18N.en[k] || k; }
