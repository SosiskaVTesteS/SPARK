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

  function getAvatarGradient(idx) {
    return AVATAR_COLORS[Number(idx) || 0] || AVATAR_COLORS[0];
  }

  /* ────── Profile Edit Section HTML ────── */
  function renderEditSection(sfx) {
    var profile = window.PROFILE || {};
    var avatarIdx = Number(profile.avatar_color) || 0;
    var bio       = profile.bio || '';
    var username  = (profile.username || '').replace('@', '');

    var avatarDots = AVATAR_COLORS.map(function (grad, i) {
      return '<button type="button" class="avatar-dot' + (i === avatarIdx ? ' selected' : '') + '" '
        + 'data-av-idx="' + i + '" style="background:' + grad + '" aria-label="Avatar colour ' + i + '"></button>';
    }).join('');

    return ''
      + '<div class="pedit-section" id="peditSec-' + sfx + '">'
      + '<button type="button" class="pedit-toggle" id="peditToggle-' + sfx + '">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
      + (window.T ? T('editProfile') : 'Edit Profile')
      + '<svg class="pedit-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</button>'
      + '<div class="pedit-body" id="peditBody-' + sfx + '">'
      /* Avatar row */
      + '<div class="pedit-av-row">'
      + '<div class="pedit-av-preview" id="peditAvPrev-' + sfx + '" style="background:' + getAvatarGradient(avatarIdx) + '">' + (username.charAt(0).toUpperCase() || 'U') + '</div>'
      + '<div class="pedit-av-right"><div class="pedit-sublabel">' + (window.T ? T('avatarColor') : 'Avatar Colour') + '</div><div class="avatar-grid" id="peditAvGrid-' + sfx + '">' + avatarDots + '</div></div>'
      + '</div>'
      /* Username */
      + '<div class="pedit-field">'
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
    /* Toggle */
    var toggle = document.getElementById('peditToggle-' + sfx);
    var body   = document.getElementById('peditBody-' + sfx);
    if (toggle && body) {
      toggle.addEventListener('click', function () {
        var open = body.classList.contains('open');
        body.classList.toggle('open', !open);
        toggle.classList.toggle('open', !open);
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
        if (prev) prev.style.background = dot.style.background;
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
        if (v && v.length < 3)                       { _hint(nickHint, (window.T ? T('min3chars') : 'Minimum 3 characters'), 'err'); }
        else if (v && !/^[a-zA-Z0-9_]+$/.test(v))   { _hint(nickHint, (window.T ? T('onlyLettersNums') : 'Only letters, numbers, _'),  'err'); }
        else                                          { _hint(nickHint, '', ''); }
      });
    }

    /* Save */
    var saveBtn = document.getElementById('peditSave-' + sfx);
    if (saveBtn) {
      saveBtn.addEventListener('click', function () { saveProfile(sfx); });
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
    if (!newNick || newNick.length < 3)           { _status(status, 'Username must be 3+ characters', 'error'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(newNick))        { _status(status, 'Only letters, numbers and _',    'error'); return; }

    var selectedDot = sec ? sec.querySelector('.avatar-dot.selected') : null;
    var avatarColor = selectedDot ? parseInt(selectedDot.dataset.avIdx, 10) : (window.PROFILE && window.PROFILE.avatar_color || 0);

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
        _applyProfileLocally('@' + newNick, newBio, avatarColor);
        _status(status, lblSaved, 'success');
        return;
      }
      var res = await window.supa.from('profiles').update({
        username:     '@' + newNick,
        bio:          newBio,
        avatar_color: avatarColor
      }).eq('id', window.ME.id);

      if (res.error) {
        _status(status, '✗ ' + res.error.message, 'error');
      } else {
        _applyProfileLocally('@' + newNick, newBio, avatarColor);
        _status(status, lblProfUpdated, 'success');
        if (window.toast) window.toast(lblProfUpdated, 'var(--ac2)');
      }
    } catch (e) {
      _status(status, lblNetErr, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = lblSaveBtn; }
    }
  }

  function _applyProfileLocally(username, bio, avatarColor) {
    if (window.PROFILE) {
      window.PROFILE.username     = username;
      window.PROFILE.bio          = bio;
      window.PROFILE.avatar_color = avatarColor;
    }
    if (window.renderProfile) window.renderProfile();
    if (window.updateHeader)  window.updateHeader();
  }

  /* ────── Theme Studio HTML ────── */
  function renderThemeStudio() {
    if (!window.ThemeEngine) return '';
    var presets = ThemeEngine.PRESETS;
    var active  = ThemeEngine.getActive();

    var presetCards = Object.keys(presets).map(function (id) {
      var p = presets[id];
      var isActive = active && active.id === id;
      var locName = window.T ? T(id) : p.name;
      return '<button type="button" class="ts-preset-card' + (isActive ? ' active' : '') + '" data-ts-preset="' + id + '" style="--p-vl:' + p.vl + ';--p-ac:' + p.ac + '">'
        + '<span class="ts-preset-icon">' + p.icon + '</span>'
        + '<span class="ts-preset-name">' + locName + '</span>'
        + '</button>';
    }).join('');

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
      + '<div class="ts-preset-grid">' + presetCards + '</div>'
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
    var modal   = document.getElementById('themeStudioModal');
    var content = document.getElementById('tsContent');
    if (!modal || !content) return;

    /* Re-render content each time it opens (so preset active state is fresh) */
    content.innerHTML = renderThemeStudio();
    
    if (!content.dataset.wired) {
      _wireThemeStudio(modal, content);
      content.dataset.wired = "true";
    } else {
      /* Re-bind the palette reference since innerHTML was replaced */
      content._tsPalette = document.getElementById('tsPalette');
    }
  }

  function _wireThemeStudio(modal, content) {
    /* Close */
    content.addEventListener('click', function (e) {
      var closeBtn = e.target.closest('#tsClose');
      if (closeBtn || e.target === modal) { modal.classList.remove('open'); return; }
    });

    /* Preset cards */
    content.addEventListener('click', function (e) {
      var card = e.target.closest('[data-ts-preset]');
      if (!card) return;
      var id = card.dataset.tsPreset;
      if (window.ThemeEngine && ThemeEngine.PRESETS[id]) {
        var t = ThemeEngine.PRESETS[id];
        content.querySelectorAll('.ts-preset-card').forEach(function (c) {
          c.classList.toggle('active', c.dataset.tsPreset === id);
        });
        /* Sync pickers */
        content.querySelectorAll('.ts-color-input').forEach(function (input) {
          var k = input.dataset.tsVar;
          if (t[k]) input.value = t[k];
        });
      }
    });

    /* Apply and Reset via delegation */
    content.addEventListener('click', function (e) {
      var applyBtn = e.target.closest('#tsApply');
      if (applyBtn) {
        var overrides = {};
        content.querySelectorAll('.ts-color-input').forEach(function (input) {
          overrides[input.dataset.tsVar] = input.value;
        });
        if (window.ThemeEngine) ThemeEngine.applyCustom(overrides);
        modal.classList.remove('open');
        if (window.toast) window.toast(window.T ? T('themeApplied') : 'Theme applied ✓', 'var(--ac2)');
        return;
      }

      var resetBtn = e.target.closest('#tsReset');
      if (resetBtn) {
        if (window.ThemeEngine && ThemeEngine.PRESETS.cosmos) {
          var t = ThemeEngine.PRESETS.cosmos;
          content.querySelectorAll('.ts-preset-card').forEach(function (c) {
            c.classList.toggle('active', c.dataset.tsPreset === 'cosmos');
          });
          content.querySelectorAll('.ts-color-input').forEach(function (input) {
            var k = input.dataset.tsVar;
            if (t[k]) input.value = t[k];
          });
        }
        return;
      }
    });
  }

  /* ────── Open Theme Studio ────── */
  function openThemeStudio() {
    var modal   = document.getElementById('themeStudioModal');
    var content = document.getElementById('tsContent');
    if (!modal) return;
    if (content) {
      content.innerHTML = renderThemeStudio();
      if (!content.dataset.wired) {
        _wireThemeStudio(modal, content);
        content.dataset.wired = "true";
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
