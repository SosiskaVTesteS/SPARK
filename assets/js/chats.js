/**
 * SPARK — chats.js (Realtime Edition)
 */

'use strict';

window.CHATS_DATA = {};
window.CURRENT_ROOM_ID = null;
window.REALTIME_CHAT_CHANNEL = null;

function formatChatTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  var now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  } else {
    var diff = now - d;
    if (diff < 86400000 * 7) return Math.floor(diff / 86400000) + 'd';
    return d.toLocaleDateString();
  }
}

function getAvatarParams(uname) {
  var unameSafe = uname || '@user';
  var letter = unameSafe.replace('@', '').charAt(0).toUpperCase();
  var idxSeed = unameSafe.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  var gradients = [
    'linear-gradient(135deg,#e8c55a,#e87a5a)',
    'linear-gradient(135deg,#5ae8c5,#5a90e8)',
    'linear-gradient(135deg,#e85a7a,#c55ae8)',
    'linear-gradient(135deg,#cd7f32,#aa5a22)'
  ];
  return { letter, bg: gradients[idxSeed % gradients.length] };
}

const ChatPanelEngine = (() => {
  let panel, overlay, trigger;
  let isOpen = false;

  function open() {
    if (!window.ME) {
      if (window.showToast) window.showToast('You must sign in to use chats.', 'error');
      document.documentElement.classList.add('auth-active');
      return;
    }
    isOpen = true;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-visible');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    ChatManager.loadChats();
  }

  function close() {
    isOpen = false;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-visible');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    ScreenEngine.showList(false);
  }

  function init() {
    panel = document.getElementById('chatPanel');
    overlay = document.getElementById('panelOverlay');
    trigger = document.getElementById('chatsTrigger');
    if (!panel || !overlay || !trigger) return;
    trigger.addEventListener('click', () => isOpen ? close() : open());
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
  }

  return { init, open, close };
})();

const TabEngine = (() => {
  function init() {
    const tabs = document.querySelectorAll('.tabs__tab');
    const panels = document.querySelectorAll('.tab-panel');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        panels.forEach(p => {
          const isTarget = p.id === `tab${target.charAt(0).toUpperCase() + target.slice(1)}`;
          p.classList.toggle('is-active', isTarget);
          if (isTarget) p.removeAttribute('hidden');
          else p.setAttribute('hidden', '');
        });
      });
    });
  }
  return { init };
})();

const ScreenEngine = (() => {
  let screenList, screenRoom;
  function showRoom(chatId) {
    RoomEngine.load(chatId);
    screenList.classList.add('slide-out');
    screenRoom.classList.add('slide-in');
    screenRoom.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('backBtn')?.focus(), 300);
  }
  function showList(animate = true) {
    if (window.CURRENT_ROOM_ID) ChatManager.leaveRoom();
    if (!animate) {
      screenList.classList.remove('slide-out');
      screenRoom.classList.remove('slide-in');
      screenRoom.setAttribute('aria-hidden', 'true');
      return;
    }
    screenList.classList.remove('slide-out');
    screenRoom.classList.remove('slide-in');
    screenRoom.setAttribute('aria-hidden', 'true');
    const lastItem = document.querySelector('.chat-item[data-last-active]');
    if (lastItem) {
      lastItem.removeAttribute('data-last-active');
      setTimeout(() => lastItem.focus(), 300);
    }
    ChatManager.loadChats(); // reload list when going back
  }
  function init() {
    screenList = document.getElementById('screenList');
    screenRoom = document.getElementById('screenRoom');
    if (!screenList || !screenRoom) return;
    document.getElementById('backBtn')?.addEventListener('click', () => showList(true));
  }
  return { init, showRoom, showList };
})();

