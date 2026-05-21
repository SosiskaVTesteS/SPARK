/**
 * Мягкая обработка ошибок опциональных и внешних интеграций.
 */
function integrationMessage(feature) {
  var key = 'integration_' + feature;
  if (typeof T === 'function') {
    var msg = T(key);
    if (msg && msg !== key) return msg;
  }
  var fallback = {
    auth: 'Sign-in and registration are unavailable. Check Supabase configuration.',
    database: 'Live data is unavailable. You can still browse demo content.',
    realtime: 'Live updates are temporarily unavailable.',
    invest: 'Investing is temporarily unavailable.',
    publish: 'Publishing is temporarily unavailable.',
    registration: 'Email verification is temporarily unavailable. Try again later.'
  };
  return fallback[feature] || 'This feature is temporarily unavailable.';
}

function isAuthError(err) {
  if (!err) return false;
  var status = err.status || err.statusCode;
  if (status === 401 || status === 403) return true;
  var msg = String(err.message || err).toLowerCase();
  return msg.indexOf('invalid api key') !== -1 || msg.indexOf('jwt') !== -1;
}

/**
 * Reads the Supabase access_token directly from localStorage as a fallback
 * when supa is null or auth.getSession() fails (e.g. CDN load error).
 */
function getStoredSessionToken() {
  try {
    var storageKey = 'spark_auth';
    var raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    var d = JSON.parse(raw);
    // Supabase v2 stores session under currentSession or directly
    var s = d && (d.access_token ? d : (d.currentSession || d.session || null));
    return (s && s.access_token) ? s.access_token : null;
  } catch (e) { return null; }
}

function registrationErrorMessage(result) {
  if (!result) return integrationMessage('registration');
  if (result.error && !result.status) {
    return typeof T === 'function' ? T('reg_err_network') : 'Network error. Check your connection.';
  }
  var status = result.status;
  var msg = (result.body && result.body.message) || (result.error && result.error.message) || '';
  if (status === 504) {
    // Edge Function timed out — cold start or server overload
    return typeof T === 'function' ? T('reg_err_network') : 'Server took too long. Please try again.';
  }
  if (status === 404) {
    return typeof T === 'function' ? T('reg_err_functions') : integrationMessage('registration');
  }
  if (
    status === 503 ||
    msg.indexOf('Email delivery') !== -1 ||
    msg.indexOf('verification email') !== -1
  ) {
    return typeof T === 'function' ? T('reg_err_email') : msg || integrationMessage('registration');
  }
  if (
    status === 500 &&
    (msg.indexOf('Could not start') !== -1 || msg.indexOf('Server configuration') !== -1)
  ) {
    return typeof T === 'function' ? T('reg_err_migration') : msg;
  }
  if (status === 400 && msg.indexOf('Invalid registration') !== -1) {
    return typeof T === 'function' ? T('reg_err_invalid') : msg;
  }
  if (status === 429) {
    return typeof T === 'function' ? T('reg_err_rate_limit') : msg;
  }
  if (msg) return msg;
  return integrationMessage('registration');
}

function featureToast(feature, err, color) {
  var msg = integrationMessage(feature);
  if (err && isAuthError(err)) {
    msg = integrationMessage('auth');
  }
  if (typeof toast === 'function') {
    toast(msg, color || 'var(--red)');
  } else {
    console.warn('[integration]', feature, err || '');
  }
  return msg;
}

async function safeSupabaseCall(feature, fn, options) {
  options = options || {};
  if (!supa && !options.allowDemo) {
    if (!options.silent) featureToast(feature);
    return { ok: false, error: new Error('supabase_unavailable'), demo: true };
  }
  
  var timeoutMs = options.timeout || 25000;
  
  try {
    var result = await Promise.race([
      fn(),
      new Promise(function(_, reject) { setTimeout(function() { reject(new Error('timeout')); }, timeoutMs); })
    ]);
    if (result && result.error) {
      if (!options.silent) featureToast(feature, result.error);
      return { ok: false, error: result.error, data: result.data };
    }
    return { ok: true, data: result };
  } catch (e) {
    if (!options.silent) featureToast(feature, e);
    return { ok: false, error: e };
  }
}

async function callEdgeFunction(name, body) {
  // Registration endpoints have verify_jwt = false and work without an active Supabase session.
  // Only check SUPABASE_URL + SUPABASE_ANON_KEY for them; avoid blocking on supa === null.
  var isPublicEndpoint = (name === 'register-send-code' || name === 'register-verify');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, error: new Error('supabase_unconfigured'), status: 503 };
  }
  if (!isPublicEndpoint && !supa) {
    return { ok: false, error: new Error('supabase_unavailable') };
  }

  var url = SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/' + name;
  var token = SUPABASE_ANON_KEY;
  if (!isPublicEndpoint) {
    if (supa) {
      try {
        var sessionData = await supa.auth.getSession();
        var session = sessionData && sessionData.data && sessionData.data.session;
        if (session && session.access_token) {
          token = session.access_token;
        } else {
          // getSession returned empty — try localStorage directly
          var stored = getStoredSessionToken();
          if (stored) token = stored;
          else return { ok: false, error: new Error('not_authenticated') };
        }
      } catch (e) {
        var stored = getStoredSessionToken();
        if (stored) token = stored;
        else return { ok: false, error: new Error('not_authenticated') };
      }
    } else {
      // supa unavailable (CDN load failed) — try localStorage directly
      var stored = getStoredSessionToken();
      if (stored) token = stored;
      else return { ok: false, error: new Error('supabase_unavailable') };
    }
  }


  var controller = new AbortController();
  var timeoutId = setTimeout(function () {
    controller.abort();
  }, 20000); // 20s — accommodates Edge Function cold starts (~8-12s) with margin

  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        apikey: SUPABASE_ANON_KEY
      },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    var json = {};
    try {
      json = await res.json();
    } catch (parseErr) {
      json = { message: 'Invalid server response' };
    }
    if (!res.ok) {
      return { ok: false, error: new Error(json.message || json.error || 'request_failed'), status: res.status, body: json };
    }
    return { ok: true, data: json };
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      // Timed out — return a status so the caller can show a meaningful message
      return { ok: false, error: new Error('timeout'), status: 504 };
    }
    return { ok: false, error: e };
  }
}
