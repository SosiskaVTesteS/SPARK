/* ═══════════════════════════════════════════════════════
   SPARK — chats-engine.js   ChatsEngine v1
   Complete high-fidelity chat experience with real-time sync,
   attachment insertion, localStorage cache, and emojis.
   ═══════════════════════════════════════════════════════ */
'use strict';

var ChatsEngine = (function () {

  // State Model
  var state = {
    activeChannelId: null,      // e.g. '@maria_builds' or 'defi-prophets'
    searchQuery: '',
    composedAttachment: null,   // Holds { title, sub, url }
    realtimeChannel: null,
    presenceChannel: null,      // Track presence
    modalTab: 'DM',              // 'DM' or 'TEAM'
    initialized: false,
    isTabActive: true,
    multiSelectMode: false,
    selectedContacts: [],
    searchMatches: [],
    searchActiveIndex: -1,
    pinSelectMode: false,
    selectedPinMessages: [],
    pinnedMessages: [],
    activePinIndex: 0
  };

  var pollingInterval = null;

  // Preloaded Contacts (DMs) - Defaults
  var DEFAULT_CONTACTS = [];

  // Preloaded Teams/Groups - Defaults
  var DEFAULT_TEAMS = [];

  // Preset Rich Media Attachments (Photo 1 UI inspiration)
  var ATTACHMENTS = [
    {
      id: 'defianalytics',
      title: 'DeFi Analytics Dashboard',
      sub: 'Interactive analytics graph, SPK/USD momentum',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="140" viewBox="0 0 250 140"><rect width="250" height="140" fill="%230b0d19"/><path d="M20,110 L80,70 L140,90 L200,40 L230,20" fill="none" stroke="%237b5cfa" stroke-width="3"/><circle cx="80" cy="70" r="4" fill="%23e85aa0"/><circle cx="140" cy="90" r="4" fill="%23e85aa0"/><circle cx="200" cy="40" r="4" fill="%23e85aa0"/><text x="15" y="25" fill="%23ffffff" font-family="sans-serif" font-size="10" font-weight="bold">DeFi Momentum</text></svg>'
    },
    {
      id: 'aipredictive',
      title: 'AI Predictive Weights',
      sub: 'TensorFlow modeling signals overlay network',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="140" viewBox="0 0 250 140"><rect width="250" height="140" fill="%230b0d19"/><circle cx="60" cy="70" r="10" fill="%23e85aa0" opacity="0.8"/><circle cx="130" cy="40" r="10" fill="%237b5cfa" opacity="0.8"/><circle cx="130" cy="100" r="10" fill="%237b5cfa" opacity="0.8"/><circle cx="200" cy="70" r="10" fill="%23e8c55a" opacity="0.8"/><line x1="70" y1="70" x2="120" y2="40" stroke="%23ffffff" stroke-width="1.5" stroke-dasharray="3"/><line x1="70" y1="70" x2="120" y2="100" stroke="%23ffffff" stroke-width="1.5" stroke-dasharray="3"/><line x1="140" y1="40" x2="190" y2="70" stroke="%23ffffff" stroke-width="1.5"/><line x1="140" y1="100" x2="190" y2="70" stroke="%23ffffff" stroke-width="1.5"/><text x="15" y="25" fill="%23ffffff" font-family="sans-serif" font-size="10" font-weight="bold">Neural Node Network</text></svg>'
    },
    {
      id: 'solarperformance',
      title: 'Solar Grid Statistics',
      sub: 'Decentralized energy tokens throughput metric',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="140" viewBox="0 0 250 140"><rect width="250" height="140" fill="%230b0d19"/><rect x="40" y="80" width="25" height="40" fill="%237b5cfa"/><rect x="85" y="50" width="25" height="70" fill="%237b5cfa"/><rect x="130" y="30" width="25" height="90" fill="%23e85aa0"/><rect x="175" y="60" width="25" height="60" fill="%23e8c55a"/><text x="15" y="25" fill="%23ffffff" font-family="sans-serif" font-size="10" font-weight="bold">Energy Throughput (MWh)</text></svg>'
    },
    {
      id: 'sparkcore',
      title: 'SPARK Glassmorphic Core',
      sub: 'Premium interface aesthetics node design',
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="250" height="140" viewBox="0 0 250 140"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%237b5cfa"/><stop offset="100%" stop-color="%23e85aa0"/></linearGradient></defs><rect width="250" height="140" fill="%230b0d19"/><rect x="40" y="30" width="170" height="80" rx="15" fill="url(%23g)" opacity="0.6"/><rect x="60" y="45" width="130" height="50" rx="10" fill="%23ffffff" fill-opacity="0.1" stroke="%23ffffff" stroke-opacity="0.25" style="backdrop-filter:blur(8px)"/><text x="75" y="75" fill="%23ffffff" font-family="sans-serif" font-size="12" font-weight="bold" letter-spacing="2">SPARK CORE</text></svg>'
    }
  ];

  // Initial Seed Message Thread database
  var INITIAL_MESSAGES = {};

  // Local Storage Cache Keys
  var CACHE_KEY = 'spark_chats_v1';
  var CACHE_CONTACTS_KEY = 'spark_chat_contacts';
  var CACHE_TEAMS_KEY = 'spark_chat_teams';

  function isValidUUID(str) {
    if (!str || typeof str !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // Load/Save DMs Contacts list from LocalStorage
  function getContactsList() {
    try {
      var cached = localStorage.getItem(CACHE_CONTACTS_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        // Filter out artificial/mock contacts (which do not have a valid UUID)
        var filtered = parsed.filter(function (c) {
          return isValidUUID(c.id);
        });
        if (filtered.length !== parsed.length) {
          saveContactsList(filtered);
        }
        return filtered;
      }
    } catch (e) {}
    localStorage.setItem(CACHE_CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
    return JSON.parse(JSON.stringify(DEFAULT_CONTACTS));
  }

  function saveContactsList(contacts) {
    try {
      localStorage.setItem(CACHE_CONTACTS_KEY, JSON.stringify(contacts));
    } catch (e) {}
  }

  // Load/Save Teams list from LocalStorage
  function getTeamsList() {
    try {
      var cached = localStorage.getItem(CACHE_TEAMS_KEY);
      if (cached) {
        var parsed = JSON.parse(cached);
        // Only keep allowed public channels
        var allowedTeams = ['defi-prophets', 'ai-signals', 'spark-devs'];
        var filtered = parsed.filter(function (t) {
          return allowedTeams.includes(t.id);
        });
        if (filtered.length !== parsed.length) {
          saveTeamsList(filtered);
        }
        return filtered;
      }
    } catch (e) {}
    localStorage.setItem(CACHE_TEAMS_KEY, JSON.stringify(DEFAULT_TEAMS));
    return JSON.parse(JSON.stringify(DEFAULT_TEAMS));
  }

  function saveTeamsList(teams) {
    try {
      localStorage.setItem(CACHE_TEAMS_KEY, JSON.stringify(teams));
    } catch (e) {}
  }

  // Load chats from LocalStorage or Fallback Seeds
  function getCachedMessages() {
    try {
      var cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached chats, using defaults', e);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(INITIAL_MESSAGES));
    return JSON.parse(JSON.stringify(INITIAL_MESSAGES));
  }

  // Save messages to LocalStorage cache
  function cacheMessages(msgs) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(msgs));
    } catch (e) {
      console.warn('Failed to write chats cache', e);
    }
  }

  // Update online indicators — no localStorage writes, status is read live from presenceChannel
  function updateOnlineStatusFromPresence(presenceState) {
    renderChatList();
    _updateActiveHeaderStatus();
    if (window.MiniProfile && typeof window.MiniProfile.onPresenceUpdate === 'function') {
      window.MiniProfile.onPresenceUpdate(presenceState);
    }
  }

  // Read live presence directly from Supabase channel — single source of truth
  function isUserOnline(userId) {
    if (!state.presenceChannel) return false;
    try {
      var ps = state.presenceChannel.presenceState();
      return !!(ps[userId] && ps[userId].length > 0);
    } catch (e) {
      return false;
    }
  }

  // Surgically update the status indicator in the active chat header
  // Called on every presence sync — avoids triggering the full renderActiveConversation
  // (which has an early-return optimisation that skips header re-render when messages unchanged)
  function _updateActiveHeaderStatus() {
    if (!state.activeChannelId) return;
    var statusEl = document.querySelector('.chat-header-status');
    if (!statusEl) return;
    var contacts = getContactsList();
    var contact  = contacts.find(function (c) { return c.id === state.activeChannelId; });
    if (!contact) return;
    var online = isUserOnline(contact.id);
    statusEl.className = 'chat-header-status' + (online ? '' : ' offline');
    var spans = statusEl.querySelectorAll('span');
    if (spans[1]) spans[1].textContent = online ? 'Active now' : 'Offline';
  }

  // Render Left Chats/Teams List
  function renderChatList() {
    var query = state.searchQuery.toLowerCase().trim();
    
    var contacts = getContactsList();
    var teams = getTeamsList();

    // 1. Filter Contacts (DMs)
    var filteredContacts = contacts.filter(function (c) {
      return c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query);
    });

    // Sort Contacts by Pinned status first, then by last message time
    filteredContacts.sort(function (a, b) {
      var pinA = a.pinned ? 1 : 0;
      var pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) {
        return pinB - pinA;
      }
      if (a.pinned && b.pinned) {
        return (b.pinnedAt || 0) - (a.pinnedAt || 0);
      }
      var msgsA = getCachedMessages()[a.id] || [];
      var msgsB = getCachedMessages()[b.id] || [];
      var lastA = msgsA[msgsA.length - 1];
      var lastB = msgsB[msgsB.length - 1];
      var timeA = lastA ? lastA.created_at : 0;
      var timeB = lastB ? lastB.created_at : 0;
      return timeB - timeA;
    });

    // 2. Filter Teams
    var filteredTeams = teams.filter(function (t) {
      return t.name.toLowerCase().includes(query);
    });

    // Render DMs List
    var dmsListEl = document.getElementById('chatListDMs');
    if (dmsListEl) {
      if (filteredContacts.length === 0) {
        var emptyText = window.LANG === 'ru' 
          ? 'Здесь пока пусто. Никто еще не подключился. Нажмите «+» вверху, чтобы начать общение с другими пользователями.' 
          : 'It is quiet here. No direct messages yet. Click the "+" button above to search and start a conversation.';
        dmsListEl.innerHTML = '<div class="chat-sidebar-empty">' + emptyText + '</div>';
      } else {
        dmsListEl.innerHTML = filteredContacts.map(function (c) {
          var msgs = getCachedMessages()[c.id] || [];
          var lastMsg = msgs[msgs.length - 1];
          var preview = lastMsg ? (lastMsg.media_url ? '📷 [Media attachment]' : lastMsg.content) : c.preview;
          var timeText = lastMsg ? _formatTime(lastMsg.created_at) : '10m';
          
          var isActive = state.activeChannelId === c.id ? ' active' : '';
          var statusClass = isUserOnline(c.id) ? '' : ' offline';
          var grad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(c.avColor) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
          var pinBadge = c.pinned ? '<span class="chat-row-pin-badge" style="color:var(--ac);font-size:10px;margin-left:5px" title="Pinned chat">📌</span>' : '';
          
          var checkboxHtml = '';
          if (state.multiSelectMode) {
            var isChecked = state.selectedContacts.includes(c.id);
            var checkedClass = isChecked ? ' checked' : '';
            checkboxHtml = '<div class="chat-custom-checkbox' + checkedClass + '">'
              + '  <svg class="chat-checkbox-tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" style="width:11px;height:11px;display:' + (isChecked ? 'block' : 'none') + '">'
              + '    <polyline points="20 6 9 17 4 12"></polyline>'
              + '  </svg>'
              + '</div>';
          }
          
          return ''
            + '<div class="chat-row-item' + isActive + '" data-chat-id="' + c.id + '">'
            + checkboxHtml
            + '<div class="chat-avatar-wrapper">'
            + '  <div class="chat-avatar-circle" style="background:' + grad + '">' + c.username.replace('@', '').charAt(0).toUpperCase() + '</div>'
            + '  <div class="chat-status-dot' + statusClass + '"></div>'
            + '</div>'
            + '<div class="chat-item-info">'
            + '<div class="chat-item-name-row"><span class="chat-item-name">' + c.name + pinBadge + '</span><span class="chat-item-time">' + timeText + '</span></div>'
            + '<div class="chat-item-preview">' + _esc(preview) + '</div>'
            + '</div>'
            + '</div>';
        }).join('');
      }
    }

    // Render Teams List
    var teamsListEl = document.getElementById('chatListTeams');
    if (teamsListEl) {
      if (filteredTeams.length === 0) {
        var emptyTextTeams = window.LANG === 'ru'
          ? 'Групповые каналы не найдены. Нажмите «+» для создания новой темы.'
          : 'No channels found. Click "+" to establish a new topic room.';
        teamsListEl.innerHTML = '<div class="chat-sidebar-empty">' + emptyTextTeams + '</div>';
      } else {
        teamsListEl.innerHTML = filteredTeams.map(function (t) {
          var msgs = getCachedMessages()[t.id] || [];
          var lastMsg = msgs[msgs.length - 1];
          var preview = lastMsg ? (lastMsg.media_url ? '📷 [Media attachment]' : lastMsg.content) : t.preview;
          
          var isActive = state.activeChannelId === t.id ? ' active' : '';
          var grad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(t.avColor) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
          
          return ''
            + '<div class="chat-row-item' + isActive + '" data-chat-id="' + t.id + '">'
            + '<div class="chat-avatar-circle" style="background:' + grad + ';border-radius:10px">' + t.name.charAt(0) + t.name.charAt(1) + '</div>'
            + '<div class="chat-item-info">'
            + '<div class="chat-item-name-row"><span class="chat-item-name">' + t.name + '</span><span class="chat-item-time">' + (t.activeCount + ' active') + '</span></div>'
            + '<div class="chat-item-preview">' + _esc(preview) + '</div>'
            + '</div>'
            + '</div>';
        }).join('');
      }
    }

    // Wire up clicks, touch long-presses, and desktop right-clicks on list items
    document.querySelectorAll('.chat-row-item[data-chat-id]').forEach(function (el) {
      var id = el.dataset.chatId;

      // Click handler (differing based on multi-select mode)
      el.addEventListener('click', function (e) {
        if (state.multiSelectMode) {
          toggleContactSelection(id);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        selectChannel(id);
      });

      // Long press touch handling (600ms hold)
      var pressTimer;
      el.addEventListener('touchstart', function (e) {
        if (state.multiSelectMode) return;
        var touch = e.touches[0];
        pressTimer = setTimeout(function () {
          showContactContextMenu(id, touch.clientX, touch.clientY);
        }, 600);
      }, { passive: true });

      el.addEventListener('touchend', function () {
        clearTimeout(pressTimer);
      });
      el.addEventListener('touchmove', function () {
        clearTimeout(pressTimer);
      });

      // Desktop right-click handling
      el.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        showContactContextMenu(id, e.clientX, e.clientY);
      });
    });
  }

  // Helper to fetch deleted message ids
  function getDeletedMessageIds() {
    try {
      var cached = localStorage.getItem('spark_deleted_msg_ids');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  }

  // Delete message locally (for me)
  function deleteMessageForMe(msgId) {
    var list = getDeletedMessageIds();
    if (!list.includes(msgId)) {
      list.push(msgId);
      try {
        localStorage.setItem('spark_deleted_msg_ids', JSON.stringify(list));
      } catch (e) {}
    }

    var channel = state.activeChannelId;
    if (channel) {
      var msgs = getCachedMessages();
      if (msgs[channel]) {
        var idx = msgs[channel].findIndex(function (m) { return m.id === msgId; });
        if (idx !== -1) {
          msgs[channel].splice(idx, 1);
          cacheMessages(msgs);
        }
      }
    }

    renderActiveConversation();
    renderChatList();
  }

  // Delete message for everyone (removes from local cache + DB delete call)
  async function deleteMessageForEveryone(msgId) {
    var channel = state.activeChannelId;
    if (channel) {
      var msgs = getCachedMessages();
      if (msgs[channel]) {
        var idx = msgs[channel].findIndex(function (m) { return m.id === msgId; });
        if (idx !== -1) {
          msgs[channel].splice(idx, 1);
          cacheMessages(msgs);
        }
      }
    }

    var list = getDeletedMessageIds();
    if (!list.includes(msgId)) {
      list.push(msgId);
      try {
        localStorage.setItem('spark_deleted_msg_ids', JSON.stringify(list));
      } catch (e) {}
    }

    renderActiveConversation();
    renderChatList();

    if (window.supa && window.ME && !msgId.startsWith('m_local_')) {
      try {
        await window.supa.from('messages')
          .delete()
          .eq('id', msgId);
      } catch (e) {
        console.warn('Supabase delete error:', e);
      }
    }
  }

  // Show dynamic Delete Confirmation Modal (handles messages and chats)
  function showDeleteConfirmModal(id, deleteType, onConfirm, isChat) {
    var existing = document.getElementById('moDeleteConfirm');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'moDeleteConfirm';
    modal.className = 'mo open';
    
    var title = '';
    var bodyText = '';
    var buttonsHtml = '';
    
    if (isChat) {
      title = window.LANG === 'ru' ? 'Удалить чат?' : 'Delete chat?';
      if (deleteType === 'both') {
        bodyText = window.LANG === 'ru' 
          ? 'Вы хотите удалить этот чат только для себя или для всех участников?' 
          : 'Do you want to delete this chat history only for yourself or for everyone?';
          
        buttonsHtml = ''
          + '<button class="spark-btn-submit" id="btnDeleteForMe" style="background:var(--vl)">'
          + (window.LANG === 'ru' ? 'Для меня' : 'Delete for Me')
          + '</button>'
          + '<button class="spark-btn-danger" id="btnDeleteForEveryone">'
          + (window.LANG === 'ru' ? 'Для всех' : 'Delete for Everyone')
          + '</button>';
      } else {
        bodyText = window.LANG === 'ru'
          ? 'Вы уверены, что хотите удалить этот чат для себя? Это действие нельзя отменить.'
          : 'Are you sure you want to delete this chat for yourself? This action cannot be undone.';
          
        buttonsHtml = ''
          + '<button class="spark-btn-danger" id="btnDeleteForMe">'
          + (window.LANG === 'ru' ? 'Удалить для себя' : 'Delete for Me')
          + '</button>';
      }
    } else {
      title = window.LANG === 'ru' ? 'Удалить сообщение?' : 'Delete message?';
      if (deleteType === 'both') {
        bodyText = window.LANG === 'ru' 
          ? 'Вы хотите удалить это сообщение только для себя или для всех участников?' 
          : 'Do you want to delete this message only for yourself or for everyone?';
          
        buttonsHtml = ''
          + '<button class="spark-btn-submit" id="btnDeleteForMe" style="background:var(--vl)">'
          + (window.LANG === 'ru' ? 'Для меня' : 'Delete for Me')
          + '</button>'
          + '<button class="spark-btn-danger" id="btnDeleteForEveryone">'
          + (window.LANG === 'ru' ? 'Для всех' : 'Delete for Everyone')
          + '</button>';
      } else {
        bodyText = window.LANG === 'ru'
          ? 'Вы уверены, что хотите удалить это сообщение для себя? Это действие нельзя отменить.'
          : 'Are you sure you want to delete this message for yourself? This action cannot be undone.';
          
        buttonsHtml = ''
          + '<button class="spark-btn-danger" id="btnDeleteForMe">'
          + (window.LANG === 'ru' ? 'Удалить' : 'Delete for Me')
          + '</button>';
      }
    }
    
    var cancelText = window.LANG === 'ru' ? 'Отмена' : 'Cancel';

    modal.innerHTML = ''
      + '<div class="mo-box" style="max-width:400px;padding:24px;box-sizing:border-box">'
      + '  <div class="mo-title" style="margin-bottom:12px;color:var(--red)">' + title + '</div>'
      + '  <div style="font-size:13px;color:var(--mu2);line-height:1.5;margin-bottom:24px">' + bodyText + '</div>'
      + '  <div class="chat-delete-modal-buttons">'
      + '    <button class="prs-btn" id="btnCancelDelete" style="border:1px solid rgba(255,255,255,0.1)">' + cancelText + '</button>'
      +      buttonsHtml
      + '  </div>'
      + '</div>';

    document.body.appendChild(modal);
    
    document.getElementById('btnCancelDelete').addEventListener('click', function() {
      modal.remove();
    });
    
    var btnMe = document.getElementById('btnDeleteForMe');
    if (btnMe) {
      btnMe.addEventListener('click', function() {
        onConfirm('me');
        modal.remove();
      });
    }
    
    var btnEveryone = document.getElementById('btnDeleteForEveryone');
    if (btnEveryone) {
      btnEveryone.addEventListener('click', function() {
        onConfirm('everyone');
        modal.remove();
      });
    }

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Global Emoji Picker Helper
  var GlobalEmojiPicker = (function () {
    var pickerEl = null;
    var currentCallback = null;
    var currentTargetBtn = null;
    var EMOJIS_LIST = ['💀', '🗿', '🔥', '💎', '🚀', '❤️', '👍', '👎', '👏', '🎉', '😢', '😮', '🤔', '👀', '💯'];

    function initPicker() {
      if (pickerEl) return;
      pickerEl = document.createElement('div');
      pickerEl.id = 'global-emoji-picker';
      pickerEl.className = 'global-emoji-picker';
      pickerEl.style.display = 'none';
      pickerEl.style.position = 'absolute';
      pickerEl.style.zIndex = '100005';
      
      var gridHtml = EMOJIS_LIST.map(function (e) {
        return '<button class="picker-emoji-btn" data-emoji="' + e + '">' + e + '</button>';
      }).join('');
      
      pickerEl.innerHTML = '<div class="picker-arrow"></div><div class="picker-grid">' + gridHtml + '</div>';
      document.body.appendChild(pickerEl);

      var style = document.createElement('style');
      style.textContent = '\n' +
        '.global-emoji-picker {\n' +
        '  background: rgba(15, 18, 36, 0.95);\n' +
        '  border: 1px solid rgba(255, 255, 255, 0.1);\n' +
        '  border-radius: 12px;\n' +
        '  padding: 8px;\n' +
        '  box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 1px 1px rgba(255,255,255,0.1) inset;\n' +
        '  backdrop-filter: blur(20px);\n' +
        '  -webkit-backdrop-filter: blur(20px);\n' +
        '  animation: pickerPop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;\n' +
        '  transform-origin: top center;\n' +
        '}\n' +
        '@keyframes pickerPop {\n' +
        '  from { transform: scale(0.9) translateY(4px); opacity: 0; }\n' +
        '  to { transform: scale(1) translateY(0); opacity: 1; }\n' +
        '}\n' +
        '.picker-grid {\n' +
        '  display: grid;\n' +
        '  grid-template-columns: repeat(5, 1fr);\n' +
        '  gap: 6px;\n' +
        '}\n' +
        '.picker-emoji-btn {\n' +
        '  background: transparent;\n' +
        '  border: none;\n' +
        '  cursor: pointer;\n' +
        '  font-size: 18px;\n' +
        '  padding: 6px;\n' +
        '  border-radius: 8px;\n' +
        '  transition: all 0.2s;\n' +
        '  display: flex;\n' +
        '  align-items: center;\n' +
        '  justify-content: center;\n' +
        '}\n' +
        '.picker-emoji-btn:hover {\n' +
        '  background: rgba(255, 255, 255, 0.08);\n' +
        '  transform: scale(1.2);\n' +
        '}\n' +
        '.picker-arrow {\n' +
        '  position: absolute;\n' +
        '  width: 8px;\n' +
        '  height: 8px;\n' +
        '  background: rgba(15, 18, 36, 0.95);\n' +
        '  border-left: 1px solid rgba(255, 255, 255, 0.1);\n' +
        '  border-top: 1px solid rgba(255, 255, 255, 0.1);\n' +
        '  transform: rotate(45deg) translateX(-50%);\n' +
        '  left: 50%;\n' +
        '  top: -5px;\n' +
        '}\n';
      document.head.appendChild(style);

      pickerEl.querySelectorAll('.picker-emoji-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          var emoji = btn.dataset.emoji;
          if (currentCallback) {
            currentCallback(emoji);
          }
          hide();
          e.stopPropagation();
        });
      });

      window.addEventListener('click', function (e) {
        if (pickerEl.style.display !== 'none' && !pickerEl.contains(e.target)) {
          // Do not hide if clicking the trigger button itself or elements inside it
          if (currentTargetBtn && (e.target === currentTargetBtn || currentTargetBtn.contains(e.target))) {
            return;
          }
          hide();
        }
      });
    }

    function show(targetBtn, callback) {
      initPicker();
      currentTargetBtn = targetBtn;
      currentCallback = callback;
      pickerEl.style.display = 'block';

      var rect = targetBtn.getBoundingClientRect();
      var scrollX = window.scrollX || document.documentElement.scrollLeft;
      var scrollY = window.scrollY || document.documentElement.scrollTop;

      var left = rect.left + rect.width / 2 - pickerEl.offsetWidth / 2 + scrollX;
      var top = rect.bottom + 5 + scrollY;

      if (left < 10) left = 10;
      if (left + pickerEl.offsetWidth > window.innerWidth - 10) {
        left = window.innerWidth - pickerEl.offsetWidth - 10;
      }

      var arrow = pickerEl.querySelector('.picker-arrow');
      var targetCenterX = rect.left + rect.width / 2 + scrollX;
      var relativeArrowX = targetCenterX - left;
      arrow.style.left = relativeArrowX + 'px';

      if (rect.bottom + 5 + pickerEl.offsetHeight > window.innerHeight && rect.top - 5 - pickerEl.offsetHeight > 0) {
        top = rect.top - 5 - pickerEl.offsetHeight + scrollY;
        arrow.style.top = 'auto';
        arrow.style.bottom = '-5px';
        arrow.style.borderLeft = 'none';
        arrow.style.borderTop = 'none';
        arrow.style.borderRight = '1px solid rgba(255, 255, 255, 0.1)';
        arrow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      } else {
        arrow.style.bottom = 'auto';
        arrow.style.top = '-5px';
        arrow.style.borderRight = 'none';
        arrow.style.borderBottom = 'none';
        arrow.style.borderLeft = '1px solid rgba(255, 255, 255, 0.1)';
        arrow.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
      }

      pickerEl.style.left = left + 'px';
      pickerEl.style.top = top + 'px';
    }

    function hide() {
      if (pickerEl) {
        pickerEl.style.display = 'none';
      }
    }

    return {
      show: show,
      hide: hide
    };
  })();
  window.GlobalEmojiPicker = GlobalEmojiPicker;

  // Render Active Conversation Viewport
  function renderActiveConversation() {
    var rightPane = document.getElementById('chatActivePane');
    if (!rightPane) return;

    var id = state.activeChannelId;
    if (!id) {
      // Empty placeholder
      var emptyTitle = window.LANG === 'ru' ? 'Секретная связь SPARK' : 'SPARK Secure Signal Network';
      var emptyText = window.LANG === 'ru' 
        ? 'Выберите защищенный канал или прямой контакт для синхронизации сигналов и обмена разведданными.'
        : 'Select a secure channel or direct contact to synchronize market signals and share intelligence notes.';
      rightPane.innerHTML = ''
        + '<div class="chat-empty-state">'
        + '<div class="chat-empty-icon">🛰️</div>'
        + '<div class="chat-empty-title">' + emptyTitle + '</div>'
        + '<div class="chat-empty-text">' + emptyText + '</div>'
        + '</div>';
      return;
    }

    var msgs = getCachedMessages()[id] || [];

    // Helper to generate signature of messages to prevent unnecessary re-rendering
    var msgsSignature = JSON.stringify(msgs.map(function (m) {
      return { id: m.id, content: m.content, read: m.read, reactions: m.reactions, media_url: m.media_url };
    }));

    // 1. Partial Render Optimization: If the correct channel is already active, perform DOM Diffing
    var existingArea = document.getElementById('chatMsgArea');
    if (existingArea && existingArea.getAttribute('data-channel-id') === id) {
      var prevSignature = existingArea.getAttribute('data-msgs-signature');
      if (prevSignature === msgsSignature) {
        return; // No changes, do not update DOM
      }
      
      diffMessagesDOM(msgs);
      existingArea.setAttribute('data-msgs-signature', msgsSignature);
      _wireActiveView();
      return; // Return early!
    }

    // 2. Full Render (only executed when opening a channel for the first time or switching channels)
    var contacts = getContactsList();
    var teams = getTeamsList();

    // Identify current target details
    var contact = contacts.find(function (c) { return c.id === id; });
    var team    = teams.find(function (t) { return t.id === id; });
    var titleName = contact ? contact.name : (team ? team.name : id);
    var _contactOnline = contact ? isUserOnline(contact.id) : false;
    var statusText = contact ? (_contactOnline ? 'Active now' : 'Offline') : (team ? (team.activeCount + ' members online') : 'Connected');
    var isOffline = contact && !_contactOnline;
    
    var avIndex = contact ? contact.avColor : (team ? team.avColor : 0);
    var avText = contact ? contact.username.replace('@', '').charAt(0).toUpperCase() : (team ? team.name.charAt(0) + team.name.charAt(1) : '?');
    var avGrad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avIndex) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
    var avBorderRadius = team ? '10px' : '50%';

    var triggerAttr = (contact && contact.id) ? ' class="chat-avatar-circle mp-trigger" data-user-id="' + contact.id + '"' : ' class="chat-avatar-circle"';
    var nameTriggerAttr = (contact && contact.id) ? ' class="chat-header-name mp-trigger" data-user-id="' + contact.id + '"' : ' class="chat-header-name"';

    // Active conversation pane frame markup
    rightPane.innerHTML = ''
      /* Header */
      + '<div class="chat-main-header">'
      + '  <div class="chat-header-left">'
      + '    <button class="chat-back-btn-mob" id="chatBackBtnMob">'
      + '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>'
      + '    </button>'
      + '    <div' + triggerAttr + ' style="background:' + avGrad + ';border-radius:' + avBorderRadius + '">' + avText + '</div>'
      + '    <div class="chat-header-info">'
      + '      <div' + nameTriggerAttr + '>' + _esc(titleName) + '</div>'
      + '      <div class="chat-header-status' + (isOffline ? ' offline' : '') + '">'
      + '        <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>'
      + '        <span>' + statusText + '</span>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="chat-header-actions">'
      + '    <button class="chat-header-icon-btn" id="chatSearchBtn" title="' + (window.LANG === 'ru' ? 'Поиск сообщений' : 'Search messages') + '">'
      + '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '    </button>'
      + '    <button class="chat-header-icon-btn" id="chatPinBtn" title="' + (window.LANG === 'ru' ? 'Закрепленные сообщения' : 'Pinned messages') + '">'
      + '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.78-3.5A2 2 0 0 1 15 9.26V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.26a2 2 0 0 1-.78 1.54l-2.78 3.5A2 2 0 0 0 5 15.24V17z"/></svg>'
      + '    </button>'
      + '  </div>'
      + '</div>'
      /* Pinned messages slidebar banner wrapper (hidden by default) */
      + '<div class="chat-pinned-slidebar-overlay" id="chatPinSlidebarOverlay" style="display:none;align-items:center;justify-content:space-between;padding:6px 20px;background:rgba(123,92,250,0.08);border-bottom:1px solid rgba(123,92,250,0.2);z-index:4;cursor:pointer">'
      + '  <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">'
      + '    <span style="font-size:12px">📌</span>'
      + '    <div style="display:flex;flex-direction:column;min-width:0">'
      + '      <span style="font-size:10px;font-weight:700;color:var(--ac)">' + (window.LANG === 'ru' ? 'Закрепленное сообщение' : 'Pinned Message') + '</span>'
      + '      <span id="chatPinnedPreviewText" style="font-size:11px;color:var(--mu2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span>'
      + '    </div>'
      + '  </div>'
      + '  <button id="btnUnpinActiveBtn" style="background:transparent;border:none;color:var(--red);font-size:12px;font-weight:bold;cursor:pointer;padding:4px">✕</button>'
      + '</div>'
      /* In-Chat Search Bar Overlay (hidden by default) */
      + '<div class="chat-search-bar-overlay" id="chatSearchBarOverlay" style="display:none;align-items:center;justify-content:space-between;padding:8px 20px;background:rgba(5,6,15,0.65);border-bottom:1px solid rgba(255,255,255,0.06);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:4">'
      + '  <div style="display:flex;align-items:center;gap:10px;flex:1">'
      + '    <span style="font-size:12px;color:var(--mu2)">🔍</span>'
      + '    <input type="text" id="chatSearchBox" placeholder="' + (window.LANG === 'ru' ? 'Поиск в этом чате...' : 'Search in this chat...') + '" style="background:transparent;border:none;outline:none;color:#fff;font-size:12px;width:100%" autocomplete="off">'
      + '  </div>'
      + '  <div style="display:flex;align-items:center;gap:12px">'
      + '    <span id="chatSearchCount" style="font-size:11px;color:var(--mu2);white-space:nowrap">0 / 0</span>'
      + '    <button id="btnSearchPrev" class="chat-header-icon-btn" style="width:24px;height:24px;border-radius:4px" title="Previous">▲</button>'
      + '    <button id="btnSearchNext" class="chat-header-icon-btn" style="width:24px;height:24px;border-radius:4px" title="Next">▼</button>'
      + '    <button id="btnSearchClose" class="chat-header-icon-btn" style="width:24px;height:24px;border-radius:4px;color:var(--red)" title="Close">✕</button>'
      + '  </div>'
      + '</div>'
      /* Messages list scroll (with data-channel-id for partial renders) */
      + '<div class="chat-messages-area" id="chatMsgArea" data-channel-id="' + id + '" data-msgs-signature="' + _esc(msgsSignature) + '">'
      +   _renderMessagesList(msgs)
      + '</div>'
      /* Bottom composed attachment preview */
      + '<div class="chat-main-input-container">'
      + '  <div class="chat-composed-attachment-preview" id="chatComposePreview">'
      + '    <span>📎 Attached: <b id="chatComposePreviewName"></b></span>'
      + '    <button class="chat-cancel-attach-btn" id="chatCancelComposeBtn">✕</button>'
      + '  </div>'
      /* Input prompt */
      + '  <div class="chat-input-row">'
      + '    <input type="text" class="chat-text-input" id="chatTextInput" placeholder="Type your trading intelligence message..." autocomplete="off">'
      + '    <button class="chat-send-btn" id="chatSendBtn" title="Send message">'
      + '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
      + '    </button>'
      + '  </div>'
      + '</div>';

    // Scroll to bottom immediately on initial load
    var area = document.getElementById('chatMsgArea');
    if (area) { area.scrollTop = area.scrollHeight; }

    // Wire up events
    _wireActiveView();
  }

  // Formulate html list of message speech bubbles
  function _renderMessagesList(msgs) {
    var deletedIds = getDeletedMessageIds();
    var visibleMsgs = msgs.filter(function (m) {
      return !deletedIds.includes(m.id);
    });

    if (visibleMsgs.length === 0) {
      return '<div style="text-align:center;padding:48px 0;color:var(--mu);font-size:12px">' 
        + (window.LANG === 'ru' ? 'В этом секретном канале пока нет сообщений.' : 'No messages in this signal room yet.') 
        + '</div>';
    }

    return visibleMsgs.map(function (m) {
      if (m.sender_id === 'system') {
        var content = m.content;
        if (content === 'Signal channel opened. Security synchronized.') {
          content = window.LANG === 'ru' ? 'Сигнальный канал открыт. Безопасность синхронизирована.' : 'Signal channel opened. Security synchronized.';
        }
        return '<div class="chat-system-message">' + _esc(content) + '</div>';
      }

      var isSent = m.sender_id === 'me' || (window.ME && m.sender_id === ME.id);
      var rowClass = isSent ? ' sent' : '';
      var avText = isSent ? (window.PROFILE && PROFILE.username || '@user').replace('@', '').charAt(0).toUpperCase() : m.sender_name.replace('@', '').charAt(0).toUpperCase();
      var avColor = isSent ? (window.PROFILE && PROFILE.avatar_color || 0) : m.sender_avatar_color;
      var avGrad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avColor) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
      
      var statusTicks = '';
      if (isSent) {
        if (m.id.startsWith('m_local_')) {
          statusTicks = '<span class="chat-msg-status-tick" style="margin-left:4px;font-size:9px;opacity:0.6">🕒</span>';
        } else if (m.read) {
          statusTicks = '<span class="chat-msg-status-tick read" style="color:var(--ac);margin-left:5px;font-weight:bold;font-size:11px">✓✓</span>';
        } else {
          statusTicks = '<span class="chat-msg-status-tick delivered" style="color:var(--mu2);margin-left:5px;font-size:11px">✓</span>';
        }
      }

      // Render media attachment inside bubble if exists
      var mediaCard = '';
      if (m.media_url) {
        var cardTitle = m.content || 'Media Node';
        mediaCard = ''
          + '<div class="chat-media-attachment-card">'
          + '  <img src="' + m.media_url + '" class="chat-media-img" alt="Attachment" loading="lazy">'
          + '  <div class="chat-media-meta">'
          + '    <div class="chat-media-title">' + _esc(cardTitle) + '</div>'
          + '    <div class="chat-media-sub">' + (window.LANG === 'ru' ? 'Вложение SPARK' : 'Spark Intelligence Attachment') + '</div>'
          + '  </div>'
          + '</div>';
      }

      // Render reaction emojis
      var reactionsHtml = '';
      if (m.reactions && Object.keys(m.reactions).length > 0) {
        reactionsHtml = '<div class="chat-msg-reactions">'
          + Object.keys(m.reactions).map(function (emoji) {
            var reactionObj = m.reactions[emoji];
            var myId = window.ME ? window.ME.id : 'me';
            var userReacted = false;
            var count = 0;
            if (reactionObj) {
              if (Array.isArray(reactionObj.users)) {
                userReacted = reactionObj.users.includes(myId);
                count = reactionObj.users.length;
              } else {
                userReacted = !!reactionObj.userReacted;
                count = Number(reactionObj.count) || 0;
              }
            }
            if (count === 0) return '';
            var activeClass = userReacted ? ' active' : '';
            return '<span class="chat-msg-react-pill' + activeClass + '" data-msg-id="' + m.id + '" data-emoji="' + emoji + '">'
              + emoji + ' ' + count
              + '</span>';
          }).join('')
          + '</div>';
      }

      // Emojis reaction popup on top of bubble
      var reactionsMenu = ''
        + '<div class="chat-bubble-context">'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="🔥">🔥</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="💎">💎</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="🚀">🚀</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="💀">💀</button>'
        + '  <button class="chat-context-picker-btn" data-msg-id="' + m.id + '" title="More emojis">➕</button>'
        + '</div>';

      // Delete message overlay below bubble
      var deleteMenu = ''
        + '<div class="chat-bubble-delete-context">'
        + '  <button class="chat-context-delete-btn" style="background:transparent;border:none;color:var(--red);cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:3px;white-space:nowrap;" data-msg-id="' + m.id + '" data-delete-type="' + (isSent ? 'both' : 'me') + '">'
        + '    🗑️ ' + (window.LANG === 'ru' ? 'Удалить' : 'Delete')
        + '  </button>'
        + '</div>';

      var triggerId = isSent ? (window.ME ? ME.id : '') : m.sender_id;
      var avatarTriggerAttr = triggerId ? ' class="chat-msg-avatar mp-trigger" data-user-id="' + triggerId + '"' : ' class="chat-msg-avatar"';
      var senderTriggerAttr = triggerId ? ' class="chat-msg-sender-name mp-trigger" data-user-id="' + triggerId + '"' : ' class="chat-msg-sender-name"';
      return ''
        + '<div class="chat-message-row' + rowClass + '" data-msg-id="' + m.id + '">'
        + '  <div' + avatarTriggerAttr + ' style="background:' + avGrad + '">' + avText + '</div>'
        + '  <div class="chat-msg-content-wrapper">'
        + '    <div' + senderTriggerAttr + '>' + _esc(m.sender_name) + '</div>'
        + '    <div class="chat-msg-bubble">'
        +        reactionsMenu
        +        (m.media_url ? '' : _esc(m.content))
        +        mediaCard
        +        deleteMenu
        + '    </div>'
        +      reactionsHtml
        + '    <div class="chat-msg-time">' + _formatTime(m.created_at) + statusTicks + '</div>'
        + '  </div>'
        + '</div>';
    }).join('');
  }

  // Wire events in the active conversation thread
  function _wireActiveView() {
    // 1. Mobile Back button click
    var backBtn = document.getElementById('chatBackBtnMob');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        var pane = document.getElementById('chatActivePane');
        if (pane) pane.classList.remove('open-active');
        var mobBar = document.querySelector('.mob-bar');
        if (mobBar) mobBar.classList.remove('hide-bar');
        var chatsPanel = document.getElementById('panel-chats');
        if (chatsPanel) chatsPanel.classList.remove('fullscreen-chat');
      });
    }


    // 3. Cancel compose attachment button
    var cancelComposeBtn = document.getElementById('chatCancelComposeBtn');
    if (cancelComposeBtn) {
      cancelComposeBtn.addEventListener('click', function () {
        state.composedAttachment = null;
        _updateComposeAttachmentUI();
      });
    }

    // 4. Send action click
    var sendBtn = document.getElementById('chatSendBtn');
    var inputEl = document.getElementById('chatTextInput');
    if (sendBtn && inputEl) {
      var handleSend = function () {
        var val = inputEl.value.trim();
        if (!val && !state.composedAttachment) return;
        
        sendMessage(val, state.composedAttachment ? state.composedAttachment.url : null, state.composedAttachment ? state.composedAttachment.title : null);
        
        inputEl.value = '';
        state.composedAttachment = null;
        _updateComposeAttachmentUI();
      };
      
      sendBtn.addEventListener('click', handleSend);
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          handleSend();
        }
      });
    }

    // 5. Context menu emojis click
    document.querySelectorAll('.chat-context-react-btn[data-msg-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var msgId = btn.getAttribute('data-msg-id');
        var emoji = btn.getAttribute('data-emoji');
        addReaction(msgId, emoji);
      });
    });

    // 5b. Context menu custom emoji picker click
    document.querySelectorAll('.chat-context-picker-btn[data-msg-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var msgId = btn.getAttribute('data-msg-id');
        GlobalEmojiPicker.show(btn, function (emoji) {
          addReaction(msgId, emoji);
        });
        e.stopPropagation();
      });
    });

    // 5c. Context menu delete button click
    document.querySelectorAll('.chat-context-delete-btn[data-msg-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var msgId = btn.getAttribute('data-msg-id');
        var deleteType = btn.getAttribute('data-delete-type');
        showDeleteConfirmModal(msgId, deleteType, function (selectedType) {
          if (selectedType === 'everyone') {
            deleteMessageForEveryone(msgId);
          } else {
            deleteMessageForMe(msgId);
          }
        });
        e.stopPropagation();
      });
    });

    // 6. Pill reactions click
    document.querySelectorAll('.chat-msg-react-pill[data-msg-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var msgId = btn.getAttribute('data-msg-id');
        var emoji = btn.getAttribute('data-emoji');
        addReaction(msgId, emoji);
      });
    });

    // 7. Mobile tap to toggle context menu on message bubbles
    document.querySelectorAll('.chat-msg-bubble').forEach(function (bubble) {
      bubble.addEventListener('click', function (e) {
        if (state.pinSelectMode) return; // Allow event to bubble to row click listener for pin selection toggling
        if (e.target.closest('.chat-bubble-context') || e.target.closest('.chat-bubble-delete-context')) return;
        var ctx = bubble.querySelector('.chat-bubble-context');
        var delCtx = bubble.querySelector('.chat-bubble-delete-context');
        if (ctx && delCtx) {
          var isOpened = ctx.style.display === 'flex';
          document.querySelectorAll('.chat-bubble-context, .chat-bubble-delete-context').forEach(function(c) {
            c.style.display = '';
          });
          ctx.style.display = isOpened ? 'none' : 'flex';
          delCtx.style.display = isOpened ? 'none' : 'flex';
          e.stopPropagation();
        }
      });
    });

    // 8. Stop click and touchstart propagation on context menus so tapping on them doesn't close them
    document.querySelectorAll('.chat-bubble-context, .chat-bubble-delete-context').forEach(function (ctx) {
      ctx.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      ctx.addEventListener('touchstart', function (e) {
        e.stopPropagation();
      }, { passive: true });
    });

    // 9. In-Chat Search Icon & Overlay clicks
    var searchIconBtn = document.getElementById('chatSearchBtn');
    var searchOverlay = document.getElementById('chatSearchBarOverlay');
    if (searchIconBtn && searchOverlay) {
      searchIconBtn.addEventListener('click', function () {
        var isHidden = searchOverlay.style.display === 'none';
        searchOverlay.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
          var input = document.getElementById('chatSearchBox');
          if (input) {
            input.value = '';
            input.focus();
          }
          performInChatSearch();
        }
      });
    }

    var searchBox = document.getElementById('chatSearchBox');
    if (searchBox) {
      searchBox.addEventListener('input', performInChatSearch);
    }

    var btnPrev = document.getElementById('btnSearchPrev');
    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        if (state.searchMatches.length === 0) return;
        state.searchActiveIndex--;
        if (state.searchActiveIndex < 0) {
          state.searchActiveIndex = state.searchMatches.length - 1; // loop to bottom
        }
        updateSearchCounter();
        jumpToActiveSearchMatch();
      });
    }

    var btnNext = document.getElementById('btnSearchNext');
    if (btnNext) {
      btnNext.addEventListener('click', function () {
        if (state.searchMatches.length === 0) return;
        state.searchActiveIndex++;
        if (state.searchActiveIndex >= state.searchMatches.length) {
          state.searchActiveIndex = 0; // loop to top
        }
        updateSearchCounter();
        jumpToActiveSearchMatch();
      });
    }
    var btnClose = document.getElementById('btnSearchClose');
    if (btnClose) {
      btnClose.addEventListener('click', function () {
        if (searchOverlay) searchOverlay.style.display = 'none';
        var box = document.getElementById('chatSearchBox');
        if (box) box.value = '';
        performInChatSearch();
      });
    }

    // 10. In-Chat Message Pinning icon, banner slider & select mode clicks
    var headerPinBtn = document.getElementById('chatPinBtn');
    if (headerPinBtn) {
      headerPinBtn.addEventListener('click', function () {
        togglePinSelectMode();
      });
    }

    var slidebar = document.getElementById('chatPinSlidebarOverlay');
    if (slidebar) {
      slidebar.addEventListener('click', function (e) {
        if (e.target.id === 'btnUnpinActiveBtn') return;
        state.activePinIndex++;
        if (state.activePinIndex >= state.pinnedMessages.length) {
          state.activePinIndex = 0;
        }
        renderPinnedSlidebar();
        jumpToActivePinnedMessage();
      });
    }

    var unpinBtn = document.getElementById('btnUnpinActiveBtn');
    if (unpinBtn) {
      unpinBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        unpinActiveMessage();
      });
    }

    // Click on message bubble inside select to pin mode
    document.querySelectorAll('.chat-message-row[data-msg-id]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (state.pinSelectMode) {
          var msgId = row.getAttribute('data-msg-id');
          togglePinMessageSelection(msgId);
          e.stopPropagation();
          e.preventDefault();
        }
      });
    });
  }

  // Update attachment composed indicators under text box
  function _updateComposeAttachmentUI() {
    var previewWrap = document.getElementById('chatComposePreview');
    var previewName = document.getElementById('chatComposePreviewName');
    if (!previewWrap || !previewName) return;

    // Toggle active state styling on attach buttons
    document.querySelectorAll('.chat-attach-btn').forEach(function (btn) {
      var attId = btn.dataset.attId;
      var isSel = state.composedAttachment && state.composedAttachment.id === attId;
      btn.classList.toggle('selected', !!isSel);
    });

    if (state.composedAttachment) {
      previewName.textContent = state.composedAttachment.title;
      previewWrap.style.display = 'flex';
    } else {
      previewWrap.style.display = 'none';
      previewName.textContent = '';
    }
  }

  // Select DM contact or group channel
  function selectChannel(id) {
    state.activeChannelId = id;
    renderChatList();
    renderActiveConversation();

    // On mobile, slide in the conversation overlay and hide the taskbar
    if (window.innerWidth <= 768) {
      var pane = document.getElementById('chatActivePane');
      if (pane) pane.classList.add('open-active');
      var mobBar = document.querySelector('.mob-bar');
      if (mobBar) mobBar.classList.add('hide-bar');
      var chatsPanel = document.getElementById('panel-chats');
      if (chatsPanel) chatsPanel.classList.add('fullscreen-chat');
    }

    // Load Supabase Database messages asynchronously for this channel if configured
    loadSupabaseHistory(id);

    // Mark all unread messages from this contact as read
    markMessagesAsRead(id);

    // Load pinned messages asynchronously
    loadPinnedMessagesForActiveChannel();
  }

  // Query Supabase for any unread direct messages sent to ME and update badges
  async function updateUnreadBadge() {
    if (!window.supa || !window.ME) return;
    try {
      var res = await supa.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ME.id)
        .eq('read', false);
      
      var hasUnread = res.count > 0;
      
      // Update Mobile bar dot
      var mChatDot = document.getElementById('mChatDot');
      if (mChatDot) {
        mChatDot.style.display = hasUnread ? 'flex' : 'none';
        mChatDot.textContent = hasUnread ? res.count : '';
      }

      // Update Desktop chats badge
      var dChatBadge = document.getElementById('dChatBadge');
      if (dChatBadge) {
        dChatBadge.style.display = hasUnread ? 'flex' : 'none';
        dChatBadge.textContent = hasUnread ? res.count : '';
      }
    } catch (e) {
      console.warn('Failed to update unread badge status:', e);
    }
  }

  // Mark all unread messages from this contact as read in DB and local cache
  async function markMessagesAsRead(contactId) {
    if (!window.supa || !window.ME || !contactId) return;

    var isDM = !contactId.startsWith('#') && !['defi-prophets', 'ai-signals', 'spark-devs'].includes(contactId);
    if (!isDM) return;
    if (isDM && !isValidUUID(contactId)) return;

    try {
      // 1. Update in Supabase
      var res = await supa.from('messages')
        .update({ read: true })
        .eq('channel_id', ME.id) // Sent to me
        .eq('sender_id', contactId) // From this contact
        .eq('read', false);

      // 2. Update locally
      var msgs = getCachedMessages();
      var thread = msgs[contactId] || [];
      var updated = false;
      thread.forEach(function (m) {
        if (m.sender_id !== 'me' && m.sender_id !== ME.id && !m.read) {
          m.read = true;
          updated = true;
        }
      });

      if (updated) {
        cacheMessages(msgs);
        renderActiveConversation();
      }
      // Also update badges
      updateUnreadBadge();
    } catch (e) {
      console.warn('Failed to mark messages as read:', e);
    }
  }

  // Load historical messages from Supabase database
  async function loadSupabaseHistory(id) {
    if (!window.supa || !window.ME) return;
    try {
      var isDM = !id.startsWith('#') && !['defi-prophets', 'ai-signals', 'spark-devs'].includes(id);
      if (isDM && !isValidUUID(id)) return; // Skip mock DMs
      var res;
      if (isDM) {
        res = await supa.from('messages')
          .select('*')
          .or('and(channel_id.eq.' + ME.id + ',sender_id.eq.' + id + '),and(channel_id.eq.' + id + ',sender_id.eq.' + ME.id + ')')
          .order('created_at', { ascending: true });
      } else {
        res = await supa.from('messages')
          .select('*')
          .eq('channel_id', id)
          .order('created_at', { ascending: true });
      }
      
      if (res.data) {
        var msgs = getCachedMessages();
        var deletedIds = getDeletedMessageIds();
        
        // Map database records to our in-memory format
        msgs[id] = res.data
          .filter(function(row) {
            return !deletedIds.includes(row.id);
          })
          .map(function(row) {
            return {
              id:                  row.id,
              sender_id:           row.sender_id === ME.id ? 'me' : row.sender_id,
              sender_name:         row.sender_name,
              sender_avatar_color: row.sender_avatar_color,
              content:             row.content,
              media_url:           row.media_url,
              created_at:          new Date(row.created_at).getTime(),
              reactions:           row.reactions || {},
              read:                row.read || false // We added this!
            };
          });

        cacheMessages(msgs);
        
        // Only refresh conversation viewport if this channel is still active
        if (state.activeChannelId === id) {
          renderActiveConversation();
          // Mark messages as read since they are loaded into our active view
          markMessagesAsRead(id);
        }
      }
    } catch (e) {
      console.warn('Failed to load Supabase chat history:', e);
    }
  }

  // Send a message (saves locally + Supabase fallback)
  async function sendMessage(content, mediaUrl, mediaTitle) {
    var channel = state.activeChannelId;
    if (!channel) return;

    // Clear input field immediately before rendering to prevent race conditions in preservation
    var inputEl = document.getElementById('chatTextInput');
    if (inputEl) inputEl.value = '';

    var senderName = window.PROFILE ? PROFILE.username : '@user';
    var senderColor = window.PROFILE ? PROFILE.avatar_color : 0;
    var senderId = window.ME ? ME.id : null;

    var newMsg = {
      id: 'm_local_' + Math.random().toString(36).slice(2),
      sender_id: senderId ? senderId : 'me',
      sender_name: senderName,
      sender_avatar_color: senderColor,
      content: mediaUrl ? (mediaTitle || 'Attachment') : content,
      media_url: mediaUrl || null,
      created_at: Date.now(),
      reactions: {}
    };

    // 1. Add to cache
    var msgs = getCachedMessages();
    if (!msgs[channel]) msgs[channel] = [];
    msgs[channel].push(newMsg);
    cacheMessages(msgs);

    // 2. Refresh UI
    renderChatList();
    renderActiveConversation();

    // 3. Supabase Database integration (if configured)
    if (window.supa && window.ME) {
      var isDM = !channel.startsWith('#') && !['defi-prophets', 'ai-signals', 'spark-devs'].includes(channel);
      if (isDM && !isValidUUID(channel)) return; // Skip mock DMs
      try {
        var dbMsg = {
          channel_id:          channel,
          sender_id:           ME.id,
          sender_name:         senderName,
          sender_avatar_color: senderColor,
          content:             newMsg.content,
          media_url:           newMsg.media_url
        };
        var res = await window.supa.from('messages').insert(dbMsg).select();
        if (res.error) {
          console.warn('Supabase message insert error:', res.error);
        } else if (res.data && res.data[0]) {
          // Replace local message ID with database UUID
          var saved = res.data[0];

          var list = getDeletedMessageIds();
          var wasDeleted = list.includes(newMsg.id);
          if (wasDeleted) {
            list = list.filter(function(id) { return id !== newMsg.id; });
            if (!list.includes(saved.id)) {
              list.push(saved.id);
            }
            try {
              localStorage.setItem('spark_deleted_msg_ids', JSON.stringify(list));
            } catch (e) {}

            if (window.supa && window.ME) {
              try {
                await window.supa.from('messages').delete().eq('id', saved.id);
              } catch (e) {
                console.warn('Supabase delete error for post-insert:', e);
              }
            }
          }

          var cachedMsgs = getCachedMessages();
          var thread = cachedMsgs[channel] || [];
          var mLocalIndex = thread.findIndex(function (m) { return m.id === newMsg.id; });
          if (mLocalIndex !== -1) {
            thread[mLocalIndex].id = saved.id;
            cacheMessages(cachedMsgs);
            if (state.activeChannelId === channel) {
              renderActiveConversation();
            }
            renderChatList();
          }
        }
      } catch (e) {
        console.warn('Supabase insert failed, running local-first mode:', e);
      }
    }
  }

  // Add emoji reaction under message bubbles
  function addReaction(msgId, emoji) {
    var channel = state.activeChannelId;
    if (!channel) return;

    var msgs = getCachedMessages();
    var thread = msgs[channel] || [];
    var msg = thread.find(function (m) { return m.id === msgId; });
    if (!msg) return;

    if (!msg.reactions) msg.reactions = {};

    var myId = window.ME ? window.ME.id : 'me';
    var reactionObj = msg.reactions[emoji];
    
    // Normalise existing reaction to array format if it's in the old structure
    if (reactionObj) {
      if (!Array.isArray(reactionObj.users)) {
        var existingUsers = [];
        if (reactionObj.userReacted) {
          // If it was marked as reacted, assume it was by the sender or the current user
          existingUsers.push(msg.sender_id === 'me' ? myId : msg.sender_id);
        }
        reactionObj.users = existingUsers;
      }
    } else {
      reactionObj = { users: [] };
    }

    var userIndex = reactionObj.users.indexOf(myId);
    if (userIndex !== -1) {
      // Current user already reacted, so they toggle it off (remove themselves)
      reactionObj.users.splice(userIndex, 1);
    } else {
      // Current user hasn't reacted yet, add them
      reactionObj.users.push(myId);
    }

    reactionObj.count = reactionObj.users.length;
    reactionObj.userReacted = reactionObj.users.includes(myId);

    if (reactionObj.count === 0) {
      delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji] = reactionObj;
    }

    // Write back and refresh
    cacheMessages(msgs);
    renderActiveConversation();

    // Sync reaction change to Supabase if it's a saved database message
    if (window.supa && window.ME && !msgId.startsWith('m_local_')) {
      window.supa.from('messages')
        .update({ reactions: msg.reactions })
        .eq('id', msgId)
        .then(function(res) {
          if (res && res.error) {
            console.warn('Failed to sync reaction update:', res.error);
          }
        });
    }
  }

  // Show "Create Chat/Channel" Modal
  function showCreateChatModal() {
    if (window.openMo) {
      state.modalTab = 'DM';
      
      // Update UI components
      var title = document.getElementById('ccTitle');
      var label = document.getElementById('lblCcTarget');
      var input = document.getElementById('ccTarget');
      var hint = document.getElementById('ccHint');
      var tabDM = document.getElementById('ccTabDM');
      var tabTeam = document.getElementById('ccTabTeam');

      if (title) title.textContent = 'Start Message Room 🛰️';
      if (label) label.textContent = 'Recipient Nickname';
      if (input) {
        input.value = '';
        input.placeholder = 'e.g. @sergey_defi';
      }
      if (hint) {
        hint.textContent = '';
        hint.style.color = 'var(--mu2)';
      }
      if (tabDM) tabDM.classList.add('active');
      if (tabTeam) tabTeam.classList.remove('active');

      openMo('moCreateChat');
    }
  }

  // Wire up the new chat modal elements
  function _wireCreateChatModal() {
    var tabDM = document.getElementById('ccTabDM');
    var tabTeam = document.getElementById('ccTabTeam');
    var label = document.getElementById('lblCcTarget');
    var input = document.getElementById('ccTarget');
    var hint = document.getElementById('ccHint');
    var confirmBtn = document.getElementById('btnConfirmCreateChat');

    if (tabDM) {
      tabDM.addEventListener('click', function () {
        state.modalTab = 'DM';
        tabDM.classList.add('active');
        if (tabTeam) tabTeam.classList.remove('active');
        if (label) label.textContent = 'Recipient Nickname';
        if (input) {
          input.value = '';
          input.placeholder = 'e.g. @sergey_defi';
        }
        if (hint) hint.textContent = '';
      });
    }

    if (tabTeam) {
      tabTeam.addEventListener('click', function () {
        state.modalTab = 'TEAM';
        tabTeam.classList.add('active');
        if (tabDM) tabDM.classList.remove('active');
        if (label) label.textContent = 'Channel Name';
        if (input) {
          input.value = '';
          input.placeholder = 'e.g. #defi-alpha';
        }
        if (hint) hint.textContent = '';
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async function () {
        if (!input) return;
        var rawVal = input.value.trim();
        if (!rawVal) {
          _setHint('Please enter a name', 'err');
          return;
        }

        var newId = '';
        var displayName = '';
        var avColor = 0;

        if (state.modalTab === 'DM') {
          // Direct Message
          if (rawVal.charAt(0) !== '@') rawVal = '@' + rawVal;
          if (rawVal.length < 4) {
            _setHint('Username must be 3+ characters', 'err');
            return;
          }
          if (!/^@[a-zA-Z0-9_]+$/.test(rawVal)) {
            _setHint('Letters, numbers, and underscores only', 'err');
            return;
          }

          if (window.supa) {
            _setHint('Verifying user identity... 🛰️', 'info');
            try {
              var res = await supa.from('profiles').select('*').ilike('username', rawVal).single();
              if (res.error || !res.data) {
                _setHint('User ' + rawVal + ' not found in the grid.', 'err');
                return;
              }
              var prof = res.data;
              newId = prof.id; // Profile UUID
              displayName = prof.username;
              avColor = prof.avatar_color || 0;
            } catch (e) {
              console.warn('Failed to verify user:', e);
              _setHint('Database error verifying user identity.', 'err');
              return;
            }
          } else {
            // Local offline fallback
            newId = rawVal;
            displayName = rawVal.replace('@', '').split('_').map(function(s) {
              return s.charAt(0).toUpperCase() + s.slice(1);
            }).join(' ');
            avColor = Math.floor(Math.random() * 12);
          }

          // Check if contact already exists
          var contacts = getContactsList();
          var exists = contacts.some(function (c) { return c.id === newId; });
          if (exists) {
            _setHint('Contact already in your direct messages', 'err');
            return;
          }

          // Push new contact
          contacts.push({
            id: newId,
            name: displayName,
            username: displayName,
            online: true,
            avColor: avColor,
            preview: 'Signal room opened.'
          });
          saveContactsList(contacts);

        } else {
          // Team Channel
          if (rawVal.charAt(0) !== '#') rawVal = '#' + rawVal;
          if (rawVal.length < 4) {
            _setHint('Channel name must be 3+ characters', 'err');
            return;
          }
          if (!/^#[a-zA-Z0-9_-]+$/.test(rawVal)) {
            _setHint('Letters, numbers, dashes and underscores only', 'err');
            return;
          }

          newId = rawVal.replace('#', '').toLowerCase();
          displayName = rawVal.replace('#', '').split('-').map(function(s) {
            return s.charAt(0).toUpperCase() + s.slice(1);
          }).join(' ');

          // Check if team already exists
          var teams = getTeamsList();
          var exists = teams.some(function (t) { return t.id === newId; });
          if (exists) {
            _setHint('Channel already exists in your registry', 'err');
            return;
          }

          // Push new team
          teams.push({
            id: newId,
            name: displayName,
            activeCount: 1,
            avColor: Math.floor(Math.random() * 12),
            preview: 'Channel established.'
          });
          saveTeamsList(teams);
        }

        // Initialize empty message log thread for the new channel
        var msgs = getCachedMessages();
        msgs[newId] = [
          { id: 'm_sys_init', sender_id: 'system', sender_name: 'SYSTEM', sender_avatar_color: 11, content: 'Signal channel opened. Security synchronized.', created_at: Date.now() }
        ];
        cacheMessages(msgs);

        // Close modal
        if (window.closeMo) closeMo('moCreateChat');

        // Select and open the new channel
        selectChannel(newId);
      });
    }

    // Wire up backdrop overlay click to close
    var moCreateChat = document.getElementById('moCreateChat');
    if (moCreateChat) {
      moCreateChat.addEventListener('click', function (event) {
        if (event.target === moCreateChat) {
          if (window.closeMo) closeMo('moCreateChat');
        }
      });
    }

    function _setHint(msg, type) {
      if (!hint) return;
      hint.textContent = msg;
      hint.style.color = type === 'err' ? 'var(--red)' : 'var(--mu2)';
    }
  }

  // Poll database for new messages if WebSockets are unavailable or in polling mode
  function _initPollingSubscription() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async function () {
      if (!state.isTabActive) return; // Completely pause polling when tab is backgrounded!
      if (!window.supa || !window.ME) return;
      try {
        // 1. If a chat is open, refresh its history to load new messages and read status
        if (state.activeChannelId) {
          await loadSupabaseHistory(state.activeChannelId);
        }
        
        // 2. Poll for other DMs sent to us to update sidebar badges / previews
        var res = await supa.from('messages')
          .select('*')
          .eq('channel_id', ME.id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (res.data && res.data.length > 0) {
          var msgs = getCachedMessages();
          var deletedIds = getDeletedMessageIds();
          var changed = false;
          res.data.forEach(function (row) {
            var threadId = row.sender_id;
            if (!msgs[threadId]) msgs[threadId] = [];
            var dup = msgs[threadId].some(function (m) { return m.id === row.id; });
            var isDeleted = deletedIds.includes(row.id);
            if (!dup && !isDeleted) {
              // Auto-append incoming contact to local sidebar list if missing
              var contacts = getContactsList();
              var contactExists = contacts.some(function (c) { return c.id === threadId; });
              if (!contactExists) {
                contacts.push({
                  id: threadId,
                  name: row.sender_name,
                  username: row.sender_name,
                  online: false,
                  avColor: row.sender_avatar_color || 0,
                  preview: row.content
                });
                saveContactsList(contacts);
              }

              msgs[threadId].push({
                id:                  row.id,
                sender_id:           row.sender_id === ME.id ? 'me' : row.sender_id,
                sender_name:         row.sender_name,
                sender_avatar_color: row.sender_avatar_color,
                content:             row.content,
                media_url:           row.media_url,
                created_at:          new Date(row.created_at).getTime(),
                reactions:           row.reactions || {},
                read:                row.read || false
              });
              changed = true;
            }
          });
          if (changed) {
            cacheMessages(msgs);
            renderChatList();
            var chatDot = document.getElementById('mChatDot');
            if (chatDot) chatDot.style.display = 'block';
          }
        }
        // 3. Keep badges in sync
        await updateUnreadBadge();
      } catch (e) {
        console.warn('Chats polling failed:', e);
      }
    }, 4000); // Check every 4 seconds for responsive real-time feedback
  }

  // Subscribe to real-time public message stream
  function _initRealtimeSubscription() {
    var mode = window.REALTIME_MODE || (window.SPARK_RUNTIME ? window.SPARK_RUNTIME.get('REALTIME_MODE') : 'polling');
    if (mode === 'polling') {
      _initPollingSubscription();
      return;
    }

    if (!window.supa || !window.ME || state.realtimeChannel) return;
    try {
      state.realtimeChannel = supa.channel('realtime:public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (payload) {
          var newRow = payload.new;
          if (!newRow) return;

          // Avoid duplicating messages sent by oneself
          if (newRow.sender_id === ME.id) return;

          var threadId = newRow.channel_id;
          if (newRow.channel_id === ME.id) {
            threadId = newRow.sender_id;

            // Auto-append incoming contacts to local sidebar list if missing
            var contacts = getContactsList();
            var contactExists = contacts.some(function (c) { return c.id === threadId; });
            if (!contactExists) {
              contacts.push({
                id: threadId,
                name: newRow.sender_name,
                username: newRow.sender_name,
                online: false,
                avColor: newRow.sender_avatar_color || 0,
                preview: newRow.content
              });
              saveContactsList(contacts);
            }
          }

          var msgs = getCachedMessages();
          if (!msgs[threadId]) msgs[threadId] = [];
          
          // Check duplicates and deleted status
          var deletedIds = getDeletedMessageIds();
          var dup = msgs[threadId].some(function (m) { return m.id === newRow.id; });
          var isDeleted = deletedIds.includes(newRow.id);
          if (dup || isDeleted) return;

          msgs[threadId].push({
            id:                  newRow.id,
            sender_id:           newRow.sender_id,
            sender_name:         newRow.sender_name,
            sender_avatar_color: newRow.sender_avatar_color,
            content:             newRow.content,
            media_url:           newRow.media_url,
            created_at:          new Date(newRow.created_at).getTime(),
            reactions:           newRow.reactions || {},
            read:                newRow.read || false
          });

          cacheMessages(msgs);
          
          // Trigger haptic dot or list indicator
          var chatDot = document.getElementById('mChatDot');
          if (chatDot) chatDot.style.display = 'block';
          updateUnreadBadge();

          if (state.activeChannelId === threadId) {
            renderActiveConversation();
            // Automatically mark as read if this thread is open
            markMessagesAsRead(threadId);
          } else {
            renderChatList();
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, function (payload) {
          var updatedRow = payload.new;
          if (!updatedRow) return;

          var threadId = updatedRow.channel_id;
          if (updatedRow.channel_id === ME.id) {
            threadId = updatedRow.sender_id;
          }

          var msgs = getCachedMessages();
          var thread = msgs[threadId] || [];
          var msg = thread.find(function (m) { return m.id === updatedRow.id; });
          if (msg) {
            msg.reactions = updatedRow.reactions || {};
            msg.read = updatedRow.read; // Keep read tick in sync!
            cacheMessages(msgs);
            if (state.activeChannelId === threadId) {
              renderActiveConversation();
            }
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, function (payload) {
          var oldRow = payload.old;
          if (!oldRow) return;

          var msgs = getCachedMessages();
          var changed = false;
          Object.keys(msgs).forEach(function (threadId) {
            var idx = msgs[threadId].findIndex(function (m) { return m.id === oldRow.id; });
            if (idx !== -1) {
              msgs[threadId].splice(idx, 1);
              changed = true;
            }
          });

          if (changed) {
            cacheMessages(msgs);
            renderChatList();
            if (state.activeChannelId) {
              renderActiveConversation();
            }
          }
        })
        .subscribe();

    } catch (e) {
      console.warn('Realtime chat subscription failed:', e);
    }
  }

  // Initialize Supabase Presence channel independently for tracking activity status
  function _initPresenceSubscription() {
    var mode = window.REALTIME_MODE || (window.SPARK_RUNTIME ? window.SPARK_RUNTIME.get('REALTIME_MODE') : 'polling');
    if (mode === 'polling') {
      // Do NOT initialize WebSocket presence channel in polling mode to avoid console WebSocket connection error spam!
      return;
    }

    if (!window.supa || !window.ME || state.presenceChannel) return;
    try {
      state.presenceChannel = supa.channel('online-presence', {
        config: { presence: { key: ME.id } }
      });

      state.presenceChannel
        .on('presence', { event: 'sync' }, function () {
          var presState = state.presenceChannel.presenceState();
          updateOnlineStatusFromPresence(presState);
        })
        .subscribe(async function (status) {
          if (status === 'SUBSCRIBED') {
            await state.presenceChannel.track({
              username: window.PROFILE ? PROFILE.username : '@user',
              online_at: new Date().toISOString()
            });
          }
        });

      // Explicitly untrack presence instantly when page unloads (closes tab, browser, or suspends)
      window.addEventListener('beforeunload', function () {
        if (state.presenceChannel) {
          state.presenceChannel.untrack();
          state.presenceChannel.unsubscribe();
        }
      });
      window.addEventListener('pagehide', function () {
        if (state.presenceChannel) {
          state.presenceChannel.untrack();
          state.presenceChannel.unsubscribe();
        }
      });
    } catch (e) {
      console.warn('Realtime presence subscription failed:', e);
    }
  }

  // Initialize Chats Engine
  function init() {
    // Online status is now read live from presenceChannel via isUserOnline(),
    // so no localStorage seed needed here.

    if (state.initialized) {
      // Re-setup realtime subscription if session loaded
      if (window.supa && window.ME) {
        _initRealtimeSubscription();
        _initPresenceSubscription();
      }
      return;
    }
    state.initialized = true;

    // Read query from search input if any
    var searchEl = document.getElementById('chatSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.searchQuery = searchEl.value;
        renderChatList();
      });
    }

    // Wire up Sidebar "+" start chat button click
    var addBtn = document.querySelector('.chat-sidebar-action');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        showCreateChatModal();
      });
    }

    // Wire up `#moCreateChat` modal events
    _wireCreateChatModal();

    window.addEventListener('click', function () {
      document.querySelectorAll('.chat-bubble-context').forEach(function (c) {
        c.style.display = '';
      });
    });

    // Initial render
    renderChatList();
    renderActiveConversation();

    // Listen to tab visibility changes to pause background polling and toggle presence tracking
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        state.isTabActive = false;
        if (state.presenceChannel && window.supa && window.ME) {
          state.presenceChannel.untrack().catch(function (e) {
            console.warn('Presence untrack failed on hidden:', e);
          });
        }
      } else {
        state.isTabActive = true;
        
        // Immediate sync upon tab refocus
        if (window.supa && window.ME) {
          if (state.activeChannelId) {
            loadSupabaseHistory(state.activeChannelId);
          }
          updateUnreadBadge();
          
          // Re-track presence immediately when user refocuses the tab to set status back to Online
          if (state.presenceChannel) {
            state.presenceChannel.track({
              username: window.PROFILE ? PROFILE.username : '@user',
              online_at: new Date().toISOString()
            }).catch(function (e) {
              console.warn('Failed to re-track presence on visible:', e);
            });
          } else {
            _initPresenceSubscription();
          }
        }
      }
    });

    // Realtime Database replication hooks
    if (window.supa && window.ME) {
      _initRealtimeSubscription();
      _initPresenceSubscription();
      updateUnreadBadge();
    }
  }

  // Formatter helper
  function _formatTime(timestamp) {
    var d = new Date(timestamp);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12;
    h = h ? h : 12; // hours 0 is 12
    m = m < 10 ? '0' + m : m;
    return h + ':' + m + ampm;
  }

  // Dynamic visual micro-alerts
  function showMicroAlert(message, type) {
    var existing = document.getElementById('spark-micro-alert');
    if (existing) existing.remove();

    var alertEl = document.createElement('div');
    alertEl.id = 'spark-micro-alert';
    alertEl.className = 'spark-micro-alert' + (type === 'err' ? ' error' : '');
    alertEl.textContent = message;
    
    alertEl.style.position = 'fixed';
    alertEl.style.top = '24px';
    alertEl.style.left = '50%';
    alertEl.style.transform = 'translateX(-50%)';
    alertEl.style.background = type === 'err' ? 'rgba(232, 90, 90, 0.95)' : 'rgba(123, 92, 250, 0.95)';
    alertEl.style.color = '#fff';
    alertEl.style.padding = '12px 24px';
    alertEl.style.borderRadius = '12px';
    alertEl.style.fontSize = '13px';
    alertEl.style.fontWeight = '600';
    alertEl.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    alertEl.style.zIndex = '100000';
    alertEl.style.pointerEvents = 'none';
    alertEl.style.animation = 'alertPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    
    document.body.appendChild(alertEl);

    if (!document.getElementById('style-micro-alert')) {
      var style = document.createElement('style');
      style.id = 'style-micro-alert';
      style.textContent = '\n' +
        '@keyframes alertPop {\n' +
        '  from { transform: translate(-50%, -20px); opacity: 0; }\n' +
        '  to { transform: translate(-50%, 0); opacity: 1; }\n' +
        '}\n';
      document.head.appendChild(style);
    }

    setTimeout(function () {
      alertEl.style.opacity = '0';
      alertEl.style.transition = 'opacity 0.3s';
      setTimeout(function () {
        alertEl.remove();
      }, 300);
    }, 2500);
  }

  // Toggle Pin / Unpin of contact in directory
  function togglePinContact(contactId) {
    var contacts = getContactsList();
    var contact = contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;

    if (contact.pinned) {
      contact.pinned = false;
      contact.pinnedAt = null;
      showMicroAlert(
        window.LANG === 'ru' ? 'Чат откреплен' : 'Chat unpinned successfully'
      );
    } else {
      var pinnedCount = contacts.filter(function (c) { return c.pinned; }).length;
      if (pinnedCount >= 4) {
        showMicroAlert(
          window.LANG === 'ru' ? 'Закреплено максимум 4 чата' : 'Maximum 4 pinned chats allowed',
          'err'
        );
        return;
      }
      contact.pinned = true;
      contact.pinnedAt = Date.now();
      showMicroAlert(
        window.LANG === 'ru' ? 'Чат закреплен сверху' : 'Chat pinned to top'
      );
    }

    saveContactsList(contacts);
    renderChatList();
  }

  // Trigger chat deletion with confirmation modal
  function triggerDeleteContact(contactId) {
    showDeleteConfirmModal(contactId, 'both', async function (selectedType) {
      var deleteForEveryone = (selectedType === 'everyone');
      
      // 1. Delete from database if delete_for_everyone
      if (deleteForEveryone && window.supa && window.ME) {
        try {
          await supa.rpc('delete_conversation', {
            target_channel: contactId,
            delete_for_everyone: true
          });
        } catch (e) {
          console.warn('RPC delete conversation failed:', e);
        }
      }

      // 2. Clear locally
      var contacts = getContactsList();
      contacts = contacts.filter(function (c) { return c.id !== contactId; });
      saveContactsList(contacts);

      var cachedMsgs = getCachedMessages();
      delete cachedMsgs[contactId];
      cacheMessages(cachedMsgs);

      if (state.activeChannelId === contactId) {
        state.activeChannelId = null;
        renderActiveConversation();
      }

      renderChatList();
      showMicroAlert(
        window.LANG === 'ru' ? 'Чат успешно удален' : 'Chat deleted successfully'
      );
    }, true);
  }

  // Show directory right-click / touch long press context menu
  function showContactContextMenu(contactId, x, y) {
    var existing = document.getElementById('directory-context-menu');
    if (existing) existing.remove();

    var contacts = getContactsList();
    var contact = contacts.find(function (c) { return c.id === contactId; });
    if (!contact) return;

    var menu = document.createElement('div');
    menu.id = 'directory-context-menu';
    menu.style.position = 'absolute';
    menu.style.zIndex = '99999';
    menu.style.background = 'rgba(15, 18, 36, 0.96)';
    menu.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    menu.style.borderRadius = '10px';
    menu.style.padding = '4px 0';
    menu.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    menu.style.width = '160px';
    menu.style.backdropFilter = 'blur(20px)';
    menu.style.webkitBackdropFilter = 'blur(20px)';

    var pinLabel = contact.pinned
      ? (window.LANG === 'ru' ? '📌 Открепить' : '📌 Unpin Chat')
      : (window.LANG === 'ru' ? '📌 Закрепить' : '📌 Pin Chat');

    var selectLabel = window.LANG === 'ru' ? '⚙️ Выбрать несколько' : '⚙️ Select Multiple';
    var deleteLabel = window.LANG === 'ru' ? '🗑️ Удалить чат' : '🗑️ Delete Chat';

    menu.innerHTML = ''
      + '<button class="dir-ctx-btn" id="btnCtxPin" style="width:100%;text-align:left;background:transparent;border:none;color:#fff;padding:8px 12px;font-size:12px;cursor:pointer;font-family:inherit">' + pinLabel + '</button>'
      + '<button class="dir-ctx-btn" id="btnCtxSelect" style="width:100%;text-align:left;background:transparent;border:none;color:#fff;padding:8px 12px;font-size:12px;cursor:pointer;font-family:inherit">' + selectLabel + '</button>'
      + '<div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0"></div>'
      + '<button class="dir-ctx-btn" id="btnCtxDelete" style="width:100%;text-align:left;background:transparent;border:none;color:var(--red);padding:8px 12px;font-size:12px;cursor:pointer;font-weight:600;font-family:inherit">' + deleteLabel + '</button>';

    document.body.appendChild(menu);

    var left = x;
    var top = y;
    if (left + 160 > window.innerWidth) left = window.innerWidth - 170;
    if (top + 120 > window.innerHeight) top = window.innerHeight - 130;

    menu.style.left = left + (window.scrollX || 0) + 'px';
    menu.style.top = top + (window.scrollY || 0) + 'px';

    if (!document.getElementById('style-dir-ctx')) {
      var style = document.createElement('style');
      style.id = 'style-dir-ctx';
      style.textContent = '\n' +
        '.dir-ctx-btn {\n' +
        '  transition: background 0.2s;\n' +
        '}\n' +
        '.dir-ctx-btn:hover {\n' +
        '  background: rgba(123, 92, 250, 0.15) !important;\n' +
        '}\n';
      document.head.appendChild(style);
    }

    document.getElementById('btnCtxPin').addEventListener('click', function (e) {
      togglePinContact(contactId);
      menu.remove();
      e.stopPropagation();
    });

    document.getElementById('btnCtxSelect').addEventListener('click', function (e) {
      startMultiSelectMode(contactId);
      menu.remove();
      e.stopPropagation();
    });

    document.getElementById('btnCtxDelete').addEventListener('click', function (e) {
      menu.remove();
      triggerDeleteContact(contactId);
      e.stopPropagation();
    });

    var closeMenu = function () {
      menu.remove();
      window.removeEventListener('click', closeMenu);
    };
    setTimeout(function () {
      window.addEventListener('click', closeMenu);
    }, 50);
  }

  // Multi-Select Mode Operations
  function startMultiSelectMode(initialId) {
    state.multiSelectMode = true;
    state.selectedContacts = initialId ? [initialId] : [];
    renderChatList();
    renderSidebarHeaderForMultiSelect();
  }

  function exitMultiSelectMode() {
    state.multiSelectMode = false;
    state.selectedContacts = [];
    var bar = document.getElementById('chatMultiSelectBar');
    if (bar) bar.remove();
    renderSidebarHeaderForMultiSelect();
    renderChatList();
  }

  function toggleContactSelection(contactId) {
    var idx = state.selectedContacts.indexOf(contactId);
    if (idx !== -1) {
      state.selectedContacts.splice(idx, 1);
    } else {
      state.selectedContacts.push(contactId);
    }
    renderChatList();
    renderSidebarHeaderForMultiSelect();
  }

  function bulkPinSelected() {
    if (state.selectedContacts.length === 0) return;
    var contacts = getContactsList();
    var currentlyPinned = contacts.filter(function (c) { return c.pinned; });
    var newlyToPin = state.selectedContacts.filter(function (id) {
      var c = contacts.find(function (item) { return item.id === id; });
      return c && !c.pinned;
    });

    if (currentlyPinned.length + newlyToPin.length > 4) {
      showMicroAlert(
        window.LANG === 'ru' ? 'Не удается закрепить. Максимум 4 закрепленных чата.' : 'Cannot pin. Maximum 4 pinned chats allowed.',
        'err'
      );
      return;
    }

    newlyToPin.forEach(function (id) {
      var c = contacts.find(function (item) { return item.id === id; });
      if (c) {
        c.pinned = true;
        c.pinnedAt = Date.now();
      }
    });

    saveContactsList(contacts);
    exitMultiSelectMode();
    showMicroAlert(
      window.LANG === 'ru' ? 'Закреплено успешно' : 'Chats pinned successfully'
    );
  }

  function bulkDeleteSelected() {
    if (state.selectedContacts.length === 0) return;
    showDeleteConfirmModal('bulk', 'both', async function (selectedType) {
      var deleteForEveryone = (selectedType === 'everyone');
      var contacts = getContactsList();
      var cachedMsgs = getCachedMessages();

      for (var i = 0; i < state.selectedContacts.length; i++) {
        var id = state.selectedContacts[i];
        
        if (deleteForEveryone && window.supa && window.ME) {
          try {
            await supa.rpc('delete_conversation', {
              target_channel: id,
              delete_for_everyone: true
            });
          } catch (e) {
            console.warn('Bulk RPC delete failed for ' + id, e);
          }
        }

        contacts = contacts.filter(function (c) { return c.id !== id; });
        delete cachedMsgs[id];

        if (state.activeChannelId === id) {
          state.activeChannelId = null;
        }
      }

      saveContactsList(contacts);
      cacheMessages(cachedMsgs);
      exitMultiSelectMode();
      renderActiveConversation();
      
      showMicroAlert(
        window.LANG === 'ru' ? 'Выбранные чаты удалены' : 'Selected chats deleted successfully'
      );
    }, true);
  }

  function renderSidebarHeaderForMultiSelect() {
    var header = document.querySelector('.chat-sidebar-header');
    if (!header) return;

    var existing = document.getElementById('chatMultiSelectBar');
    if (existing) existing.remove();

    if (!state.multiSelectMode) {
      header.querySelectorAll('.chat-sidebar-title-row, .chat-search-wrap').forEach(function (el) {
        el.style.display = '';
      });
      return;
    }

    header.querySelectorAll('.chat-sidebar-title-row, .chat-search-wrap').forEach(function (el) {
      el.style.display = 'none';
    });

    var selectBar = document.createElement('div');
    selectBar.id = 'chatMultiSelectBar';

    var countText = window.LANG === 'ru'
      ? state.selectedContacts.length + ' выбрано'
      : state.selectedContacts.length + ' selected';

    var pinBtnText = window.LANG === 'ru' ? '📌 Закрепить' : '📌 Pin';
    var deleteBtnText = window.LANG === 'ru' ? '🗑️ Удалить' : '🗑️ Delete';
    var cancelText = window.LANG === 'ru' ? 'Отмена' : 'Cancel';

    selectBar.innerHTML = ''
      + '  <span class="chat-multiselect-count">' + countText + '</span>'
      + '  <div style="display:flex;align-items:center;gap:6px">'
      + '    <button id="btnBulkPin" class="chat-multiselect-btn chat-multiselect-btn-pin">' + pinBtnText + '</button>'
      + '    <button id="btnBulkDelete" class="chat-multiselect-btn chat-multiselect-btn-delete">' + deleteBtnText + '</button>'
      + '    <button id="btnBulkCancel" class="chat-multiselect-btn chat-multiselect-btn-cancel">' + cancelText + '</button>'
      + '  </div>';

    header.appendChild(selectBar);

    document.getElementById('btnBulkCancel').addEventListener('click', function () {
      exitMultiSelectMode();
    });

    document.getElementById('btnBulkPin').addEventListener('click', function () {
      bulkPinSelected();
    });

    document.getElementById('btnBulkDelete').addEventListener('click', function () {
      bulkDeleteSelected();
    });
  }

  function _esc(s) {
    if (typeof escapeHTML === 'function') return escapeHTML(s);
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Load pinned messages from database and local storage
  async function loadPinnedMessagesForActiveChannel() {
    var channelId = state.activeChannelId;
    if (!channelId) return;

    state.pinnedMessages = [];
    state.activePinIndex = 0;

    var localPins = [];
    try {
      var localCached = localStorage.getItem('spark_local_pins');
      if (localCached) {
        var parsed = JSON.parse(localCached);
        localPins = parsed[channelId] || [];
      }
    } catch (e) {}

    var dbPins = [];
    if (window.supa && window.ME) {
      try {
        var res = await supa.from('pinned_messages')
          .select('*, messages(*)')
          .eq('channel_id', channelId);
        if (res.data) {
          dbPins = res.data.map(function (row) {
            return {
              id: row.id,
              message_id: row.message_id,
              content: row.messages ? row.messages.content : (window.LANG === 'ru' ? '[Сообщение]' : '[Message]'),
              for_everyone: true,
              pinned_by: row.pinned_by
            };
          });
        }
      } catch (e) {
        console.warn('Failed to load DB pins:', e);
      }
    }

    var allPins = [];
    var msgs = getCachedMessages()[channelId] || [];
    localPins.forEach(function (mId) {
      var msg = msgs.find(function (m) { return m.id === mId; });
      if (msg) {
        allPins.push({
          id: 'local_pin_' + mId,
          message_id: mId,
          content: msg.content,
          for_everyone: false,
          pinned_by: window.ME ? ME.id : 'me'
        });
      }
    });

    allPins = allPins.concat(dbPins);
    state.pinnedMessages = allPins;

    renderPinnedSlidebar();
  }

  function renderPinnedSlidebar() {
    var banner = document.getElementById('chatPinSlidebarOverlay');
    var textSpan = document.getElementById('chatPinnedPreviewText');
    if (!banner || !textSpan) return;

    if (state.pinnedMessages.length === 0) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    
    if (state.activePinIndex >= state.pinnedMessages.length) {
      state.activePinIndex = 0;
    }

    var pin = state.pinnedMessages[state.activePinIndex];
    var content = pin.content;
    if (content.length > 50) content = content.substring(0, 50) + '...';
    
    var prefix = state.pinnedMessages.length > 1
      ? '📌 (' + (state.activePinIndex + 1) + ' / ' + state.pinnedMessages.length + ') '
      : '📌 ';

    textSpan.textContent = prefix + content;
  }

  function jumpToActivePinnedMessage() {
    if (state.pinnedMessages.length === 0) return;
    var pin = state.pinnedMessages[state.activePinIndex];
    var row = document.querySelector('.chat-message-row[data-msg-id="' + pin.message_id + '"]');
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('search-pulse-glow');
      setTimeout(function () {
        row.classList.remove('search-pulse-glow');
      }, 1500);
    }
  }

  function togglePinSelectMode() {
    state.pinSelectMode = !state.pinSelectMode;
    state.selectedPinMessages = [];
    
    var chatCont = document.querySelector('.chat-container');
    if (chatCont) {
      chatCont.classList.toggle('pin-select-active', state.pinSelectMode);
    }
    
    // Reset any preselected classes from rows
    document.querySelectorAll('.chat-message-row.pin-selected').forEach(function (row) {
      row.classList.remove('pin-selected');
    });

    if (state.pinSelectMode) {
      showMicroAlert(
        window.LANG === 'ru' ? 'Выберите сообщение для закрепления' : 'Select a message to pin'
      );
      renderPinSelectionPanel();
    } else {
      var panel = document.getElementById('chatPinSelectionPanel');
      if (panel) panel.remove();
      
      // Restore normal inputs
      var container = document.querySelector('.chat-main-input-container');
      if (container) {
        container.querySelectorAll('.chat-input-row').forEach(function (el) {
          el.style.display = 'flex';
        });
      }
    }
  }

  function togglePinMessageSelection(msgId) {
    var idx = state.selectedPinMessages.indexOf(msgId);
    if (idx !== -1) {
      state.selectedPinMessages.splice(idx, 1);
    } else {
      state.selectedPinMessages.push(msgId);
    }
    
    var row = document.querySelector('.chat-message-row[data-msg-id="' + msgId + '"]');
    if (row) {
      row.classList.toggle('pin-selected', idx === -1);
    }
    
    renderPinSelectionPanel();
  }

  function renderPinSelectionPanel() {
    var container = document.querySelector('.chat-main-input-container');
    if (!container) return;

    var existing = document.getElementById('chatPinSelectionPanel');
    if (existing) existing.remove();

    container.querySelectorAll('.chat-input-row, .chat-composed-attachment-preview').forEach(function (el) {
      el.style.display = 'none';
    });

    var panel = document.createElement('div');
    panel.id = 'chatPinSelectionPanel';
    panel.style.display = 'flex';
    panel.style.alignItems = 'center';
    panel.style.justifyContent = 'space-between';
    panel.style.width = '100%';
    panel.style.boxSizing = 'border-box';
    panel.style.padding = '10px 0';

    var countText = window.LANG === 'ru'
      ? state.selectedPinMessages.length + ' выбрано'
      : state.selectedPinMessages.length + ' selected';

    var pinBtnText = window.LANG === 'ru' ? '📌 Закрепить' : '📌 Pin Selected';
    var cancelText = window.LANG === 'ru' ? 'Отмена' : 'Cancel';

    panel.innerHTML = ''
      + '  <span style="font-size:12px;font-weight:600;color:#fff">' + countText + '</span>'
      + '  <div style="display:flex;gap:8px">'
      + '    <button id="btnPinSubmit" class="chat-attach-btn" style="padding:6px 14px;font-size:12px">' + pinBtnText + '</button>'
      + '    <button id="btnPinCancel" class="chat-attach-btn" style="padding:6px 14px;font-size:12px;background:transparent;border:none">' + cancelText + '</button>'
      + '  </div>';

    container.appendChild(panel);

    document.getElementById('btnPinCancel').addEventListener('click', function () {
      togglePinSelectMode();
    });

    document.getElementById('btnPinSubmit').addEventListener('click', function () {
      submitPinSelectedMessages();
    });
  }

  function submitPinSelectedMessages() {
    if (state.selectedPinMessages.length === 0) return;
    
    showDeleteConfirmModal('pin', 'both', async function (pinType) {
      var forEveryone = (pinType === 'everyone');
      var channelId = state.activeChannelId;

      for (var i = 0; i < state.selectedPinMessages.length; i++) {
        var mId = state.selectedPinMessages[i];
        
        if (forEveryone) {
          if (window.supa && window.ME && !mId.startsWith('m_local_')) {
            try {
              await supa.from('pinned_messages').insert({
                channel_id: channelId,
                message_id: mId,
                pinned_by: ME.id,
                for_everyone: true
              });
            } catch (e) {
              console.warn('Supabase DB pin failed:', e);
            }
          }
        } else {
          var localPins = {};
          try {
            var cached = localStorage.getItem('spark_local_pins');
            if (cached) localPins = JSON.parse(cached);
          } catch (e) {}
          
          if (!localPins[channelId]) localPins[channelId] = [];
          if (!localPins[channelId].includes(mId)) {
            localPins[channelId].push(mId);
          }
          localStorage.setItem('spark_local_pins', JSON.stringify(localPins));
        }
      }

      togglePinSelectMode();
      await loadPinnedMessagesForActiveChannel();
      showMicroAlert(
        window.LANG === 'ru' ? 'Сообщения успешно закреплены' : 'Messages pinned successfully'
      );
    });

    var popTitle = document.querySelector('#moDeleteConfirm .mo-title');
    var popBody = document.querySelector('#moDeleteConfirm .mo-box div[style*="font-size:13px"]');
    var popBtnMe = document.getElementById('btnDeleteForMe');
    var popBtnEveryone = document.getElementById('btnDeleteForEveryone');

    if (popTitle) popTitle.textContent = window.LANG === 'ru' ? 'Закрепить сообщения?' : 'Pin messages?';
    if (popBody) popBody.textContent = window.LANG === 'ru'
      ? 'Вы хотите закрепить эти сообщения только для себя или для всех участников?'
      : 'Do you want to pin these messages only for yourself or for everyone?';
    if (popBtnMe) popBtnMe.textContent = window.LANG === 'ru' ? 'Для меня' : 'Pin for Me';
    if (popBtnEveryone) popBtnEveryone.textContent = window.LANG === 'ru' ? 'Для всех' : 'Pin for Everyone';
  }

  async function unpinActiveMessage() {
    if (state.pinnedMessages.length === 0) return;
    var pin = state.pinnedMessages[state.activePinIndex];
    var channelId = state.activeChannelId;

    if (pin.id.startsWith('local_pin_')) {
      try {
        var cached = localStorage.getItem('spark_local_pins');
        if (cached) {
          var localPins = JSON.parse(cached);
          if (localPins[channelId]) {
            localPins[channelId] = localPins[channelId].filter(function (id) { return id !== pin.message_id; });
            localStorage.setItem('spark_local_pins', JSON.stringify(localPins));
          }
        }
      } catch (e) {}
    } else {
      if (window.supa && window.ME) {
        try {
          await supa.from('pinned_messages').delete().eq('id', pin.id);
        } catch (e) {
          console.warn('Failed to delete DB pin:', e);
        }
      }
    }

    showMicroAlert(
      window.LANG === 'ru' ? 'Сообщение успешно откреплено' : 'Message unpinned successfully'
    );
    
    await loadPinnedMessagesForActiveChannel();
  }

  function performInChatSearch() {
    var box = document.getElementById('chatSearchBox');
    if (!box) return;
    var query = box.value.trim().toLowerCase();
    
    // Clear existing highlights
    document.querySelectorAll('.search-highlight').forEach(function (el) {
      var parent = el.parentNode;
      if (parent) {
        // If wrapped in custom text wrapper span, replace the span with text node
        if (parent.className === 'search-text-wrapper') {
          var grandparent = parent.parentNode;
          if (grandparent) {
            grandparent.replaceChild(document.createTextNode(parent.textContent), parent);
            grandparent.normalize();
          }
        } else {
          parent.replaceChild(document.createTextNode(el.textContent), el);
          parent.normalize();
        }
      }
    });

    state.searchMatches = [];
    state.searchActiveIndex = -1;

    var countSpan = document.getElementById('chatSearchCount');
    if (countSpan) countSpan.textContent = '0 / 0';

    if (!query) return;

    var id = state.activeChannelId;
    var msgs = getCachedMessages()[id] || [];
    var deletedIds = getDeletedMessageIds();
    
    var matchedIds = [];
    msgs.forEach(function (m) {
      if (m.sender_id === 'system') return;
      if (deletedIds.includes(m.id)) return;
      if (m.content && m.content.toLowerCase().includes(query)) {
        matchedIds.push(m.id);
      }
    });

    state.searchMatches = matchedIds;

    if (matchedIds.length > 0) {
      state.searchActiveIndex = matchedIds.length - 1; // start at newest
      
      matchedIds.forEach(function (msgId) {
        var row = document.querySelector('.chat-message-row[data-msg-id="' + msgId + '"]');
        if (row) {
          var bubble = row.querySelector('.chat-msg-bubble');
          if (bubble) {
            bubble.childNodes.forEach(function (node) {
              if (node.nodeType === 3) { // TEXT_NODE
                var text = node.textContent;
                var lower = text.toLowerCase();
                if (lower.includes(query)) {
                  var span = document.createElement('span');
                  span.className = 'search-text-wrapper';
                  span.innerHTML = text.replace(new RegExp('(' + _escapeRegExp(query) + ')', 'gi'), '<mark class="search-highlight" style="background:rgba(232, 197, 90, 0.45);color:#fff;border-radius:4px;padding:0 2px;box-shadow:0 0 10px rgba(232, 197, 90, 0.45)">$1</mark>');
                  node.parentNode.replaceChild(span, node);
                }
              }
            });
          }
        }
      });

      updateSearchCounter();
      jumpToActiveSearchMatch();
    }
  }

  function updateSearchCounter() {
    var countSpan = document.getElementById('chatSearchCount');
    if (countSpan) {
      var total = state.searchMatches.length;
      var current = total > 0 ? (state.searchActiveIndex + 1) : 0;
      countSpan.textContent = current + ' / ' + total;
    }
  }

  function jumpToActiveSearchMatch() {
    if (state.searchActiveIndex === -1 || state.searchMatches.length === 0) return;
    var msgId = state.searchMatches[state.searchActiveIndex];
    var row = document.querySelector('.chat-message-row[data-msg-id="' + msgId + '"]');
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('search-pulse-glow');
      setTimeout(function () {
        row.classList.remove('search-pulse-glow');
      }, 1500);
    }
  }

  // Incremental DOM Diffing and Reconciliation Renderer
  function diffMessagesDOM(msgs) {
    var existingArea = document.getElementById('chatMsgArea');
    if (!existingArea) return;

    var deletedIds = getDeletedMessageIds();
    var visibleMsgs = msgs.filter(function (m) {
      return !deletedIds.includes(m.id);
    });

    if (visibleMsgs.length === 0) {
      existingArea.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--mu);font-size:12px">' 
        + (window.LANG === 'ru' ? 'В этом секретном канале пока нет сообщений.' : 'No messages in this signal room yet.') 
        + '</div>';
      return;
    }

    var wasAtBottom = (existingArea.scrollHeight - existingArea.clientHeight - existingArea.scrollTop) < 60;

    // Index existing DOM elements
    var domRows = existingArea.querySelectorAll('.chat-message-row, .chat-system-message');
    var domMap = {};
    domRows.forEach(function (row) {
      var id = row.getAttribute('data-msg-id') || row.textContent.trim();
      domMap[id] = row;
    });

    // Reconcile list
    visibleMsgs.forEach(function (m) {
      var key = m.id;
      var existingRow = domMap[key];

      if (existingRow) {
        // 1. Reconcile reactions
        var rxContainer = existingRow.querySelector('.chat-msg-reactions');
        var newRxHtml = '';
        if (m.reactions && Object.keys(m.reactions).length > 0) {
          newRxHtml = Object.keys(m.reactions).map(function (emoji) {
            var reactionObj = m.reactions[emoji];
            var myId = window.ME ? window.ME.id : 'me';
            var userReacted = false;
            var count = 0;
            if (reactionObj) {
              if (Array.isArray(reactionObj.users)) {
                userReacted = reactionObj.users.includes(myId);
                count = reactionObj.users.length;
              } else {
                userReacted = !!reactionObj.userReacted;
                count = Number(reactionObj.count) || 0;
              }
            }
            if (count === 0) return '';
            var activeClass = userReacted ? ' active' : '';
            return '<span class="chat-msg-react-pill' + activeClass + '" data-msg-id="' + m.id + '" data-emoji="' + emoji + '">'
              + emoji + ' ' + count
              + '</span>';
          }).join('');
        }

        if (rxContainer) {
          if (rxContainer.innerHTML !== newRxHtml) {
            if (newRxHtml === '') {
              rxContainer.remove();
            } else {
              rxContainer.innerHTML = newRxHtml;
            }
          }
        } else if (newRxHtml !== '') {
          var reactionsDiv = document.createElement('div');
          reactionsDiv.className = 'chat-msg-reactions';
          reactionsDiv.innerHTML = newRxHtml;
          
          var wrapper = existingRow.querySelector('.chat-msg-content-wrapper');
          var timeDiv = existingRow.querySelector('.chat-msg-time');
          if (wrapper && timeDiv) {
            wrapper.insertBefore(reactionsDiv, timeDiv);
          }
        }

        // 2. Reconcile ticks and time
        var timeEl = existingRow.querySelector('.chat-msg-time');
        if (timeEl) {
          var isSent = m.sender_id === 'me' || (window.ME && m.sender_id === ME.id);
          var statusTicks = '';
          if (isSent) {
            if (m.id.startsWith('m_local_')) {
              statusTicks = '<span class="chat-msg-status-tick" style="margin-left:4px;font-size:9px;opacity:0.6">🕒</span>';
            } else if (m.read) {
              statusTicks = '<span class="chat-msg-status-tick read" style="color:var(--ac);margin-left:5px;font-weight:bold;font-size:11px">✓✓</span>';
            } else {
              statusTicks = '<span class="chat-msg-status-tick delivered" style="color:var(--mu2);margin-left:5px;font-size:11px">✓</span>';
            }
          }
          var newTimeText = _formatTime(m.created_at) + statusTicks;
          if (timeEl.innerHTML !== newTimeText) {
            timeEl.innerHTML = newTimeText;
          }
        }

        delete domMap[key];
      } else {
        // Message is new! Append it smoothly.
        var tempWrap = document.createElement('div');
        tempWrap.innerHTML = _renderMessagesList([m]);
        var newRow = tempWrap.firstElementChild;
        if (newRow) {
          existingArea.appendChild(newRow);
        }
      }
    });

    // Remove deleted messages smoothly
    Object.keys(domMap).forEach(function (deletedKey) {
      var row = domMap[deletedKey];
      if (row) {
        row.style.opacity = '0';
        row.style.transform = 'translateY(-10px) scale(0.95)';
        row.style.transition = 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
        setTimeout(function () {
          row.remove();
        }, 280);
      }
    });

    if (wasAtBottom) {
      existingArea.scrollTop = existingArea.scrollHeight;
    }
  }

  return {
    init:                     init,
    selectChannel:            selectChannel,
    sendMessage:              sendMessage,
    addReaction:              addReaction,
    showCreateChatModal:      showCreateChatModal,
    renderChatList:           renderChatList,
    renderActiveConversation: renderActiveConversation,
    updateUnreadBadge:        updateUnreadBadge,
    isUserOnline:             isUserOnline
  };
})();

window.ChatsEngine = ChatsEngine;