const RoomEngine = (() => {
  function makeAvatar(bg, label, isGroup = false) {
    const el = document.createElement('div');
    el.className = 'msg__avatar';
    el.style.background = bg;
    if (isGroup) {
      el.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    } else {
      el.textContent = label || 'U';
    }
    return el;
  }

  function buildMessage(msg, chat) {
    const isMe = String(msg.sender_id) === String(window.ME.id);
    const wrap = document.createElement('div');
    wrap.className = `msg ${isMe ? 'msg--me' : 'msg--them'}`;

    let avatarEl;
    if (isMe) {
      avatarEl = makeAvatar('#1a1a25', 'ME');
      avatarEl.classList.add('msg__avatar--me');
    } else {
      let uname = '@user';
      if (chat.type === 'direct' && chat.partner) uname = chat.partner.username;
      else if (msg.sender_username) uname = msg.sender_username; // From populated users map if group
      const p = getAvatarParams(uname);
      avatarEl = makeAvatar(p.bg, p.letter, false);
    }

    const bubble = document.createElement('div');
    bubble.className = `msg__bubble${isMe ? ' msg__bubble--me' : ''}`;
    const text = document.createElement('p');
    text.className = 'msg__text';
    text.textContent = msg.content;
    const meta = document.createElement('div');
    meta.className = 'msg__meta';
    const time = document.createElement('span');
    time.className = 'msg__time';
    time.textContent = formatChatTime(msg.created_at);
    meta.appendChild(time);
    
    bubble.appendChild(text);
    bubble.appendChild(meta);

    if (isMe) {
      wrap.appendChild(bubble);
      wrap.appendChild(avatarEl);
    } else {
      wrap.appendChild(avatarEl);
      wrap.appendChild(bubble);
    }
    return wrap;
  }

  function updateHeader(chat) {
    const avatar = document.getElementById('roomAvatar');
    const name = document.getElementById('roomName');
    const meta = document.getElementById('roomMeta');
    const status = document.getElementById('roomStatus');

    if (chat.type === 'group') {
      avatar.style.background = 'linear-gradient(145deg,#a78bfa 0%,#6d28d9 100%)';
      avatar.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
      avatar.style.borderRadius = '10px';
      status.className = 'room-header__status group';
      meta.textContent = 'Group Chat';
      name.textContent = chat.name || 'Group';
    } else {
      const uname = chat.partner ? chat.partner.username : '@user';
      const p = getAvatarParams(uname);
      avatar.style.background = p.bg;
      avatar.textContent = p.letter;
      avatar.style.borderRadius = '50%';
      status.className = 'room-header__status online'; // Assuming online for now
      meta.textContent = 'Partner';
      name.textContent = uname;
    }
  }

  function appendMessage(msg, chat, scrollToBottom = true) {
    const area = document.getElementById('messagesArea');
    area.appendChild(buildMessage(msg, chat));
    if (scrollToBottom) {
      requestAnimationFrame(() => area.scrollTop = area.scrollHeight);
    }
  }

  async function load(chatId) {
    window.CURRENT_ROOM_ID = chatId;
    const chat = window.CHATS_DATA[chatId] || { type: 'direct', partner: { username: 'Loading...' } };
    updateHeader(chat);
    
    const area = document.getElementById('messagesArea');
    area.innerHTML = '<div style="text-align:center;color:var(--mu);padding:20px;font-size:13px">Loading messages...</div>';

    try {
      const { data, error } = await window.supa
        .from('chat_messages')
        .select('*')
        .eq('room_id', chatId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      area.innerHTML = '';
      data.forEach(m => appendMessage(m, chat, false));
      requestAnimationFrame(() => area.scrollTop = area.scrollHeight);

      // Mark as read
      await window.supa.rpc('mark_chat_read', { p_room_id: chatId });
      
      // Clear unread in DOM if present
      const item = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
      if (item) {
        const badge = item.querySelector('.chat-item__badge');
        if (badge) badge.remove();
      }

      ChatManager.subscribeRoom(chatId, chat);

    } catch (e) {
      console.error('Error loading room', e);
      area.innerHTML = '<div style="color:#e85a5a;padding:20px;text-align:center">Failed to load.</div>';
    }

    setTimeout(() => document.getElementById('msgInput')?.focus(), 320);
  }

  async function sendMessage(text) {
    if (!window.CURRENT_ROOM_ID || !text.trim() || !window.ME) return;
    const msg = {
      room_id: window.CURRENT_ROOM_ID,
      sender_id: window.ME.id,
      content: text.trim()
    };
    // Optimistic insert could go here, but let's just wait for DB/Realtime
    try {
      const { error } = await window.supa.from('chat_messages').insert([msg]);
      if (error) throw error;
    } catch (e) {
      console.error('Error sending message', e);
      if (window.showToast) window.showToast('Failed to send message', 'error');
    }
  }

  return { load, sendMessage, appendMessage };
})();

const ChatManager = (() => {
  async function loadChats() {
    if (!window.ME) return;
    try {
      const { data, error } = await window.supa.rpc('get_user_chats');
      if (error) throw error;
      
      const directList = document.getElementById('tabDirect').querySelector('.chat-list');
      const groupList = document.getElementById('tabGroup').querySelector('.chat-list');
      directList.innerHTML = ''; groupList.innerHTML = '';

      if (!data || data.length === 0) {
        directList.innerHTML = '<div style="padding:24px;text-align:center;color:var(--mu);font-size:13px">No chats yet. Find someone in the feed to start a conversation!</div>';
        return;
      }

      let totalUnread = 0;

      data.forEach(chat => {
        window.CHATS_DATA[chat.id] = chat;
        totalUnread += chat.unread_count || 0;
        
        let uname = chat.name || 'Chat';
        let isGroup = chat.type === 'group';
        let p = { bg: 'linear-gradient(145deg,#a78bfa 0%,#6d28d9 100%)', letter: 'G' };
        
        if (!isGroup && chat.partner) {
          uname = chat.partner.username;
          p = getAvatarParams(uname);
        }

        const lastMsg = chat.last_message ? chat.last_message.text : 'New chat started';
        const lastTime = chat.last_message ? formatChatTime(chat.last_message.created_at) : '';
        const badge = chat.unread_count > 0 ? `<span class="chat-item__badge">${chat.unread_count}</span>` : '';

        const html = `
          <li class="chat-item" data-chat-id="${chat.id}" role="button" tabindex="0">
            <div class="chat-item__avatar-wrap">
              <div class="chat-item__avatar ${isGroup ? 'chat-item__avatar--group' : ''}" style="background:${p.bg}">${isGroup ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' : p.letter}</div>
            </div>
            <div class="chat-item__body">
              <div class="chat-item__top"><span class="chat-item__name">${uname}</span><span class="chat-item__time">${lastTime}</span></div>
              <div class="chat-item__bottom"><span class="chat-item__preview">${lastMsg}</span>${badge}</div>
            </div>
          </li>
        `;
        if (isGroup) groupList.insertAdjacentHTML('beforeend', html);
        else directList.insertAdjacentHTML('beforeend', html);
      });

      // Update global dot
      const dot = document.getElementById('unreadDot');
      if (dot) dot.style.display = totalUnread > 0 ? 'block' : 'none';

      document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
          item.setAttribute('data-last-active', '');
          ScreenEngine.showRoom(item.dataset.chatId);
        });
      });

    } catch (e) {
      console.error('Failed to load chats', e);
    }
  }

  function subscribeRoom(chatId, chat) {
    if (window.REALTIME_CHAT_CHANNEL) {
      window.supa.removeChannel(window.REALTIME_CHAT_CHANNEL);
    }
    window.REALTIME_CHAT_CHANNEL = window.supa.channel('chat_room_' + chatId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${chatId}` }, payload => {
        RoomEngine.appendMessage(payload.new, chat);
        if (payload.new.sender_id !== window.ME.id) {
          window.supa.rpc('mark_chat_read', { p_room_id: chatId });
        }
      })
      .subscribe();
  }

  function leaveRoom() {
    window.CURRENT_ROOM_ID = null;
    if (window.REALTIME_CHAT_CHANNEL) {
      window.supa.removeChannel(window.REALTIME_CHAT_CHANNEL);
      window.REALTIME_CHAT_CHANNEL = null;
    }
  }

  return { loadChats, subscribeRoom, leaveRoom };
})();

const InputEngine = (() => {
  let input, placeholder, sendBtn;
  function updateState() {
    const hasText = input.value.length > 0;
    placeholder.classList.toggle('is-hidden', hasText);
    sendBtn.classList.toggle('is-active', hasText);
    sendBtn.disabled = !hasText;
    input.style.height = 'auto';
    const maxH = parseInt(getComputedStyle(input).lineHeight, 10) * 4;
    input.style.height = Math.min(input.scrollHeight, maxH) + 'px';
  }
  function sendCurrent() {
    const text = input.value;
    if (!text.trim()) return;
    RoomEngine.sendMessage(text);
    input.value = '';
    input.style.height = '';
    updateState();
    input.focus();
  }
  function init() {
    input = document.getElementById('msgInput');
    placeholder = document.getElementById('inputPlaceholder');
    sendBtn = document.getElementById('sendBtn');
    if (!input || !placeholder || !sendBtn) return;
    input.addEventListener('input', updateState);
    input.addEventListener('focus', updateState);
    input.addEventListener('blur', updateState);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
    });
    sendBtn.addEventListener('click', sendCurrent);
  }
  return { init };
})();

// Global helpers to start chats
window.startDirectChat = async function(targetUserId) {
  if (!window.ME) {
    if (window.showToast) window.showToast('Please sign in to chat', 'error');
    return;
  }
  if (targetUserId === window.ME.id) return;
  ChatPanelEngine.open();
  const directList = document.getElementById('tabDirect').querySelector('.chat-list');
  directList.innerHTML = '<div style="padding:24px;text-align:center;color:var(--mu);">Creating room...</div>';
  try {
    const { data: roomId, error } = await window.supa.rpc('create_direct_chat', { target_user_id: targetUserId });
    if (error) throw error;
    await ChatManager.loadChats();
    ScreenEngine.showRoom(roomId);
  } catch (e) {
    console.error('Failed to create direct chat', e);
    if (window.showToast) window.showToast('Failed to start chat', 'error');
  }
};

function initChats() {
  ChatPanelEngine.init();
  TabEngine.init();
  ScreenEngine.init();
  InputEngine.init();
  
  // Listen for realtime unread notifications globally
  setTimeout(() => {
    if (window.ME && window.supa) {
      window.supa.channel('global_chats')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
          if (payload.new.sender_id !== window.ME.id && payload.new.room_id !== window.CURRENT_ROOM_ID) {
            const dot = document.getElementById('unreadDot');
            if (dot) dot.style.display = 'block';
          }
        })
        .subscribe();
    }
  }, 2000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChats);
} else {
  initChats();
}
