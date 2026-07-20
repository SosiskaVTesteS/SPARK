/* ═══════════════════════════════════════════════════════
   SPARK — profile-edit.js   ProfileEditEngine v1
   Profile editing form: nickname, bio, avatar colour
   Theme Studio: preset grid + custom colour pickers
   ═══════════════════════════════════════════════════════ */
'use strict';

var ProfileEditEngine = (function () {

  /* 12 avatar gradient definitions (index 0-11) */
  var AVATAR_COLORS = [
    'linear-gradient(135deg,#7B5CFA,#E85AA0)',  // 0 cosmos
    'linear-gradient(135deg,#3B82F6,#22D3EE)',  // 1 ocean
    'linear-gradient(135deg,#F97316,#FBBF24)',  // 2 ember
    'linear-gradient(135deg,#22C55E,#34D399)',  // 3 forest
    'linear-gradient(135deg,#F43F5E,#FB923C)',  // 4 rose
    'linear-gradient(135deg,#06B6D4,#A5F3FC)',  // 5 arctic
    'linear-gradient(135deg,#8B5CF6,#C4B5FD)',  // 6 void
    'linear-gradient(135deg,#D97706,#FCD34D)',  // 7 gold
    'linear-gradient(135deg,#EC4899,#F43F5E)',  // 8 fuchsia
    'linear-gradient(135deg,#10B981,#6EE7B7)',  // 9 emerald
    'linear-gradient(135deg,#6366F1,#A5B4FC)',  // 10 indigo
    'linear-gradient(135deg,#475569,#94A3B8)'   // 11 slate
  ];

  /* 8 space-themed emoji avatars */
  var AVATAR_EMOJIS = ['🚀', '👨‍🚀', '👽', '🛸', '🛰️', '🪐', '✨', '👾'];

  /* Track if global event delegation is set up */
  var globalDelegationSetup = false;

  function getAvatarGradient(idx) {
    return AVATAR_COLORS[Number(idx) || 0] || AVATAR_COLORS[0];
  }

  /* ────── Profile Edit Modal ────── */
  function openProfileEditModal() {
    // Create modal if it doesn't exist
    var modal = document.getElementById('profileEditModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'profileEditModal';
      modal.className = 'profile-edit-modal';
      document.body.appendChild(modal);
    }

    // Render modal content
    modal.innerHTML = renderProfileEditModalContent();

    // Show modal
    modal.classList.add('open');

    // Initialize event handlers
    initProfileEditModalHandlers();
  }

  function closeProfileEditModal() {
    var modal = document.getElementById('profileEditModal');
    if (modal) {
      modal.classList.remove('open');
    }
  }

  function renderProfileEditModalContent() {
    var profile = window.PROFILE || {};
    var avatarIdx = Number(profile.avatar_color) || 0;
    var bio       = profile.bio || '';
    var username  = (profile.username || '').replace('@', '');
    var avatarEmoji = profile.avatar_emoji || '';
    var avatarPhoto = profile.avatar_photo || '';

    // Determine current avatar display
    var currentAvatarDisplay = '';
    if (avatarPhoto) {
      currentAvatarDisplay = '<img src="' + avatarPhoto + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else if (avatarEmoji) {
      currentAvatarDisplay = avatarEmoji;
    } else {
      currentAvatarDisplay = username.charAt(0).toUpperCase() || 'U';
    }

    var avatarDots = AVATAR_COLORS.map(function (grad, i) {
      return '<button type="button" class="avatar-dot' + (i === avatarIdx ? ' selected' : '') + '" '
        + 'data-av-idx="' + i + '" style="background:' + grad + '" aria-label="Avatar colour ' + i + '"></button>';
    }).join('');

    var emojiOptions = AVATAR_EMOJIS.map(function (emoji, i) {
      return '<button type="button" class="avatar-emoji' + (avatarEmoji === emoji ? ' selected' : '') + '" '
        + 'data-emoji="' + emoji + '">' + emoji + '</button>';
    }).join('');

    return ''
      + '<div class="profile-edit-modal-backdrop"></div>'
      + '<div class="profile-edit-modal-content">'
      + '<button type="button" class="profile-edit-modal-close" id="profileEditModalClose">✕</button>'
      + '<div class="profile-edit-modal-header">' + (window.T ? T('editProfile') : 'Edit Profile') + '</div>'
      /* Current Avatar Preview */
      + '<div class="pedit-current-avatar">'
      + '<div class="pedit-avatar-large" id="peditAvatarLarge-modal" style="background:' + getAvatarGradient(avatarIdx) + '">' + currentAvatarDisplay + '</div>'
      + '</div>'
      /* Change Avatar Section */
      + '<div class="pedit-sublabel">' + (window.T ? T('changeAvatar') : 'Change Avatar') + '</div>'
      + '<div class="avatar-emoji-grid" id="peditEmojiGrid-modal">' + emojiOptions + '</div>'
      + '<button type="button" class="pedit-upload-btn" id="peditUpload-modal">' + (window.T ? T('uploadOwn') : 'Upload your own') + '</button>'
      + '<input type="file" id="peditFileInput-modal" accept="image/*" style="display:none">'
      /* Avatar Color Section */
      + '<div class="pedit-sublabel" style="margin-top:20px">' + (window.T ? T('avatarColor') : 'Avatar Colour') + '</div>'
      + '<div class="pedit-color-row">'
      + '<div class="pedit-av-preview-small" id="peditAvPrev-modal" style="background:' + getAvatarGradient(avatarIdx) + '">' + (username.charAt(0).toUpperCase() || 'U') + '</div>'
      + '<div class="avatar-grid" id="peditAvGrid-modal">' + avatarDots + '</div>'
      + '</div>'
      /* Username */
      + '<div class="pedit-field" style="margin-top:20px">'
      + '<label>Username <span class="pedit-sublabel">' + (window.T ? T('usernameLetters') : '(letters, numbers, _)') + '</span></label>'
      + '<div class="pedit-input-wrap"><span class="pedit-at">@</span>'
      + '<input type="text" class="pedit-input" id="peditNick-modal" value="' + _esc(username) + '" maxlength="29" placeholder="your_name" autocomplete="off" spellcheck="false">'
      + '</div>'
      + '<div class="pedit-hint" id="peditNickHint-modal"></div>'
      + '</div>'
      /* Bio */
      + '<div class="pedit-field">'
      + '<label>' + (window.T ? T('bioLabel') : 'Bio') + ' <span class="pedit-char-count" id="peditBioCount-modal">' + bio.length + '/160</span></label>'
      + '<textarea class="pedit-input pedit-bio" id="peditBio-modal" maxlength="160" rows="3" placeholder="' + (window.T ? T('bioPlaceholder') : 'A short bio about you…') + '">' + _esc(bio) + '</textarea>'
      + '</div>'
      /* Save */
      + '<button type="button" class="pedit-save-btn" id="peditSave-modal">' + (window.T ? T('saveChanges') : 'Save Changes') + '</button>'
      + '<div class="pedit-status" id="peditStatus-modal"></div>'
      + '</div>';
  }

  function initProfileEditModalHandlers() {
    // Close button
    var closeBtn = document.getElementById('profileEditModalClose');
    if (closeBtn) {
      closeBtn.onclick = function () { closeProfileEditModal(); };
    }

    // Backdrop click
    var backdrop = document.querySelector('.profile-edit-modal-backdrop');
    if (backdrop) {
      backdrop.onclick = function () { closeProfileEditModal(); };
    }

    // Emoji selection
    var emojiGrid = document.getElementById('peditEmojiGrid-modal');
    if (emojiGrid) {
      emojiGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('.avatar-emoji');
        if (!btn) return;
        var selectedEmoji = btn.dataset.emoji;
        emojiGrid.querySelectorAll('.avatar-emoji').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        updateAvatarPreview('modal', selectedEmoji, null, null);
      });
    }

    // Photo upload
    var uploadBtn = document.getElementById('peditUpload-modal');
    var fileInput = document.getElementById('peditFileInput-modal');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          updateAvatarPreview('modal', null, e.target.result, null);
          if (emojiGrid) {
            emojiGrid.querySelectorAll('.avatar-emoji').forEach(function (b) { b.classList.remove('selected'); });
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Avatar dots
    var grid = document.getElementById('peditAvGrid-modal');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var dot = e.target.closest('.avatar-dot');
        if (!dot) return;
        grid.querySelectorAll('.avatar-dot').forEach(function (d) { d.classList.remove('selected'); });
        dot.classList.add('selected');
        var prev = document.getElementById('peditAvPrev-modal');
        var large = document.getElementById('peditAvatarLarge-modal');
        if (prev) prev.style.background = dot.style.background;
        if (large) large.style.background = dot.style.background;
      });
    }

    // Bio char counter
    var bioEl    = document.getElementById('peditBio-modal');
    var bioCount = document.getElementById('peditBioCount-modal');
    if (bioEl && bioCount) {
      bioEl.addEventListener('input', function () {
        bioCount.textContent = bioEl.value.length + '/160';
      });
    }

    // Nick hint
    var nickEl   = document.getElementById('peditNick-modal');
    var nickHint = document.getElementById('peditNickHint-modal');
    if (nickEl && nickHint) {
      nickEl.addEventListener('input', function () {
        var v = nickEl.value;
        if (v && v.length < 3)                       { _hint(nickHint, (window.T ? T('min3chars') : 'Minimum 3 characters'), 'err'); }
        else if (v && !/^[a-zA-Z0-9_-]+$/.test(v))  { _hint(nickHint, (window.T ? T('onlyLettersNums') : 'Only letters, numbers, _ and -'),  'err'); }
        else                                          { _hint(nickHint, '', ''); }
      });
    }

    // Save
    var saveBtn = document.getElementById('peditSave-modal');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () { saveProfileModal(); });
    }
  }

  async function saveProfileModal() {
    var saveBtn  = document.getElementById('peditSave-modal');
    var status   = document.getElementById('peditStatus-modal');
    var nickEl   = document.getElementById('peditNick-modal');
    var bioEl    = document.getElementById('peditBio-modal');
    var modal    = document.getElementById('profileEditModal');
    if (!nickEl || !bioEl) return;

    var newNick = nickEl.value.trim();
    var newBio  = bioEl.value.trim();

    /* Validate */
    if (!newNick || newNick.length < 3)           { _status(status, 'Username must be 3+ characters', 'error'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(newNick))       { _status(status, (window.T ? T('onlyLettersNums') : 'Only letters, numbers, _ and -'), 'error'); return; }

    var selectedDot = modal ? modal.querySelector('.avatar-dot.selected') : null;
    var avatarColor = selectedDot ? parseInt(selectedDot.dataset.avIdx, 10) : (window.PROFILE && window.PROFILE.avatar_color || 0);

    var selectedEmoji = modal ? modal.querySelector('.avatar-emoji.selected') : null;
    var avatarEmoji = selectedEmoji ? selectedEmoji.dataset.emoji : '';

    var largeAvatar = document.getElementById('peditAvatarLarge-modal');
    var avatarPhoto = '';
    if (largeAvatar) {
      var img = largeAvatar.querySelector('img');
      if (img) avatarPhoto = img.src;
    }

    console.log('[ProfileEdit] Saving profile with:', {
      username: '@' + newNick,
      bio: newBio,
      avatarColor: avatarColor,
      avatarEmoji: avatarEmoji,
      avatarPhoto: avatarPhoto ? 'present' : 'none'
    });

    var lblSaving = window.T ? T('saving') : 'Saving…';
    var lblSaved = window.T ? T('saved') : '✓ Saved';
    var lblSaveBtn = window.T ? T('saveChanges') : 'Save Changes';
    var lblNetErr = window.T ? T('networkError') : '✗ Network error. Try again.';
    var lblProfUpdated = window.T ? T('profileUpdated') : '✓ Profile updated!';

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = lblSaving; }
    _status(status, '', '');

    try {
      if (!window.supa || !window.ME) {
        _applyProfileLocally('@' + newNick, newBio, avatarColor, avatarEmoji, avatarPhoto);
        _status(status, lblSaved, 'success');
        closeProfileEditModal();
        return;
      }
      var updateData = {
        username:     '@' + newNick,
        bio:          newBio,
        avatar_color: avatarColor,
        avatar_emoji: avatarEmoji
      };
      if (avatarPhoto) {
        updateData.avatar_photo = avatarPhoto;
      }
      console.log('[ProfileEdit] Sending to Supabase:', updateData);
      var res = await window.supa.from('profiles').update(updateData).eq('id', window.ME.id);
      console.log('[ProfileEdit] Supabase response:', res);

      if (res.error) {
        console.error('[ProfileEdit] Supabase error:', res.error);
        _status(status, '✗ ' + res.error.message, 'error');
      } else {
        console.log('[ProfileEdit] Save successful, applying locally');
        _applyProfileLocally('@' + newNick, newBio, avatarColor, avatarEmoji, avatarPhoto);
        _status(status, lblProfUpdated, 'success');
        if (window.toast) window.toast(lblProfUpdated, 'var(--ac2)');
        closeProfileEditModal();
      }
    } catch (e) {
      _status(status, lblNetErr, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lblSaveBtn; }
    }
  }

  /* ────── Profile Edit Section HTML ────── */
  function renderEditSection(sfx) {
    var profile = window.PROFILE || {};
    var avatarIdx = Number(profile.avatar_color) || 0;
    var bio       = profile.bio || '';
    var username  = (profile.username || '').replace('@', '');
    var avatarEmoji = profile.avatar_emoji || '';
    var avatarPhoto = profile.avatar_photo || '';

    // Determine current avatar display
    var currentAvatarDisplay = '';
    if (avatarPhoto) {
      currentAvatarDisplay = '<img src="' + avatarPhoto + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else if (avatarEmoji) {
      currentAvatarDisplay = avatarEmoji;
    } else {
      currentAvatarDisplay = username.charAt(0).toUpperCase() || 'U';
    }

    var avatarDots = AVATAR_COLORS.map(function (grad, i) {
      return '<button type="button" class="avatar-dot' + (i === avatarIdx ? ' selected' : '') + '" '
        + 'data-av-idx="' + i + '" style="background:' + grad + '" aria-label="Avatar colour ' + i + '"></button>';
    }).join('');

    var emojiOptions = AVATAR_EMOJIS.map(function (emoji, i) {
      return '<button type="button" class="avatar-emoji' + (avatarEmoji === emoji ? ' selected' : '') + '" '
        + 'data-emoji="' + emoji + '">' + emoji + '</button>';
    }).join('');

    return ''
      + '<div class="pedit-section" id="peditSec-' + sfx + '">'
      + '<button type="button" class="pedit-toggle" id="peditToggle-' + sfx + '">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + (window.T ? T('editProfile') : 'Edit Profile')
      + '<svg class="pedit-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</button>'
      + '<div class="pedit-body" id="peditBody-' + sfx + '">'
      /* Current Avatar Preview */
      + '<div class="pedit-current-avatar">'
      + '<div class="pedit-avatar-large" id="peditAvatarLarge-' + sfx + '" style="background:' + getAvatarGradient(avatarIdx) + '">' + currentAvatarDisplay + '</div>'
      + '</div>'
      /* Change Avatar Section */
      + '<div class="pedit-sublabel">' + (window.T ? T('changeAvatar') : 'Change Avatar') + '</div>'
      + '<div class="avatar-emoji-grid" id="peditEmojiGrid-' + sfx + '">' + emojiOptions + '</div>'
      + '<button type="button" class="pedit-upload-btn" id="peditUpload-' + sfx + '">' + (window.T ? T('uploadOwn') : 'Upload your own') + '</button>'
      + '<input type="file" id="peditFileInput-' + sfx + '" accept="image/*" style="display:none">'
      /* Avatar Color Section */
      + '<div class="pedit-sublabel" style="margin-top:20px">' + (window.T ? T('avatarColor') : 'Avatar Colour') + '</div>'
      + '<div class="pedit-color-row">'
      + '<div class="pedit-av-preview-small" id="peditAvPrev-' + sfx + '" style="background:' + getAvatarGradient(avatarIdx) + '">' + (username.charAt(0).toUpperCase() || 'U') + '</div>'
      + '<div class="avatar-grid" id="peditAvGrid-' + sfx + '">' + avatarDots + '</div>'
      + '</div>'
      /* Username */
      + '<div class="pedit-field" style="margin-top:20px">'
      + '<label>Username <span class="pedit-sublabel">' + (window.T ? T('usernameLetters') : '(letters, numbers, _)') + '</span></label>'
      + '<div class="pedit-input-wrap"><span class="pedit-at">@</span>'
      + '<input type="text" class="pedit-input" id="peditNick-' + sfx + '" value="' + _esc(username) + '" maxlength="29" placeholder="your_name" autocomplete="off" spellcheck="false">'
      + '</div>'
      + '<div class="pedit-hint" id="peditNickHint-' + sfx + '"></div>'
      + '</div>'
      /* Bio */
      + '<div class="pedit-field">'
      + '<label>' + (window.T ? T('bioLabel') : 'Bio') + ' <span class="pedit-char-count" id="peditBioCount-' + sfx + '">' + bio.length + '/160</span></label>'
      + '<textarea class="pedit-input pedit-bio" id="peditBio-' + sfx + '" maxlength="160" rows="3" placeholder="' + (window.T ? T('bioPlaceholder') : 'A short bio about you…') + '">' + _esc(bio) + '</textarea>'
      + '</div>'
      /* Save */
      + '<button type="button" class="pedit-save-btn" id="peditSave-' + sfx + '">' + (window.T ? T('saveChanges') : 'Save Changes') + '</button>'
      + '<div class="pedit-status" id="peditStatus-' + sfx + '"></div>'
      + '</div>'
      + '</div>';
  }

  /* ────── Wire up a rendered edit section ────── */
  function initSection(sfx) {
    console.log('[ProfileEdit] initSection called with sfx:', sfx);
    
    /* Set up global event delegation once */
    if (!globalDelegationSetup) {
      console.log('[ProfileEdit] Setting up global event delegation');
      document.addEventListener('click', function (e) {
        var toggle = e.target.closest('.pedit-toggle');
        if (!toggle) return;
        console.log('[ProfileEdit] Toggle clicked via delegation! Event:', e);
        e.preventDefault();
        e.stopPropagation();
        
        var sfxMatch = toggle.id.match(/peditToggle-(.+)/);
        if (!sfxMatch) return;
        var currentSfx = sfxMatch[1];
        
        // Open profile edit modal instead of inline section
        openProfileEditModal();
        
        var body = document.getElementById('peditBody-' + currentSfx);
        console.log('[ProfileEdit] Found body:', body);
        if (body) {
          var open = body.classList.contains('open');
          console.log('[ProfileEdit] Current open state:', open);
          body.classList.toggle('open', !open);
          toggle.classList.toggle('open', !open);
          console.log('[ProfileEdit] Body classes after toggle:', body.className);
          console.log('[ProfileEdit] Toggle state changed. open:', !open);
          
          // Log computed styles for debugging
          var computed = getComputedStyle(body);
          console.log('[ProfileEdit] Computed styles:');
          console.log('  max-height:', computed.maxHeight);
          console.log('  height:', computed.height);
          console.log('  display:', computed.display);
          console.log('  overflow:', computed.overflow);
          console.log('  opacity:', computed.opacity);
          console.log('  visibility:', computed.visibility);
          console.log('  innerHTML length:', body.innerHTML.length);
          
          // Log bounding rect and dimensions
          console.log('[ProfileEdit] BoundingRect:', JSON.stringify(body.getBoundingClientRect()));
          console.log('[ProfileEdit] offsetWidth:', body.offsetWidth, 'offsetHeight:', body.offsetHeight);
          
          // Check parent containers for overflow issues
          var parent = body.parentElement;
          var depth = 0;
          console.log('[ProfileEdit] Parent containers:');
          while (parent && depth < 5) {
            var parentStyle = getComputedStyle(parent);
            console.log('  Parent ' + depth + ' (' + (parent.className || parent.tagName) + '):', 
              'overflow:', parentStyle.overflow, 
              'height:', parentStyle.height, 
              'max-height:', parentStyle.maxHeight,
              'display:', parentStyle.display);
            parent = parent.parentElement;
            depth++;
          }
        } else {
          console.error('[ProfileEdit] Body element not found for sfx:', currentSfx);
        }
      });
      globalDelegationSetup = true;
      console.log('[ProfileEdit] Global event delegation set up');
    }

    /* Emoji selection */
    var emojiGrid = document.getElementById('peditEmojiGrid-' + sfx);
    if (emojiGrid) {
      emojiGrid.addEventListener('click', function (e) {
        var btn = e.target.closest('.avatar-emoji');
        if (!btn) return;
        var selectedEmoji = btn.dataset.emoji;
        emojiGrid.querySelectorAll('.avatar-emoji').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        updateAvatarPreview(sfx, selectedEmoji, null, null);
      });
    }

    /* Photo upload */
    var uploadBtn = document.getElementById('peditUpload-' + sfx);
    var fileInput = document.getElementById('peditFileInput-' + sfx);
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          updateAvatarPreview(sfx, null, e.target.result, null);
          // Clear emoji selection when photo is uploaded
          if (emojiGrid) {
            emojiGrid.querySelectorAll('.avatar-emoji').forEach(function (b) { b.classList.remove('selected'); });
          }
        };
        reader.readAsDataURL(file);
      });
    }

    /* Avatar dots */
    var grid = document.getElementById('peditAvGrid-' + sfx);
    if (grid) {
      grid.addEventListener('click', function (e) {
        var dot = e.target.closest('.avatar-dot');
        if (!dot) return;
        grid.querySelectorAll('.avatar-dot').forEach(function (d) { d.classList.remove('selected'); });
        dot.classList.add('selected');
        var prev = document.getElementById('peditAvPrev-' + sfx);
        var large = document.getElementById('peditAvatarLarge-' + sfx);
        if (prev) prev.style.background = dot.style.background;
        if (large) large.style.background = dot.style.background;
      });
    }

    /* Bio char counter */
    var bioEl    = document.getElementById('peditBio-'      + sfx);
    var bioCount = document.getElementById('peditBioCount-' + sfx);
    if (bioEl && bioCount) {
      bioEl.addEventListener('input', function () {
        bioCount.textContent = bioEl.value.length + '/160';
      });
    }

    /* Nick hint */
    var nickEl   = document.getElementById('peditNick-'     + sfx);
    var nickHint = document.getElementById('peditNickHint-' + sfx);
    if (nickEl && nickHint) {
      nickEl.addEventListener('input', function () {
        var v = nickEl.value;
        /* БАГ #5: дефис разрешён — как при регистрации (единый паттерн) */
        if (v && v.length < 3)                       { _hint(nickHint, (window.T ? T('min3chars') : 'Minimum 3 characters'), 'err'); }
        else if (v && !/^[a-zA-Z0-9_-]+$/.test(v))  { _hint(nickHint, (window.T ? T('onlyLettersNums') : 'Only letters, numbers, _ and -'),  'err'); }
        else                                          { _hint(nickHint, '', ''); }
      });
    }

    /* Save */
    var saveBtn = document.getElementById('peditSave-' + sfx);
    if (saveBtn) {
      saveBtn.addEventListener('click', function () { saveProfile(sfx); });
    }
  }

  /* Update avatar preview */
  function updateAvatarPreview(sfx, emoji, photo, colorIdx) {
    var large = document.getElementById('peditAvatarLarge-' + sfx);
    var small = document.getElementById('peditAvPrev-' + sfx);
    if (!large) return;

    var profile = window.PROFILE || {};
    var username = (profile.username || '').replace('@', '');
    var currentColorIdx = colorIdx !== null ? colorIdx : (profile.avatar_color || 0);
    var gradient = getAvatarGradient(currentColorIdx);

    if (photo) {
      large.innerHTML = '<img src="' + photo + '" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      large.style.background = gradient;
    } else if (emoji) {
      large.innerHTML = emoji;
      large.style.background = gradient;
    } else {
      large.innerHTML = username.charAt(0).toUpperCase() || 'U';
      large.style.background = gradient;
    }

    if (small) {
      small.style.background = gradient;
      small.innerHTML = username.charAt(0).toUpperCase() || 'U';
    }
  }

  /* ────── Save to Supabase ────── */
  async function saveProfile(sfx) {
    var saveBtn  = document.getElementById('peditSave-'   + sfx);
    var status   = document.getElementById('peditStatus-' + sfx);
    var nickEl   = document.getElementById('peditNick-'   + sfx);
    var bioEl    = document.getElementById('peditBio-'    + sfx);
    var sec      = document.getElementById('peditSec-'    + sfx);
    if (!nickEl || !bioEl) return;

    var newNick = nickEl.value.trim();
    var newBio  = bioEl.value.trim();

    /* Validate */
    /* БАГ #5: дефис разрешён — как при регистрации (единый паттерн) */
    if (!newNick || newNick.length < 3)           { _status(status, 'Username must be 3+ characters', 'error'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(newNick))       { _status(status, (window.T ? T('onlyLettersNums') : 'Only letters, numbers, _ and -'), 'error'); return; }

    var selectedDot = sec ? sec.querySelector('.avatar-dot.selected') : null;
    var avatarColor = selectedDot ? parseInt(selectedDot.dataset.avIdx, 10) : (window.PROFILE && window.PROFILE.avatar_color || 0);

    var selectedEmoji = sec ? sec.querySelector('.avatar-emoji.selected') : null;
    var avatarEmoji = selectedEmoji ? selectedEmoji.dataset.emoji : '';

    var largeAvatar = document.getElementById('peditAvatarLarge-' + sfx);
    var avatarPhoto = '';
    if (largeAvatar) {
      var img = largeAvatar.querySelector('img');
      if (img) avatarPhoto = img.src;
    }

    var lblSaving = window.T ? T('saving') : 'Saving…';
    var lblSaved = window.T ? T('saved') : '✓ Saved';
    var lblSaveBtn = window.T ? T('saveChanges') : 'Save Changes';
    var lblNetErr = window.T ? T('networkError') : '✗ Network error. Try again.';
    var lblProfUpdated = window.T ? T('profileUpdated') : '✓ Profile updated!';

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = lblSaving; }
    _status(status, '', '');

    try {
      if (!window.supa || !window.ME) {
        /* Offline fallback */
        _applyProfileLocally('@' + newNick, newBio, avatarColor, avatarEmoji, avatarPhoto);
        _status(status, lblSaved, 'success');
        return;
      }
      var updateData = {
        username:     '@' + newNick,
        bio:          newBio,
        avatar_color: avatarColor,
        avatar_emoji: avatarEmoji
      };
      if (avatarPhoto) {
        updateData.avatar_photo = avatarPhoto;
      }
      var res = await window.supa.from('profiles').update(updateData).eq('id', window.ME.id);

      if (res.error) {
        _status(status, '✗ ' + res.error.message, 'error');
      } else {
        _applyProfileLocally('@' + newNick, newBio, avatarColor, avatarEmoji, avatarPhoto);
        _status(status, lblProfUpdated, 'success');
        if (window.toast) window.toast(lblProfUpdated, 'var(--ac2)');
      }
    } catch (e) {
      _status(status, lblNetErr, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lblSaveBtn; }
    }
  }

  function _applyProfileLocally(username, bio, avatarColor, avatarEmoji, avatarPhoto) {
    if (window.PROFILE) {
      window.PROFILE.username     = username;
      window.PROFILE.bio          = bio;
      window.PROFILE.avatar_color = avatarColor;
      window.PROFILE.avatar_emoji = avatarEmoji || '';
      window.PROFILE.avatar_photo = avatarPhoto || '';
    }
    if (window.renderProfile) window.renderProfile();
    if (window.updateHeader)  window.updateHeader();
  }

  /* ────── Theme Studio HTML ────── */
  function renderThemeStudio() {
    if (!window.ThemeEngine) return '';
    var presets = ThemeEngine.PRESETS;
    var active  = ThemeEngine.getActive();

    var keys = Object.keys(presets);
    var page1Keys = keys.slice(0, 8);
    var page2Keys = keys.slice(8, 16);
    
    var isPage2Active = active && page2Keys.includes(active.id);
    var initialTransform = isPage2Active ? 'style="transform:translateX(-50%)"' : '';
    
    function renderPageCards(keysList) {
      return keysList.map(function (id) {
        var p = presets[id];
        var isActive = active && active.id === id;
        var locName = window.T ? T(id) : p.name;
        return '<button type="button" class="ts-preset-card' + (isActive ? ' active' : '') + '" data-ts-preset="' + id + '" style="--p-vl:' + p.vl + ';--p-ac:' + p.ac + '">'
          + '<span class="ts-preset-icon">' + p.icon + '</span>'
          + '<span class="ts-preset-name">' + locName + '</span>'
          + '</button>';
      }).join('');
    }

    var page1Html = renderPageCards(page1Keys);
    var page2Html = renderPageCards(page2Keys);

    var carouselHtml = ''
      + '<div class="ts-preset-carousel">'
      + '  <div class="ts-preset-track" id="tsPresetTrack" ' + initialTransform + '>'
      + '    <div class="ts-preset-page">'
      + '      <div class="ts-preset-grid">' + page1Html + '</div>'
      + '    </div>'
      + '    <div class="ts-preset-page">'
      + '      <div class="ts-preset-grid">' + page2Html + '</div>'
      + '    </div>'
      + '  </div>'
      + '  <div class="ts-preset-pagination">'
      + '    <span class="ts-dot' + (!isPage2Active ? ' active' : '') + '" data-page="0"></span>'
      + '    <span class="ts-dot' + (isPage2Active ? ' active' : '') + '" data-page="1"></span>'
      + '  </div>'
      + '</div>';

    var pickerRows = [
      { label: window.T ? T('tsPrimary') : 'Primary / Buttons',   key: 'vl',    tip: window.T ? T('tsPrimaryTip') : 'Invest button, active tabs, links' },
      { label: window.T ? T('tsAccent') : 'SPK / Gold Accent',   key: 'ac',    tip: window.T ? T('tsAccentTip') : 'Balance display, number highlights' },
      { label: window.T ? T('tsSecondary') : 'Cyan / Secondary',    key: 'ac2',   tip: window.T ? T('tsSecondaryTip') : 'Verified badge, countdown, success' },
      { label: window.T ? T('tsGraph') : 'Graph Line',          key: 'graph', tip: window.T ? T('tsGraphTip') : 'Investment chart line' },
      { label: window.T ? T('tsMuted') : 'Muted Text',         key: 'mu2',   tip: window.T ? T('tsMutedTip') : 'Secondary labels, timestamps' }
    ].map(function (row) {
      var val = (active && active[row.key]) || '#888888';
      return '<div class="ts-picker-row">'
        + '<div class="ts-picker-info"><div class="ts-picker-label">' + row.label + '</div><div class="ts-picker-tip">' + row.tip + '</div></div>'
        + '<div class="ts-picker-right">'
        + '<input type="color" class="ts-color-input" data-ts-var="' + row.key + '" id="tsPicker-' + row.key + '" value="' + val + '">'
        + '</div>'
        + '</div>';
    }).join('');

    return '<div class="ts-header"><div class="ts-title">' + (window.T ? T('themeStudioTitle') : '🎨 Theme Studio') + '</div><button class="ts-close" id="tsClose">✕</button></div>'
      + '<div class="stitle" style="margin:16px 0 10px">' + (window.T ? T('presets') : 'Presets') + '</div>'
      + carouselHtml
      + '<div class="divider" style="margin:18px 0"></div>'
      + '<div class="stitle" style="margin-bottom:12px">' + (window.T ? T('customColors') : 'Custom Colours') + '</div>'
      + '<div class="ts-pickers">' + pickerRows + '</div>'
      + '<div class="ts-footer">'
      + '<button type="button" class="ts-reset-btn" id="tsReset">' + (window.T ? T('resetDefault') : '↺ Reset Default') + '</button>'
      + '<button type="button" class="hbtn hbtn-gold" id="tsApply">' + (window.T ? T('applyTheme') : 'Apply →') + '</button>'
      + '</div>';
  }

  /* ────── Wire Theme Studio modal ────── */
  function initThemeStudio() {
    openThemeStudio();
  }

  function _wireThemeStudio(modal, content) {
    // Keep as a fallback no-op, since wiring is now done directly on open
  }

  /* ────── Open Theme Studio ────── */
  function openThemeStudio() {
    var modal   = document.getElementById('themeStudioModal');
    var content = document.getElementById('tsContent');
    if (!modal) return;
    if (content) {
      content.innerHTML = renderThemeStudio();

      // Prevent click propagation inside the modal container so clicks don't hit the backdrop close handler
      content.onclick = function (e) {
        if (e) e.stopPropagation();
      };

      // 0. Carousel Pagination dots click listeners
      var track = content.querySelector('#tsPresetTrack');
      var dots  = content.querySelectorAll('.ts-dot');
      if (track && dots.length > 0) {
        dots.forEach(function (dot) {
          dot.onclick = function (e) {
            if (e) e.stopPropagation();
            var page = parseInt(dot.dataset.page, 10);
            dots.forEach(function (d) { d.classList.toggle('active', d === dot); });
            track.style.transform = 'translateX(-' + (page * 50) + '%)';
          };
        });
      }
      
      // 1. Close button
      var closeBtn = content.querySelector('#tsClose');
      if (closeBtn) {
        closeBtn.onclick = function(e) {
          if (e) e.stopPropagation();
          modal.classList.remove('open');
        };
      }
      
      // Backdrop click closes the modal (only when clicking the grey backdrop itself)
      modal.onclick = function(e) {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      };
      
      // 2. Preset cards
      var presetCards = content.querySelectorAll('[data-ts-preset]');
      presetCards.forEach(function(card) {
        card.onclick = function(e) {
          if (e) e.stopPropagation();
          var id = card.dataset.tsPreset;
          if (window.ThemeEngine && ThemeEngine.PRESETS[id]) {
            var t = ThemeEngine.PRESETS[id];
            content.dataset.selectedPreset = id;
            content.querySelectorAll('.ts-preset-card').forEach(function (c) {
              c.classList.toggle('active', c.dataset.tsPreset === id);
            });
            /* Sync pickers */
            content.querySelectorAll('.ts-color-input').forEach(function (input) {
              var k = input.dataset.tsVar;
              if (t[k]) input.value = t[k];
            });
          }
        };
      });
      
      // 3. Color pickers inputs
      var pickers = content.querySelectorAll('.ts-color-input');
      pickers.forEach(function(input) {
        input.onclick = function(e) {
          if (e) e.stopPropagation();
        };
        input.oninput = function() {
          content.removeAttribute('data-selected-preset');
          content.querySelectorAll('.ts-preset-card').forEach(function (c) {
            c.classList.remove('active');
          });
        };
      });
      
      // 4. Reset button
      var resetBtn = content.querySelector('#tsReset');
      if (resetBtn) {
        resetBtn.onclick = function(e) {
          if (e) e.stopPropagation();
          if (window.ThemeEngine && ThemeEngine.PRESETS.cosmos) {
            var t = ThemeEngine.PRESETS.cosmos;
            content.dataset.selectedPreset = 'cosmos';
            content.querySelectorAll('.ts-preset-card').forEach(function (c) {
              c.classList.toggle('active', c.dataset.tsPreset === 'cosmos');
            });
            content.querySelectorAll('.ts-color-input').forEach(function (input) {
              var k = input.dataset.tsVar;
              if (t[k]) input.value = t[k];
            });
          }
        };
      }
      
      // 5. Apply button
      var applyBtn = content.querySelector('#tsApply');
      if (applyBtn) {
        applyBtn.onclick = function(e) {
          if (e) e.stopPropagation();
          var presetId = content.dataset.selectedPreset;
          var base = (presetId && window.ThemeEngine && ThemeEngine.PRESETS[presetId]) 
                      ? ThemeEngine.PRESETS[presetId] 
                      : (window.ThemeEngine ? ThemeEngine.getActive() : {});
          var merged = Object.assign({}, base);
          
          content.querySelectorAll('.ts-color-input').forEach(function (input) {
            merged[input.dataset.tsVar] = input.value;
          });

          if (window.ThemeEngine) {
            if (!presetId) delete merged.id;
            ThemeEngine.apply(merged);
            ThemeEngine.save(merged);
          }
          // Persist preset choice to DB for cross-device sync (web ↔ Android)
          if (window.supa && window.ME) {
            supa.from('profiles')
              .update({ theme_preset_id: presetId || null })
              .eq('id', ME.id)
              .then(function () {});
          }
          modal.classList.remove('open');
          if (window.toast) window.toast(window.T ? T('themeApplied') : 'Theme applied ✓', 'var(--ac2)');
        };
      }
    }
    modal.classList.add('open');
  }

  /* ────── Helpers ────── */
  function _esc(s) {
    if (typeof escapeHTML === 'function') return escapeHTML(s);
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _hint(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'err' ? 'var(--red)' : 'var(--mu2)';
  }
  function _status(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'error' ? 'var(--red)' : type === 'success' ? 'var(--ac2)' : 'var(--mu2)';
  }

  return {
    AVATAR_COLORS:     AVATAR_COLORS,
    getAvatarGradient: getAvatarGradient,
    renderEditSection: renderEditSection,
    initSection:       initSection,
    saveProfile:       saveProfile,
    renderThemeStudio: renderThemeStudio,
    initThemeStudio:   initThemeStudio,
    openThemeStudio:   openThemeStudio
  };
})();

window.ProfileEditEngine = ProfileEditEngine;
window.showThemeStudio   = ProfileEditEngine.openThemeStudio;
