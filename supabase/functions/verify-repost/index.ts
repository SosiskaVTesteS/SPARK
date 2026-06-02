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

// Rate limit: одна заявка в 5 минут
const RATE_LIMIT_MS = 5 * 60 * 1000;

// Gemini: модель
const GEMINI_MODEL = 'gemini-1.5-flash';

// ── Извлечение JSON из ответа Gemini (терпит markdown-обёртки) ──────────────
function extractJson(raw: string): { is_valid: boolean; reason: string } | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.is_valid === 'boolean' && typeof parsed.reason === 'string') {
      return { is_valid: parsed.is_valid, reason: parsed.reason };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Промпт для Gemini ──────────────────────────────────────────────────────
function buildPrompt(link: string, pageText: string): string {
  return (
    `Ты — ИИ-модератор платформы SPARK. Твоя задача — проверить, опубликовал ли пользователь рекламный пост со ссылкой на наш сайт.\n` +
    `Ссылка на пост: ${link}\n\n` +
    `Полученный текст/мета-данные страницы:\n${pageText}\n\n` +
    `Проверь условия:\n` +
    `1. Ссылка ведёт на публичный пост в соцсети (X/Twitter, Telegram, VK, Reddit и т.д.) ИЛИ выглядит как настоящая ссылка на пост в соцсети.\n` +
    `2. В тексте поста или мета-данных упоминается SPARK, spark.app или похожий домен в положительном/нейтральном контексте.\n` +
    `3. Пост не выглядит как спам-бот, оскорбление или накрутка.\n\n` +
    `Если страница недоступна (Cloudflare, стена авторизации), оцени саму структуру ссылки — похожа ли она на реальный пост в соцсети (например, twitter.com/user/status/..., t.me/channel/..., vk.com/wall...).\n\n` +
    `Верни СТРОГО JSON-объект без разметки markdown:\n` +
    `{"is_valid": true | false, "reason": "краткое объяснение вердикта на русском языке"}`
  );
}

// ── Извлечение текста из HTML ──────────────────────────────────────────────
function extractTextFromHtml(html: string): string {
  // Метатеги og:description и twitter:description
  const metaMatches: string[] = [];
  const metaRe = /<meta[^>]+(?:property|name)="(?:og:|twitter:)?description"[^>]+content="([^"]{0,500})"/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) metaMatches.push(m[1]);

  const titleRe = /<title[^>]*>([^<]{0,200})<\/title>/i;
  const titleM  = titleRe.exec(html);
  const title   = titleM ? titleM[1] : '';

  // Убираем скрипты, стили, теги — оставляем видимый текст
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const combined = [title, ...metaMatches, stripped].join('\n').slice(0, 3000);
  return combined || '(текст страницы недоступен)';
}

