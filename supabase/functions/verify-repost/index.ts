import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const RATE_LIMIT_MS      = 5 * 60 * 1000;
const ACCOUNT_MIN_AGE_MS = 24 * 60 * 60 * 1000; // 24 часа

// ── Генерируем стойкий уникальный код через HMAC-SHA256 ──────────────────
async function getUserCode(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userId));
  const hex = Array.from(new Uint8Array(sig).slice(0, 5))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return 'SPARK-' + hex;
}

// ── Шаблоны постов в соцсетях ──────────────────────────────────────────────
const SOCIAL_POST_PATTERNS = [
  /(?:twitter\.com|x\.com)\/\w[\w_]+\/status\/\d+/i,
  /(?:t\.me|telegram\.me)\/[^/?#\s]+\/\d+/i,
  /(?:vk\.com|vk\.ru)\/wall-?\d+_\d+/i,
  /(?:vk\.com|vk\.ru)\/[^/?#\s]+\?w=wall-?\d+_\d+/i,
  /reddit\.com\/r\/\w+\/comments\//i,
  /linkedin\.com\/(?:posts?|feed\/update|pulse)\//i,
  /instagram\.com\/(?:p|reel|tv)\//i,
  /(?:facebook\.com|m\.facebook\.com|fb\.com)\/[^/?#\s]+\/posts?\//i,
];

function looksLikeSocialPost(url: string): boolean {
  return SOCIAL_POST_PATTERNS.some((re) => re.test(url));
}

// ── Извлекает весь доступный текст из HTML ─────────────────────────────────
function extractText(html: string): string {
  // og:description и twitter:description
  const metas: string[] = [];
  // Ищем все meta-теги и вытаскиваем content=
  const metaTagRe  = /<meta[^>]+>/gi;
  const contentRe  = /content="([^"]{2,600})"/i;
  const descRe     = /(?:property|name)="[^"]*description[^"]*"/i;
  let tag: RegExpExecArray | null;
  while ((tag = metaTagRe.exec(html)) !== null) {
    if (descRe.test(tag[0])) {
      const cm = contentRe.exec(tag[0]);
      if (cm) metas.push(cm[1]);
    }
  }

  const titleM = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  const title  = titleM ? titleM[1] : '';

  // Весь видимый текст (стрипаем теги)
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 2000);

  return [title, ...metas, body].join(' ');
}

// ── Reddit: публичный JSON API (не блокирует серверные IP) ───────────────
async function fetchRedditPost(url: string): Promise<{ text: string; ok: boolean }> {
  const m = /reddit\.com\/r\/\w+\/comments\/([a-z0-9]+)/i.exec(url);
  if (!m) return { text: '', ok: false };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://www.reddit.com/comments/${m[1]}.json?limit=1`, {
      headers: { 'User-Agent': 'SPARK-Verifier/1.0 (post verification)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { text: '', ok: false };
    const data = await res.json();
    const post = data?.[0]?.data?.children?.[0]?.data;
    if (!post) return { text: '', ok: false };
    const text = [post.title ?? '', post.selftext ?? ''].join(' ').trim();
    return { text, ok: text.length > 0 };
  } catch { return { text: '', ok: false }; }
}

