/**
 * Deno Deploy Proxy for Supabase (SPARK)
 * 
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ ДЛЯ DENO DEPLOY
 * Этот скрипт проксирует запросы от фронтенда в Supabase для обхода блокировок.
 * Deno.dev домены блокируются провайдерами РФ значительно реже, чем workers.dev.
 * 
 * КАК НАСТРОИТЬ И ЗАПУСТИТЬ:
 * 1. Зарегистрируйтесь на https://deno.com/deploy (можно войти через GitHub).
 * 2. Нажмите "New Playground".
 * 3. Скопируйте весь этот код и вставьте его в редактор кода Deno.
 * 4. Нажмите "Save & Deploy" (в правом верхнем углу).
 * 5. Справа сверху появится адрес вашего проекта (вида https://floral-butterfly-12.deno.dev).
 * 6. Скопируйте этот адрес и укажите его как SUPABASE_URL в вашем файле assets/js/config.js.
 */

const SUPABASE_HOST = 'ppehttbtrlavnrytoweu.supabase.co';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin') || '*';
  
  // 0. Базовые заголовки CORS, которые разрешают всё для браузера
  const corsHeaders = new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  });
  
  // Динамически разрешаем любые заголовки, которые браузер просит отправить
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
  if (requestedHeaders) {
    corsHeaders.set('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    corsHeaders.set('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer, x-client-info');
  }

  // 1. Обработка CORS preflight (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const url = new URL(request.url);
  const targetUrl = new URL(request.url);
  targetUrl.hostname = SUPABASE_HOST;

  // 2. Обработка WebSocket (Supabase Realtime)
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader === 'websocket') {
    targetUrl.protocol = 'wss:';
    
    // В Deno мы поднимаем WebSocket со стороны клиента
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(request);
    
    // И подключаемся к целевому WebSocket (Supabase)
    const targetSocket = new WebSocket(targetUrl.toString());

    // Перекидываем сообщения туда-обратно
    clientSocket.onmessage = (e) => {
      if (targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(e.data);
      }
    };

    targetSocket.onmessage = (e) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(e.data);
      }
    };

    const cleanup = () => {
      if (clientSocket.readyState === WebSocket.OPEN) clientSocket.close();
      if (targetSocket.readyState === WebSocket.OPEN) targetSocket.close();
    };

    clientSocket.onclose = cleanup;
    targetSocket.onclose = cleanup;
    clientSocket.onerror = cleanup;
    targetSocket.onerror = cleanup;

    // Добавляем CORS заголовки
    for (const [key, value] of corsHeaders.entries()) {
      response.headers.set(key, value);
    }
    
    return response;
  }

  // 3. Обработка HTTP запросов (REST, Auth)
  targetUrl.protocol = 'https:';

  const httpHeaders = new Headers(request.headers);
  httpHeaders.delete('Host'); // Удаляем оригинальный Host
  httpHeaders.delete('Content-Length'); // Удаляем оригинальный Content-Length, так как мы буферизируем тело

  const fetchOptions = {
    method: request.method,
    headers: httpHeaders,
    redirect: 'manual'
  };

  // Читаем тело целиком, чтобы избежать Transfer-Encoding: chunked (PostgREST зависает на нём)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    fetchOptions.body = await request.arrayBuffer(); 
  }

  try {
    const targetResponse = await fetch(targetUrl.toString(), fetchOptions);

    const proxyResponse = new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: new Headers(targetResponse.headers)
    });

    // Насильно ставим CORS заголовки
    for (const [key, value] of corsHeaders.entries()) {
      proxyResponse.headers.set(key, value);
    }

    // Обработка Location (редиректы)
    if (targetResponse.status >= 300 && targetResponse.status < 400) {
      const location = targetResponse.headers.get('Location');
      if (location && location.includes(SUPABASE_HOST)) {
        proxyResponse.headers.set('Location', location.replace(SUPABASE_HOST, url.host));
      }
    }

    return proxyResponse;
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, cause: 'Deno Proxy Error' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(corsHeaders.entries())
      }
    });
  }
});
