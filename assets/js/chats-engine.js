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
    realtimeChannel: null
  };

  // Preloaded Contacts (DMs)
  var CONTACTS = [
    { id: '@maria_builds', name: 'Maria Kovaleva', username: '@maria_builds', online: true, avColor: 4, preview: 'Let\'s discuss the solar leasing idea 🔥' },
    { id: '@alex_ventures', name: 'Alex Harrison', username: '@alex_ventures', online: true, avColor: 0, preview: 'Hey, what do you think about the SPK pool?' },
    { id: '@cody_prophet', name: 'Cody Fisher', username: '@cody_prophet', online: false, avColor: 6, preview: 'Send the market signals document when ready.' },
    { id: '@elizabeth_trade', name: 'Elizabeth Webb', username: '@elizabeth_trade', online: true, avColor: 9, preview: 'I see, okay noted. Talk to you tomorrow!' }
  ];

  // Preloaded Teams/Groups
  var TEAMS = [
    { id: 'defi-prophets', name: 'DeFi Prophets', activeCount: 8, avColor: 1, preview: 'Kirill: Volatility threshold exceeded 🚨' },
    { id: 'ai-signals', name: 'AI Signal Room', activeCount: 14, avColor: 8, preview: 'Elena: Model predictive weight is 98.4%' },
    { id: 'spark-devs', name: 'Spark Core Devs', activeCount: 5, avColor: 2, preview: 'System: Cinematic loading intro merged' }
  ];

  // Preset Rich Media Attachments (Photo 1 UI inspiration)
  var ATTACHMENTS = [
    {
      id: 'defianalytics',
      title: 'DeFi Analytics Dashboard',
      sub: 'Interactive analytics graph, SPK/USD momentum',
      url: 'https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=600&auto=format&fit=crop&q=80'
    },
    {
      id: 'aipredictive',
      title: 'AI Predictive Weights',
      sub: 'TensorFlow modeling signals overlay network',
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
    },
    {
      id: 'solarperformance',
      title: 'Solar Grid Statistics',
      sub: 'Decentralized energy tokens throughput metric',
      url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&auto=format&fit=crop&q=80'
    },
    {
      id: 'sparkcore',
      title: 'SPARK Glassmorphic Core',
      sub: 'Premium interface aesthetics node design',
      url: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&auto=format&fit=crop&q=80'
    }
  ];

  // Initial Seed Message Thread database (for both DMs and Topics)
  var INITIAL_MESSAGES = {
    '@alex_ventures': [
      { id: 'm1', sender_id: 'alex', sender_name: '@alex_ventures', sender_avatar_color: 0, content: 'Hey there! How has the SPARK alpha testing been going on your end?', created_at: Date.now() - 3600000 * 3 },
      { id: 'm2', sender_id: 'me', sender_name: 'You', sender_avatar_color: 3, content: 'It is amazing! The Canvas loading screens are 60 FPS and the Theme Studio transitions are butter smooth.', created_at: Date.now() - 3600000 * 2.8 },
      { id: 'm3', sender_id: 'alex', sender_name: '@alex_ventures', sender_avatar_color: 0, content: 'Hey, what do you think about the SPK pool? Do you think the volatility is high enough for margin critique?', created_at: Date.now() - 3600000 * 0.1 }
    ],
    '@maria_builds': [
      { id: 'm4', sender_id: 'maria', sender_name: '@maria_builds', sender_avatar_color: 4, content: 'Hi spark developer! I have been reviewing our CleanEnergy microgrid investment thesis.', created_at: Date.now() - 3600000 * 5 },
      { id: 'm5', sender_id: 'maria', sender_name: '@maria_builds', sender_avatar_color: 4, content: 'Let\'s discuss the solar leasing idea 🔥. I think we can tokenise the solar output seamlessly using smart contracts.', created_at: Date.now() - 3600000 * 4.9 }
    ],
    'defi-prophets': [
      { id: 'm6', sender_id: 'system', sender_name: 'SYSTEM', sender_avatar_color: 11, content: 'DeFi Prophets group established.', created_at: Date.now() - 3600000 * 48 },
      { id: 'm7', sender_id: 'cody', sender_name: '@cody_prophet', sender_avatar_color: 6, content: 'Yield farming rates are stabilizing on the arbitrum nodes.', created_at: Date.now() - 3600000 * 12 },
      { id: 'm8', sender_id: 'alex', sender_name: '@alex_ventures', sender_avatar_color: 0, content: 'Agreed, pool depth is growing rapidly.', created_at: Date.now() - 3600000 * 4 },
      { id: 'm9', sender_id: 'kirill', sender_name: '@kirill_vc', sender_avatar_color: 8, content: 'Kirill: Volatility threshold exceeded 🚨. Prepare critique hedges.', created_at: Date.now() - 3600000 * 0.5 }
    ]
  };

  // Local Storage Cache Key
  var CACHE_KEY = 'spark_chats_v1';

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
    // Set fallback if empty
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

  // Render Left Chats/Teams List
  function renderChatList() {
    var query = state.searchQuery.toLowerCase().trim();
    
    // 1. Filter Contacts (DMs)
    var filteredContacts = CONTACTS.filter(function (c) {
      return c.name.toLowerCase().includes(query) || c.username.toLowerCase().includes(query);
    });

    // 2. Filter Teams
    var filteredTeams = TEAMS.filter(function (t) {
      return t.name.toLowerCase().includes(query);
    });

    // Render DMs List
    var dmsListEl = document.getElementById('chatListDMs');
    if (dmsListEl) {
      if (filteredContacts.length === 0) {
        dmsListEl.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--mu);font-size:11px">No direct messages</div>';
      } else {
        dmsListEl.innerHTML = filteredContacts.map(function (c) {
          var msgs = getCachedMessages()[c.id] || [];
          var lastMsg = msgs[msgs.length - 1];
          var preview = lastMsg ? (lastMsg.media_url ? '📷 [Media attachment]' : lastMsg.content) : c.preview;
          var timeText = lastMsg ? _formatTime(lastMsg.created_at) : '10m';
          
          var isActive = state.activeChannelId === c.id ? ' active' : '';
          var statusClass = c.online ? '' : ' offline';
          var grad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(c.avColor) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
          
          return ''
            + '<div class="chat-row-item' + isActive + '" data-chat-id="' + c.id + '">'
            + '<div class="chat-avatar-circle" style="background:' + grad + '">' + c.username.replace('@', '').charAt(0).toUpperCase() + '</div>'
            + '<div class="chat-status-dot' + statusClass + '"></div>'
            + '<div class="chat-item-info">'
            + '<div class="chat-item-name-row"><span class="chat-item-name">' + c.name + '</span><span class="chat-item-time">' + timeText + '</span></div>'
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
        teamsListEl.innerHTML = '<div style="text-align:center;padding:16px 0;color:var(--mu);font-size:11px">No channels found</div>';
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

    // Wire up clicks on list items
    document.querySelectorAll('.chat-row-item[data-chat-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.dataset.chatId;
        selectChannel(id);
      });
    });
  }

  // Render Active Conversation Viewport
  function renderActiveConversation() {
    var rightPane = document.getElementById('chatActivePane');
    if (!rightPane) return;

    var id = state.activeChannelId;
    if (!id) {
      // Empty placeholder
      rightPane.innerHTML = ''
        + '<div class="chat-empty-state">'
        + '<div class="chat-empty-icon">🛰️</div>'
        + '<div class="chat-empty-title">' + (window.T ? T('marketObservatory') : 'Market Intelligence Chats') + '</div>'
        + '<div class="chat-empty-text">Select a secure channel or direct contact to synchronize market signals and share intelligence notes.</div>'
        + '</div>';
      return;
    }

    // Identify current target details
    var contact = CONTACTS.find(function (c) { return c.id === id; });
    var team    = TEAMS.find(function (t) { return t.id === id; });
    var titleName = contact ? contact.name : (team ? team.name : id);
    var statusText = contact ? (contact.online ? 'Active now' : 'Offline') : (team ? (team.activeCount + ' members online') : 'Connected');
    var isOffline = contact && !contact.online;
    
    var avIndex = contact ? contact.avColor : (team ? team.avColor : 0);
    var avText = contact ? contact.username.replace('@', '').charAt(0).toUpperCase() : (team ? team.name.charAt(0) + team.name.charAt(1) : '?');
    var avGrad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avIndex) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
    var avBorderRadius = team ? '10px' : '50%';

    var msgs = getCachedMessages()[id] || [];

    // Map attachments icons/grid in composer bar
    var attachOptions = ATTACHMENTS.map(function (att) {
      var isSelected = state.composedAttachment && state.composedAttachment.id === att.id ? ' selected' : '';
      return '<button class="chat-attach-btn' + isSelected + '" data-att-id="' + att.id + '">'
        + '📷 ' + att.title.split(' ')[0]
        + '</button>';
    }).join('');

    // Active conversation pane frame markup
    rightPane.innerHTML = ''
      /* Header */
      + '<div class="chat-main-header">'
      + '  <div class="chat-header-left">'
      + '    <button class="chat-back-btn-mob" id="chatBackBtnMob">'
      + '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>'
      + '    </button>'
      + '    <div class="chat-avatar-circle" style="background:' + avGrad + ';border-radius:' + avBorderRadius + '">' + avText + '</div>'
      + '    <div class="chat-header-info">'
      + '      <div class="chat-header-name">' + _esc(titleName) + '</div>'
      + '      <div class="chat-header-status' + (isOffline ? ' offline' : '') + '">'
      + '        <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>'
      + '        <span>' + statusText + '</span>'
      + '      </div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="chat-header-actions">'
      + '    <button class="chat-header-icon-btn" title="Call signal (voice)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>'
      + '    <button class="chat-header-icon-btn" title="Pin signal"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></button>'
      + '  </div>'
      + '</div>'
      /* Messages list scroll */
      + '<div class="chat-messages-area" id="chatMsgArea">'
      +   _renderMessagesList(msgs)
      + '</div>'
      /* Bottom composed attachment preview */
      + '<div class="chat-main-input-container">'
      + '  <div class="chat-composed-attachment-preview" id="chatComposePreview">'
      + '    <span>📎 Attached: <b id="chatComposePreviewName"></b></span>'
      + '    <button class="chat-cancel-attach-btn" id="chatCancelComposeBtn">✕</button>'
      + '  </div>'
      /* Attachment presets row */
      + '  <div class="chat-attachment-options-row">'
      +      attachOptions
      + '  </div>'
      /* Input prompt */
      + '  <div class="chat-input-row">'
      + '    <input type="text" class="chat-text-input" id="chatTextInput" placeholder="Type your trading intelligence message..." autocomplete="off">'
      + '    <button class="chat-send-btn" id="chatSendBtn" title="Send message">'
      + '      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
      + '    </button>'
      + '  </div>'
      + '</div>';

    // Scroll to bottom immediately
    var area = document.getElementById('chatMsgArea');
    if (area) { area.scrollTop = area.scrollHeight; }

    // Wire up events
    _wireActiveView();
  }

  // Formulate html list of message speech bubbles
  function _renderMessagesList(msgs) {
    if (msgs.length === 0) {
      return '<div style="text-align:center;padding:48px 0;color:var(--mu);font-size:12px">No messages in this signal room yet.</div>';
    }

    return msgs.map(function (m) {
      if (m.sender_id === 'system') {
        return '<div class="chat-system-message">' + _esc(m.content) + '</div>';
      }

      var isSent = m.sender_id === 'me';
      var rowClass = isSent ? ' sent' : '';
      var avText = isSent ? (window.PROFILE && PROFILE.username || '@user').replace('@', '').charAt(0).toUpperCase() : m.sender_name.replace('@', '').charAt(0).toUpperCase();
      var avColor = isSent ? (window.PROFILE && PROFILE.avatar_color || 0) : m.sender_avatar_color;
      var avGrad = ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avColor) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
      
      // Render media attachment inside bubble if exists
      var mediaCard = '';
      if (m.media_url) {
        var cardTitle = m.content || 'Media Node';
        mediaCard = ''
          + '<div class="chat-media-attachment-card">'
          + '  <img src="' + m.media_url + '" class="chat-media-img" alt="Attachment" loading="lazy">'
          + '  <div class="chat-media-meta">'
          + '    <div class="chat-media-title">' + _esc(cardTitle) + '</div>'
          + '    <div class="chat-media-sub">Spark Intelligence Attachment</div>'
          + '  </div>'
          + '</div>';
      }

      // Render reaction emojis
      var reactionsHtml = '';
      if (m.reactions && Object.keys(m.reactions).length > 0) {
        reactionsHtml = '<div class="chat-msg-reactions">'
          + Object.keys(m.reactions).map(function (emoji) {
            var activeClass = m.reactions[emoji].userReacted ? ' active' : '';
            return '<span class="chat-msg-react-pill' + activeClass + '" data-msg-id="' + m.id + '" data-emoji="' + emoji + '">'
              + emoji + ' ' + m.reactions[emoji].count
              + '</span>';
          }).join('')
          + '</div>';
      }

      // Message options popup on bubble hover (Photo 1 design match)
      var hoverMenu = ''
        + '<div class="chat-bubble-context">'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="🔥">🔥</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="💎">💎</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="🚀">🚀</button>'
        + '  <button class="chat-context-react-btn" data-msg-id="' + m.id + '" data-emoji="🗿">🗿</button>'
        + '</div>';

      return ''
        + '<div class="chat-message-row' + rowClass + '" data-msg-id="' + m.id + '">'
        + '  <div class="chat-msg-avatar" style="background:' + avGrad + '">' + avText + '</div>'
        + '  <div class="chat-msg-content-wrapper">'
        + '    <div class="chat-msg-sender-name">' + _esc(m.sender_name) + '</div>'
        + '    <div class="chat-msg-bubble">'
        +        hoverMenu
        +        (m.media_url ? '' : _esc(m.content))
        +        mediaCard
        + '    </div>'
        +      reactionsHtml
        + '    <div class="chat-msg-time">' + _formatTime(m.created_at) + '</div>'
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
      });
    }

    // 2. Attachment presets option clicks
    document.querySelectorAll('.chat-attach-btn[data-att-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var attId = btn.dataset.attId;
        var att = ATTACHMENTS.find(function (a) { return a.id === attId; });
        if (!att) return;
        
        if (state.composedAttachment && state.composedAttachment.id === att.id) {
          // Toggle off
          state.composedAttachment = null;
        } else {
          // Select
          state.composedAttachment = att;
        }
        _updateComposeAttachmentUI();
      });
    });

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
        var msgId = btn.dataset.msgId;
        var emoji = btn.dataset.emoji;
        addReaction(msgId, emoji);
      });
    });

    // 6. Pill reactions click
    document.querySelectorAll('.chat-msg-react-pill[data-msg-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var msgId = btn.dataset.msgId;
        var emoji = btn.dataset.emoji;
        addReaction(msgId, emoji);
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

    // On mobile, slide in the conversation overlay
    if (window.innerWidth <= 768) {
      var pane = document.getElementById('chatActivePane');
      if (pane) pane.classList.add('open-active');
    }
  }

  // Send a message (saves locally + Supabase fallback)
  async function sendMessage(content, mediaUrl, mediaTitle) {
    var channel = state.activeChannelId;
    if (!channel) return;

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
      try {
        var dbMsg = {
          channel_id:          channel,
          sender_id:           ME.id,
          sender_name:         senderName,
          sender_avatar_color: senderColor,
          content:             newMsg.content,
          media_url:           newMsg.media_url
        };
        var res = await window.supa.from('messages').insert(dbMsg);
        if (res.error) {
          console.warn('Supabase message insert error:', res.error);
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

    if (msg.reactions[emoji]) {
      if (msg.reactions[emoji].userReacted) {
        // Remove reaction
        msg.reactions[emoji].count = Math.max(0, msg.reactions[emoji].count - 1);
        msg.reactions[emoji].userReacted = false;
        if (msg.reactions[emoji].count === 0) delete msg.reactions[emoji];
      } else {
        // Increment
        msg.reactions[emoji].count += 1;
        msg.reactions[emoji].userReacted = true;
      }
    } else {
      // First reaction of this type
      msg.reactions[emoji] = { count: 1, userReacted: true };
    }

    // Write back and refresh
    cacheMessages(msgs);
    renderActiveConversation();
  }

  // Initialize Chats Engine
  function init() {
    // Read query from search input if any
    var searchEl = document.getElementById('chatSearchInput');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        state.searchQuery = searchEl.value;
        renderChatList();
      });
    }

    // Initial render
    renderChatList();
    renderActiveConversation();

    // Realtime Database replication hooks
    if (window.supa && window.ME) {
      try {
        state.realtimeChannel = supa.channel('realtime:public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (payload) {
            var newRow = payload.new;
            if (!newRow) return;

            // Avoid duplicating messages sent by oneself
            if (newRow.sender_id === ME.id) return;

            var msgs = getCachedMessages();
            if (!msgs[newRow.channel_id]) msgs[newRow.channel_id] = [];
            
            // Check duplicates
            var dup = msgs[newRow.channel_id].some(function (m) { return m.content === newRow.content && Math.abs(new Date(m.created_at).getTime() - new Date(newRow.created_at).getTime()) < 5000; });
            if (dup) return;

            msgs[newRow.channel_id].push({
              id:                  newRow.id,
              sender_id:           newRow.sender_id,
              sender_name:         newRow.sender_name,
              sender_avatar_color: newRow.sender_avatar_color,
              content:             newRow.content,
              media_url:           newRow.media_url,
              created_at:          new Date(newRow.created_at).getTime(),
              reactions:           {}
            });

            cacheMessages(msgs);
            
            // Trigger haptic dot or list indicator
            var chatDot = document.getElementById('mChatDot');
            if (chatDot) chatDot.style.display = 'block';

            if (state.activeChannelId === newRow.channel_id) {
              renderActiveConversation();
            } else {
              renderChatList();
            }
          })
          .subscribe();
      } catch (e) {
        console.warn('Realtime chat subscription failed:', e);
      }
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

  function _esc(s) {
    if (typeof escapeHTML === 'function') return escapeHTML(s);
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    init:                     init,
    selectChannel:            selectChannel,
    sendMessage:              sendMessage,
    addReaction:              addReaction,
    renderChatList:           renderChatList,
    renderActiveConversation: renderActiveConversation
  };
})();

window.ChatsEngine = ChatsEngine;
