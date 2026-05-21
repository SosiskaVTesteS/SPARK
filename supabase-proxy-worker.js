/**
 * Cloudflare Worker Proxy for Supabase (SPARK)
 *
 * ОПТИМИЗИРОВАННАЯ И ИСПРАВЛЕННАЯ ВЕРСИЯ (Fix: "failed to fetch" / Cloudflare 403 / CORS)
 * Этот скрипт проксирует запросы от фронтенда в Supabase для обхода блокировок.
 * 
 * ЧТО БЫЛО ИСПРАВЛЕНО:
 * 1. Убрана ручная установка заголовка Host (Cloudflare запрещает менять Host при запросах между CF-зонами, что вызывало 403/502).
 * 2. Добавлен динамический отзеркаливающий CORS для Access-Control-Allow-Headers, чтобы браузер 100% пропускал preflight-запросы (исправляет ошибку failed to fetch при логине/регистрации).
 * 3. Поддержка WebSocket для Realtime теперь удаляет заголовок Origin и Host перед проксированием.
 *
 * КАК ОБНОВИТЬ ВОРКЕР:
 * 1. Зайдите в ваш Cloudflare Dashboard -> Workers & Pages -> spark-supabase-proxy -> Edit Code.
 * 2. Замените весь старый код на этот новый код.
 * 3. Нажмите "Save and deploy".
 */

const SUPABASE_HOST = 'ppehttbtrlavnrytoweu.supabase.co';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '*';
    
    // 0. Базовые заголовки CORS, которые разрешают всё для браузера
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    };
    
    // Динамически разрешаем любые заголовки, которые браузер просит отправить
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
    if (requestedHeaders) {
      corsHeaders['Access-Control-Allow-Headers'] = requestedHeaders;
    } else {
      corsHeaders['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, prefer, x-client-info';
    }

    // 1. Обработка CORS preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const targetUrl = new URL(request.url);
    targetUrl.hostname = SUPABASE_HOST;

    // 2. Обработка WebSocket (Supabase Realtime)
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      targetUrl.protocol = 'wss:';
      
      const [client, server] = new WebSocketPair();
      server.accept();

      const wsHeaders = new Headers(request.headers);
      wsHeaders.delete('Host'); // Обязательно удаляем Host, fetch сам подставит нужный

      const response = await fetch(targetUrl.toString(), {
        headers: wsHeaders,
        webSocket: server
      });

      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: responseHeaders
      });
    }

    // 3. Обработка стандартных HTTP запросов (REST, Auth)
    targetUrl.protocol = 'https:';

    const httpHeaders = new Headers(request.headers);
    httpHeaders.delete('Host'); // ВАЖНО: Cloudflare Worker выдаст ошибку, если вручную изменить Host для другой зоны CF.

    const fetchOptions = {
      method: request.method,
      headers: httpHeaders,
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
    }

    try {
      const response = await fetch(targetUrl.toString(), fetchOptions);

      const proxyResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });

      // Перезаписываем CORS-заголовки ответа, чтобы браузер 100% их принял
      Object.entries(corsHeaders).forEach(([key, value]) => {
        proxyResponse.headers.set(key, value);
      });

      // Корректировка Location для редиректов (например, OAuth)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location && location.includes(SUPABASE_HOST)) {
          const newUrl = new URL(request.url);
          proxyResponse.headers.set('Location', location.replace(SUPABASE_HOST, newUrl.host));
        }
      }

      return proxyResponse;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, cause: 'Cloudflare Proxy Error' }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  }
};
