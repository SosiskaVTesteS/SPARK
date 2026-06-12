/**
 * SPARK — miniprofile.js
 * ─────────────────────────────────────────────────────────────
 * Модули:
 *  1. MOCK_USERS     — заглушки пользователей (заменить на API)
 *  2. MiniProfile    — открытие / закрытие / заполнение карточки
 *  3. Init           — точка входа
 * ─────────────────────────────────────────────────────────────
 * Интегрировано на уровне 10k$ с поддержкой Supabase в реальном времени.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. MOCK USERS (Локальный оффлайн-fallback)
   ═══════════════════════════════════════════════════════════ */
const MOCK_USERS = {
  1: {
    id:          1,
    name:        'Alex Kravtsov',
    handle:      '@alex_ventures',
    online:      true,
    rank:        'venture',
    rankIcon:    '⚡',
    rankLabel:   'Venture',
    ideas:       24,
    invested:    '12.4k',
    rankNum:     '#7',
    avatarLabel: 'АК',
    theme:       'violet',
  },
  2: {
    id:          2,
    name:        'Maria Orlova',
    handle:      '@maria_builds',
    online:      false,
    rank:        'seed',
    rankIcon:    '🌱',
    rankLabel:   'Seed',
    ideas:       3,
    invested:    '840',
    rankNum:     '#204',
    avatarLabel: 'МО',
    theme:       'teal',
  },
  3: {
    id:          3,
    name:        'Nova Dev',
    handle:      '@nova_dev',
    online:      true,
    rank:        'angel',
    rankIcon:    '✦',
    rankLabel:   'Angel',
    ideas:       11,
    invested:    '5.2k',
    rankNum:     '#38',
    avatarLabel: 'NV',
    theme:       'pink',
  },
};

/* ═══════════════════════════════════════════════════════════
   2. MINI PROFILE ENGINE
   ═══════════════════════════════════════════════════════════ */