// ── Пробуем получить страницу (несколько User-Agent'ов) ───────────────────
async function fetchPage(url: string): Promise<{ text: string; ok: boolean }> {
  const userAgents = [
    // Googlebot — многие соцсети дают контент
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    // WhatsApp превью — t.me отдаёт og: теги
    'WhatsApp/2.23.24.76 A',
    // Обычный браузер
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];

  for (const ua of userAgents) {
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);

      const res = await fetch(url, {
        headers: {
          'User-Agent':      ua,
          'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('text/html') && !ct.includes('text/plain')) continue;

      const text = extractText(await res.text());
      // Считаем успешным если нашли реальный контент (не форма входа)
      const tl = text.toLowerCase();
      const isLoginPage = tl.includes('sign in') || tl.includes('войти') || tl.includes('log in');
      const hasContent  = text.length > 100 && !isLoginPage;
      if (hasContent) return { text, ok: true };
    } catch { /* пробуем следующий UA */ }
  }
  return { text: '', ok: false };
}

// ── Журнал мошеннических действий ────────────────────────────────────────
async function logFraud(
  admin:      ReturnType<typeof createClient>,
  userId:     string,
  repostLink: string,
  eventType:  string,
  codeUsed:   string,
  meta:       Record<string, unknown> = {},
): Promise<void> {
  try {
    await admin.from('fraud_log').insert({
      user_id:     userId     || null,
      event_type:  eventType,
      repost_link: repostLink || null,
      code_used:   codeUsed,
      meta,
    });
  } catch (e) {
    console.error('[verify-repost] fraud_log insert failed:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ message: 'Server configuration error' }, 500);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return json({ message: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ message: 'Unauthorized' }, 401);

  const userId   = user.id;
  const secret   = Deno.env.get('REPOST_CODE_SECRET') ?? 'fallback-dev-secret';
  const userCode = await getUserCode(userId, secret);

  // ── Body ─────────────────────────────────────────────────────────────────
  let payload: { repost_link?: string };
  try { payload = await req.json(); } catch { return json({ message: 'Invalid body' }, 400); }

  const repostLink = (payload.repost_link ?? '').trim();
  if (!repostLink) return json({ message: 'repost_link is required' }, 400);

  // Если клиент просто спрашивает код — отдаём его
  if (repostLink === '__get_code__') {
    return json({ code: userCode });
  }

  try {
    const u = new URL(repostLink);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
  } catch { return json({ message: 'invalid_url' }, 400); }

  // ── Возраст аккаунта: минимум 24 часа (#4) ───────────────────────────────
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  if (Date.now() - createdAt < ACCOUNT_MIN_AGE_MS) {
    logFraud(admin, userId, repostLink, 'account_too_new', userCode);
    return json({
      success: false,
      status:  'rejected',
      reason:  'Аккаунт слишком новый. Попробуйте через 24 часа после регистрации.',
      code:    userCode,
    }, 403);
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateCutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  const { data: recentClaim } = await admin
    .from('repost_claims').select('id, created_at')
    .eq('user_id', userId).in('status', ['pending', 'approved'])
    .gte('created_at', rateCutoff)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (recentClaim) {
    const waitSec = Math.ceil(
      (new Date(recentClaim.created_at).getTime() + RATE_LIMIT_MS - Date.now()) / 1000,
    );
    return json({ message: 'rate_limited', wait_seconds: waitSec }, 429);
  }

  // ── Проверка максимума одобренных репостов (ранг V = 30 репостов) ──────────
  const { count: approvedCount } = await admin
    .from('repost_claims')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'approved');

  if ((approvedCount ?? 0) >= 30) {
    return json({
      success: false,
      status:  'max_reached',
      reason:  'Достигнут максимум (30 репостов). Все ранги Амбассадора SPARK открыты!',
    });
  }

  // ── Защита от повторной подачи той же ссылки тем же пользователем ──────────
  const { data: ownClaim } = await admin
    .from('repost_claims')
    .select('id, status')
    .eq('user_id', userId)
    .eq('repost_link', repostLink)
    .neq('status', 'rejected')
    .limit(1).maybeSingle();

  if (ownClaim) {
    return json({
      success: false,
      status:  'rejected',
      reason:  ownClaim.status === 'approved'
        ? `Этот пост уже был подтверждён ранее. Для следующего ранга нужна новая публикация с кодом ${userCode}.`
        : 'Этот пост уже находится на проверке.',
    });
  }

  // ── Защита от дублирования ссылки между пользователями (#3) ────────────
  const { data: linkUsedByOther } = await admin
    .from('repost_claims')
    .select('user_id')
    .eq('repost_link', repostLink)
    .eq('status', 'approved')
    .neq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (linkUsedByOther) {
    logFraud(admin, userId, repostLink, 'duplicate_link', userCode);
    return json({
      success: false,
      status:  'rejected',
      reason:  'Эта ссылка уже была использована другим пользователем.',
      code:    userCode,
    });
  }

  // ── Скрапим страницу; для Reddit используем публичный JSON API ──────────
  let { text: pageText, ok: pageAccessible } = await fetchPage(repostLink);
  if (!pageAccessible && /reddit\.com/i.test(repostLink)) {
    const rr = await fetchRedditPost(repostLink);
    if (rr.ok) { pageText = rr.text; pageAccessible = true; }
  }

  // ── Проверка ──────────────────────────────────────────────────────────────
  let verdict: 'VALID' | 'INVALID' | 'PENDING';
  let reason:  string;

  // 1. Обязательно: URL должен быть постом в соцсети
  if (!looksLikeSocialPost(repostLink)) {
    logFraud(admin, userId, repostLink, 'invalid_social_url', userCode);
    verdict = 'INVALID';
    reason  = `Ссылка не соответствует формату поста в соцсети. Укажите прямую ссылку на публикацию (VK, Telegram, X/Twitter и др.) и убедитесь, что в тексте поста указан ваш код верификации: ${userCode}.`;
  }
  // 2. Страница доступна — ищем код верификации
  else if (pageAccessible) {
    const codeFound = pageText.toUpperCase().includes(userCode);
    if (!codeFound) {
      logFraud(admin, userId, repostLink, 'invalid_code_in_page', userCode);
      verdict = 'INVALID';
      reason  = `В тексте поста не найден ваш код верификации ${userCode}. Добавьте его в пост.`;
    } else {
      verdict = 'VALID';
      reason  = `Код верификации ${userCode} найден в посте.`;
    }
  }
  // 3. Страница недоступна (VK, Instagram, Twitter и др. блокируют серверные IP) —
  //    без возможности прочитать текст пост нельзя одобрить автоматически.
  else {
    verdict = 'PENDING';
    reason  = `Страница недоступна для автопроверки. Заявка поставлена в очередь. Убедитесь, что в посте есть ваш код ${userCode} и он публично доступен.`;
  }

  // ── Запись в БД ───────────────────────────────────────────────────────────
  const finalStatus = verdict === 'VALID'   ? 'approved'
                    : verdict === 'PENDING' ? 'pending'
                    : 'rejected';
  await admin.from('repost_claims').insert({
    user_id:      userId,
    repost_link:  repostLink,
    status:       finalStatus,
    ai_verdict:   {
      verdict,
      reason,
      page_accessible: pageAccessible,
      code_expected:   userCode,
    },
    processed_at: new Date().toISOString(),
  });

  console.log(`[verify-repost] user=${userId} code=${userCode} → ${finalStatus}: ${reason}`);

  return json({ success: verdict === 'VALID', status: finalStatus, reason, code: userCode });
});