// ── Социальные сети: ссылка выглядит как пост? ────────────────────────────
function looksLikeSocialPost(url: string): boolean {
  return /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(url)
    || /t\.me\/[^/]+\/\d+/i.test(url)
    || /vk\.com\/wall[-\d_]+/i.test(url)
    || /reddit\.com\/r\/\w+\/comments\//i.test(url)
    || /linkedin\.com\/posts?\//i.test(url);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  // ── Переменные окружения ─────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const geminiKey   = Deno.env.get('GEMINI_API_KEY');

  if (!supabaseUrl || !serviceKey) return json({ message: 'Server configuration error' }, 500);
  if (!geminiKey) {
    console.error('[verify-repost] GEMINI_API_KEY not set');
    return json({ message: 'AI service not configured' }, 500);
  }

  // ── Авторизация пользователя ─────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') || '';
  const token      = authHeader.replace('Bearer ', '').trim();
  if (!token) return json({ message: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json({ message: 'Unauthorized' }, 401);

  const userId = user.id;

  // ── Тело запроса ─────────────────────────────────────────────────────────
  let payload: { repost_link?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }

  const repostLink = (payload.repost_link || '').trim();
  if (!repostLink) return json({ message: 'repost_link is required' }, 400);

  // Базовая валидация URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(repostLink);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol');
  } catch {
    return json({ message: 'invalid_url' }, 400);
  }

  // ── Rate limit: не чаще 1 раза в 5 минут ─────────────────────────────────
  const rateCutoff = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  const { data: recentClaim } = await admin
    .from('repost_claims')
    .select('id, created_at')
    .eq('user_id', userId)
    .gte('created_at', rateCutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentClaim) {
    const waitSec = Math.ceil(
      (new Date(recentClaim.created_at).getTime() + RATE_LIMIT_MS - Date.now()) / 1000
    );
    return json({ message: 'rate_limited', wait_seconds: waitSec }, 429);
  }

  // ── Проверяем: не было ли уже одобренной заявки (ачивка одноразовая) ──────
  const { data: alreadyApproved } = await admin
    .from('repost_claims')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  if (alreadyApproved) {
    return json({ message: 'already_approved', status: 'approved' });
  }

  // ── Создаём запись в pending-состоянии (фиксируем заявку до результата) ──
  const { data: claimRow, error: insertErr } = await admin
    .from('repost_claims')
    .insert({ user_id: userId, repost_link: repostLink, status: 'pending' })
    .select('id')
    .single();

  if (insertErr || !claimRow) {
    console.error('[verify-repost] insert claim error:', insertErr?.message);
    return json({ message: 'Database error' }, 500);
  }

  const claimId = claimRow.id;

  // ── Скрапинг страницы по ссылке ──────────────────────────────────────────
  let pageText = '(страница недоступна для скрапинга)';
  const isSocialLink = looksLikeSocialPost(repostLink);

  try {
    const fetchCtrl = new AbortController();
    const fetchTimeout = setTimeout(() => fetchCtrl.abort(), 7000);

    const pageRes = await fetch(repostLink, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      },
      signal: fetchCtrl.signal,
      redirect: 'follow',
    });
    clearTimeout(fetchTimeout);

    if (pageRes.ok) {
      const contentType = pageRes.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        const html = await pageRes.text();
        pageText = extractTextFromHtml(html);
      } else {
        pageText = `(нетекстовый ответ: ${contentType})`;
      }
    } else {
      pageText = `(HTTP ${pageRes.status} при загрузке страницы)`;
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.warn('[verify-repost] page fetch failed:', errMsg);
    pageText = isSocialLink
      ? `(страница недоступна — возможно, требует авторизации; ссылка похожа на пост в соцсети)`
      : `(страница недоступна: ${errMsg})`;
  }

  // ── Вызов Gemini 1.5 Flash ────────────────────────────────────────────────
  const prompt     = buildPrompt(repostLink, pageText);
  const geminiUrl  =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`;

  const geminiCtrl = new AbortController();
  const geminiTimeout = setTimeout(() => geminiCtrl.abort(), 20000);

  let verdict: { is_valid: boolean; reason: string };

  try {
    const gRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
      signal: geminiCtrl.signal,
    });
    clearTimeout(geminiTimeout);

    if (!gRes.ok) {
      const errText = await gRes.text();
      console.error('[verify-repost] Gemini HTTP error', gRes.status, errText);
      await admin.from('repost_claims').update({ status: 'rejected', processed_at: new Date().toISOString(),
        ai_verdict: { error: 'gemini_api_error', status: gRes.status } }).eq('id', claimId);
      return json({ message: 'AI service error' }, 502);
    }

    const gData   = await gRes.json();
    const rawText: string = gData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed  = extractJson(rawText);

    if (!parsed) {
      console.error('[verify-repost] unparseable Gemini response:', rawText);
      await admin.from('repost_claims').update({ status: 'rejected', processed_at: new Date().toISOString(),
        ai_verdict: { error: 'parse_error', raw: rawText.slice(0, 500) } }).eq('id', claimId);
      return json({ message: 'AI response parse error' }, 502);
    }

    verdict = parsed;
  } catch (e) {
    clearTimeout(geminiTimeout);
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('[verify-repost] Gemini fetch error:', errMsg);
    await admin.from('repost_claims').update({ status: 'rejected', processed_at: new Date().toISOString(),
      ai_verdict: { error: 'gemini_unreachable' } }).eq('id', claimId);
    return json({ message: 'AI service unreachable' }, 502);
  }

  // ── Записываем результат в repost_claims ──────────────────────────────────
  const finalStatus = verdict.is_valid ? 'approved' : 'rejected';

  await admin
    .from('repost_claims')
    .update({
      status:       finalStatus,
      ai_verdict:   { is_valid: verdict.is_valid, reason: verdict.reason },
      processed_at: new Date().toISOString(),
    })
    .eq('id', claimId);

  console.log(`[verify-repost] user=${userId} link=${repostLink} → ${finalStatus}: ${verdict.reason}`);

  // ── Ответ клиенту ─────────────────────────────────────────────────────────
  return json({
    success: verdict.is_valid,
    status:  finalStatus,
    reason:  verdict.reason,
  });
});
