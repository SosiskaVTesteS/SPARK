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

const RATE_LIMIT_MS = 5 * 60 * 1000;

// ── Генерируем уникальный код из user_id (детерминированный, без БД) ────────
function getUserCode(userId: string): string {
  const clean = userId.replace(/-/g, '').toUpperCase();
  return 'SPARK-' + clean.slice(0, 6);
}

// ── Шаблоны постов в соцсетях ──────────────────────────────────────────────
const SOCIAL_POST_PATTERNS = [
  /(?:twitter\.com|x\.com)\/\w[\w_]+\/status\/\d+/i,
  /t\.me\/[^/?#\s]+\/\d+/i,
  /vk\.com\/wall-?\d+_\d+/i,
  /vk\.com\/[^/?#\s]+\?w=wall-?\d+_\d+/i,
  /reddit\.com\/r\/\w+\/comments\//i,
  /linkedin\.com\/posts?\//i,
  /instagram\.com\/p\//i,
  /facebook\.com\/[^/?#\s]+\/posts?\//i,
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
  const userCode = getUserCode(userId); // e.g. "SPARK-A3F2B1"

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

  // ── Уже одобрено? ─────────────────────────────────────────────────────────
  const { data: alreadyApproved } = await admin
    .from('repost_claims').select('id').eq('user_id', userId).eq('status', 'approved')
    .limit(1).maybeSingle();
  if (alreadyApproved) return json({ message: 'already_approved', status: 'approved' });

  // ── Скрапим страницу (несколько UA) ───────────────────────────────────────
  const { text: pageText, ok: pageAccessible } = await fetchPage(repostLink);

  // ── Проверка ──────────────────────────────────────────────────────────────
  let verdict: 'VALID' | 'INVALID';
  let reason:  string;

  // 1. Обязательно: URL должен быть постом в соцсети
  if (!looksLikeSocialPost(repostLink)) {
    verdict = 'INVALID';
    reason  = 'Ссылка не соответствует формату поста в соцсети (VK, Telegram, X/Twitter и др.).';
  }
  // 2. Страница доступна — ищем код верификации
  else if (pageAccessible) {
    const codeFound = pageText.toUpperCase().includes(userCode);
    if (!codeFound) {
      verdict = 'INVALID';
      reason  = `В тексте поста не найден ваш код верификации ${userCode}. Добавьте его в пост.`;
    } else {
      verdict = 'VALID';
      reason  = `Код верификации ${userCode} найден в посте.`;
    }
  }
  // 3. Страница недоступна — сообщаем что нужно сделать
  else {
    verdict = 'INVALID';
    reason  = `Не удалось прочитать пост. Убедитесь что канал/профиль публичный, или сделайте пост общедоступным. Код верификации ${userCode} должен быть в тексте.`;
  }

  // ── Запись в БД ───────────────────────────────────────────────────────────
  const finalStatus = verdict === 'VALID' ? 'approved' : 'rejected';
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