const MiniProfile = (() => {

  /* ── DOM-ссылки ─────────────────────────────────────── */
  let portal, overlay, card, closeBtn;
  let elAvatar, elStatusDot, elName, elHandle;
  let elStatusBadge, elStatusDot2, elStatusLabel;
  let elRankBadge, elRankIcon, elRankLabel;
  let elStatIdeas, elStatInvested, elStatRank;
  let elBtnMessage, elBtnProfile, elNebula;

  let isOpen       = false;
  let currentUser  = null;
  let triggerEl    = null; // элемент, который открыл карточку (для возврата фокуса)

  /* ── Кэш профилей (для оптимизации и исключения лишних запросов к Supabase) ── */
  const profileCache = new Map();
  const CACHE_TTL = 180000; // 3 минуты жизни кэша

  /* БАГ #17: собственный профиль всегда «Онлайн» — пользователь физически
     смотрит на экран; presence-канал может ещё не синхронизироваться. */
  function _resolveOnline(userId) {
    if (window.ME && userId === window.ME.id) return true;
    return (window.ChatsEngine && typeof window.ChatsEngine.isUserOnline === 'function')
      ? window.ChatsEngine.isUserOnline(userId)
      : false;
  }

  /* ── Получить данные пользователя (Supabase / Mock) ── */
  async function fetchUser(userId) {
    const now = Date.now();
    if (profileCache.has(userId)) {
      const cached = profileCache.get(userId);
      if (now - cached.timestamp < CACHE_TTL) {
        // Online status changes frequently — always recompute it from the live presence channel
        return Object.assign({}, cached.data, { online: _resolveOnline(cached.data.id) });
      }
    }

    // Если Supabase подключен и передан UUID
    if (window.supa && typeof userId === 'string' && userId.length > 20) {
      try {
        // Запрос профиля из Supabase
        const pRes = await window.supa.from('profiles').select('*').eq('id', userId).single();
        if (pRes.data) {
          const row = pRes.data;

          // Подсчет идей автора
          let ideasCount = 0;
          const ideasRes = await window.supa.from('ideas').select('id', { count: 'exact', head: true }).eq('author_id', userId);
          if (ideasRes && !ideasRes.error) {
            ideasCount = ideasRes.count || 0;
          }

          // Расчет текущего ранга на основе баланса SPK
          let rankNum = '#—';
          const rankRes = await window.supa.from('profiles').select('id', { count: 'exact', head: true }).gt('spk_balance', row.spk_balance || 0);
          if (rankRes && !rankRes.error) {
            rankNum = '#' + (rankRes.count + 1);
          }

          // Цветовые темы MiniProfile в соответствии с индексом avatar_color
          const themes = ['violet', 'teal', 'pink'];
          const avatarColorIdx = Number(row.avatar_color) || 0;
          const theme = themes[avatarColorIdx % themes.length];

          // Вычисление лиги/ранга инвестора
          const bal = Number(row.spk_balance) || 0;
          let rankLabel = 'Seed';
          let rankIcon = '🌱';
          let rankClass = 'seed';
          
          if (bal >= 10000) {
            rankLabel = 'Venture';
            rankIcon = '⚡';
            rankClass = 'venture';
          } else if (bal >= 3000) {
            rankLabel = 'Angel';
            rankIcon = '✦';
            rankClass = 'angel';
          }

          let uname = row.username || '@user';
          if (!uname.startsWith('@')) uname = '@' + uname;

          const userData = {
            id:          row.id,
            name:        uname.replace('@', ''),
            handle:      uname,
            online:      _resolveOnline(row.id),
            rank:        rankClass,
            rankIcon:    rankIcon,
            rankLabel:   rankLabel,
            ideas:       ideasCount,
            invested:    bal.toLocaleString(),
            rankNum:     rankNum,
            avatarLabel: uname.replace('@', '').slice(0, 2).toUpperCase(),
            theme:       theme
          };
          profileCache.set(userId, { data: userData, timestamp: now });
          return userData;
        }
      } catch (err) {
        console.warn('[MiniProfile] Supabase profile fetch failed, using fallback:', err);
      }
    }

    // Если UUID не найден в БД или это локальный демо-ID
    const mockUser = MOCK_USERS[userId] ?? null;
    if (mockUser) {
      profileCache.set(userId, { data: mockUser, timestamp: now });
    }
    return mockUser;
  }

  /* ── Заполнить карточку данными ─────────────────────── */
  function populate(user) {
    /* Аватарка */
    elAvatar.textContent = user.avatarLabel;

    /* Тема карточки (цвет рамки, туманности, кнопок) */
    card.dataset.theme = user.theme;

    /* Статус-точка на аватарке */
    elStatusDot.className = `mp-card__status-dot ${user.online ? 'online' : 'offline'}`;

    /* Имя и хендл */
    elName.textContent   = user.name;
    elHandle.textContent = user.handle;

    /* Статус-бейдж */
    elStatusBadge.className = `mp-badge mp-badge--status ${user.online ? 'online' : 'offline'}`;
    
    const isRu = (window.LANG === 'ru');
    elStatusLabel.textContent = user.online 
      ? (isRu ? 'В сети' : 'Online') 
      : (isRu ? 'Офлайн' : 'Offline');

    /* Ранг-бейдж */
    elRankBadge.className = `mp-badge mp-badge--rank ${user.rank}`;
    elRankIcon.textContent  = user.rankIcon;
    elRankLabel.textContent = user.rankLabel;

    /* Статистика */
    elStatIdeas.textContent    = user.ideas;
    elStatInvested.textContent = user.invested;
    elStatRank.textContent     = user.rankNum;

    /* Динамическая локализация лейблов */
    const labelIdeas = document.getElementById('mpLabelIdeas');
    const labelInvested = document.getElementById('mpLabelInvested');
    const labelRank = document.getElementById('mpLabelRank');

    if (labelIdeas) labelIdeas.textContent = isRu ? 'Идей' : 'Ideas';
    if (labelInvested) labelInvested.textContent = isRu ? 'Вложено' : 'Invested';
    if (labelRank) labelRank.textContent = isRu ? 'Место' : 'Rank';

    /* Кнопки — добавляем data-user-id для обработчиков */
    elBtnMessage.dataset.userId = user.id;
    elBtnProfile.dataset.userId = user.id;

    /* Динамическая локализация текста кнопок с SVG */
    if (elBtnMessage) {
      elBtnMessage.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
        + '</svg>'
        + (isRu ? 'Написать' : 'Message');
      elBtnMessage.setAttribute('aria-label', isRu ? 'Написать сообщение' : 'Send message');
    }

    if (elBtnProfile) {
      elBtnProfile.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'
        + '<circle cx="12" cy="7" r="4"/>'
        + '</svg>'
        + (isRu ? 'Профиль' : 'Profile');
      elBtnProfile.setAttribute('aria-label', isRu ? 'Открыть полный профиль' : 'Open full profile');
    }

    /* Скрытие кнопки "Написать" для собственного профиля */
    const currentHandle = (window.PROFILE && window.PROFILE.username) ? String(window.PROFILE.username).toLowerCase().trim() : '';
    const clickedHandle = user.handle ? String(user.handle).toLowerCase().trim() : '';
    const isMe = (window.ME && String(window.ME.id) === String(user.id)) || 
                 (window.PROFILE && String(window.PROFILE.id) === String(user.id)) ||
                 (currentHandle && (currentHandle === clickedHandle || '@' + currentHandle === clickedHandle || currentHandle === '@' + clickedHandle));

    if (isMe) {
      elBtnMessage.style.display = 'none';
    } else {
      elBtnMessage.style.display = '';
    }
  }

  /* ── Открыть карточку ───────────────────────────────── */
  async function open(userId, triggerButton) {
    if (isOpen) await close(false); // если уже открыта — сначала закрыть

    triggerEl = triggerButton ?? null;

    // Установка состояния загрузки на триггере
    if (triggerEl) triggerEl.style.opacity = '0.6';

    const user = await fetchUser(userId);
    
    if (triggerEl) triggerEl.style.opacity = '';

    if (!user) {
      console.warn(`[MiniProfile] User ${userId} not found`);
      return;
    }

    currentUser = user;
    populate(user);

    /* Показываем портал */
    portal.setAttribute('aria-hidden', 'false');
    portal.classList.add('is-open');
    isOpen = true;

    /* Блокируем скролл страницы */
    document.body.style.overflow = 'hidden';

    /* Фокус на кнопку закрытия (доступность) */
    setTimeout(() => { if (closeBtn) closeBtn.focus(); }, 320);
  }

  /* ── Закрыть карточку ───────────────────────────────── */
  function close(restoreFocus = true) {
    if (!isOpen) return;

    /* Убираем фокус из карточки ДО выставления aria-hidden,
       иначе браузер выдаёт "Blocked aria-hidden on focused element" */
    if (card && card.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    portal.classList.remove('is-open');
    portal.setAttribute('aria-hidden', 'true');
    isOpen      = false;
    currentUser = null;

    /* Восстановить скролл */
    document.body.style.overflow = '';

    /* Вернуть фокус на триггер-элемент.
       Захватываем ссылку в локальную переменную ДО обнуления triggerEl —
       иначе замыкание setTimeout прочитает уже null. */
    if (restoreFocus && triggerEl) {
      var elToFocus = triggerEl;
      triggerEl = null;
      setTimeout(function () { if (elToFocus) elToFocus.focus(); }, 280);
    } else {
      triggerEl = null;
    }
  }

  /* ── Обработчики кнопок внутри карточки ────────────── */
  function onMessageClick() {
    const userId = elBtnMessage.dataset.userId;
    if (!userId) { close(); return; }

    console.log(`[MiniProfile] → Инициализация чата с ID: ${userId}`);

    // Переключение панели на чаты
    if (typeof window.openPanel === 'function') {
      window.openPanel('chats');
    }

    // Добавление в кэш контактов при необходимости
    const contactsKey = 'spark_chat_contacts';
    let contacts = [];
    try {
      const cached = localStorage.getItem(contactsKey);
      if (cached) contacts = JSON.parse(cached);
    } catch (e) {}

    const exists = contacts.some(c => String(c.id) === String(userId));
    if (!exists && currentUser) {
      contacts.push({
        id: currentUser.id,
        name: currentUser.handle,
        username: currentUser.handle,
        online: currentUser.online,
        avColor: currentUser.theme === 'violet' ? 0 : currentUser.theme === 'teal' ? 1 : 2,
        preview: 'Signal room opened.'
      });
      try {
        localStorage.setItem(contactsKey, JSON.stringify(contacts));
      } catch (e) {}

      // Обновление списка чатов
      if (window.ChatsEngine && typeof window.ChatsEngine.renderChatList === 'function') {
        window.ChatsEngine.renderChatList();
      }
    }

    // Выбор канала в движке чатов
    if (window.ChatsEngine && typeof window.ChatsEngine.selectChannel === 'function') {
      window.ChatsEngine.selectChannel(userId);
    }

    close();
  }

  function onProfileClick() {
    const isRu = (window.LANG === 'ru');
    const msg = isRu 
      ? 'Полный профиль пользователя будет доступен в следующем обновлении SPARK!' 
      : 'Full user profiles will be available in the next SPARK release!';
    
    if (window.toast) {
      window.toast(msg, 'var(--ac2)', 'info');
    } else {
      alert(msg);
    }
    
    close();
  }

  /* ── Инициализация ──────────────────────────────────── */
  function init() {
    /* Получаем DOM-элементы */
    portal        = document.getElementById('miniProfilePortal');
    overlay       = document.getElementById('mpOverlay');
    card          = document.getElementById('mpCard');
    closeBtn      = document.getElementById('mpClose');
    elNebula      = document.getElementById('mpNebula');

    elAvatar      = document.getElementById('mpAvatar');
    elStatusDot   = document.getElementById('mpStatusDot');
    elName        = document.getElementById('mpUserName');
    elHandle      = document.getElementById('mpHandle');

    elStatusBadge = document.getElementById('mpStatusBadge');
    elStatusLabel = document.getElementById('mpStatusLabel');

    elRankBadge   = document.getElementById('mpRankBadge');
    elRankIcon    = document.getElementById('mpRankIcon');
    elRankLabel   = document.getElementById('mpRankLabel');

    elStatIdeas    = document.getElementById('mpStatIdeas');
    elStatInvested = document.getElementById('mpStatInvested');
    elStatRank     = document.getElementById('mpStatRank');

    elBtnMessage  = document.getElementById('mpBtnMessage');
    elBtnProfile  = document.getElementById('mpBtnProfile');

    if (!portal) {
      console.warn('[MiniProfile] #miniProfilePortal not found');
      return;
    }

    /* Закрытие через overlay */
    overlay.addEventListener('click', () => close());

    /* Закрытие через кнопку × */
    closeBtn.addEventListener('click', () => close());

    /* Закрытие через Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) close();
    });

    /* Кнопки действий */
    elBtnMessage.addEventListener('click', onMessageClick);
    elBtnProfile.addEventListener('click', onProfileClick);

    /* Фокус-trap: Tab внутри карточки */
    card.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;

      const focusable = card.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    /* Подписываемся на все триггеры в документе */
    bindTriggers();

    /* MutationObserver — подхватывает новые триггеры (динамический контент) */
    let boundRafId = null;
    const observer = new MutationObserver(() => {
      if (boundRafId) return;
      boundRafId = requestAnimationFrame(() => {
        bindTriggers();
        boundRafId = null;
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Привязать обработчики ко всем .mp-trigger ──────── */
  function bindTriggers() {
    document.querySelectorAll('.mp-trigger:not([data-mp-bound])').forEach(btn => {
      btn.setAttribute('data-mp-bound', '');

      btn.addEventListener('click', e => {
        e.stopPropagation();
        const userId = btn.dataset.userId;
        if (!userId) return;
        open(userId, btn);
      });

      /* Клавиатурная доступность */
      btn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          btn.click();
        }
      });
    });
  }

  /* ── Реактивное обновление статуса из ChatsEngine ───── */
  function onPresenceUpdate(presenceState) {
    if (!isOpen || !currentUser) return;
    /* БАГ #17: для собственного профиля presence-снимок не важен — мы онлайн */
    const isOnline = (window.ME && currentUser.id === window.ME.id) || !!(
      presenceState &&
      presenceState[currentUser.id] &&
      presenceState[currentUser.id].length > 0
    );
    if (currentUser.online !== isOnline) {
      currentUser.online = isOnline;
      populate(currentUser);
    }
  }

  /* ── Публичный API ──────────────────────────────────── */
  return { init, open, close, onPresenceUpdate };

})();

/* Экспорт в глобальный объект — нужен ChatsEngine для связи через onPresenceUpdate */
window.MiniProfile = MiniProfile;

/* Авто-инициализация при загрузке страницы */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => MiniProfile.init());
} else {
  MiniProfile.init();
}
