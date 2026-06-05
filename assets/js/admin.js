/**
 * SPARK Admin Panel — assets/js/admin.js
 * Loads after config.js which exposes window.SPARK_RUNTIME
 */
(function () {
  'use strict';

  var supa = null;
  var ME   = null;

  function escapeHTML(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(msg, color) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('toast-success', 'toast-error', 'toast-info');
    if (color && color.indexOf('red') !== -1) t.classList.add('toast-error');
    else if (color && (color.indexOf('ac2') !== -1 || color.indexOf('ac)') !== -1)) t.classList.add('toast-success');
    else t.style.background = color || 'rgba(8,12,28,0.95)';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._t);
    t._t = setTimeout(function () {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(14px)';
    }, 2800);
  }

  function showDenied() {
    var layout = document.getElementById('admLayout');
    if (!layout) return;
    layout.innerHTML = '<div class="adm-denied">'
      + '<div class="adm-denied-icon">🔒</div>'
      + '<div class="adm-denied-title">Доступ запрещён</div>'
      + '<p class="adm-denied-text">Эта страница доступна только администраторам SPARK.</p>'
      + '<a href="index.html" style="color:var(--vl2);font-size:13px;text-decoration:none;margin-top:8px">← Вернуться на главную</a>'
      + '</div>';
  }

  function renderPanel(stats, currentAnnouncement) {
    var layout = document.getElementById('admLayout');
    if (!layout) return;

    var totalUsers = stats ? escapeHTML(String(stats.total_users || '—')) : '—';
    var totalSpk   = stats ? (Number(stats.total_spk) || 0).toLocaleString() + ' SPK' : '—';

    var annText = currentAnnouncement || '';

    layout.innerHTML =
      /* Header */
      '<div class="adm-header">'
        + '<a href="index.html" class="adm-header-back" aria-label="Назад">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
        + 'Главная</a>'
        + '<div style="flex:1">'
        + '<div class="adm-title">Панель управления</div>'
        + '</div>'
        + '<span class="adm-badge">Admin</span>'
      + '</div>'

      /* Stats */
      + '<div class="adm-stats">'
        + '<div class="adm-stat-card">'
          + '<div class="adm-stat-icon">📊</div>'
          + '<div class="adm-stat-label">Пользователей</div>'
          + '<div class="adm-stat-val" id="statUsers">' + totalUsers + '</div>'
        + '</div>'
        + '<div class="adm-stat-card">'
          + '<div class="adm-stat-icon">💰</div>'
          + '<div class="adm-stat-label">SPK у пользователей</div>'
          + '<div class="adm-stat-val" id="statSpk">' + totalSpk + '</div>'
        + '</div>'
      + '</div>'

      /* Announcement */
      + '<div class="adm-section">'
        + '<div class="adm-section-title">'
          + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
          + 'Системное объявление'
        + '</div>'

        + '<div class="adm-ann-preview' + (annText ? ' visible' : '') + '" id="annPreview">'
          + '<div class="adm-ann-preview-label">Активное объявление</div>'
          + '<div id="annPreviewText">' + escapeHTML(annText) + '</div>'
        + '</div>'

        + '<label style="font-size:11px;color:var(--mu2);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;display:block;margin-bottom:6px">'
          + 'Системное сообщение для всех пользователей'
        + '</label>'
        + '<textarea class="adm-textarea" id="annInput" placeholder="Введите объявление для всех пользователей… Оставьте пустым, чтобы убрать баннер." maxlength="500">'
          + escapeHTML(annText)
        + '</textarea>'
        + '<div class="adm-hint">Сообщение появится как закрепляемый баннер в начале ленты для всех авторизованных пользователей. Если поле пустое — баннер скрыт.</div>'
        + '<button class="adm-btn" id="annSubmitBtn">'
          + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
          + 'Опубликовать объявление'
        + '</button>'
        + '<div class="adm-status" id="annStatus"></div>'
      + '</div>';

    /* Inject floating toast div if not present */
    if (!document.getElementById('toast')) {
      var td = document.createElement('div');
      td.id = 'toast';
      document.body.appendChild(td);
    }

    document.getElementById('annSubmitBtn').addEventListener('click', doPublishAnnouncement);
  }

  async function doPublishAnnouncement() {
    var input  = document.getElementById('annInput');
    var status = document.getElementById('annStatus');
    var btn    = document.getElementById('annSubmitBtn');
    if (!input || !status || !btn || !supa) return;

    var msg = input.value.trim();
    btn.disabled = true;
    btn.textContent = '⏳ Публикуем...';
    status.textContent = '';
    status.className = 'adm-status';

    try {
      var r = await supa.rpc('set_announcement', { p_message: msg });
      var result = r.data;

      if (r.error) throw r.error;
      if (result && result.success === false) {
        throw new Error(result.message || 'Ошибка');
      }

      // Update preview
      var preview  = document.getElementById('annPreview');
      var prevText = document.getElementById('annPreviewText');
      if (preview && prevText) {
        if (msg) {
          prevText.textContent = msg;
          preview.classList.add('visible');
        } else {
          prevText.textContent = '';
          preview.classList.remove('visible');
        }
      }

      status.textContent = msg ? '✓ Объявление опубликовано!' : '✓ Объявление удалено.';
      status.className = 'adm-status';
    } catch (e) {
      status.textContent = '✗ Ошибка: ' + (e.message || 'Попробуйте позже');
      status.className = 'adm-status error';
    }

    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Опубликовать объявление';
  }

  async function boot() {
    var cfg = window.SPARK_CONFIG || {};
    var url = cfg.SUPABASE_URL || '';
    var key = cfg.SUPABASE_ANON_KEY || '';

    if (!url || !key || typeof supabase === 'undefined') {
      showDenied();
      return;
    }

    try {
      supa = supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'spark_auth',
          flowType: 'pkce'
        }
      });
    } catch (e) {
      showDenied();
      return;
    }

    /* Verify session */
    var sessionRes = await supa.auth.getSession();
    if (!sessionRes.data || !sessionRes.data.session || !sessionRes.data.session.user) {
      window.location.href = 'index.html';
      return;
    }
    ME = sessionRes.data.session.user;

    /* Verify admin flag server-side via RPC */
    var statsRes = await supa.rpc('get_admin_stats');
    var stats = statsRes.data;

    if (!stats || stats.success === false) {
      showDenied();
      return;
    }

    /* Fetch current announcement */
    var annRes = await supa.from('system_announcements').select('message').eq('id', 1).single();
    var currentAnn = (annRes.data && annRes.data.message) ? annRes.data.message : '';

    renderPanel(stats, currentAnn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
