/**
 * Cloudflare Worker Proxy for Supabase (SPARK)
 *
 * Этот скрипт проксирует запросы от вашего фронтенда в Supabase, чтобы обойти блокировки провайдеров.
 * Он поддерживает стандартные HTTP-запросы (REST API, Auth, Edge Functions) и WebSocket-соединения для Realtime.
 *
 * КАК НАСТРОИТЬ И ЗАПУСТИТЬ:
 * 1. Зарегистрируйтесь/войдите в бесплатный аккаунт Cloudflare (https://dash.cloudflare.com).
 * 2. Перейдите во вкладку "Workers & Pages" в левом меню.
 * 3. Нажмите "Create Application" -> "Create Worker".
 * 4. Задайте имя (например, `spark-supabase-proxy`) и нажмите "Deploy".
 * 5. Нажмите "Edit Code", вставьте содержимое этого файла полностью вместо стандартного кода.
 * 6. Нажмите "Save and deploy" в верхнем правом углу.
 * 7. Скопируйте URL вашего воркера (например, `https://spark-supabase-proxy.ваше-имя.workers.dev`).
 * 8. Откройте файл `assets/js/config.js` в проекте SPARK и замените значение `SUPABASE_URL` на полученный URL воркера.
 *    Пример: SUPABASE_URL: 'https://spark-supabase-proxy.ваше-имя.workers.dev'
 */

const SUPABASE_HOST = 'ppehttbtrlavnrytoweu.supabase.co';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // 1. Обработка CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin)
      });
    }

    // 2. Обработка WebSocket для Supabase Realtime (подписки)
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      const targetWsUrl = new URL(request.url);
      targetWsUrl.hostname = SUPABASE_HOST;
      targetWsUrl.protocol = 'wss:';

      const [client, server] = new WebSocketPair();
      server.accept();

      // Создаем WebSocket соединение с реальным сервером Supabase
      const response = await fetch(targetWsUrl.toString(), {
        headers: request.headers,
        webSocket: server
      });

      const responseHeaders = new Headers(response.headers);
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: responseHeaders
      });
    }

    // 3. Обработка обычных HTTP-запросов (REST, Auth, etc.)
    const targetUrl = new URL(request.url);
    targetUrl.hostname = SUPABASE_HOST;
    targetUrl.protocol = 'https:';

    const headers = new Headers(request.headers);
    headers.set('Host', SUPABASE_HOST);

    const fetchOptions = {
      method: request.method,
      headers: headers,
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
    }

    try {
      const response = await fetch(targetUrl.toString(), fetchOptions);

      const responseHeaders = new Headers(response.headers);
      Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      // Перенаправляем редиректы, чтобы они оставались на домене прокси
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location && location.includes(SUPABASE_HOST)) {
          const newLocation = location.replace(SUPABASE_HOST, url.host);
          responseHeaders.set('Location', newLocation);
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      });
    }
  }
};

function getCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}
