// ════ ADMIN 2FA STATE ════
// Admin identity is determined server-side by querying profiles.is_admin.
// The 2FA secret lives only in the verify_admin_secret() Supabase RPC — never here.
// To grant admin access: UPDATE profiles SET is_admin = true WHERE id = '<uuid>';
var _pendingAdminSignIn = null; // holds { email, password } while 2FA modal is open
var _activePanel = 'feed';

document.addEventListener('DOMContentLoaded', function () {
  // Capture ?auto= param so profile.html / leaderboard.html redirects survive
  // the auth flow (enterApp() reads this after login).
  try {
    var _autoPanel = new URLSearchParams(window.location.search).get('auto');
    if (_autoPanel) {
      sessionStorage.setItem('spark_auto_panel', _autoPanel);
      window.history.replaceState(null, '', window.location.pathname);
    }
  } catch (e) {}

  // Event delegation: clicks on elements with data-open-mo open the named modal.
  // Used as a robust fallback for dynamically-rendered settings items.
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open-mo]');
    if (trigger) {
      e.stopPropagation();
      openMo(trigger.dataset.openMo);
    }
  });

  // supportMailLink: native href="mailto:..." handled by inline onclick="closeMo('moSupport')"

  document.querySelectorAll('[data-auth-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchAuth(btn.dataset.authTab);
    });
  });
  var btnSI = document.getElementById('btnSI');
  if (btnSI) btnSI.addEventListener('click', doSignIn);
  var btnSU = document.getElementById('btnSU');
  if (btnSU) btnSU.addEventListener('click', doSignUp);
  var btnSUVerify = document.getElementById('btnSUVerify');
  if (btnSUVerify) btnSUVerify.addEventListener('click', doVerifyRegistration);
  var btnSUResend = document.getElementById('btnSUResend');
  if (btnSUResend) btnSUResend.addEventListener('click', resendRegistrationCode);
  var btnSUBack = document.getElementById('btnSUBack');
  if (btnSUBack) btnSUBack.addEventListener('click', backToRegistrationForm);
  var vmConfirmBtn = document.getElementById('vmConfirmBtn');
  if (vmConfirmBtn) vmConfirmBtn.addEventListener('click', checkEmailVerified);
  var vmResendBtn = document.getElementById('vmResendBtn');
  if (vmResendBtn) vmResendBtn.addEventListener('click', resendVerification);
  var btnProfDesk = document.getElementById('btnProfDesk');
  if (btnProfDesk) btnProfDesk.addEventListener('click', toggleDeskProf);
  var btnPostIdea = document.getElementById('btnPostIdea');
  if (btnPostIdea) btnPostIdea.addEventListener('click', openCreate);
  var dpOverlay = document.getElementById('dpOverlay');
  if (dpOverlay) dpOverlay.addEventListener('click', bgCloseDesk);
  // moCreate: outside-click close disabled to prevent losing typed content
  var moInvest = document.getElementById('moInvest');
  if (moInvest) {
    moInvest.addEventListener('click', function (event) {
      if (event.target === moInvest) closeMo('moInvest');
    });
  }
  var moContactAuthor = document.getElementById('moContactAuthor');
  if (moContactAuthor) {
    moContactAuthor.addEventListener('click', function (event) {
      if (event.target === moContactAuthor) closeMo('moContactAuthor');
    });
  }
  var caCancel = document.getElementById('caCancel');
  if (caCancel) caCancel.addEventListener('click', function () { closeMo('moContactAuthor'); });
  var caConfirm = document.getElementById('caConfirm');
  if (caConfirm) caConfirm.addEventListener('click', doUnlockContact);
  var diCancel = document.getElementById('diCancel');
  if (diCancel) diCancel.addEventListener('click', function () { closeMo('moDeleteIdea'); });
  var diConfirm = document.getElementById('diConfirm');
  if (diConfirm) diConfirm.addEventListener('click', doAuthorDeleteConfirm);
  var riCancel = document.getElementById('riCancel');
  if (riCancel) riCancel.addEventListener('click', function () { closeMo('moRestoreIdea'); });
  attachHold('riConfirm', 2000, doAuthorRestoreConfirm);
  var reportConfirmModal = document.getElementById('reportConfirmModal');
  if (reportConfirmModal) {
    reportConfirmModal.addEventListener('click', function (event) {
      if (event.target === reportConfirmModal) { _cancelPendingReport(); }
    });
  }
  var rcmCancel = document.getElementById('rcmCancel');
  if (rcmCancel) rcmCancel.addEventListener('click', _cancelPendingReport);
  var rcmConfirm = document.getElementById('rcmConfirm');
  if (rcmConfirm) rcmConfirm.addEventListener('click', _doSubmitReport);
  document.querySelectorAll('.mob-tab[data-panel]').forEach(function (tabBtn) {
    tabBtn.addEventListener('click', function () {
      openPanel(tabBtn.dataset.panel);
    });
  });

  // Side navigation tabs - visual switching only
  document.querySelectorAll('.nav-tab[data-nav]').forEach(function (navBtn) {
    navBtn.addEventListener('click', function () {
      document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.remove('active'); });
      navBtn.classList.add('active');
    });
  });
  document.querySelectorAll('.chat-tab-btn[data-chat-tab]').forEach(function (chatBtn) {
    chatBtn.addEventListener('click', function () {
      switchChatTab(chatBtn.dataset.chatTab);
    });
  });
  document.querySelectorAll('[data-sort]').forEach(function (b) {
    b.addEventListener('click', function () {
      triggerVibration(10);
      document.querySelectorAll('[data-sort]').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      sort = b.dataset.sort;
      page = 1;
      renderFeed();
    });
  });

  document.querySelectorAll('[data-tag]').forEach(function (c) {
    c.addEventListener('click', function () {
      triggerVibration(10);
      document.querySelectorAll('[data-tag]').forEach(function (x) { x.classList.remove('active'); });
      c.classList.add('active');
      ftag = c.dataset.tag;
      page = 1;
      renderFeed();
    });
  });

  var srchEl = document.getElementById('srchIn');
  if (srchEl) {
    var _srchDebounce = null;
    srchEl.addEventListener('input', function (e) {
      clearTimeout(_srchDebounce);
      var val = e.target.value.toLowerCase().trim();
      _srchDebounce = setTimeout(function () {
        q = val;
        page = 1;
        renderFeed();
      }, 220);
    });
  }

  var durGrid = document.getElementById('durGrid');
  if (durGrid) durGrid.addEventListener('click', function (e) {
    var b = e.target.closest('.dur-btn');
    if (!b || b.classList.contains('locked')) return;
    document.querySelectorAll('.dur-btn:not(.locked)').forEach(function (x) { x.classList.remove('sel'); });
    b.classList.add('sel');
    selDur = b.dataset.dur;
  });

  document.addEventListener('click', function (e) {
    document.querySelectorAll('.lang-dd').forEach(function (d) { d.classList.remove('open'); });
    // Close any open card dropdown unless the click originated inside one
    if (!e.target.closest('.cmen') && !e.target.closest('.cmen-dropdown')) {
      document.querySelectorAll('.cmen-dropdown').forEach(function (d) { d.remove(); });
    }
  });
  var cardsList = document.getElementById('cardsList');
  if (cardsList) {
    cardsList.addEventListener('click', function (event) {
      var investBtn = event.target.closest('[data-invest-id]');
      if (investBtn && !investBtn.disabled) {
        openInvest(investBtn.dataset.investId);
        return;
      }
      // Связаться с автором — открыть модалку подтверждения
      var contactBtn = event.target.closest('[data-contact-author-id]');
      if (contactBtn && !contactBtn.disabled) {
        openContactAuthorModal(
          contactBtn.dataset.contactAuthorId,
          contactBtn.dataset.contactAuthorName
        );
        return;
      }
      // Автор уже открыт — перейти в чат
      var openChatBtn = event.target.closest('[data-open-chat-id]');
      if (openChatBtn && !openChatBtn.disabled) {
        _switchToChat(openChatBtn.dataset.openChatId);
        return;
      }
      var reactAddBtn = event.target.closest('.react-add-btn[data-id]');
      if (reactAddBtn) {
        var ideaId = reactAddBtn.dataset.id;
        if (window.GlobalEmojiPicker) {
          window.GlobalEmojiPicker.show(reactAddBtn, function (emoji) {
            react(ideaId, emoji, reactAddBtn);
          });
        }
        event.stopPropagation();
        return;
      }
      var reactBtn = event.target.closest('.rbbl[data-id][data-e]');
      if (reactBtn) {
        // Reactions use idea id directly (string UUID)
        react(reactBtn.dataset.id, reactBtn.dataset.e, reactBtn);
        return;
      }
      var shareBtn = event.target.closest('.bshare[data-share-id]');
      if (shareBtn) {
        doShareIdea(shareBtn.dataset.shareId);
        return;
      }
      // Must be checked BEFORE .cmen — report btn lives inside .cmen
      var dropReportBtn = event.target.closest('.cmen-report-btn[data-report-id]');
      if (dropReportBtn && !dropReportBtn.disabled) {
        document.querySelectorAll('.cmen-dropdown').forEach(function (d) { d.remove(); });
        doReportIdea(dropReportBtn.dataset.reportId, dropReportBtn);
        return;
      }
      var cmenBtn = event.target.closest('.cmen[data-idea-id]');
      if (cmenBtn) {
        event.stopPropagation();
        openCmenDropdown(cmenBtn);
        return;
      }
      var adminDelBtn = event.target.closest('.admin-del-btn[data-admin-del-id]');
      if (adminDelBtn && PROFILE.is_admin) {
        event.stopPropagation();
        openAdminDeleteModal(adminDelBtn.dataset.adminDelId);
        return;
      }
      var authorDelBtn = event.target.closest('.author-del-btn[data-author-del-id]');
      if (authorDelBtn) {
        event.stopPropagation();
        openAuthorDeleteModal(authorDelBtn.dataset.authorDelId);
        return;
      }
      var authorRestoreBtn = event.target.closest('.author-restore-btn[data-author-restore-id]');
      if (authorRestoreBtn) {
        event.stopPropagation();
        openAuthorRestoreModal(authorRestoreBtn.dataset.authorRestoreId);
        return;
      }
    });
  }
  
  // Обработчик кликов для карточек в "Мои идеи" (профиль) будет установлен в renderMyIdeas
  
  var invPresets = document.getElementById('invPresets');
  if (invPresets) {
    invPresets.addEventListener('click', function (event) {
      var presetBtn = event.target.closest('[data-set-amt]');
      if (!presetBtn || presetBtn.disabled) return;
      setAmt(parseInt(presetBtn.dataset.setAmt, 10));
    });
  }
  ['dpPanel', 'mobProfInner'].forEach(function (containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', function (event) {
      var investBtn = event.target.closest('[data-invest-id]');
      if (investBtn && !investBtn.disabled) {
        openInvest(investBtn.dataset.investId);
        return;
      }
      var reactAddBtn = event.target.closest('.react-add-btn[data-id]');
      if (reactAddBtn) {
        var ideaId = reactAddBtn.dataset.id;
        if (window.GlobalEmojiPicker) {
          window.GlobalEmojiPicker.show(reactAddBtn, function (emoji) {
            react(ideaId, emoji, reactAddBtn);
          });
        }
        event.stopPropagation();
        return;
      }
      var reactBtn = event.target.closest('.rbbl[data-id][data-e]');
      if (reactBtn) {
        react(reactBtn.dataset.id, reactBtn.dataset.e, reactBtn);
        return;
      }
      var langOpt = event.target.closest('[data-set-lang]');
      if (langOpt) {
        setLang(langOpt.dataset.setLang, event);
        return;
      }
      var ddToggle = event.target.closest('[data-dd-id]');
      if (ddToggle) {
        toggleDD(event, ddToggle.dataset.ddId);
        return;
      }
      var pulseBtn = event.target.closest('[data-pulse]');
      if (pulseBtn) {
        pulse(pulseBtn);
        if (pulseBtn.dataset.settings === 'notifications') showNotifications();
        if (pulseBtn.dataset.settings === 'privacy') showPrivacy();
        return;
      }
      var howToggle = event.target.closest('[data-ach-how]');
      if (howToggle) {
        var howBody = document.getElementById('achHow-' + howToggle.dataset.achHow);
        if (howBody) {
          var open = howBody.classList.toggle('open');
          howToggle.classList.toggle('open', open);
        }
        return;
      }
      var copyCodeEl = event.target.closest('[id^="achCode-"]');
      if (copyCodeEl) {
        var codeText = copyCodeEl.querySelector('span') ? copyCodeEl.querySelector('span').textContent : '';
        if (codeText && navigator.clipboard) {
          navigator.clipboard.writeText(codeText).then(function () {
            toast('Код скопирован: ' + codeText, 'var(--ac2)');
          });
        }
        return;
      }
      var claimAchBtn = event.target.closest('[data-claim-ach]');
      if (claimAchBtn && !claimAchBtn.disabled) {
        doClaimAchievement(claimAchBtn.dataset.claimAch, parseInt(claimAchBtn.dataset.claimRank, 10) || 1);
        return;
      }
      var verifyRepostBtn = event.target.closest('[data-verify-repost]');
      if (verifyRepostBtn && !verifyRepostBtn.disabled) {
        doVerifyRepost(verifyRepostBtn.dataset.verifyRepost);
        return;
      }
      var logoutBtn = event.target.closest('[data-logout]');
      if (logoutBtn) doLogout();
    });
  });
  // Dynamic verification code auto-sanitization & instant auto-verification!
  var suCodeInput = document.getElementById('suCode');
  if (suCodeInput) {
    suCodeInput.addEventListener('input', function () {
      var cleaned = this.value.replace(/\D/g, '').slice(0, 6);
      if (this.value !== cleaned) {
        this.value = cleaned;
      }
      if (cleaned.length === 6 && !AuthFlowManager.isProcessing()) {
        doVerifyRegistration();
      }
    });
  }
  var delCodeInput = document.getElementById('delete-verify-code');
  if (delCodeInput) {
    delCodeInput.addEventListener('input', function () {
      var cleaned = this.value.replace(/\D/g, '').slice(0, 6);
      if (this.value !== cleaned) {
        this.value = cleaned;
      }
      if (cleaned.length === 6 && !AuthFlowManager.isProcessing()) {
        doConfirmDeleteAccount();
      }
    });
  }

  // Support modal — close on backdrop
  var moSupport = document.getElementById('moSupport');
  if (moSupport) {
    moSupport.addEventListener('click', function (e) {
      if (e.target === moSupport) closeMo('moSupport');
    });
  }

  // Admin 2FA modal
  var adminCodeConfirmBtn = document.getElementById('adminCodeConfirm');
  if (adminCodeConfirmBtn) adminCodeConfirmBtn.addEventListener('click', doAdminCodeConfirm);
  var adminCodeBackBtn = document.getElementById('adminCodeBack');
  if (adminCodeBackBtn) adminCodeBackBtn.addEventListener('click', closeAdminCodeModal);
  var adminCodeInput = document.getElementById('adminCodeInput');
  if (adminCodeInput) {
    adminCodeInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doAdminCodeConfirm();
      if (e.key === 'Escape') closeAdminCodeModal();
    });
  }

  // Admin delete modal buttons
  var adminDelCancelBtn = document.getElementById('adminDelCancelBtn');
  if (adminDelCancelBtn) adminDelCancelBtn.addEventListener('click', function () { closeMo('moAdminDelete'); });
  var adminDelConfirmBtn = document.getElementById('adminDelConfirmBtn');
  if (adminDelConfirmBtn) adminDelConfirmBtn.addEventListener('click', doAdminDeleteConfirm);

  var moAdminDelete = document.getElementById('moAdminDelete');
  if (moAdminDelete) {
    moAdminDelete.addEventListener('click', function (e) {
      if (e.target === moAdminDelete) closeMo('moAdminDelete');
    });
  }

  // Announcement banner close
  var annClose = document.getElementById('announcementClose');
  if (annClose) {
    annClose.addEventListener('click', function () {
      var banner = document.getElementById('announcementBanner');
      if (banner) banner.style.display = 'none';
      var textEl = document.getElementById('announcementText');
      if (textEl && textEl.textContent) {
        localStorage.setItem('spark_closed_announcement', textEl.textContent.trim());
      }
    });
  }

  // Global Escape key closes any open modal
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      ['moSupport', 'moAdminDelete'].forEach(function (id) { closeMo(id); });
    }
  });

  initObservatory();
  bootApp();
});

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeCssBackground(value) {
  var raw = String(value || '').trim();
  if (!raw) return 'linear-gradient(135deg,#e8c55a,#5ae8c5)';
  var safeGradient = /^linear-gradient\([#(),.%\sa-zA-Z0-9-]+\)$/;
  var safeHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (safeGradient.test(raw) || safeHex.test(raw)) return raw;
  return 'linear-gradient(135deg,#e8c55a,#5ae8c5)';
}

function safeAvatar(value) {
  var text = String(value || '').trim();
  if (!text) return '?';
  return escapeHTML(text.charAt(0).toUpperCase());
}

function clampAmount(raw, min, max) {
  var n = Number(raw);
  if (!Number.isFinite(n)) return min;
  var normalized = Math.floor(n);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function switchAuth(tab) {
  var isSI = (tab === 'signin');
  var fmSI = document.getElementById('fmSI');
  var fmSU = document.getElementById('fmSU');
  if (fmSI) fmSI.style.display = isSI ? '' : 'none';
  if (fmSU) fmSU.style.display = isSI ? 'none' : '';
  if (!isSI) showRegistrationForm();
  var tabSI = document.getElementById('tabSI');
  var tabSU = document.getElementById('tabSU');
  if (tabSI) tabSI.classList.toggle('on', isSI);
  if (tabSU) tabSU.classList.toggle('on', !isSI);
  setAuthErr('');
}

function showRegistrationForm() {
  REGISTRATION_STEP = 1;
  var fmSU = document.getElementById('fmSU');
  var fmSUCode = document.getElementById('fmSUCode');
  if (fmSU) fmSU.style.display = '';
  if (fmSUCode) fmSUCode.style.display = 'none';
  var codeEl = document.getElementById('suCode');
  if (codeEl) codeEl.value = '';
}

function showRegistrationCodeStep(email) {
  REGISTRATION_STEP = 2;
  var fmSU = document.getElementById('fmSU');
  var fmSUCode = document.getElementById('fmSUCode');
  if (fmSU) fmSU.style.display = 'none';
  if (fmSUCode) fmSUCode.style.display = '';
  var emailEl = document.getElementById('suCodeEmail');
  if (emailEl) emailEl.textContent = email;
  var codeEl = document.getElementById('suCode');
  if (codeEl) {
    codeEl.value = '';
    codeEl.focus();
  }
  setAuthErr('');
}

function backToRegistrationForm() {
  showRegistrationForm();
  setAuthErr('');
}

function setAuthErr(m) {
  var el = document.getElementById('authErr');
  if (el) el.textContent = m;
}

var activeButtonTimers = new Map();

// ════ Unified Auth State Machine ════
var AuthFlowManager = {
  state: 'IDLE',
  btn: null,
  isProcessing: function () {
    return this.state !== 'IDLE';
  },
  start: function (stateName, btnEl) {
    if (this.isProcessing()) return false;
    this.state = stateName;
    this.btn = btnEl;
    if (btnEl) {
      setBtnLoading(btnEl, true);
    }
    return true;
  },
  stop: function () {
    if (this.btn) {
      setBtnLoading(this.btn, false);
    }
    this.state = 'IDLE';
    this.btn = null;
  }
};

function setBtnLoading(idOrEl, isLoading) {
  var btn = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!btn) return;

  if (activeButtonTimers.has(btn)) {
    var timerData = activeButtonTimers.get(btn);
    clearInterval(timerData.interval);
    activeButtonTimers.delete(btn);
  }

  if (isLoading) {
    btn.disabled = true;
    if (btn.dataset.originalHtml === undefined) {
      btn.dataset.originalHtml = btn.innerHTML;
    }

    var isCountdownBtn = ['btnSU', 'btnSUVerify', 'btnConfirmDel', 'btnSUResend'].includes(btn.id);

    if (isCountdownBtn) {
      btn.classList.add('btn-timer-loading');
      var duration = 5;
      btn.innerHTML =
        '<span class="btn-timer-content" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; vertical-align: middle; width: 100%; height: 100%;">' +
          '<svg class="btn-timer-svg" width="20" height="20" viewBox="0 0 24 24" style="transform: rotate(-90deg); flex-shrink: 0;">' +
            '<circle class="btn-timer-track" cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity: 0.15;"></circle>' +
            '<circle class="btn-timer-progress" cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="56.55" stroke-dashoffset="56.55" stroke-linecap="round"></circle>' +
          '</svg>' +
          '<span class="btn-timer-text" style="font-family: var(--fh); font-weight: 700; font-size: 13px; min-width: 22px; text-align: left;">' + duration + 's</span>' +
        '</span>';

      var progressCircle = btn.querySelector('.btn-timer-progress');
      var timerText = btn.querySelector('.btn-timer-text');

      setTimeout(function() {
        if (progressCircle) {
          progressCircle.style.transition = 'stroke-dashoffset ' + duration + 's linear';
          progressCircle.style.strokeDashoffset = '0';
        }
      }, 20);

      var remaining = duration;
      var interval = setInterval(function() {
        remaining--;
        if (remaining >= 0) {
          if (timerText) timerText.textContent = remaining + 's';
        }
        if (remaining <= 0) {
          clearInterval(interval);
          if (timerText) timerText.textContent = '...';
          if (progressCircle) progressCircle.classList.add('pulse-glow');
        }
      }, 1000);

      activeButtonTimers.set(btn, { interval: interval });
    } else {
      btn.classList.add('btn-loading');
    }
  } else {
    btn.classList.remove('btn-loading');
    btn.classList.remove('btn-timer-loading');
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
    btn.disabled = false;
  }
}

async function doSignIn() {
  var emailEl = document.getElementById('siEmail');
  var passEl  = document.getElementById('siPass');
  if (!emailEl || !passEl) { setAuthErr('Form error'); return; }
  var email = emailEl.value.trim().toLowerCase();
  var pass  = passEl.value;
  if (!email || !pass) { setAuthErr('Please fill all fields'); return; }
  setBtnLoading('btnSI', true);
  setAuthErr('');

  if (!supa) { PROFILE.username = '@demo'; enterApp(); setBtnLoading('btnSI', false); return; }

  try {
    var res = await safeSupabaseCall('auth', function () {
      return supa.auth.signInWithPassword({ email: email, password: pass });
    }, { timeout: 25000, silent: true });

    if (!res.ok) throw res.error;
    var r = res.data;
    if (r && r.error) throw r.error;
    ME = r.data.user;

    if (ME && !ME.email_confirmed_at) {
      PENDING_EMAIL = email;
      showVerify(email, '');
      setAuthErr(T('verifyTitle'));
      setBtnLoading('btnSI', false);
      return;
    }

    // Check server-side whether this account is flagged as admin
    var profileCheck = await safeSupabaseCall('database', function () {
      return supa.from('profiles').select('is_admin').eq('id', ME.id).single();
    }, { silent: true, timeout: 10000 });

    if (!profileCheck.ok) {
      throw new Error(profileCheck.error && profileCheck.error.message ? profileCheck.error.message : 'Не удалось проверить статус учетной записи. Проверьте соединение с базой данных.');
    }

    var userIsAdmin = profileCheck.data &&
                      profileCheck.data.data &&
                      profileCheck.data.data.is_admin === true;

    if (userIsAdmin) {
      // Sign out immediately and hold credentials for the 2FA gate
      await supa.auth.signOut();
      _pendingAdminSignIn = { email: email, password: pass };
      setBtnLoading('btnSI', false);
      openAdminCodeModal();
      return;
    }

    await fetchProfile();
    enterApp();
  } catch (e) {
    console.error(e);
    var isNetworkOrParseErr = (e instanceof SyntaxError) ||
      (e.message && (e.message.indexOf('is not valid JSON') !== -1 || e.message.indexOf('Failed to fetch') !== -1));
    var msg = (isAuthError(e) || isNetworkOrParseErr) ? integrationMessage('auth') : (e.message || 'Sign in failed');
    toast(msg, 'var(--red)');
    setAuthErr(msg);
  } finally {
    setBtnLoading('btnSI', false);
  }
}

// ════ ADMIN 2FA MODAL LOGIC ════
function openAdminCodeModal() {
  var mo = document.getElementById('moAdminCode');
  if (!mo) return;
  var inp = document.getElementById('adminCodeInput');
  var err = document.getElementById('adminCodeErr');
  if (inp) inp.value = '';
  if (err) err.textContent = '';
  mo.style.display = 'flex';
  setTimeout(function() { if (inp) inp.focus(); }, 80);
}

function closeAdminCodeModal() {
  var mo = document.getElementById('moAdminCode');
  if (mo) mo.style.display = 'none';
  _pendingAdminSignIn = null;
}

async function doAdminCodeConfirm() {
  var inp = document.getElementById('adminCodeInput');
  var err = document.getElementById('adminCodeErr');
  var btn = document.getElementById('adminCodeConfirm');
  if (!inp || !err || !btn) return;

  var code = inp.value.trim();
  if (!code) { err.textContent = 'Введите код доступа.'; inp.focus(); return; }

  if (!_pendingAdminSignIn || !supa) {
    err.textContent = 'Сессия истекла. Войдите заново.';
    setTimeout(closeAdminCodeModal, 1200);
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Проверяем...';
  err.textContent = '';

  try {
    // Step 1: Re-authenticate to get a valid session for the RPC call
    var loginRes = await safeSupabaseCall('auth', function () {
      return supa.auth.signInWithPassword({
        email: _pendingAdminSignIn.email,
        password: _pendingAdminSignIn.password
      });
    }, { timeout: 25000, silent: true });

    if (!loginRes.ok) throw loginRes.error;

    // Step 2: Verify the code server-side — the secret never leaves the DB
    var verifyRes = await supa.rpc('verify_admin_secret', { p_code: code });

    if (verifyRes.error) throw verifyRes.error;
    var result = verifyRes.data;

    if (!result || result.success === false) {
      // Wrong code — revoke the session and show an error
      await supa.auth.signOut().catch(function () {});
      err.textContent = '❌ Неверный код. Попробуйте ещё раз.';
      inp.value = '';
      inp.focus();
      btn.disabled = false;
      btn.textContent = 'Подтвердить →';
      return;
    }

    // Step 3: Code verified server-side — proceed into the app
    ME = loginRes.data.data.user;
    closeAdminCodeModal();
    await fetchProfile();
    enterApp();
    toast('👑 Добро пожаловать, администратор!', 'var(--vl2)');
  } catch (e) {
    err.textContent = '⚠ Ошибка: ' + (e.message || 'попробуйте позже');
    await supa.auth.signOut().catch(function () {});
    btn.disabled = false;
    btn.textContent = 'Подтвердить →';
  }
}

async function doSignUp() {
  if (AuthFlowManager.isProcessing()) return;

  var nickEl = document.getElementById('suNick');
  var emailEl = document.getElementById('suEmail');
  var passEl = document.getElementById('suPass');
  var pass2El = document.getElementById('suPass2');
  if (!nickEl || !emailEl || !passEl || !pass2El) { setAuthErr('Form error'); return; }

  var nick = nickEl.value.trim().replace(/^@/, '');
  var email = emailEl.value.trim().toLowerCase();
  var pass = passEl.value;
  var pass2 = pass2El.value;

  if (!nick || !email || !pass || !pass2) { setAuthErr('Fill all fields'); return; }
  // БАГ #5: правила username едины для регистрации и редактирования профиля
  // (буквы, цифры, _ и -) — см. profile-edit.js и register-send-code
  if (nick.length < 3) { setAuthErr(T('min3chars')); return; }
  if (!/^[a-zA-Z0-9_-]+$/.test(nick)) { setAuthErr(T('onlyLettersNums')); return; }
  if (pass.length < 8) { setAuthErr('Password min 8 chars'); return; }
  if (pass !== pass2) { setAuthErr('Passwords do not match'); return; }

  var btn = document.getElementById('btnSU');
  AuthFlowManager.start('REG_SENDING_CODE', btn);
  setAuthErr('');

  if (!supa) {
    PROFILE.username = '@' + nick;
    enterApp();
    AuthFlowManager.stop();
    return;
  }

  PENDING_EMAIL = email;
  PENDING_NICK = nick;
  PENDING_REG_PASSWORD = pass;

  try {
    var sent = await callEdgeFunction('register-send-code', {
      email: email,
      password: pass,
      nickname: nick
    });
    if (!sent.ok) {
      var regMsg = registrationErrorMessage(sent);
      setAuthErr(regMsg);
      toast(regMsg, 'var(--red)');
      AuthFlowManager.stop();
      return;
    }
    toast(T('regCodeSent'), 'var(--ac2)');
    if (sent.data && sent.data.dev_code) {
      console.info('[dev] registration code:', sent.data.dev_code);
      toast('Dev code: ' + sent.data.dev_code, 'var(--ac)');
    }
    showRegistrationCodeStep(email);
  } catch (e) {
    console.error('SignUp exception:', e.message);
    featureToast('registration', e);
    setAuthErr(integrationMessage('registration'));
  } finally {
    AuthFlowManager.stop();
  }
}

async function doVerifyRegistration() {
  if (AuthFlowManager.isProcessing()) return;

  var codeEl = document.getElementById('suCode');
  var code = codeEl ? codeEl.value.replace(/\D/g, '') : '';
  if (!/^\d{6}$/.test(code)) {
    setAuthErr(T('regInvalidCode'));
    return;
  }
  if (!PENDING_EMAIL || !PENDING_REG_PASSWORD) {
    setAuthErr(T('regInvalidCode'));
    backToRegistrationForm();
    return;
  }

  var btn = document.getElementById('btnSUVerify');
  AuthFlowManager.start('REG_VERIFYING', btn);
  setAuthErr('');

  try {
    var verified = await callEdgeFunction('register-verify', {
      email: PENDING_EMAIL,
      code: code,
      password: PENDING_REG_PASSWORD
    });
    if (!verified.ok) {
      var vMsg = registrationErrorMessage(verified);
      setAuthErr(vMsg);
      toast(vMsg, 'var(--red)');
      AuthFlowManager.stop();
      return;
    }

    // ════ Optimistic UI Transition ════
    // Transition IMMEDIATELY to application since database setup succeeded!
    toast(T('regComplete'), 'var(--ac2)');

    PROFILE.username = '@' + PENDING_NICK;
    PROFILE.spk_balance = 500;

    var tempUser = {
      email: PENDING_EMAIL,
      user_metadata: { username: '@' + PENDING_NICK }
    };
    ME = tempUser;

    showRegistrationForm();
    enterApp();
    AuthFlowManager.stop();

    // Async background session handshake
    (async function () {
      try {
        var established = false;
        if (verified.data && verified.data.token_hash) {
          var verifyRes = await supa.auth.verifyOtp({
            token_hash: verified.data.token_hash,
            type: 'magiclink'
          });
          if (!verifyRes.error && verifyRes.data && verifyRes.data.user) {
            ME = verifyRes.data.user;
            established = true;
            await fetchProfile();
            updateHeader();
          }
        }
        if (!established) {
          var signIn = await supa.auth.signInWithPassword({
            email: PENDING_EMAIL,
            password: PENDING_REG_PASSWORD
          });
          if (signIn.error) throw signIn.error;
          ME = signIn.data.user;
          await fetchProfile();
          updateHeader();
        }
      } catch (bgError) {
        console.warn('[background session handshake failed]:', bgError);
        toast('Session alignment failed. Re-authenticating...', 'var(--red)');
        doLogout(true);
      } finally {
        PENDING_REG_PASSWORD = '';
      }
    })();
  } catch (e) {
    console.error('verify registration', e);
    var msg = isAuthError(e) ? integrationMessage('auth') : (e.message || T('regInvalidCode'));
    setAuthErr(msg);
    toast(msg, 'var(--red)');
    AuthFlowManager.stop();
  }
}

async function resendRegistrationCode() {
  if (AuthFlowManager.isProcessing()) return;
  if (!PENDING_EMAIL || !PENDING_REG_PASSWORD || !PENDING_NICK) {
    backToRegistrationForm();
    return;
  }
  var btn = document.getElementById('btnSUResend');
  AuthFlowManager.start('REG_RESENDING_CODE', btn);
  setAuthErr('');

  try {
    var sent = await callEdgeFunction('register-send-code', {
      email: PENDING_EMAIL,
      password: PENDING_REG_PASSWORD,
      nickname: PENDING_NICK
    });
    if (!sent.ok) {
      var resendMsg = registrationErrorMessage(sent);
      toast(resendMsg, 'var(--red)');
      setAuthErr(resendMsg);
      return;
    }
    toast(T('regCodeSent'), 'var(--ac2)');
    if (sent.data && sent.data.dev_code) {
      console.info('[dev] registration code:', sent.data.dev_code);
    }
  } catch (e) {
    console.error('resend registration code error:', e);
  } finally {
    AuthFlowManager.stop();
  }
}

async function fetchProfile() {
  if (!supa || !ME) return;
  var r = await safeSupabaseCall('database', function () {
    return supa.from('profiles').select('*').eq('id', ME.id).single();
  }, { silent: true, timeout: 25000 });

  if (r.ok && r.data && r.data.data) {
    var row = r.data.data;
    PROFILE.username = row.username || '@user';
    PROFILE.spk_balance = Number(row.spk_balance) || 0;
    PROFILE.investments_count = Number(row.investments_count) || 0;
    PROFILE.last_daily_bonus_claim = row.last_daily_bonus_claim || null;
    PROFILE.bio = row.bio || '';
    PROFILE.avatar_color = row.avatar_color || 0;
    PROFILE.is_admin = row.is_admin === true;
    if (PROFILE.is_admin) ADMIN_USER_IDS.add(ME.id);
    // БАГ #1: онбординг показывается только один раз — статус хранится в БД
    PROFILE.onboarding_completed = row.onboarding_completed === true;
    // ICC: специальные бейджи (BETA TESTER / BETA TESTER PRO)
    var badges = row.special_badges;
    if (typeof badges === 'string') {
      try {
        badges = JSON.parse(badges);
      } catch (e) {
        badges = [];
      }
    }
    PROFILE.special_badges = Array.isArray(badges) ? badges : [];
    if (PROFILE.onboarding_completed) {
      try { localStorage.setItem('spark_tour3_seen', '1'); localStorage.setItem('spark_ob3_seen', '1'); } catch (e) {}
    }
    // Cross-device theme sync: apply preset from DB if set (overrides local localStorage)
    if (row.theme_preset_id && window.ThemeEngine && ThemeEngine.PRESETS[row.theme_preset_id]) {
      ThemeEngine.applyPreset(row.theme_preset_id);
    }

    // Check Daily Bonus Eligibility
    var eligible = false;
    if (!PROFILE.last_daily_bonus_claim) {
      eligible = true;
    } else {
      var lastClaim = new Date(PROFILE.last_daily_bonus_claim);
      var now = new Date();
      // Compare UTC dates
      if (lastClaim.getUTCFullYear() !== now.getUTCFullYear() ||
          lastClaim.getUTCMonth() !== now.getUTCMonth() ||
          lastClaim.getUTCDate() !== now.getUTCDate()) {
        eligible = true;
      }
    }
    
    if (eligible && window.claimDailyBonus) {
      // Prevent multiple simultaneous triggers locally
      PROFILE.last_daily_bonus_claim = new Date().toISOString(); 
      setTimeout(claimDailyBonus, 1500); // Small delay for nice UX after load
    }

  } else {
    // Fallback if DB is blocked/timed out but session exists
    var fallbackName = '@user';
    if (ME.user_metadata && ME.user_metadata.username) {
      fallbackName = ME.user_metadata.username;
    } else if (ME.email) {
      fallbackName = '@' + ME.email.split('@')[0];
    }
    PROFILE.username = fallbackName;
    PROFILE.spk_balance = 0;
    PROFILE.investments_count = 0;
    PROFILE.special_badges = [];
  }

  // Load secondary stats asynchronously without blocking the startup sequence
  setTimeout(async function() {
    var ideasPromise = safeSupabaseCall('database', function () {
      return supa.from('ideas').select('id', { count: 'exact', head: true }).eq('author_id', ME.id);
    }, { silent: true, timeout: 25000 });

    var rankPromise = safeSupabaseCall('database', function () {
      return supa.from('profiles').select('id', { count: 'exact', head: true }).gt('spk_balance', PROFILE.spk_balance || 0);
    }, { silent: true, timeout: 25000 });

    var [ideasRes, rankRes] = await Promise.all([ideasPromise, rankPromise]);

    if (ideasRes.ok && ideasRes.data) {
      PROFILE.ideas_count = ideasRes.data.count || 0;
    } else {
      PROFILE.ideas_count = 0;
    }

    if (rankRes.ok && rankRes.data && rankRes.data.count !== null) {
      PROFILE.rank = rankRes.data.count + 1;
    } else {
      PROFILE.rank = 1;
    }

    if (appEntered) {
      updateHeader();
      renderProfile();
      renderLeaders();
    }
  }, 0);
}

window.claimDailyBonus = async function() {
  if (!supa || !ME) return;
  var r = await safeSupabaseCall('database', function() {
    return supa.rpc('claim_daily_bonus');
  }, { silent: true, timeout: 25000 });

  if (r.ok && r.data && r.data.data && r.data.data.success) {
    var bonusData = r.data.data;
    PROFILE.spk_balance = Number(bonusData.new_balance) || (PROFILE.spk_balance + 10);
    PROFILE.last_daily_bonus_claim = new Date().toISOString();
    updateHeader();
    if (appEntered) {
      renderProfile();
    }
    toast('🎁 Ежедневный бонус: +' + (bonusData.amount || 10) + ' SPK!', 'var(--ac)');
  } else if (r.ok && r.data && r.data.data && r.data.data.message === 'already_claimed') {
    // Just quietly update local state to avoid further attempts today
    PROFILE.last_daily_bonus_claim = new Date().toISOString();
  }
};

// ═══ Load ideas from DB and populate LIVE array ═══
async function loadIdeasFromDB() {
  // Show loading state in feed
  var cl = document.getElementById('cardsList');
  if (cl) cl.innerHTML = '<div style="text-align:center;color:var(--mu);padding:40px 20px;font-size:14px">Loading ideas...</div>';

  if (!supa) {
    // No DB — show empty state
    renderFeed();
    renderTrends();
    renderLeaders();
    return;
  }

  var r = await safeSupabaseCall('database', function () {
    return supa.from('ideas')
      .select('id, title, description, min_bet, total_invested, investment_history, investor_ids, expires_at, created_at, author_id, reactions, status')
      .or('status.eq.active,status.eq.immune,status.is.null')
      .order('created_at', { ascending: false })
      .limit(50);
  }, { silent: true, timeout: 25000 });

  if (r.ok && r.data && r.data.data) {
    var rows = r.data.data;
    // Fetch author usernames from profiles
    var authorIds = rows.map(function(row) { return row.author_id; }).filter(Boolean);
    var profilesMap = {};
    if (authorIds.length > 0) {
      var pRes = await safeSupabaseCall('database', function () {
        return supa.from('profiles').select('id, username, is_admin').in('id', authorIds);
      }, { silent: true, timeout: 25000 });
      if (pRes.ok && pRes.data && pRes.data.data) {
        pRes.data.data.forEach(function(p) {
          profilesMap[p.id] = p.username || '@user';
          if (p.is_admin === true) ADMIN_USER_IDS.add(p.id);
        });
      }
    }

    LIVE = rows.map(function(row) {
      return dbRowToLiveIdea(row, profilesMap);
    });
  } else {
    LIVE = [];
  }

  renderFeed();
  renderTrends();
  renderLeaders();
  // Update observatory and live activity once after data is loaded
  renderObservatoryData();
  applyLiveActivityI18n();
}

// БАГ #7: уникальные инвесторы из ideas.investor_ids (uuid[]).
// Если колонки ещё нет / массив пуст, а история инвестиций есть —
// фолбэк на старое поведение (длина истории).
function countUniqueInvestors(investorIds, history) {
  if (Array.isArray(investorIds) && investorIds.length > 0) {
    return new Set(investorIds).size;
  }
  return Array.isArray(history) ? history.length : 0;
}

// ═══ Convert a DB ideas row to LIVE array object ═══
function dbRowToLiveIdea(row, profilesMap) {
  var uname = (profilesMap && profilesMap[row.author_id]) || '@user';
  var letter = uname.replace('@', '').charAt(0).toUpperCase();
  var history = Array.isArray(row.investment_history) ? row.investment_history : [];
  // БАГ #7: считаем УНИКАЛЬНЫХ инвесторов (investor_ids), а не число транзакций.
  // Для старых идей (до миграции investor_ids) фолбэк — длина истории.
  var investorCount = countUniqueInvestors(row.investor_ids, history);
  var pool = Number(row.total_invested) || 0;
  // Calculate pct as growth: (pool / minBet) relative to an arbitrary baseline
  var minBet = Number(row.min_bet) || 10;
  var pct = pool > 0 ? Math.min(Math.round((pool / Math.max(minBet * 5, 1)) * 100), 999) : 0;
  // Calculate hours left from expires_at
  var cdH = '—';
  if (row.expires_at) {
    var msLeft = new Date(row.expires_at).getTime() - Date.now();
    if (msLeft > 0) {
      var hoursLeft = Math.floor(msLeft / 3600000);
      cdH = String(hoursLeft);
    } else {
      cdH = '0';
    }
  }
  // Calculate 'tm' (time since posted)
  var tm = '—';
  if (row.created_at) {
    var msSince = Date.now() - new Date(row.created_at).getTime();
    var minSince = Math.floor(msSince / 60000);
    if (minSince < 60) tm = minSince + 'm';
    else if (minSince < 1440) tm = Math.floor(minSince / 60) + 'h';
    else tm = Math.floor(minSince / 1440) + 'd';
  }
  // Restore reactions from DB reactions jsonb
  var reactions = row.reactions || {};
  var rsObj = getRS(row.id);
  EMOJIS.forEach(function(e) {
    if (reactions[e] !== undefined) rsObj.counts[e] = Number(reactions[e]) || 0;
  });
  // Clear stale localStorage pick: if DB shows count=0 for the stored pick emoji, the pick is outdated
  if (rsObj.pick && (rsObj.counts[rsObj.pick] || 0) === 0) {
    rsObj.pick = null;
    try { localStorage.removeItem('spark_pick_' + row.id); } catch (e2) {}
  }
  // Pick tag from title keywords
  var tag = detectTag(row.title || '');
  // Random-ish gradient based on id
  var gradients = [
    'linear-gradient(135deg,#e8c55a,#e87a5a)',
    'linear-gradient(135deg,#5ae8c5,#5a90e8)',
    'linear-gradient(135deg,#e85a7a,#c55ae8)',
    'linear-gradient(135deg,#cd7f32,#aa5a22)',
    'linear-gradient(135deg,#c0c0c0,#8888aa)',
    'linear-gradient(135deg,#5a90e8,#5ae8c5)',
    'linear-gradient(135deg,#e8a55a,#e8c55a)',
    'linear-gradient(135deg,#c55ae8,#e85a7a)'
  ];
  // Fast gradient seed from first 8 chars of UUID (much cheaper than full string)
  var idxSeed = String(row.id || '').slice(0, 8).split('').reduce(function(a, c) { return a + c.charCodeAt(0); }, 0);
  var bg = gradients[idxSeed % gradients.length];
  return {
    id: row.id,
    author_id: row.author_id,
    u: uname,
    av: letter,
    bg: bg,
    tm: tm,
    tag: tag,
    minBet: minBet,
    title: row.title || '',
    body: row.description || '',
    investors: investorCount,
    pool: String(pool),
    cd: cdH,
    pct: pct,
    investment_history: history,
    expires_at: row.expires_at,
    status: row.status || 'active'
  };
}

// Simple tag detection from title keywords
function detectTag(title) {
  var t = title.toLowerCase();
  if (t.includes('ai') || t.includes('ml') || t.includes('gpt') || t.includes('code') || t.includes('review')) return 'AI Tools';
  if (t.includes('solar') || t.includes('energy') || t.includes('ev') || t.includes('carbon') || t.includes('green')) return 'CleanEnergy';
  if (t.includes('defi') || t.includes('yield') || t.includes('lending') || t.includes('chain') || t.includes('liquidity')) return 'DeFi';
  if (t.includes('web3') || t.includes('token') || t.includes('nft') || t.includes('blockchain')) return 'Web3';
  if (t.includes('hardware') || t.includes('device') || t.includes('keyboard') || t.includes('sensor') || t.includes('chip')) return 'Hardware';
  if (t.includes('saas') || t.includes('crm') || t.includes('b2b') || t.includes('slack') || t.includes('productivity')) return 'B2B SaaS';
  return 'B2B SaaS';
}

// ═══ Render live trends table from LIVE data ═══
function renderTrends() {
  var tagTotals = {};
  LIVE.forEach(function(idea) {
    var tag = idea.tag || 'Other';
    if (!tagTotals[tag]) tagTotals[tag] = 0;
    tagTotals[tag] += Number(idea.pool) || 0;
  });

  var sorted = Object.keys(tagTotals).sort(function(a, b) { return tagTotals[b] - tagTotals[a]; });

  function buildHtml(list) {
    if (list.length === 0) {
      return '<div style="color:var(--mu);font-size:12px;padding:8px 0">' + (LANG === 'ru' ? 'Нет данных — опубликуйте первую идею!' : 'No data yet — publish the first idea!') + '</div>';
    }
    return list.map(function(tag, i) {
      var total = tagTotals[tag];
      var isHot = i === 0 && total > 0;
      var cntHtml = total > 0 ? total.toLocaleString() + ' SPK' : '0 SPK';
      return '<div class="trend-item">'
        + '<span class="t-rank">' + (i + 1) + '</span>'
        + '<span class="t-tag">#' + escapeHTML(tag) + '</span>'
        + '<span class="t-cnt">' + escapeHTML(cntHtml) + '</span>'
        + (isHot ? '<span class="t-hot">\uD83D\uDD25</span>' : '')
        + '</div>';
    }).join('');
  }

  var html = buildHtml(sorted);
  var desk = document.getElementById('trendListDesk');
  if (desk) desk.innerHTML = html;
  var mob = document.getElementById('trendListMob');
  if (mob) mob.innerHTML = html;
}

// ═══ Render leaders from profiles DB ═══
async function renderLeaders() {
  var rankColors = ['gold', 'silver', 'bronze'];

  // Build self-row — shown in both online and offline paths
  var selfHtml = '';
  if (typeof ME !== 'undefined' && ME && PROFILE) {
    var selfUname = escapeHTML(PROFILE.username || '@user');
    var selfLetter = selfUname.replace('@', '').charAt(0).toUpperCase();
    var selfAvIdx  = PROFILE.avatar_color || 0;
    var selfAvGrad = window.ProfileEditEngine
      ? ProfileEditEngine.getAvatarGradient(selfAvIdx)
      : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
    var selfBal    = Number(PROFILE.spk_balance) || 0;
    var selfInv    = Number(PROFILE.investments_count) || 0;
    var selfRank   = PROFILE.rank ? '#' + PROFILE.rank : '#—';
    selfHtml = '<div class="divider"></div>'
      + '<div class="stitle">' + T('you') + '</div>'
      + '<div class="li li-self">'
      + '<span class="lrank" style="width:auto;min-width:22px;color:var(--mu)">' + selfRank + '</span>'
      + '<div class="lav" style="background:' + selfAvGrad + '">' + selfLetter + '</div>'
      + '<div class="linf">'
      + '<div class="lname">' + selfUname + '</div>'
      + '<div class="lsub">' + selfInv + ' ' + (LANG === 'ru' ? 'вложений' : 'investments') + '</div>'
      + '</div>'
      + '<div class="lprofit" style="color:var(--ac)">' + selfBal.toLocaleString() + ' SPK</div>'
      + '</div>';
  }

  if (!supa) {
    var emptyHtml = '<div style="color:var(--mu);font-size:12px;padding:8px 0">' + (LANG === 'ru' ? 'Нет данных' : 'No data yet') + '</div>';
    var ld = document.getElementById('leaderListDesk');
    if (ld) ld.innerHTML = emptyHtml + selfHtml;
    var lm = document.getElementById('leaderListMob');
    if (lm) lm.innerHTML = emptyHtml + selfHtml;
    return;
  }

  var r = await safeSupabaseCall('database', function () {
    return supa.from('profiles')
      .select('id, username, spk_balance, investments_count, is_admin')
      .or('is_admin.is.null,is_admin.eq.false')
      .order('spk_balance', { ascending: false })
      .limit(5);
  }, { silent: true, timeout: 25000 });

  var html;
  if (r.ok && r.data && r.data.data && r.data.data.length > 0) {
    var leaders = r.data.data;
    html = leaders.map(function(p, i) {
      var uname = escapeHTML(p.username || '@user');
      var letter = uname.replace('@', '').charAt(0).toUpperCase();
      var rankClass = rankColors[i] ? 'lrank ' + rankColors[i] : 'lrank';
      var rankStyle = i >= 3 ? ' style="color:var(--mu)"' : '';
      var bal = Number(p.spk_balance) || 0;
      var invCount = Number(p.investments_count) || 0;
      // Gradient based on rank
      var gradients = [
        'linear-gradient(135deg,#ffd700,#e8a55a)',
        'linear-gradient(135deg,#c0c0c0,#8888aa)',
        'linear-gradient(135deg,#cd7f32,#aa5a22)',
        'linear-gradient(135deg,#5ae8c5,#5a90e8)',
        'linear-gradient(135deg,#e85a7a,#c55ae8)'
      ];
      var profitColor = i < 3 ? '' : ' style="color:var(--ac)"';
      var triggerId = p.id;
      var lavTriggerAttr = triggerId ? ' class="lav mp-trigger" data-user-id="' + triggerId + '"' : ' class="lav"';
      var linfTriggerAttr = triggerId ? ' class="linf mp-trigger" data-user-id="' + triggerId + '"' : ' class="linf"';
      return '<div class="li">'
        + '<span class="' + rankClass + '"' + rankStyle + '>' + (i + 1) + '</span>'
        + '<div' + lavTriggerAttr + ' style="background:' + gradients[i] + '">' + letter + '</div>'
        + '<div' + linfTriggerAttr + '>'
        + '<div class="lname">' + uname + '</div>'
        + '<div class="lsub">' + invCount + ' ' + (LANG === 'ru' ? 'вложений' : 'investments') + '</div>'
        + '</div>'
        + '<div class="lprofit"' + profitColor + '>' + bal.toLocaleString() + ' SPK</div>'
        + '</div>';
    }).join('');
  } else {
    html = '<div style="color:var(--mu);font-size:12px;padding:8px 0">' + (LANG === 'ru' ? 'Нет данных' : 'No data yet') + '</div>';
  }

  html += selfHtml;

  var ld = document.getElementById('leaderListDesk');
  if (ld) ld.innerHTML = html;
  var lm = document.getElementById('leaderListMob');
  if (lm) lm.innerHTML = html;
}

async function doLogout(skipSignOut) {
  // First, completely obliterate all session and local storage to prevent any session restoring!
  // БАГ #1: флаги пройденного онбординга переживают logout (основное хранилище —
  // profiles.onboarding_completed в БД, локальные ключи сохраняем как фолбэк).
  var preservedKeys = ['spark_lang', 'spark_ob3_seen', 'spark_tour3_seen'];
  try {
    var preserved = {};
    preservedKeys.forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v !== null) preserved[k] = v;
    });
    localStorage.clear();
    sessionStorage.clear();
    Object.keys(preserved).forEach(function (k) {
      localStorage.setItem(k, preserved[k]);
    });
  } catch (err) {
    console.warn('storage clear error', err);
  }

  try {
    if (supa) {
      if (skipSignOut) {
        // Run signOut in the background but catch any errors (since the user is already deleted, it might throw)
        supa.auth.signOut().catch(function(e) { console.warn('async signOut error', e); });
      } else {
        await supa.auth.signOut();
      }
    }
  } catch (e) {
    console.warn('signOut error', e);
  }

  // Explicitly reset session state to guarantee immediate redirection to sign-in page
  ME = null;
  PROFILE = { username: '@user', spk_balance: 0, ideas_count: 0, rank: null, investments_count: 0, bio: '', avatar_color: 0, is_admin: false, special_badges: [] };
  ADMIN_USER_IDS.clear();
  appEntered = false;
  try {
    Object.keys(localStorage).forEach(function (key) {
      if (key.indexOf('spark_pick_') === 0) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {}
  document.documentElement.classList.remove('spark-presession');
  document.documentElement.classList.add('auth-active');
  var authScreen = document.getElementById('authScreen');
  if (authScreen) authScreen.classList.remove('gone');
  var launchOverlay = document.getElementById('launchOverlay');
  if (launchOverlay) launchOverlay.classList.add('gone');

  // Use a reliable 150ms delay before redirecting to the base URL to prevent any race conditions with async storage writes
  setTimeout(function() {
    window.location.href = window.location.origin + window.location.pathname;
  }, 150);
}

// ── Контакт автора: состояние ожидающей операции ────────────
var _pendingContactId   = null;
var _pendingContactName = null;

// Открыть модалку подтверждения покупки контакта
function openContactAuthorModal(authorId, authorName) {
  _pendingContactId   = authorId;
  _pendingContactName = authorName || '?';

  var cost = IDEA_CONTACT_COST;
  var el = function(id) { return document.getElementById(id); };

  var titleEl = el('caTitle');
  if (titleEl) titleEl.textContent = T('caTitle');

  var nameEl = el('caAuthorName');
  if (nameEl) nameEl.textContent = authorName || '?';

  // Аватар — первая буква + инициируем нужный цвет
  var avEl = el('caAuthorAv');
  if (avEl) avEl.textContent = (authorName || '?').replace('@', '').charAt(0).toUpperCase();

  var costEl = el('caCostLabel');
  if (costEl) costEl.textContent = cost + ' SPK';

  var noticeEl = el('caNotice');
  if (noticeEl) noticeEl.innerHTML = T('caNotice').replace('{cost}', cost);

  var balEl = el('caBalVal');
  if (balEl) balEl.textContent = (PROFILE.spk_balance || 0).toLocaleString() + ' SPK';

  var balLblEl = el('caBalLabel');
  if (balLblEl) balLblEl.textContent = T('caBalLabel');

  var confirmEl = el('caConfirm');
  if (confirmEl) {
    confirmEl.textContent = T('caConfirmBtn').replace('{cost}', cost);
    confirmEl.disabled = (PROFILE.spk_balance || 0) < cost;
  }

  var cancelEl = el('caCancel');
  if (cancelEl) cancelEl.textContent = T('caCancel');

  var warnEl = el('caWarn');
  if (warnEl) {
    if ((PROFILE.spk_balance || 0) < cost) {
      warnEl.style.display = '';
      warnEl.textContent = T('caErrBalance');
    } else {
      warnEl.style.display = 'none';
    }
  }

  openMo('moContactAuthor');
}

// Выполнить разблокировку контакта
async function doUnlockContact() {
  if (!_pendingContactId) return;

  var confirmBtn = document.getElementById('caConfirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳…'; }

  var cost = IDEA_CONTACT_COST;
  var authorId   = _pendingContactId;
  var authorName = _pendingContactName;

  // Проверка: контакт уже разблокирован?
  var alreadyUnlocked = false;
  
  // 1. Проверка в локальном множестве
  if (window.UNLOCKED_CONTACT_IDS && window.UNLOCKED_CONTACT_IDS.has(authorId)) {
    alreadyUnlocked = true;
  }
  
  // 2. Проверка в локальном списке контактов
  if (!alreadyUnlocked && window.ChatsEngine && window.ChatsEngine._getContacts) {
    var contacts = window.ChatsEngine._getContacts();
    if (contacts.some(function (c) { return c.id === authorId; })) {
      alreadyUnlocked = true;
    }
  }
  
  // 3. Проверка в базе данных (если есть соединение)
  if (!alreadyUnlocked && window.supa && window.ME) {
    try {
      var checkRes = await supa
        .from('unlocked_contacts')
        .select('contact_id')
        .eq('user_id', ME.id)
        .eq('contact_id', authorId)
        .single();
      
      if (!checkRes.error && checkRes.data) {
        alreadyUnlocked = true;
        window.UNLOCKED_CONTACT_IDS.add(authorId);
      }
    } catch (e) {
      // Игнорируем ошибки при проверке, продолжаем с обычной логикой
    }
  }
  
  // Если контакт уже разблокирован — просто открываем чат без списания
  if (alreadyUnlocked) {
    closeMo('moContactAuthor');
    toast('Чат уже открыт', 'var(--ac)');
    
    // Убедимся что контакт есть в локальном списке
    if (window.ChatsEngine) {
      var contacts = (window.ChatsEngine._getContacts ? window.ChatsEngine._getContacts() : []);
      var alreadyIn = contacts.some(function (c) { return c.id === authorId; });
      if (!alreadyIn) {
        contacts.push({
          id:       authorId,
          name:     authorName,
          username: authorName,
          online:   false,
          avColor:  0,
          preview:  ''
        });
        if (window.ChatsEngine._saveContacts) window.ChatsEngine._saveContacts(contacts);
      }
    }
    
    // Обновляем ленту чтобы кнопка на карточке сменилась
    renderFeed();
    
    // Переключаемся в чаты
    setTimeout(function () { _switchToChat(authorId); }, 350);
    return;
  }

  // БАГ #6: optimistic update — мгновенно списываем 30 SPK в UI,
  // при ошибке сервера откатываем и показываем уведомление.
  var balanceBeforeUnlock = PROFILE.spk_balance || 0;
  function _rollbackUnlockBalance() {
    PROFILE.spk_balance = balanceBeforeUnlock;
    updateHeader();
  }

  try {
    if (window.supa && window.ME) {
      PROFILE.spk_balance = Math.max(0, balanceBeforeUnlock - cost);
      updateHeader();

      var r = await safeSupabaseCall('database', function () {
        return supa.rpc('unlock_contact', { p_contact_id: authorId, p_cost: cost });
      }, { silent: true });

      var result = r.ok && r.data && r.data.data ? r.data.data : null;

      if (!result || !result.success) {
        _rollbackUnlockBalance();
        var msg = result && result.message;
        var errText = msg === 'insufficient_balance' ? T('caErrBalance') : T('caErrGeneric');
        toast(errText, 'var(--red)');
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = T('caConfirmBtn').replace('{cost}', cost); }
        return;
      }

      // Синхронизация с авторитетным балансом из ответа сервера
      PROFILE.spk_balance = Number(result.new_balance) || PROFILE.spk_balance;
      updateHeader();
      renderLeaders(); // БАГ #14: лидерборд не должен расходиться с кошельком
    } else {
      // Offline-режим: локальное списание
      PROFILE.spk_balance = Math.max(0, (PROFILE.spk_balance || 0) - cost);
      updateHeader();
    }
  } catch (e) {
    _rollbackUnlockBalance();
    toast(T('caErrGeneric'), 'var(--red)');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = T('caConfirmBtn').replace('{cost}', cost); }
    return;
  }

  // Добавляем в множество разблокированных
  window.UNLOCKED_CONTACT_IDS.add(authorId);

  // Добавляем в список чатов (LocalStorage)
  if (window.ChatsEngine) {
    var contacts = (window.ChatsEngine._getContacts ? window.ChatsEngine._getContacts() : []);
    var alreadyIn = contacts.some(function (c) { return c.id === authorId; });
    if (!alreadyIn) {
      contacts.push({
        id:       authorId,
        name:     authorName,
        username: authorName,
        online:   false,
        avColor:  0,
        preview:  ''
      });
      if (window.ChatsEngine._saveContacts) window.ChatsEngine._saveContacts(contacts);
    }
  }

  closeMo('moContactAuthor');
  toast(T('caSuccess').replace('{cost}', cost), 'var(--ac)');

  // Обновляем ленту чтобы кнопка на карточке сменилась
  renderFeed();

  // Переключаемся в чаты
  setTimeout(function () { _switchToChat(authorId); }, 350);
}

// Переключить панель на чаты и открыть диалог с userId
function _switchToChat(userId) {
  openPanel('chats');
  if (window.ChatsEngine) {
    setTimeout(function () { ChatsEngine.selectChannel(userId); }, 100);
  }
}

// Синхронизировать разблокированные контакты из БД при старте
async function syncUnlockedContacts() {
  if (!window.supa || !window.ME) return;
  try {
    var res = await supa
      .from('unlocked_contacts')
      .select('contact_id, contact:contact_id(id, username, avatar_color)')
      .eq('user_id', ME.id);

    if (res.error || !res.data) return;

    var changed = false;
    var contacts = window.ChatsEngine ? (window.ChatsEngine._getContacts ? window.ChatsEngine._getContacts() : []) : [];

    res.data.forEach(function (row) {
      var prof = row.contact;
      if (!prof) return;
      window.UNLOCKED_CONTACT_IDS.add(prof.id);

      var exists = contacts.some(function (c) { return c.id === prof.id; });
      if (!exists) {
        contacts.push({
          id:       prof.id,
          name:     prof.username,
          username: prof.username,
          online:   false,
          avColor:  prof.avatar_color || 0,
          preview:  ''
        });
        changed = true;
      }
    });

    if (changed && window.ChatsEngine && window.ChatsEngine._saveContacts) {
      window.ChatsEngine._saveContacts(contacts);
      window.ChatsEngine.renderChatList();
    }

    // Перерисовываем ленту чтобы кнопки обновились
    if (res.data.length > 0) renderFeed();
  } catch (e) {
    console.warn('[syncUnlockedContacts]', e);
  }
}

// ════ Load user's reaction picks from DB (cross-device sync: web ↔ Android) ════
// Called once on login. Fetches user_reactions rows and restores RS[id].pick so the
// user sees their own past picks from any device / browser (not just the current localStorage).
async function loadUserReactionsFromDB() {
  if (!supa || !ME) return;
  try {
    var r = await supa.from('user_reactions')
      .select('idea_id, emoji')
      .eq('user_id', ME.id);
    if (!r.data || !Array.isArray(r.data)) return;
    r.data.forEach(function (row) {
      if (!row.idea_id || !row.emoji || EMOJIS.indexOf(row.emoji) === -1) return;
      var rs = getRS(row.idea_id);
      rs.pick = row.emoji;
      try { localStorage.setItem('spark_pick_' + row.idea_id, row.emoji); } catch (e) {}
    });
    // Re-render feed so freshly restored picks are highlighted
    renderFeed();
  } catch (e) {
    // Non-critical: localStorage picks still work as fallback
  }
}

function enterApp() {
  if (appEntered) return;
  appEntered = true;
  document.documentElement.classList.remove('auth-active');
  hideVerify();
  var authScreen = document.getElementById('authScreen');
  if (authScreen) authScreen.classList.add('gone');
  var launchOverlay = document.getElementById('launchOverlay');
  if (launchOverlay) launchOverlay.classList.add('gone');
  updateHeader();
  initRealtime();
  applyLang(); // applyLang already calls renderProfile() — no need to call it twice
  // Load real ideas from DB, then render trends and leaders
  loadIdeasFromDB();
  // Restore this user's reaction picks from DB (cross-device: replaces stale localStorage picks)
  loadUserReactionsFromDB();

  // Pre-fill search from ?search= URL param (used by share links)
  var urlSearchParam = new URLSearchParams(window.location.search).get('search');
  if (urlSearchParam) {
    var srchEl2 = document.getElementById('srchIn');
    if (srchEl2) {
      srchEl2.value = urlSearchParam;
      q = urlSearchParam.toLowerCase().trim();
    }
    window.history.replaceState(null, '', window.location.pathname);
  }

  if (window.ChatsEngine) {
    ChatsEngine.init();
  }
  // Phase 2 interactive tour — runs for new registrations and first-time logins.
  if (window.SparkTour) {
    SparkTour.init();
  }
  // Синхронизируем разблокированные контакты из БД
  syncUnlockedContacts();
  // Загружаем системное объявление
  loadAnnouncement();

  // Open the panel requested by profile.html / leaderboard.html redirects.
  try {
    var _savedPanel = sessionStorage.getItem('spark_auto_panel');
    if (_savedPanel) {
      sessionStorage.removeItem('spark_auto_panel');
      setTimeout(function () { openPanel(_savedPanel, false); }, 300);
    }
  } catch (e) {}
}

// ════ СИСТЕМНОЕ ОБЪЯВЛЕНИЕ ════
async function loadAnnouncement() {
  if (!supa) return;
  try {
    var res = await supa.from('system_announcements').select('message').eq('id', 1).single();
    var banner = document.getElementById('announcementBanner');
    var textEl = document.getElementById('announcementText');
    if (res.data && res.data.message) {
      var activeMsg = res.data.message.trim();
      var closedMsg = localStorage.getItem('spark_closed_announcement');
      if (closedMsg === activeMsg) {
        if (banner) banner.style.display = 'none';
        return;
      }
      if (banner && textEl) {
        textEl.textContent = res.data.message;
        banner.style.display = 'flex';
      }
    } else {
      if (banner) banner.style.display = 'none';
      localStorage.removeItem('spark_closed_announcement');
    }
  } catch (e) {
    // Non-critical — silently ignore
  }
}

// ════ ADMIN DELETE IDEA ════
var _pendingAdminDeleteId = null;

function openAdminDeleteModal(ideaId) {
  _pendingAdminDeleteId = ideaId;
  var idea = LIVE.filter(function (x) { return String(x.id) === String(ideaId); })[0];
  var msgEl = document.getElementById('adminDelMsg');
  if (msgEl && idea) {
    msgEl.textContent = 'Точно удалить «' + String(idea.title || '').slice(0, 40) + '»? Действие необратимо.';
  }
  openMo('moAdminDelete');
}

async function doAdminDeleteConfirm() {
  if (!_pendingAdminDeleteId || !supa || !PROFILE.is_admin) return;
  var ideaId = _pendingAdminDeleteId;
  _pendingAdminDeleteId = null;

  var confirmBtn = document.getElementById('adminDelConfirmBtn');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳...'; }

  var r = await safeSupabaseCall('database', function () {
    return supa.rpc('admin_delete_idea', { p_idea_id: ideaId });
  }, { silent: true });

  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Удалить'; }
  closeMo('moAdminDelete');

  var result = r.ok && r.data && r.data.data ? r.data.data : null;
  if (result && result.success) {
    // Optimistic: remove from LIVE and re-render
    LIVE = LIVE.filter(function (x) { return String(x.id) !== String(ideaId); });
    renderFeed();
    renderTrends();
    toast('Удалено', 'var(--ac2)');
  } else {
    var errDetail = '';
    if (!r.ok && r.error) {
      errDetail = r.error.message || r.error.code || String(r.error);
    } else if (result && result.message) {
      errDetail = result.message;
    }
    toast('Ошибка: ' + (errDetail || 'неизвестная ошибка'), 'var(--red)');
  }
}

// ════ AUTHOR DELETE IDEA ════
var _pendingAuthorDeleteId = null;

function openAuthorDeleteModal(ideaId) {
  _pendingAuthorDeleteId = ideaId;
  openMo('moDeleteIdea');
}

async function doAuthorDeleteConfirm() {
  if (!_pendingAuthorDeleteId || !supa || !ME) return;
  var ideaId = _pendingAuthorDeleteId;
  _pendingAuthorDeleteId = null;

  var confirmBtn = document.getElementById('diConfirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳...'; }

  // Обновляем статус идеи на 'hidden' вместо полного удаления
  var r = await safeSupabaseCall('database', function () {
    return supa
      .from('ideas')
      .update({ status: 'hidden' })
      .eq('id', ideaId)
      .eq('author_id', ME.id);
  }, { silent: true });

  if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Удалить идею'; }
  closeMo('moDeleteIdea');

  if (r.ok && !r.error) {
    // Optimistic: remove from LIVE and re-render
    LIVE = LIVE.filter(function (x) { return String(x.id) !== String(ideaId); });
    renderFeed();
    renderTrends();
    renderMyIdeas();
    toast('Идея удалена из ленты', 'var(--ac2)');
  } else {
    var errDetail = '';
    if (!r.ok && r.error) {
      errDetail = r.error.message || r.error.code || String(r.error);
    }
    toast('Ошибка: ' + (errDetail || 'неизвестная ошибка'), 'var(--red)');
  }
}

// ════ AUTHOR RESTORE IDEA ════
var _pendingAuthorRestoreId = null;

function openAuthorRestoreModal(ideaId) {
  _pendingAuthorRestoreId = ideaId;
  openMo('moRestoreIdea');
}

async function doAuthorRestoreConfirm() {
  if (!_pendingAuthorRestoreId || !supa || !ME) return;
  var ideaId = _pendingAuthorRestoreId;
  _pendingAuthorRestoreId = null;

  // Обновляем статус идеи на 'active'
  var r = await safeSupabaseCall('database', function () {
    return supa
      .from('ideas')
      .update({ status: 'active' })
      .eq('id', ideaId)
      .eq('author_id', ME.id);
  }, { silent: true });

  closeMo('moRestoreIdea');

  if (r.ok && !r.error) {
    // Optimistic: add back to LIVE and re-render
    var idea = LIVE.find(function (x) { return String(x.id) === String(ideaId); });
    if (idea) {
      idea.status = 'active';
    }
    renderFeed();
    renderTrends();
    renderMyIdeas();
    toast('Идея опубликована', 'var(--ac2)');
  } else {
    var errDetail = '';
    if (!r.ok && r.error) {
      errDetail = r.error.message || r.error.code || String(r.error);
    }
    toast('Ошибка: ' + (errDetail || 'неизвестная ошибка'), 'var(--red)');
  }
}

function updateHeader() {
  var letter = PROFILE.username.replace('@', '').charAt(0).toUpperCase();
  var av = document.getElementById('hdrAv');
  var un = document.getElementById('hdrUn');
  var spk = document.getElementById('hdrSpk');
  var bal = document.getElementById('invBal');
  if (av) {
    av.textContent = letter;
    var avIdx = Number(PROFILE.avatar_color) || 0;
    var avGrad = window.ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avIdx) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
    av.style.background = avGrad;
  }
  if (un) un.textContent = PROFILE.username;
  if (spk) spk.textContent = PROFILE.spk_balance.toLocaleString() + ' SPK';
  if (bal) bal.textContent = PROFILE.spk_balance.toLocaleString() + ' SPK';
  // Keep profile/sidebar wallet cards in sync
  document.querySelectorAll('.wamt').forEach(function (el) {
    el.innerHTML = PROFILE.spk_balance.toLocaleString() + ' <small>SPK</small>';
  });
}

function showVerify(email, nick) {
  PENDING_EMAIL = email;
  if (nick) PENDING_NICK = nick;
  document.documentElement.classList.add('auth-active');
  var el = document.getElementById('vmEmailDisplay');
  if (el) el.textContent = email;
  setVmErr('');
  var modal = document.getElementById('verify-modal');
  if (modal) modal.classList.add('show', 'open');
}

function hideVerify() {
  var modal = document.getElementById('verify-modal');
  if (modal) modal.classList.remove('show', 'open');
}

function setVmErr(m) {
  var el = document.getElementById('vmErr');
  if (el) el.textContent = m;
}

async function checkEmailVerified() {
  var btn = document.getElementById('vmConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Проверяем…'; }
  setVmErr('');

  if (!supa) { hideVerify(); enterApp(); return; }

  var confirmed = false;

  try {
    var refresh = await supa.auth.refreshSession();
    if (!refresh.error && refresh.data && refresh.data.user) {
      confirmed = !!refresh.data.user.email_confirmed_at;
      if (confirmed) ME = refresh.data.user;
    }

    if (!confirmed) {
      var gu = await supa.auth.getUser();
      if (!gu.error && gu.data && gu.data.user) {
        confirmed = !!gu.data.user.email_confirmed_at;
        if (confirmed) ME = gu.data.user;
      }
    }
  } catch (e) {
    setVmErr('Ошибка сети. Попробуйте ещё раз.');
    console.warn('checkEmailVerified error', e);
    if (btn) { btn.disabled = false; btn.textContent = T('verifyDone'); }
    return;
  }

  if (confirmed) {
    await fetchProfile();
    hideVerify();
    enterApp();
  } else {
    setVmErr('Почта ещё не подтверждена. Проверьте папку «Спам».');
    if (btn) { btn.disabled = false; btn.textContent = T('verifyDone'); }
  }
}

async function resendVerification() {
  if (!supa || !PENDING_EMAIL) return;
  setVmErr('');
  try {
    var r = await supa.auth.resend({
      type: 'signup',
      email: PENDING_EMAIL,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    setVmErr(r.error ? 'Не удалось: ' + r.error.message : '✉️ Письмо отправлено!');
  } catch (e) {
    setVmErr('Ошибка отправки.');
  }
}

function applyLang() {
  document.querySelectorAll('.lang-opt').forEach(function (o) {
    o.classList.toggle('sel', o.dataset.lang === LANG);
  });
  document.querySelectorAll('[id^="lc"]').forEach(function (e) {
    if (e) e.textContent = LANG.toUpperCase();
  });
  applyStaticI18n();
  renderProfile();
  renderFeed();
  if (window.ChatsEngine) {
    ChatsEngine.renderChatList();
    ChatsEngine.renderActiveConversation();
  }
}

function setText(selector, value) {
  var el = document.querySelector(selector);
  if (el && typeof value === 'string') el.textContent = value;
}

function setPlaceholder(selector, value) {
  var el = document.querySelector(selector);
  if (el && typeof value === 'string') el.placeholder = value;
}

function applyStaticI18n() {
  setText('#tabSI', T('signIn'));
  setText('#tabSU', T('register'));
  setText('#btnSI', T('signInBtn'));
  setText('#btnSU', T('createAccount'));
  setText('#suCodeHint', T('regEnterCode'));
  setText('#suCodeLabel', T('regCodeLabel'));
  setText('#btnSUVerify', T('regVerifyBtn'));
  setText('#btnSUResend', T('regResendCode'));
  setText('#btnSUBack', T('regBack'));
  var authRem = document.querySelector('.auth-rem');
  if (authRem) {
    var remInput = authRem.querySelector('input');
    authRem.textContent = '';
    if (remInput) authRem.appendChild(remInput);
    authRem.appendChild(document.createTextNode(' ' + T('rememberMe')));
  }
  setText('#fmSI .af:nth-of-type(1) label', T('email'));
  setText('#fmSI .af:nth-of-type(2) label', T('password'));
  setText('#fmSU .af:nth-of-type(1) label', T('nickname'));
  setText('#fmSU .af:nth-of-type(2) label', T('email'));
  setText('#fmSU .af:nth-of-type(3) label', T('passMin'));
  setText('#fmSU .af:nth-of-type(4) label', T('repeatPassword'));
  setPlaceholder('#suNick', '@your_name');
  setPlaceholder('#siEmail', 'you@spark.app');
  setPlaceholder('#suEmail', 'you@spark.app');

  setText('#vmTitleText', T('verifyTitle'));
  setText('#vmConfirmBtn', T('verifyDone'));
  setText('#vmResendBtn', T('resendMail'));
  var vmText = document.querySelector('.vm-text');
  var vmMail = document.getElementById('vmEmailDisplay');
  if (vmText && vmMail) {
    vmText.innerHTML = escapeHTML(T('verifyText')) + '<br>'
      + escapeHTML(T('verifyText2')) + ': <span class="vm-email" id="vmEmailDisplay">' + escapeHTML(vmMail.textContent || '') + '</span> '
      + escapeHTML(T('verifyText3'));
  }

  setText('#btnChatsDesk span', T('chats'));
  setText('#btnProfDesk span', T('profile'));
  setText('#btnPostIdea', T('postIdea'));
  setText('.wallet-badge .wlabel', T('wallet'));
  setText('.layout > .sidebar:first-child .stitle', T('trendingNow'));
  setText('#obsTitleDesk', T('marketObservatory'));
  setText('#obsTitleMob', T('marketObservatory'));
  document.querySelectorAll('[data-obs-label="tech"]').forEach(function (el) { el.textContent = T('obsTech'); });
  document.querySelectorAll('[data-obs-label="eco"]').forEach(function (el) { el.textContent = T('obsEco'); });
  document.querySelectorAll('[data-obs-label="social"]').forEach(function (el) { el.textContent = T('obsSocial'); });
  setText('.layout > .sidebar:last-child .stitle', T('leaderboard'));
  setText('.layout > .sidebar:last-child .divider + .stitle', T('liveActivity'));
  applyLiveActivityI18n();

  setText('.frow .flabel', T('sortLabel'));
  setText('.frow [data-sort="new"]', T('newSort'));
  setText('.frow [data-sort="popular"]', T('popularSort'));
  setText('.frow [data-sort="profit"]', T('profitSort'));
  setText('.frow [data-sort="ending"]', T('endingSort'));
  setText('.trow .flabel', T('tagLabel'));
  setText('.trow [data-tag="all"]', T('all'));
  setPlaceholder('#srchIn', LANG === 'ru' ? 'Поиск идей...' : 'Search ideas...');

  setText('.mob-tab[data-panel="feed"] span', T('feed'));
  setText('.mob-tab[data-panel="leaders"] span', T('leaders'));
  setText('.mob-tab[data-panel="chats"] span', T('chats'));
  setText('.mob-tab[data-panel="trends"] span', T('trends'));
  setText('.mob-tab[data-panel="profile"] span', T('profile'));
  setText('#panel-trends .stitle', T('trendingNow'));
  setText('#panel-leaders .stitle', T('leaders'));
  setText('[data-chat-tab="dms"]', T('chatDms'));
  setText('[data-chat-tab="topics"]', T('chatTopics'));

  setText('#moCreate .mo-title', T('newIdea'));
  setText('#moCreate .mf:nth-of-type(1) label', T('title'));
  setText('#moCreate .mf:nth-of-type(2) label', T('description'));
  setText('#moCreate .row2 .mf:nth-of-type(1) label', T('minBet'));
  setText('#moCreate .row2 .mf:nth-of-type(2) label', T('targetOpt'));
  setText('#moCreate .mf:nth-of-type(3) label', T('duration'));
  setText('#btnPub', T('holdPublish'));
  setText('#moCreate .hbtn-hint', T('holdHint'));
  setText('#btnPubCancel', T('caCancel'));
  setPlaceholder('#ciTitle', LANG === 'ru' ? 'В чем идея?' : "What's the idea?");
  setPlaceholder('#ciDesc', LANG === 'ru' ? 'Опишите...' : 'Describe it...');

  setText('#invTitle', T('investModal'));
  setText('#moInvest .inv-bal span', T('yourBalance'));
  setText('#btnInv', T('holdInvest'));
  setText('#moInvest .hbtn-hint', T('holdHint'));

  // Notifications modal i18n
  setText('#notifTitle', T('notifTitle'));
  setText('#notifSub', T('notifSub'));
  setText('#notifVibTitle', T('notifVibTitle'));
  setText('#notifVibSub', T('notifVibSub'));
  setText('#notifNewPostsTitle', T('notifNewPostsTitle'));
  setText('#notifNewPostsSub', T('notifNewPostsSub'));
  setText('#notifEmailTitle', T('notifEmailTitle'));
  setText('#notifEmailSub', T('notifEmailSub'));

  // Privacy modal i18n
  setText('#privTitle', T('privTitle'));
  setText('#privSub', T('privSub'));
  setText('#privSecTitle', T('privSecTitle'));
  setText('#privSecSub', T('privSecSub'));
  setPlaceholder('#current-password', T('privCurrPwd'));
  setPlaceholder('#new-password', T('privNewPwd'));
  setText('#btnUpdatePwd', T('privUpdatePwd'));
  setText('#privDelTitle', T('privDelTitle'));
  setText('#privDelSub', T('privDelSub'));
  setText('#btn-open-delete-modal', T('privDelBtn'));

  // Delete account modal i18n
  setText('#delModalTitle1', T('delModal1Title'));
  setText('#delModalSub1', T('delModal1Sub'));
  setPlaceholder('#delete-curr-pwd', T('delModal1Pwd'));
  setText('#btnSendDelCode', T('delSendCode'));
  setText('#delModalTitle2', T('delModal2Title'));
  setText('#delModalSub2', T('delModal2Sub'));
  setText('#btnConfirmDel', T('delFinalBtn'));

  // Create Team Channel modal i18n
  setText('#ccTitle', T('ccTitleTeam'));
  setText('#lblCcTarget', T('ccLabelChannel'));
  setPlaceholder('#ccTarget', T('ccPlaceholderChannel'));
  setText('#ccMembersLabel', T('teamMembersLabel'));
  setText('#btnConfirmCreateChat', T('ccBtnConfirm'));

  // Contact Author modal i18n
  setText('#caTitle', T('caTitle'));
  setText('#caAuthorSub', T('caAuthorSub'));
  setText('#caBalLabel', T('caBalLabel'));
  setText('#caCancel', T('caCancel'));
}

function initObservatory() {
  document.querySelectorAll('.obs-shell').forEach(function (shell) {
    var systems = shell.querySelectorAll('[data-obs-system]');
    systems.forEach(function (system) {
      system.addEventListener('click', function (event) {
        event.stopPropagation();
        var alreadyFocused = system.classList.contains('focused');
        systems.forEach(function (s) { s.classList.remove('focused'); });
        if (alreadyFocused) {
          shell.classList.remove('has-focus');
          return;
        }
        shell.classList.add('has-focus');
        system.classList.add('focused');
      });
    });

    var dimmer = shell.querySelector('.obs-dimmer');
    if (dimmer) {
      dimmer.addEventListener('click', function () {
        shell.classList.remove('has-focus');
        systems.forEach(function (s) { s.classList.remove('focused'); });
      });
    }
  });
  renderObservatoryData();
}

function parsePoolAmount(raw) {
  var normalized = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
  var n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function compactSpk(value) {
  var n = Number(value) || 0;
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k SPK';
  return Math.round(n) + ' SPK';
}

function shortTopic(idea) {
  if (!idea) return 'N/A';
  var source = String(idea.title || idea.tag || '').trim();
  if (!source) return 'N/A';
  return source.length > 14 ? source.slice(0, 14) + '…' : source;
}

function topByCategory(tags, maxItems) {
  var list = LIVE.filter(function (x) {
    return tags.includes(String(x.tag || '').toLowerCase());
  }).sort(function (a, b) {
    return (parsePoolAmount(b.pool) + (b.investors || 0) * 20) - (parsePoolAmount(a.pool) + (a.investors || 0) * 20);
  });
  return list.slice(0, maxItems);
}

function renderObservatoryData() {
  var tech = topByCategory(['ai tools', 'b2b saas', 'web3', 'defi'], 3);
  var eco = topByCategory(['cleanenergy'], 2);
  var social = topByCategory(['hardware'], 3);
  var fallback = LIVE.slice().sort(function (a, b) { return (b.investors || 0) - (a.investors || 0); });
  while (tech.length < 3 && fallback[tech.length]) tech.push(fallback[tech.length]);
  while (eco.length < 2 && fallback[eco.length]) eco.push(fallback[eco.length]);
  while (social.length < 3 && fallback[social.length]) social.push(fallback[social.length]);

  document.querySelectorAll('.obs-shell').forEach(function (shell) {
    var systems = shell.querySelectorAll('[data-obs-system]');
    var groups = [tech, eco, social];
    systems.forEach(function (system, index) {
      var infos = system.querySelectorAll('.obs-info');
      var group = groups[index] || [];
      infos.forEach(function (info, infoIndex) {
        var item = group[infoIndex] || null;
        var n = info.querySelector('.obs-n');
        var v = info.querySelector('.obs-v');
        if (!n || !v) return;
        n.textContent = shortTopic(item);
        v.textContent = item ? compactSpk(parsePoolAmount(item.pool)) : '0 SPK';
      });
    });
  });
}

// Live Activity: show real recent investments from LIVE data, or hide if no data
function applyLiveActivityI18n() {
  var row1 = document.getElementById('actRow1');
  var row2 = document.getElementById('actRow2');
  var row3 = document.getElementById('actRow3');
  // Build from actual LIVE data if available
  var recent = LIVE.slice().filter(function(x) { return x.investors > 0 || Number(x.pool) > 0; })
    .sort(function(a, b) { return (b.investors || 0) - (a.investors || 0); });
  if (recent.length === 0) {
    if (row1) row1.innerHTML = '';
    if (row2) row2.innerHTML = '';
    if (row3) row3.innerHTML = '';
    return;
  }
  var entries = recent.slice(0, 3);
  var rows = [row1, row2, row3];
  entries.forEach(function(idea, i) {
    var r = rows[i];
    if (!r) return;
    var u = escapeHTML(idea.u || '@user');
    var title = escapeHTML((idea.title || '').slice(0, 22));
    var pool = Number(idea.pool) || 0;
    r.innerHTML = '<span style="color:var(--ac2)">' + u + '</span> '
      + (LANG === 'ru' ? 'вложил(а) ' : 'invested ')
      + '<strong style="color:var(--tx)">' + pool + ' SPK</strong> '
      + (LANG === 'ru' ? 'в "' : 'in "') + title + '"'
      + '<div style="font-size:10px;margin-top:1px">' + escapeHTML(idea.tm || '—') + '</div>';
  });
  // Clear unused rows
  for (var j = entries.length; j < 3; j++) {
    if (rows[j]) rows[j].innerHTML = '';
  }
}

function setLang(l, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  LANG = l;
  localStorage.setItem('spark_lang', l);
  document.querySelectorAll('.lang-dd').forEach(function (d) { d.classList.remove('open'); });
  applyLang();
}

function toggleDD(e, id) {
  e.stopPropagation();
  document.querySelectorAll('.lang-dd').forEach(function (d) { if (d.id !== id) d.classList.remove('open'); });
  var dd = document.getElementById(id);
  if (dd) dd.classList.toggle('open');
}

/* Специальные бейджи (ICC: BETA TESTER / BETA TESTER PRO) из profiles.special_badges */
function renderSpecialBadges(badges) {
  if (typeof badges === 'string') {
    try {
      badges = JSON.parse(badges);
    } catch (e) {
      badges = [];
    }
  }
  if (!Array.isArray(badges) || badges.length === 0) return '';
  return badges.map(function (b) {
    if (!b || !b.label) return '';
    var cls = 'special-badge';
    var style = '';
    if (b.id === 'beta_tester') {
      cls += ' special-badge--beta';
      style = ' style="background:rgba(96, 165, 250, 0.12);color:#60A5FA;border:1px solid rgba(96, 165, 250, 0.3)"';
    } else if (b.id === 'beta_tester_pro') {
      cls += ' special-badge--pro';
      style = ' style="background:rgba(167, 139, 250, 0.15);color:#A78BFA;border:1px solid rgba(167, 139, 250, 0.4);box-shadow:0 0 8px rgba(167, 139, 250, 0.2)"';
    } else {
      // Неизвестный бейдж — красим инлайном по color из JSON (только hex, защита от инъекции в style)
      var color = /^#[0-9A-Fa-f]{3,8}$/.test(String(b.color || '')) ? b.color : '#A78BFA';
      style = ' style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '55"';
    }
    return ' <span class="' + cls + '"' + style + '>' + escapeHTML(String(b.label)) + '</span>';
  }).join('');
}

function profileHTML(sfx) {
  var L = PROFILE.username.replace('@', '').charAt(0).toUpperCase();
  var safeUser  = escapeHTML(PROFILE.username);
  var safeBio   = PROFILE.bio ? escapeHTML(PROFILE.bio) : '';
  var avIdx     = Number(PROFILE.avatar_color) || 0;
  var avGrad    = window.ProfileEditEngine ? ProfileEditEngine.getAvatarGradient(avIdx) : 'linear-gradient(135deg,#7B5CFA,#E85AA0)';
  var activeTheme = window.ThemeEngine ? ThemeEngine.getActive() : {};
  var themeIcon = activeTheme.icon || '🌌';
  var adminBadgeHtml = PROFILE.is_admin
    ? ' <span class="admin-badge">CORE TEAM</span>'
    : '';
  var specialBadgesHtml = renderSpecialBadges(PROFILE.special_badges);

  return '<div class="phero">'
    + '<div class="pav-lg" style="background:' + avGrad + '">' + L + '</div>'
    + '<div class="pname">' + safeUser + adminBadgeHtml + specialBadgesHtml + '</div>'
    + (safeBio ? '<div class="pbio">' + safeBio + '</div>' : '')
    + '<span class="pbadge">' + T('verifiedInvestor') + '</span></div>'
    + '<div class="srow" style="margin-bottom:18px">'
    + '<div class="sbox"><span class="sval">' + (PROFILE.ideas_count || 0) + '</span><span class="skey">' + T('ideas') + '</span></div>'
    + '<div class="sbox"><span class="sval">' + (typeof PROFILE.profit_pct === 'number' && PROFILE.profit_pct !== 0 ? (PROFILE.profit_pct > 0 ? '+' : '') + PROFILE.profit_pct + '%' : '—') + '</span><span class="skey">' + T('profit') + '</span></div>'
    + '<div class="sbox"><span class="sval">' + (PROFILE.investments_count || 0) + '</span><span class="skey">' + T('invested') + '</span></div>'
    + '<div class="sbox"><span class="sval">' + (PROFILE.rank ? '#' + PROFILE.rank : '—') + '</span><span class="skey">' + T('rank') + '</span></div></div>'
    /* Profile Edit section */
    + (window.ProfileEditEngine ? ProfileEditEngine.renderEditSection(sfx) : '')
    + '<div class="myideas-section" id="myideasSec-' + sfx + '">'
    + '<button type="button" class="myideas-toggle" id="myideasToggle-' + sfx + '">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac2)"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/></svg>'
    + '<span>' + T('myIdeas') + '</span>'
    + '<svg class="myideas-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
    + '</button>'
    + '<div class="myideas-body" id="myideasBody-' + sfx + '">'
    + '<div class="my-ideas-list" id="myIdeasList-' + sfx + '" style="display:flex;flex-direction:column;gap:12px;margin-top:12px;padding:4px 0;"></div>'
    + '</div>'
    + '</div>'
    + '<div class="divider"></div>'
    + '<div class="stitle" style="margin-top:14px">' + T('wallet') + '</div>'
    + '<div class="wcrd"><div><div class="wamt">' + (Number(PROFILE.spk_balance) || 0).toLocaleString() + ' <small>SPK</small></div><div class="wsub">' + T('availableBalance') + '</div></div>'
    + '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ac);opacity:.55"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8L2 7h20l-6-4z"/></svg></div>'
    + '<div class="divider"></div>'
    + '<div class="ach-section" id="achSec-' + sfx + '">'
    + '<button type="button" class="ach-toggle" id="achToggle-' + sfx + '">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--ac)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
    + '<span>' + T('achTitle') + '</span>'
    + '<svg class="ach-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
    + '</button>'
    + '<div class="ach-body" id="achBody-' + sfx + '">'
    + '<div class="ach-list" id="achList-' + sfx + '"><div class="ach-skeleton-row"><span class="ach-spin"></span> Загрузка...</div></div>'
    + '</div>'
    + '</div>'
    + '<div class="divider"></div>'
    + '<div class="stitle" style="margin-top:14px">' + T('settings') + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:2px">'
    /* Theme Studio row */
    + '<div class="sset-theme" onclick="window.showThemeStudio && showThemeStudio()">'
    + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--ac)"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/></svg>'
    + '<span style="font-size:13px">Theme Studio</span>'
    + '<div class="sset-theme-dots"><div class="sset-theme-dot" style="background:var(--vl)"></div><div class="sset-theme-dot" style="background:var(--ac)"></div><div class="sset-theme-dot" style="background:var(--ac2)"></div></div>'
    + '<span style="font-size:14px">' + themeIcon + '</span>'
    + '</div>'
    + '<div class="lang-row" data-dd-id="ldd-' + sfx + '">'
    + '<span style="font-size:13px">' + T('language') + '</span>'
    + '<span class="lang-cur" id="lc' + sfx + '">' + LANG.toUpperCase() + '</span>'
    + '<div class="lang-dd" id="ldd-' + sfx + '">'
    + '<div class="lang-opt' + (LANG === 'en' ? ' sel' : '') + '" data-lang="en" data-set-lang="en"><span style="font-size:11px; font-weight:bold; color:var(--mu);">EN</span> English</div>'
    + '<div class="lang-opt' + (LANG === 'ru' ? ' sel' : '') + '" data-lang="ru" data-set-lang="ru"><span style="font-size:11px; font-weight:bold; color:var(--mu);">RU</span> Русский</div>'
    + '</div></div>'
    + '<div class="sset" data-pulse="1" data-settings="notifications"><span>' + T('notifications') + '</span>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mu)"><polyline points="9 18 15 12 9 6"/></svg></div>'
    + '<div class="sset" data-pulse="1" data-settings="privacy"><span>' + T('privacy') + '</span>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mu)"><polyline points="9 18 15 12 9 6"/></svg></div>'
    + '<a class="sset" href="about.html" style="text-decoration:none;color:inherit"><span>' + (typeof T === 'function' && T('aboutUs') !== 'aboutUs' ? T('aboutUs') : (window.LANG === 'ru' ? 'О нас' : 'About us')) + '</span>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mu)"><polyline points="9 18 15 12 9 6"/></svg></a>'
    + '<div class="sset" data-open-mo="moSupport" onclick="openMo(\'moSupport\')"><span>' + (window.LANG === 'ru' ? 'Поддержка' : 'Support') + '</span>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mu)"><polyline points="9 18 15 12 9 6"/></svg></div>'
    + (PROFILE.is_admin
        ? '<a class="sset" href="admin.html" style="text-decoration:none;color:inherit">'
          + '<span style="color:var(--vl2)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:5px;color:var(--vl2)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Панель управления</span>'
          + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mu)"><polyline points="9 18 15 12 9 6"/></svg></a>'
        : '')
    + '<div class="sset" data-logout="1"><span style="color:var(--red)">' + T('logout') + '</span>'
    + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--red)"><polyline points="9 18 15 12 9 6"/></svg></div>'
    + '</div>';
}

function renderProfile() {
  var dp = document.getElementById('dpPanel');
  if (dp) {
    dp.innerHTML = profileHTML('D');
    if (window.ProfileEditEngine) ProfileEditEngine.initSection('D');
    initMyIdeasToggle('D');
    initAchievementsToggle('D');
  }
  var mb = document.getElementById('mobProfInner');
  if (mb) {
    mb.innerHTML = profileHTML('M');
    if (window.ProfileEditEngine) ProfileEditEngine.initSection('M');
    initMyIdeasToggle('M');
    initAchievementsToggle('M');
  }
  renderMyIdeas();
  renderAchievements('D');
  renderAchievements('M');
}

function initMyIdeasToggle(sfx) {
  var toggle = document.getElementById('myideasToggle-' + sfx);
  var body   = document.getElementById('myideasBody-' + sfx);
  if (toggle && body) {
    toggle.onclick = function () {
      var open = body.classList.contains('open');
      body.classList.toggle('open', !open);
      toggle.classList.toggle('open', !open);
    };
  }
}

/* ═══════════════════════════════════════════════════════════
   ДОСТИЖЕНИЯ — toggle, render, claim, repost verify
   ═══════════════════════════════════════════════════════════ */

function initAchievementsToggle(sfx) {
  var toggle = document.getElementById('achToggle-' + sfx);
  var body   = document.getElementById('achBody-' + sfx);
  if (toggle && body) {
    toggle.onclick = function () {
      var open = body.classList.contains('open');
      body.classList.toggle('open', !open);
      toggle.classList.toggle('open', !open);
    };
  }
}

function getAchDefs() {
  return [
    {
      id: 'fill_profile', icon: '👤',
      title: T('achFillProfileTitle'),
      ranks: [
        { rank: 1, label: 'I',   reward: 100, desc: T('achFillProfileDesc1') },
        { rank: 2, label: 'II',  reward: 150, desc: T('achFillProfileDesc2') },
        { rank: 3, label: 'III', reward: 200, desc: T('achFillProfileDesc3') },
        { rank: 4, label: 'IV',  reward: 300, desc: T('achFillProfileDesc4') },
        { rank: 5, label: 'V',   reward: 500, desc: T('achFillProfileDesc5') },
      ]
    },
    {
      id: 'create_ideas', icon: '💡',
      title: T('achCreate5IdeasTitle'),
      ranks: [
        { rank: 1, label: 'I',   reward: 100,  threshold: 5,   desc: T('achIdeasDesc1') },
        { rank: 2, label: 'II',  reward: 200,  threshold: 15,  desc: T('achIdeasDesc2') },
        { rank: 3, label: 'III', reward: 350,  threshold: 30,  desc: T('achIdeasDesc3') },
        { rank: 4, label: 'IV',  reward: 500,  threshold: 60,  desc: T('achIdeasDesc4') },
        { rank: 5, label: 'V',   reward: 1000, threshold: 100, desc: T('achIdeasDesc5') },
      ]
    },
    {
      id: 'adv_repost', icon: '📢',
      title: T('achAdvRepostTitle'),
      ranks: [
        { rank: 1, label: 'I',   reward: 50,  threshold: 1,  desc: T('achRepostDesc1') },
        { rank: 2, label: 'II',  reward: 100, threshold: 3,  desc: T('achRepostDesc2') },
        { rank: 3, label: 'III', reward: 200, threshold: 7,  desc: T('achRepostDesc3') },
        { rank: 4, label: 'IV',  reward: 350, threshold: 15, desc: T('achRepostDesc4') },
        { rank: 5, label: 'V',   reward: 500, threshold: 30, desc: T('achRepostDesc5') },
      ]
    },
  ];
}
// ACH_DEFS не кешируем — вызываем getAchDefs() при каждом рендере чтобы язык всегда был актуальным
var ACH_DEFS = [];

function achCardHTML(ach, rankData, sfx, extra) {
  extra    = extra    || {};
  rankData = rankData || { current_rank: 0, next_rank: 1, next_rank_reward: ach.ranks[0].reward, progress: {} };

  var currentRank = rankData.current_rank || 0;
  var nextRank    = rankData.next_rank;          // null when all 5 done
  var progress    = rankData.progress || {};

  var isAllDone = (currentRank === 5);
  var isReady   = false;
  if (!isAllDone && nextRank) {
    if (ach.id === 'fill_profile') {
      if      (nextRank === 1) isReady = (progress.bio_length > 0 && !!progress.has_username);
      else if (nextRank === 2) isReady = (progress.bio_length > 50 && progress.avatar_color !== 0);
      else if (nextRank === 3) isReady = (progress.bio_length > 100);
      // БАГ #15: кнопка «Забрать» активна только при реальной ссылке в bio
      // (те же паттерны, что проверяет бэкенд в claim_achievement_rank)
      else if (nextRank === 4) isReady = (currentRank >= 3) && /https:\/\/|t\.me|vk\.com/i.test((window.PROFILE && PROFILE.bio) || '');
      else if (nextRank === 5) isReady = (progress.bio_length >= 160);
    } else if (ach.id === 'create_ideas') {
      isReady = ((progress.ideas_count || 0) >= progress.threshold);
    } else if (ach.id === 'adv_repost') {
      isReady = ((progress.reposts_count || 0) >= progress.threshold);
    }
  }
  var state = isAllDone ? 'claimed' : (isReady ? 'ready' : 'locked');

  var lockSvg  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var checkSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  var starSvg  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  // Rank badge shows the highest earned rank
  var rankLabels = ['I', 'II', 'III', 'IV', 'V'];
  var badgeHtml = currentRank > 0
    ? '<span class="ach-rank-badge ach-rank-badge--' + rankLabels[currentRank - 1] + '">' + rankLabels[currentRank - 1] + '</span>'
    : '';

  // Header: description and reward of the NEXT rank to earn
  var nextRankDef = nextRank ? ach.ranks[nextRank - 1] : null;
  var descHtml    = nextRankDef ? nextRankDef.desc : T('achAllRanksDone');
  var rewardVal   = nextRankDef ? nextRankDef.reward : ach.ranks[4].reward;

  // Rank track: 5 pips with connectors
  var trackHtml = '<div class="ach-rank-track">';
  for (var rp = 1; rp <= 5; rp++) {
    var lbl    = rankLabels[rp - 1];
    var earned = rp <= currentRank;
    trackHtml += '<div class="ach-rank-pip' + (earned ? ' earned pip-' + lbl : '') + '">' + lbl + '</div>';
    if (rp < 5) {
      trackHtml += '<div class="ach-rank-connector' + (rp < currentRank ? ' filled' : '') + '"></div>';
    }
  }
  trackHtml += '</div>';

  // Numeric progress bar
  var progressHtml = '';
  if (ach.id === 'create_ideas' && !isAllDone && progress.threshold) {
    var ideasCnt = Math.min(progress.ideas_count || 0, progress.threshold);
    var ideasPct = Math.round(ideasCnt / progress.threshold * 100);
    progressHtml = '<div class="ach-progress"><div class="ach-progress-bar" style="width:' + ideasPct + '%"></div></div>'
      + '<div class="ach-progress-label">' + ideasCnt + ' / ' + progress.threshold + ' ' + T('achIdeasUnit') + '</div>';
  } else if (ach.id === 'adv_repost' && !isAllDone && progress.threshold) {
    var repostCnt = Math.min(progress.reposts_count || 0, progress.threshold);
    var repostPct = Math.round(repostCnt / progress.threshold * 100);
    progressHtml = '<div class="ach-progress"><div class="ach-progress-bar" style="width:' + repostPct + '%"></div></div>'
      + '<div class="ach-progress-label">' + repostCnt + ' / ' + progress.threshold + ' ' + T('achRepostsUnit') + '</div>';
  }

  // Button
  var btn = '';
  if (isAllDone) {
    btn = '<button class="ach-btn ach-btn-claimed" disabled>' + checkSvg + ' ' + T('achAllRanksDone') + '</button>';
  } else if (isReady) {
    var nxtLabel = rankLabels[nextRank - 1];
    btn = '<button class="ach-btn ach-btn-ready rank-ready" data-claim-ach="' + ach.id + '" data-claim-rank="' + nextRank + '">'
      + starSvg + ' ' + T('achNextRank').replace('{label}', nxtLabel).replace('{reward}', rewardVal)
      + '</button>';
  } else {
    // БАГ #15: подсказка, почему ранг IV «Заполненного профиля» ещё заблокирован
    var lockedTitle = (ach.id === 'fill_profile' && nextRank === 4 && currentRank >= 3)
      ? ' title="' + T('achErrBioLink') + '"'
      : '';
    btn = '<button class="ach-btn ach-btn-locked" disabled' + lockedTitle + '>' + lockSvg + ' ' + T('achLocked') + '</button>';
  }

  // Repost form (adv_repost only, visible until all ranks are done)
  var repostFormHtml = '';
  if (ach.id === 'adv_repost' && !isAllDone) {
    repostFormHtml = '<div class="ach-repost-form">'

      /* ── Всегда виден: код верификации ── */
      + '<div class="ach-code-label">' + T('achCodeLabel') + '</div>'
      + '<div class="ach-repost-code" id="achCode-' + sfx + '" title="' + T('achCodeCopied') + '">'
      + '<span id="achCodeVal-' + sfx + '">SPARK-??????</span>'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      + '</div>'

      /* ── Раскрывающаяся инструкция ── */
      + '<button type="button" class="ach-how-toggle" data-ach-how="' + sfx + '">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
      + ' ' + T('achHowTitle')
      + '<svg class="ach-how-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
      + '</button>'

      + '<div class="ach-how-body" id="achHow-' + sfx + '">'
      + '<div class="ach-how-steps">'

      + '<div class="ach-how-step"><div class="ach-how-num">1</div>'
      + '<div class="ach-how-text">' + T('achHowStep1') + '</div></div>'

      + '<div class="ach-how-step"><div class="ach-how-num">2</div>'
      + '<div class="ach-how-text">' + T('achHowStep2Intro') + '<br>'
      + '<span class="ach-how-req">' + T('achHowStep2Link') + '</span>'
      + '<span class="ach-how-req">' + T('achHowStep2Code').replace('{code}', '<strong id="achCodeInline-' + sfx + '">SPARK-??????</strong>') + '</span>'
      + '</div></div>'

      + '<div class="ach-how-step"><div class="ach-how-num">3</div>'
      + '<div class="ach-how-text">' + T('achHowStep3Intro') + '<br>'
      + '<span class="ach-how-example">t.me/channel/<strong>123</strong></span>'
      + '<span class="ach-how-example">vk.ru/wall<strong>800681375_5</strong></span>'
      + '<span class="ach-how-example">vk.com/wall-<strong>12345678_99</strong></span>'
      + '<span class="ach-how-example">x.com/username/status/<strong>123...</strong></span>'
      + '</div></div>'

      + '<div class="ach-how-step"><div class="ach-how-num">4</div>'
      + '<div class="ach-how-text">' + T('achHowStep4') + '</div></div>'

      + '</div>'
      + '</div>'

      /* ── Форма ── */
      + '<div class="ach-repost-row">'
      + '<input type="url" class="ach-repost-input" id="achRepostInput-' + sfx + '" placeholder="' + T('achInputPlaceholder') + '" autocomplete="off" spellcheck="false">'
      + '<button class="ach-repost-check-btn" data-verify-repost="' + sfx + '">' + T('achCheckBtn') + '</button>'
      + '</div>'
      + (ME && ME.created_at && (Date.now() - new Date(ME.created_at).getTime()) < 24 * 60 * 60 * 1000
          ? '<div class="ach-repost-age-notice" id="achRepostAgeNotice-' + sfx + '">'
            + T('repostAccountAge') + ' <span class="ach-age-timer" id="achRepostTimer-' + sfx + '">--:--:--</span>'
            + '</div>'
          : '')
      + '<div class="ach-repost-verdict" id="achRepostVerdict-' + sfx + '"></div>'
      + '</div>';
  }

  return '<div class="ach-card ach-card-' + state + '">'
    + '<div class="ach-card-top">'
    + '<div class="ach-icon">' + ach.icon + '</div>'
    + '<div class="ach-info">'
    + '<div class="ach-title">' + ach.title + badgeHtml + '</div>'
    + '<div class="ach-desc">' + descHtml + '</div>'
    + '</div>'
    + (!isAllDone ? '<div class="ach-reward">+' + rewardVal + '<span class="ach-spk-lbl"> SPK</span></div>' : '')
    + '</div>'
    + trackHtml
    + progressHtml
    + repostFormHtml
    + '<div class="ach-btn-row">' + btn + '</div>'
    + '</div>';
}

async function renderAchievements(sfx) {
  var container = document.getElementById('achList-' + sfx);
  if (!container) return;

  // Всегда пересобираем с актуальным языком
  var ACH_DEFS = getAchDefs();

  if (!supa || !ME) {
    container.innerHTML = '<div class="ach-empty">' + T('achEmpty') + '</div>';
    return;
  }

  var r = await safeSupabaseCall('database', function () {
    return supa.rpc('get_achievements_status');
  }, { silent: true });

  if (!r.ok || !r.data || !r.data.data || !r.data.data.success) {
    container.innerHTML = '<div class="ach-empty">' + T('achEmptyFail') + '</div>';
    return;
  }

  var st       = r.data.data.data;
  var rankData = st.rank_data || null;

  var html = ACH_DEFS.map(function (ach) {
    if (rankData && rankData[ach.id]) {
      return achCardHTML(ach, rankData[ach.id], sfx, { profile_filled: !!st.profile_filled });
    }
    // Graceful fallback для случая когда миграция ещё не применена
    var claimedIds  = Array.isArray(st.claimed_ids) ? st.claimed_ids : [];
    var claimedRank = claimedIds.indexOf(ach.id) !== -1 ? 1 : 0;
    var nxtRank     = claimedRank < 5 ? claimedRank + 1 : null;
    var fakeRd = {
      current_rank:     claimedRank,
      next_rank:        nxtRank,
      next_rank_reward: nxtRank ? ach.ranks[nxtRank - 1].reward : ach.ranks[4].reward,
      progress: {
        bio_length:    0,
        has_username:  !!st.profile_filled,
        avatar_color:  0,
        ideas_count:   st.ideas_count || 0,
        reposts_count: st.has_approved_repost ? 1 : 0,
        threshold:     nxtRank ? (ach.ranks[nxtRank - 1].threshold || null) : null,
      }
    };
    return achCardHTML(ach, fakeRd, sfx, { profile_filled: !!st.profile_filled });
  }).join('');

  container.innerHTML = html;

  // Загружаем HMAC-код верификации с сервера (не может быть вычислен локально)
  if (container.querySelector('#achCode-' + sfx)) {
    loadUserRepostCode(sfx);
  }

  // Запускаем таймер обратного отсчёта возраста аккаунта
  if (ME && ME.created_at && container.querySelector('#achRepostTimer-' + sfx)) {
    startRepostCountdown(sfx, new Date(ME.created_at).getTime() + 24 * 60 * 60 * 1000);
  }
}

var _repostCodeCache = null;    // { uid: string, code: string } | null
var _repostCodeFetching = false; // prevents concurrent HTTP calls

async function loadUserRepostCode(sfx) {
  if (!ME) return;

  function _applyCode(code) {
    ['D', 'M'].forEach(function (s) {
      var sp = document.getElementById('achCodeVal-' + s);
      if (sp) sp.textContent = code;
      var inl = document.getElementById('achCodeInline-' + s);
      if (inl) inl.textContent = code;
    });
  }

  // Serve from cache if we already have the code for this user
  if (_repostCodeCache && _repostCodeCache.uid === ME.id) {
    _applyCode(_repostCodeCache.code);
    return;
  }

  // Another call is already in-flight — skip to avoid duplicate requests
  if (_repostCodeFetching) return;
  _repostCodeFetching = true;

  var r = await callEdgeFunction('verify-repost', { repost_link: '__get_code__' });
  _repostCodeFetching = false;

  if (!r.ok || !r.data || !r.data.code) return;
  var code = r.data.code;
  _repostCodeCache = { uid: ME.id, code: code };
  _applyCode(code);
}

async function doClaimAchievement(achId, rank) {
  if (!supa) return;
  rank = rank || 1;

  // Disable matching button immediately (anti-double-click)
  document.querySelectorAll('[data-claim-ach="' + achId + '"][data-claim-rank="' + rank + '"]').forEach(function (b) {
    b.disabled = true;
    b.textContent = '⏳ ' + T('achClaiming');
  });

  var r = await safeSupabaseCall('database', function () {
    return supa.rpc('claim_achievement_rank', { p_achievement_id: achId, p_rank: rank });
  }, { silent: true });

  var result = r.ok && r.data && r.data.data ? r.data.data : null;

  if (result && result.success) {
    PROFILE.spk_balance = Number(result.new_balance) || PROFILE.spk_balance;
    updateHeader();
    achSparkEffect();
    var rankLabels = ['I', 'II', 'III', 'IV', 'V'];
    var label = rankLabels[(result.rank || rank) - 1] || rank;
    toast(T('achRankUnlocked').replace('{label}', label).replace('{reward}', result.reward), 'var(--ac)');
    renderAchievements('D');
    renderAchievements('M');
  } else {
    var msg  = result && result.message;
    var need = result && result.required ? result.required - (result.current_count || 0) : '?';
    var text = msg === 'already_claimed'              ? T('achErrClaimed')
             : msg === 'previous_rank_required'       ? T('achErrPrevRank')
             : msg === 'condition_not_met_bio'         ? T('achErrBio')
             : msg === 'condition_not_met_username'    ? T('achErrUsername')
             : msg === 'condition_not_met_bio_length'  ? T('achErrBioLength')
             : msg === 'condition_not_met_avatar'      ? T('achErrAvatar')
             : msg === 'condition_not_met_bio_link'    ? T('achErrBioLink')
             : msg === 'condition_not_met_bio_max'     ? T('achErrBioMax')
             : msg === 'condition_not_met_ideas'       ? T('achErrIdeas').replace('{n}', need)
             : msg === 'condition_not_met_repost'      ? T('achErrRepost')
             : T('achErrGeneric');
    toast(text, 'var(--red)');
    renderAchievements('D');
    renderAchievements('M');
  }
}

var _repostTimers = {};

function formatCountdown(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000));
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

function startRepostCountdown(sfx, targetMs) {
  if (_repostTimers[sfx]) clearInterval(_repostTimers[sfx]);
  function tick() {
    var el = document.getElementById('achRepostTimer-' + sfx);
    if (!el) { clearInterval(_repostTimers[sfx]); delete _repostTimers[sfx]; return; }
    var remaining = targetMs - Date.now();
    if (remaining <= 0) {
      clearInterval(_repostTimers[sfx]);
      delete _repostTimers[sfx];
      renderAchievements(sfx);
      return;
    }
    el.textContent = formatCountdown(remaining);
  }
  tick();
  _repostTimers[sfx] = setInterval(tick, 1000);
}

async function doVerifyRepost(sfx) {
  var input   = document.getElementById('achRepostInput-' + sfx);
  var verdict = document.getElementById('achRepostVerdict-' + sfx);
  var btn     = document.querySelector('[data-verify-repost="' + sfx + '"]');
  if (!input || !verdict || !btn) return;

  var link = input.value.trim();
  if (!link) {
    verdict.innerHTML = '<span class="ach-verdict-fail">' + T('repostErrEmpty') + '</span>';
    return;
  }

  // Basic URL check on client side
  try { new URL(link); } catch (_) {
    verdict.innerHTML = '<span class="ach-verdict-fail">' + T('repostErrUrl') + '</span>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="ach-spin"></span> ' + T('achChecking');
  verdict.innerHTML = '';

  var r = await callEdgeFunction('verify-repost', { repost_link: link });

  btn.disabled = false;
  btn.textContent = T('achCheckBtn');

  if (!r.ok) {
    var errMsg = r.status === 429
      ? T('repostErrRate').replace('{n}', (r.data && r.data.wait_seconds) || 300)
      : r.status === 403
      ? T('repostErrAccountAge')
      : T('repostErrServer');
    verdict.innerHTML = '<span class="ach-verdict-fail">' + escapeHTML(errMsg) + '</span>';
    return;
  }

  var data       = r.data || {};
  var isApproved = data.status === 'approved' || data.message === 'already_approved';
  var isPending  = !isApproved && data.status === 'pending';
  var isMaxed    = data.status === 'max_reached';

  // Репост одобрен (свежий или ранее одобренный) — ре-рендерим карточку,
  // затем вставляем вердикт в НОВЫЕ div'ы (старые уничтожены ре-рендером)
  if (isApproved || data.success) {
    await Promise.all([renderAchievements('D'), renderAchievements('M')]);
    var okMsg = '<span class="ach-verdict-ok">' + T('repostOkApproved') + '</span>';
    ['D', 'M'].forEach(function (s) {
      var v = document.getElementById('achRepostVerdict-' + s);
      if (v) v.innerHTML = okMsg;
    });
    return;
  }

  // Достигнут максимум (30 репостов) — ре-рендерим чтобы показать актуальный прогресс
  if (isMaxed) {
    await Promise.all([renderAchievements('D'), renderAchievements('M')]);
    var maxMsg = '<span class="ach-verdict-ok">' + T('repostMaxReached') + '</span>';
    ['D', 'M'].forEach(function (s) {
      var v = document.getElementById('achRepostVerdict-' + s);
      if (v) v.innerHTML = maxMsg;
    });
    return;
  }

  // Страница недоступна для автопроверки — заявка в очереди, не ре-рендерим
  if (isPending) {
    var codeEl = document.getElementById('achCodeVal-' + sfx);
    var code   = codeEl ? codeEl.textContent : '';
    verdict.innerHTML = '<span class="ach-verdict-pending">'
      + escapeHTML(T('repostPending').replace('{code}', code))
      + '</span>';
    return;
  }

  // Rejected — показываем причину от сервера, ре-рендер не нужен
  verdict.innerHTML = '<span class="ach-verdict-fail">✗ ' + escapeHTML(data.reason || T('repostErrServer')) + '</span>';
}

function achSparkEffect() {
  var overlay = document.createElement('div');
  overlay.className = 'ach-spark-overlay';
  var html = '';
  for (var i = 0; i < 18; i++) {
    var angle = (i / 18) * 360;
    var dist  = 60 + Math.random() * 80;
    var size  = 4 + Math.random() * 6;
    var delay = Math.random() * 0.3;
    html += '<div class="ach-spark-particle" style="'
      + '--angle:' + angle + 'deg;--dist:' + dist + 'px;'
      + 'width:' + size + 'px;height:' + size + 'px;'
      + 'animation-delay:' + delay + 's"></div>';
  }
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  setTimeout(function () { overlay.remove(); }, 1200);
}

async function getUserIdeas() {
  if (supa && ME) {
    try {
      var r = await supa.from('ideas')
        .select('id, title, description, min_bet, total_invested, investment_history, investor_ids, expires_at, created_at, author_id, reactions, status')
        .eq('author_id', ME.id)
        .order('created_at', { ascending: false });
      if (r.data && ME) {
        var profilesMap = {};
        profilesMap[ME.id] = PROFILE.username;
        return r.data.map(function(row) {
          return dbRowToLiveIdea(row, profilesMap);
        });
      }
    } catch (e) {
      console.warn('getUserIdeas fetch error, falling back to local filter:', e);
    }
  }
  var userUname = PROFILE.username;
  return LIVE.filter(function (x) {
    return x.u === userUname;
  });
}

async function renderMyIdeas() {
  var list = await getUserIdeas();
  ['D', 'M'].forEach(function (sfx) {
    var el = document.getElementById('myIdeasList-' + sfx);
    if (!el) return;

    if (list.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:24px 0;color:var(--mu);font-size:13px">' + T('noMyIdeas') + '</div>';
      return;
    }

    /* Single-card carousel: show one idea, swipe right→left to advance.
       Dots + hint appear only when there is more than one idea. */
    var slides = list.map(function (x) {
      return '<div class="mi-slide">' + cardHTML(x, true) + '</div>';
    }).join('');

    // Устанавливаем обработчик кликов для карточек в "Мои идеи"
    el.onclick = function (event) {
      var authorDelBtn = event.target.closest('.author-del-btn[data-author-del-id]');
      if (authorDelBtn) {
        event.stopPropagation();
        openAuthorDeleteModal(authorDelBtn.dataset.authorDelId);
        return;
      }
      var authorRestoreBtn = event.target.closest('.author-restore-btn[data-author-restore-id]');
      if (authorRestoreBtn) {
        event.stopPropagation();
        openAuthorRestoreModal(authorRestoreBtn.dataset.authorRestoreId);
        return;
      }
      var cmenBtn = event.target.closest('.cmen[data-idea-id]');
      if (cmenBtn) {
        event.stopPropagation();
        openCmenDropdown(cmenBtn);
        return;
      }
    };

    var multi = list.length > 1;
    var dots = '';
    var hint = '';
    if (multi) {
      dots = '<div class="mi-dots" role="tablist">'
        + list.map(function (_, i) {
            return '<button type="button" class="mi-dot' + (i === 0 ? ' active' : '')
              + '" data-mi-dot="' + i + '" aria-label="' + (i + 1) + ' / ' + list.length + '"></button>';
          }).join('')
        + '</div>';
      hint = '<div class="mi-hint">'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
        + '<span>' + T('myIdeasSwipe') + '</span>'
        + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'
        + '</div>';
    }

    el.innerHTML = '<div class="mi-carousel' + (multi ? ' mi-multi' : '') + '" data-mi-idx="0" data-mi-count="' + list.length + '">'
      + '<div class="mi-viewport"><div class="mi-track">' + slides + '</div></div>'
      + dots
      + hint
      + '</div>';

    initMyIdeasCarousel(el.querySelector('.mi-carousel'));
  });

  // Animate SVG graphs for user ideas using IntersectionObserver
  ['D', 'M'].forEach(function (sfx) {
    var el = document.getElementById('myIdeasList-' + sfx);
    if (el) animateAllGraphs(el);
  });
}

/* ── My Ideas carousel: swipe + dots navigation ─────────────────────────── */
function initMyIdeasCarousel(root) {
  if (!root) return;
  var track = root.querySelector('.mi-track');
  var count = parseInt(root.dataset.miCount, 10) || 1;
  if (!track || count <= 1) return;

  var idx       = 0;
  var dragging  = false;
  var startX    = 0;
  var startY    = 0;
  var deltaX    = 0;
  var width     = 0;
  var moved     = false;          // became a real horizontal drag
  var lockedDir = null;           // 'x' | 'y' | null

  function setTransition(on) {
    track.style.transition = on ? 'transform .42s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
  }
  function snap() {
    setTransition(true);
    track.style.transform = 'translateX(' + (-idx * 100) + '%)';
    root.dataset.miIdx = idx;
    root.querySelectorAll('.mi-dot').forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
    // (re)draw any graphs that just became visible
    if (typeof animateAllGraphs === 'function') animateAllGraphs(root);
  }
  function go(to) {
    idx = Math.max(0, Math.min(count - 1, to));
    snap();
  }

  /* Dot navigation */
  root.querySelectorAll('.mi-dot').forEach(function (dot) {
    dot.addEventListener('click', function () {
      triggerVibration(8);
      go(parseInt(dot.dataset.miDot, 10) || 0);
    });
  });

  /* Pointer-based swipe (covers touch + mouse on modern browsers) */
  var vp = root.querySelector('.mi-viewport');
  if (!vp) return;

  var usePointer = !!window.PointerEvent;

  function bindDragListeners() {
    if (usePointer) {
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    } else {
      window.addEventListener('touchmove', onMoveTouch, { passive: false });
      window.addEventListener('touchend', onUp);
      window.addEventListener('touchcancel', onUp);
    }
  }
  function unbindDragListeners() {
    if (usePointer) {
      window.removeEventListener('pointermove', onMove, { passive: false });
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    } else {
      window.removeEventListener('touchmove', onMoveTouch, { passive: false });
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    }
  }

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // ignore non-primary mouse
    dragging  = true;
    moved     = false;
    lockedDir = null;
    startX    = e.clientX;
    startY    = e.clientY;
    deltaX    = 0;
    width     = vp.clientWidth || 1;
    setTransition(false);
    bindDragListeners();
  }
  function onMove(e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (lockedDir === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedDir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (lockedDir === 'y') { dragging = false; unbindDragListeners(); return; } // let vertical scroll happen
    if (e.cancelable) e.preventDefault();
    moved  = true;
    var atStart = idx === 0 && dx > 0;
    var atEnd   = idx === count - 1 && dx < 0;
    deltaX = (atStart || atEnd) ? dx * 0.32 : dx;          // rubber-band at the ends
    var pct = (-idx * width + deltaX) / width * 100;
    track.style.transform = 'translateX(' + pct + '%)';
  }
  function onMoveTouch(e) { if (e.touches[0]) onMove(e.touches[0]); }
  function onUp() {
    unbindDragListeners();
    if (!dragging) return;
    dragging = false;
    var threshold = Math.min(width * 0.22, 90);
    if (deltaX <= -threshold && idx < count - 1)      idx++;
    else if (deltaX >= threshold && idx > 0)          idx--;
    snap();
    if (moved) suppressNextClick();
  }
  /* Prevent the click that ends a drag from triggering card actions */
  function suppressNextClick() {
    var blocker = function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      vp.removeEventListener('click', blocker, true);
    };
    vp.addEventListener('click', blocker, true);
    setTimeout(function () { vp.removeEventListener('click', blocker, true); }, 350);
  }

  if (usePointer) {
    vp.addEventListener('pointerdown', onDown);
  } else {
    vp.addEventListener('touchstart', function (e) { if (e.touches[0]) onDown(e.touches[0]); }, { passive: true });
  }
}

function toggleDeskProf() {
  var o = document.getElementById('dpOverlay');
  var b = document.getElementById('btnProfDesk');
  if (o) {
    var opening = !o.classList.contains('open');
    o.classList.toggle('open');
    if (opening) {
      window.history.pushState({ type: 'modal', id: 'dpOverlay' }, '');
    }
  }
  if (b) b.classList.toggle('active', o && o.classList.contains('open'));
}

function bgCloseDesk(e) {
  if (e.target === document.getElementById('dpOverlay')) {
    var o = document.getElementById('dpOverlay');
    var b = document.getElementById('btnProfDesk');
    if (o) o.classList.remove('open');
    if (b) b.classList.remove('active');
  }
}

var GW = 400, GH = 68, GPX = 8, GPY = 8;

function synthesiseHistory(investors) {
  var total = investors * 10;
  if (total === 0) return [0, 0];
  var weights = [0, 0.02, 0.06, 0.14, 0.28, 0.48, 0.72, 1.0];
  return weights.map(function (w) { return Math.round(w * total); });
}

function buildGraphPath(history) {
  var safe = history.reduce(function (acc, v, i) {
    acc.push(i === 0 ? v : Math.max(v, acc[i - 1]));
    return acc;
  }, []);
  var minV = safe[0];
  var maxV = safe[safe.length - 1];
  var range = (maxV - minV) || 1;
  var drawW = GW - GPX * 2;
  var drawH = GH - GPY * 2;
  var n = safe.length;
  var pts = safe.map(function (v, i) {
    return { x: GPX + (i / (n - 1 || 1)) * drawW, y: GPY + drawH - ((v - minV) / range) * drawH };
  });
  if (maxV === minV) pts = pts.map(function (p) { return { x: p.x, y: GPY + drawH }; });
  var d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
  return { d: d, lastPt: pts[pts.length - 1] };
}

function investGraphHTML(x) {
  var history = x.investment_history || synthesiseHistory(x.investors, x.pct);
  var histJSON = JSON.stringify(history).replace(/"/g, '&quot;');
  var expired = isExpired(x);
  var cdText = expired 
    ? ('&#8987; ' + (LANG === 'ru' ? 'Завершено' : 'Ended'))
    : ('&#8987; ' + x.cd + 'h ' + T('cleft'));
  return '<div class="igraph-wrap">'
    + '<div class="igraph-header"><span>' + T('iot') + '</span><span class="igraph-label-right">&#8593; +' + x.pct + '%</span></div>'
    + '<svg class="igsvg" viewBox="0 0 ' + GW + ' ' + GH + '" preserveAspectRatio="none" data-history="' + histJSON + '"></svg>'
    + '<div class="igraph-footer"><div class="ig-investors">'
    + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    + '<span>' + x.investors + '</span>&nbsp;' + T('cinv') + ' &middot; <span class="ig-pool">' + x.pool + ' SPK</span>&nbsp;' + T('cpool')
    + '</div><div class="ig-cd">' + cdText + '</div></div></div>';
}

function drawInvestmentGraph(svgEl, history, dur) {
  if (!svgEl) return;
  dur = dur || 1.6;
  history = (history && history.length >= 2) ? history : [0, 0];
  var gid = 'g' + (Math.random().toString(36).slice(2));
  svgEl.dataset.gid = gid;
  var gp = buildGraphPath(history);
  var NS = 'http://www.w3.org/2000/svg';
  svgEl.innerHTML = '';
  var defs = document.createElementNS(NS, 'defs');
  var graphColor = (window.ThemeEngine ? ThemeEngine.getGraphColor() : null)
    || getComputedStyle(document.documentElement).getPropertyValue('--graph-line').trim()
    || '#e8c55a';
  defs.innerHTML = '<linearGradient id="igf-' + gid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="var(--graph-line, var(--ac))" stop-opacity="0.22"/>'
    + '<stop offset="100%" stop-color="var(--graph-line, var(--ac))" stop-opacity="0"/>'
    + '</linearGradient>';
  svgEl.appendChild(defs);
  var fill = document.createElementNS(NS, 'path');
  fill.setAttribute('d', gp.d + ' L' + (GW - GPX) + ',' + GH + ' L' + GPX + ',' + GH + ' Z');
  fill.setAttribute('fill', 'url(#igf-' + gid + ')');
  fill.classList.add('ig-fill');
  svgEl.appendChild(fill);
  var line = document.createElementNS(NS, 'path');
  line.setAttribute('d', gp.d);
  line.classList.add('ig-line');
  svgEl.appendChild(line);
  var dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', gp.lastPt.x.toFixed(1));
  dot.setAttribute('cy', gp.lastPt.y.toFixed(1));
  dot.setAttribute('r', '3.5');
  dot.classList.add('ig-dot');
  requestAnimationFrame(function () {
    var len = line.getTotalLength() || 300;
    line.style.setProperty('--ig-len', String(len));
    line.style.setProperty('--ig-dur', dur + 's');
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    requestAnimationFrame(function () {
      line.classList.add('animated');
      setTimeout(function () {
        svgEl.appendChild(dot);
        requestAnimationFrame(function () {
          dot.classList.add('show');
        });
      }, dur * 1000);
    });
  });
}

// Cache the graph IntersectionObserver to avoid creating a new instance per render
var _graphObserver = null;

function animateAllGraphs(container) {
  if (!container) return;
  var svgs = container.querySelectorAll('svg.igsvg[data-history]');
  if (!('IntersectionObserver' in window)) {
    svgs.forEach(function (svg) { try { drawInvestmentGraph(svg, JSON.parse(svg.dataset.history)); } catch (e) {} });
    return;
  }
  if (!_graphObserver) {
    // БАГ #9: rootMargin 500px — графики отрисовываются ЗАРАНЕЕ, за пол-экрана
    // до появления карточки, поэтому колёсико мыши больше не ловит рывки
    // от innerHTML + getTotalLength() прямо в момент скролла.
    _graphObserver = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var svg = entry.target;
          o.unobserve(svg);
          requestAnimationFrame(function () {
            try { drawInvestmentGraph(svg, JSON.parse(svg.dataset.history)); } catch (e) { drawInvestmentGraph(svg, [0, 0]); }
          });
        }
      });
    }, { threshold: 0, rootMargin: '500px 0px 500px 0px' });
  }
  svgs.forEach(function (svg) { _graphObserver.observe(svg); });
}

var page = 1, sort = 'new', ftag = 'all', q = '';
var PER = 5;

// ── Платные контакты ───────────────────────────────────────
var IDEA_CONTACT_COST = 30;   // SPK за открытие контакта с карточки идеи
var DIRECT_CHAT_COST  = 100;  // SPK за прямой поиск через "+"
window.UNLOCKED_CONTACT_IDS = new Set();  // UUID разблокированных контактов

function isExpired(x) {
  if (!x.expires_at) return false;
  return new Date(x.expires_at).getTime() < Date.now();
}

function filtered() {
  var a = LIVE.slice();
  a = a.filter(function (x) { return !isExpired(x); });
  a = a.filter(function (x) { return x.status !== 'hidden' && x.status !== 'banned'; });
  if (ftag !== 'all') a = a.filter(function (x) { return x.tag === ftag; });
  if (q) a = a.filter(function (x) {
    return x.title.toLowerCase().includes(q) || x.body.toLowerCase().includes(q) || x.tag.toLowerCase().includes(q) || x.u.toLowerCase().includes(q);
  });
  if (sort === 'popular') a.sort(function (a1, b1) { return b1.investors - a1.investors; });
  if (sort === 'profit') a.sort(function (a2, b2) { return b2.pct - a2.pct; });
  // Safe parseInt: '—' or empty string returns Infinity (shown last in ending-soon)
  if (sort === 'ending') a.sort(function (a3, b3) {
    var va = parseInt(a3.cd, 10); var vb = parseInt(b3.cd, 10);
    va = Number.isFinite(va) ? va : Infinity;
    vb = Number.isFinite(vb) ? vb : Infinity;
    return va - vb;
  });
  return a;
}

function reactHTML(id) {
  var rs = getRS(id);
  var html = '';
  EMOJIS.forEach(function (e) {
    var cnt = rs.counts[e] || 0;
    if (cnt > 0) {
      var on = rs.pick === e ? 'on' : '';
      html += '<button class="rbbl ' + on + '" data-id="' + id + '" data-e="' + e + '"><span class="rem">' + e + '</span><span class="rct">' + cnt + '</span></button>';
    }
  });
  html += '<button class="rbbl react-add-btn" data-id="' + id + '" title="Add reaction"><span class="rem">➕</span></button>';
  return html;
}

// Строит кнопку «Связаться/Открыть чат/Моя идея» для карточки идеи
function _contactBtnHTML(x) {
  var aid = x.author_id;
  if (!aid) {
    return '<button class="bcontact" disabled style="opacity:0.35;cursor:default">' + T('contactAuthor') + '</button>';
  }
  if (window.ME && aid === window.ME.id) {
    return '<button class="bcontact" disabled style="opacity:0.35;cursor:default">' + T('myIdea') + '</button>';
  }
  if (window.UNLOCKED_CONTACT_IDS && window.UNLOCKED_CONTACT_IDS.has(aid)) {
    return '<button class="bcontact bcontact--open" data-open-chat-id="' + aid + '">' + T('openChat') + '</button>';
  }
  var label = T('contactAuthorCost').replace('{cost}', IDEA_CONTACT_COST);
  return '<button class="bcontact" data-contact-author-id="' + aid + '" data-contact-author-name="' + escapeHTML(x.u) + '">' + label + '</button>';
}

function cardHTML(x, isProfile) {
  var fire = (getRS(x.id).counts['🔥'] || 0) >= FIRE_T;
  var safeUser = escapeHTML(x.u);
  var safeTag = escapeHTML(x.tag);
  var safeTitle = escapeHTML(x.title);
  var safeBody = escapeHTML(x.body);
  var safeTime = escapeHTML(x.tm);
  var safeBg = sanitizeCssBackground(x.bg);
  var safeAv = safeAvatar(x.av);
  var expired = isExpired(x);
  var triggerId = x.author_id || (x.u === '@future_founder' ? 1 : '');
  var triggerAttr = triggerId ? ' class="cav mp-trigger" data-user-id="' + triggerId + '"' : ' class="cav"';
  var nameTriggerAttr = triggerId ? ' class="cu mp-trigger" data-user-id="' + triggerId + '"' : ' class="cu"';
  var isImmune = x.status === 'immune';
  var wasReported = MY_REPORTED_IDEAS.indexOf(x.id) !== -1;
  var cmenClass = 'cmen' + (wasReported ? ' cmen--reported' : '');
  var cmenTitle = wasReported ? (LANG === 'ru' ? 'Вы пожаловались на этот пост' : 'You reported this post') : '';
  var isAuthorAdmin = window.ADMIN_USER_IDS && ADMIN_USER_IDS.has(x.author_id);
  var authorAdminBadge = isAuthorAdmin ? ' <span class="admin-badge">CORE TEAM</span>' : '';
  var adminDeleteBtn = (PROFILE.is_admin && ME && x.author_id && x.author_id !== ME.id)
    ? '<button class="admin-del-btn" data-admin-del-id="' + x.id + '" title="Удалить (admin)">'
      + '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'
      + '</button>'
    : '';
  
  // Для профиля автора: кнопка удаления/восстановления + надпись "В ленте"
  var profileActions = '';
  if (isProfile && ME && x.author_id && x.author_id === ME.id) {
    if (x.status === 'hidden') {
      // Кнопка восстановления
      profileActions = '<button class="author-restore-btn" data-author-restore-id="' + x.id + '" title="Восстановить идею">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>'
        + '</button>';
    } else if (x.status === 'active') {
      // Кнопка удаления + надпись "В ленте"
      profileActions = '<button class="author-del-btn" data-author-del-id="' + x.id + '" title="Удалить идею">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
        + '</button>'
        + '<span class="in-feed-badge">В ленте</span>';
    }
  } else if (ME && x.author_id && x.author_id === ME.id && !isProfile) {
    // Для общей ленты: только кнопка удаления
    profileActions = '<button class="author-del-btn" data-author-del-id="' + x.id + '" title="Удалить идею">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
      + '</button>';
  }
  
  return '<div class="card' + (fire ? ' fire' : '') + '" data-cid="' + x.id + '">'
    + '<div class="ch"><div' + triggerAttr + ' style="background:' + safeBg + '">' + safeAv + '</div>'
    + '<div class="cm"><div' + nameTriggerAttr + '>' + safeUser + authorAdminBadge + '</div><div class="ct">' + safeTime + ' · #' + safeTag + '</div></div>'
    + adminDeleteBtn
    + profileActions
    + '<div class="' + cmenClass + '" data-idea-id="' + x.id + '" data-immune="' + (isImmune ? '1' : '0') + '"' + (cmenTitle ? ' title="' + cmenTitle + '"' : '') + '><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></div></div>'
    + '<div class="ctitle">' + safeTitle + '</div><div class="cbody">' + safeBody + '</div>'
    + investGraphHTML(x)
    // БАГ #8: автор не может инвестировать в свою идею — disabled-кнопка «Моя идея»
    + '<div class="cact">'
    + (window.ME && x.author_id && x.author_id === ME.id
        ? '<button class="binv" disabled style="opacity:0.35;cursor:default">' + T('myIdea') + '</button>'
        : '<button class="binv" data-invest-id="' + x.id + '">' + T('binv') + '</button>')
    + _contactBtnHTML(x) + '<button class="bshare" data-share-id="' + x.id + '" title="' + T('shareIdea') + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button></div>'
    + '<div class="creact" id="rc-' + x.id + '">' + reactHTML(x.id) + '</div></div>';
}

function renderFeed() {
  var list = filtered();
  var tp = Math.max(1, Math.ceil(list.length / PER));
  if (page > tp) page = tp;
  var sl = list.slice((page - 1) * PER, page * PER);
  var cl = document.getElementById('cardsList');
  if (!cl) return;
  cl.innerHTML = sl.length ? sl.map(cardHTML).join('') : '<div style="text-align:center;padding:48px 0;color:var(--mu);font-size:13px">' + T('noResults') + '</div>';
  renderPgn(tp);
  // Observatory only needs update after full data load, not on every render
  var f = document.querySelector('.feed');
  if (f) f.scrollTop = 0;
  // Defer graph animation to avoid blocking render
  setTimeout(function () { animateAllGraphs(cl); }, 80);
}

function renderPgn(tp) {
  var pg = document.getElementById('pgn');
  if (!pg) return;
  if (tp <= 1) { pg.innerHTML = ''; return; }
  function mkbtn(lbl, p, dis, act) {
    return '<button class="pbtn' + (act ? ' active' : '') + '" data-p="' + p + '" ' + (dis ? 'disabled' : '') + '>' + lbl + '</button>';
  }
  var ps = [];
  if (tp <= 5) { for (var i = 1; i <= tp; i++) ps.push(i); } else {
    var l = Math.max(1, page - 1), r = Math.min(tp, page + 1);
    if (l > 2) ps.push('…l');
    for (var p2 = l; p2 <= r; p2++) ps.push(p2);
    if (r < tp - 1) ps.push('…r');
  }
  var h = mkbtn('«', 1, page === 1, false) + mkbtn('‹', page - 1, page === 1, false);
  if (!ps.includes(1)) { h += mkbtn('1', 1, false, false); if (ps[0] !== '…l') h += '<span class="psep">…</span>'; }
  ps.forEach(function (p) {
    if (p === '…l' || p === '…r') h += '<span class="psep">…</span>';
    else h += mkbtn(p, p, false, p === page);
  });
  if (!ps.includes(tp)) { if (ps[ps.length - 1] !== '…r') h += '<span class="psep">…</span>'; h += mkbtn(tp, tp, false, false); }
  h += mkbtn('›', page + 1, page === tp, false) + mkbtn('»', tp, page === tp, false);
  pg.innerHTML = h;
  pg.querySelectorAll('.pbtn:not([disabled])').forEach(function (b) {
    b.addEventListener('click', function () { page = parseInt(b.dataset.p, 10); renderFeed(); });
  });
}

// Latched true on first PGRST202 — switches all subsequent react() calls to legacy path
var _reactRpcMissing = false;
// Set of ideaIds with an async RPC in flight — prevents double-click race
var _reactInflight = new Set();

function _isRpcMissingError(err) {
  if (!err) return false;
  var code = String(err.code || '');
  var msg = String(err.message || '') + String(err.hint || '');
  return code === 'PGRST202' ||
    msg.indexOf('react_to_idea') !== -1 ||
    msg.indexOf('Could not find the function') !== -1;
}

function _renderReactContainer(ideaId) {
  var container = document.getElementById('rc-' + ideaId);
  if (!container) return;
  var oldPos = {};
  container.querySelectorAll('.rbbl').forEach(function (b) { oldPos[b.dataset.e] = b.getBoundingClientRect().left; });
  container.innerHTML = reactHTML(ideaId);
  container.querySelectorAll('.rbbl').forEach(function (b2) {
    var e = b2.dataset.e;
    if (oldPos[e] === undefined) return;
    var dx = oldPos[e] - b2.getBoundingClientRect().left;
    if (Math.abs(dx) < 2) return;
    b2.style.transition = 'none';
    b2.style.transform = 'translateX(' + dx + 'px)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        b2.style.transition = 'transform .32s cubic-bezier(.34,1.56,.64,1)';
        b2.style.transform = 'translateX(0)';
      });
    });
  });
  var rsLocal = getRS(ideaId);
  var card = document.querySelector('.card[data-cid="' + ideaId + '"]');
  if (card) card.classList.toggle('fire', (rsLocal.counts['🔥'] || 0) >= FIRE_T);
}

function react(ideaId, emoji, btn) {
  // Block concurrent async operations on the same idea (double-click guard)
  if (_reactInflight.has(ideaId)) return;

  var rs = getRS(ideaId);
  var prev = rs.pick;

  // Snapshot for optimistic-rollback
  var snapCounts = Object.assign({}, rs.counts);
  var snapPick = prev;

  // Which emojis to decrement / increment in DB
  var toDecrement = (prev === emoji) ? emoji : prev;   // null when no previous pick
  var toIncrement = (prev === emoji) ? null : emoji;   // null when toggling off

  // --- Optimistic update ---
  if (prev === emoji) {
    rs.counts[emoji] = Math.max(0, (rs.counts[emoji] || 0) - 1);
    rs.pick = null;
    try { localStorage.removeItem('spark_pick_' + ideaId); } catch (e) {}
  } else {
    if (prev) rs.counts[prev] = Math.max(0, (rs.counts[prev] || 0) - 1);
    rs.counts[emoji] = (rs.counts[emoji] || 0) + 1;
    rs.pick = emoji;
    try { localStorage.setItem('spark_pick_' + ideaId, emoji); } catch (e) {}
  }

  _renderReactContainer(ideaId);
  // btn is now detached (innerHTML was replaced) — find the freshly rendered button for the pop animation
  var rc = document.getElementById('rc-' + ideaId);
  if (rc) {
    var popBtn = rc.querySelector('.rbbl[data-e="' + emoji + '"]');
    if (popBtn) {
      popBtn.classList.add('pop');
      setTimeout(function () { popBtn.classList.remove('pop'); }, 300);
    }
  }

  // --- Atomic DB sync via unified toggle_reaction RPC (web ↔ Android) ---
  if (supa && ME) {
    (async function () {
      _reactInflight.add(ideaId);
      try {
        var rr = await safeSupabaseCall('database', function () {
          return supa.rpc('toggle_reaction', { p_idea_id: ideaId, p_emoji: emoji });
        }, { silent: true });

        if (rr.ok && rr.data && rr.data.data) {
          var result = rr.data.data;
          // Reconcile with authoritative server state (reactions counts + canonical pick)
          if (result.reactions && typeof result.reactions === 'object') {
            EMOJIS.forEach(function (e) {
              if (result.reactions[e] !== undefined) {
                rs.counts[e] = Math.max(0, Number(result.reactions[e]) || 0);
              }
            });
          }
          rs.pick = result.pick || null;
          try {
            if (rs.pick) localStorage.setItem('spark_pick_' + ideaId, rs.pick);
            else localStorage.removeItem('spark_pick_' + ideaId);
          } catch (e) {}
          _renderReactContainer(ideaId);
        } else if (!rr.ok) {
          // Rollback optimistic state on RPC failure
          rs.counts = snapCounts;
          rs.pick = snapPick;
          try {
            if (snapPick) localStorage.setItem('spark_pick_' + ideaId, snapPick);
            else localStorage.removeItem('spark_pick_' + ideaId);
          } catch (e) {}
          _renderReactContainer(ideaId);
          if (typeof toast === 'function') toast('Reaction failed — please try again.', 'var(--red)');
        }
      } finally {
        _reactInflight.delete(ideaId);
      }
    })();
  }
}

var CUR_IDEA = null;
var realtimeIdeasChannel = null;
var realtimeBalanceChannel = null;
var usingLegacyInvestFallback = false;
var investFallbackNoticeShown = false;

function openInvest(id) {
  // id is a UUID string; find matching idea by string comparison
  var idea = LIVE.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!idea) return;
  // БАГ #8: фронтовая защита от инвестиции в собственную идею (бэкенд дублирует — P0003)
  if (window.ME && idea.author_id && idea.author_id === ME.id) {
    toast('❌ ' + T('myIdea'), 'var(--red)');
    return;
  }
  CUR_IDEA = idea;
  var min = idea.minBet || 10;
  var maxAllowed = Math.max(min, PROFILE.spk_balance);
  var invTitle = document.getElementById('invTitle');
  if (invTitle) {
    var titlePrefix = LANG === 'ru' ? 'Инвестировать в "' : 'Invest in "';
    invTitle.textContent = titlePrefix + String(idea.title || '').slice(0, 28) + '…" 🚀';
  }
  var invBal = document.getElementById('invBal');
  if (invBal) invBal.textContent = PROFILE.spk_balance.toLocaleString() + ' SPK';
  var aEl = document.getElementById('invAmt'), sEl = document.getElementById('invSl');
  if (aEl) { aEl.min = String(min); aEl.max = String(maxAllowed); aEl.value = String(min); }
  if (sEl) { sEl.min = String(min); sEl.max = String(maxAllowed); sEl.value = String(min); }
  var presets = [min, 50, 100, 250, 500, 1000];
  var presetsEl = document.getElementById('invPresets');
  if (presetsEl) {
    presetsEl.innerHTML = presets.map(function (v) {
      var dis = v < min && v !== min;
      return '<button class="prs-btn' + (v === min ? ' on' : '') + '" data-set-amt="' + v + '" ' + (dis ? 'disabled' : '') + '>' + (v === min ? 'Min(' + v + ')' : v) + '</button>';
    }).join('');
  }
  syncInv();
  openMo('moInvest');
  attachHold('btnInv', 2000, doInvest);
  if (aEl) aEl.oninput = function () { if (sEl) sEl.value = aEl.value; syncInv(); };
  if (sEl) sEl.oninput = function () { if (aEl) aEl.value = sEl.value; syncInv(); };
}

function setAmt(v) {
  var aEl = document.getElementById('invAmt');
  var sEl = document.getElementById('invSl');
  if (!CUR_IDEA) return;
  var min = CUR_IDEA.minBet || 10;
  var max = Math.max(min, PROFILE.spk_balance);
  var clamped = clampAmount(v, min, max);
  if (aEl) aEl.value = String(clamped);
  if (sEl) sEl.value = String(clamped);
  syncInv();
  document.querySelectorAll('.prs-btn').forEach(function (b) { b.classList.remove('on'); });
  var m = [].slice.call(document.querySelectorAll('.prs-btn')).find(function (b2) {
    return b2.textContent === String(clamped) || b2.textContent === 'Min(' + clamped + ')';
  });
  if (m) m.classList.add('on');
}

function syncInv() {
  if (!CUR_IDEA) return;
  var aEl = document.getElementById('invAmt');
  var min = CUR_IDEA.minBet || 10;
  var max = Math.max(min, PROFILE.spk_balance);
  var amt = aEl ? clampAmount(aEl.value, min, max) : min;
  if (aEl) aEl.value = String(amt);
  var sEl = document.getElementById('invSl');
  if (sEl) sEl.value = String(amt);
  var btn = document.getElementById('btnInv');
  var warn = document.getElementById('invWarn');
  if (amt < min) { if (warn) warn.textContent = 'Min bet: ' + min + ' SPK'; if (btn) btn.disabled = true; }
  else if (amt > PROFILE.spk_balance) { if (warn) warn.textContent = 'Insufficient balance'; if (btn) btn.disabled = true; }
  else { if (warn) warn.textContent = ''; if (btn) btn.disabled = false; }
}

async function doInvest() {
  var btn = document.getElementById('btnInv');
  if (btn) btn.disabled = true;
  var aEl = document.getElementById('invAmt');
  var min = CUR_IDEA ? (CUR_IDEA.minBet || 10) : 10;
  var amt = aEl ? clampAmount(aEl.value, min, Math.max(min, PROFILE.spk_balance)) : 0;
  if (!CUR_IDEA || amt < (CUR_IDEA.minBet || 10)) {
    if (btn) btn.disabled = false;
    return;
  }
  if (amt > PROFILE.spk_balance) {
    toast('❌ ' + T('insufficientBalance'), 'var(--red)');
    if (btn) btn.disabled = false;
    return;
  }
  try {
    if (supa && ME) {
      var rpcId = String(CUR_IDEA.id).length < 20 ? '00000000-0000-0000-0000-000000000000' : CUR_IDEA.id;
      var res = await safeSupabaseCall('invest', function () {
        return supa.rpc('invest_in_idea', {
          p_idea_id: rpcId,
          p_amount: amt
        });
      }, { timeout: 25000 });
      
      if (!res.ok) throw res.error;
      var rpc = res.data;
      if (rpc && rpc.error) {
          var rpcMsg = String(rpc.error.message || '').toLowerCase();
          var rpcMissing = rpcMsg.includes('function') && rpcMsg.includes('invest_in_idea');
          if (ALLOW_LEGACY_INVEST_FALLBACK && rpcMissing) {
            usingLegacyInvestFallback = true;
            if (!investFallbackNoticeShown) {
              investFallbackNoticeShown = true;
              toast('⚠️ ' + T('legacyInvestMode'), 'var(--ac2)');
            }
            var currentBalance = Number(PROFILE.spk_balance || 0);
            var nextBalance = currentBalance - amt;
            if (nextBalance < 0) throw new Error('insufficient_balance');
            var upd = await supa.from('profiles').update({ spk_balance: nextBalance }).eq('id', ME.id);
            if (upd.error) throw upd.error;
            PROFILE.spk_balance = nextBalance;
          } else {
            throw rpc.error;
          }
        }
        var payload = rpc.data;
        var newBalance = null;
        if (!usingLegacyInvestFallback && Array.isArray(payload) && payload[0] && Number.isFinite(Number(payload[0].new_balance))) {
          newBalance = Number(payload[0].new_balance);
        } else if (!usingLegacyInvestFallback && payload && Number.isFinite(Number(payload.new_balance))) {
          newBalance = Number(payload.new_balance);
        }
        if (newBalance === null) {
          await fetchProfile();
        } else {
          PROFILE.spk_balance = newBalance;
        }
        updateHeader();
    } else {
      PROFILE.spk_balance -= amt;
      updateHeader();
    }
    closeMo('moInvest');
    toast('✅ Invested ' + amt + ' SPK!', 'var(--ac)');
    // Update the local idea object with new totals from DB response
    if (CUR_IDEA) {
      var ideaIdx = LIVE.findIndex(function(x) { return x.id === CUR_IDEA.id; });
      if (ideaIdx !== -1) {
        var payload2 = rpc && rpc.data;
        if (Array.isArray(payload2) && payload2[0]) {
          if (payload2[0].new_total !== undefined) LIVE[ideaIdx].pool = String(payload2[0].new_total);
          if (Array.isArray(payload2[0].new_history) && payload2[0].new_history.length > 0) {
            LIVE[ideaIdx].investment_history = payload2[0].new_history;
            // БАГ #7: счётчик — уникальные инвесторы из RPC, не число транзакций
            LIVE[ideaIdx].investors = Number.isFinite(Number(payload2[0].new_investor_count)) && Number(payload2[0].new_investor_count) > 0
              ? Number(payload2[0].new_investor_count)
              : payload2[0].new_history.length;
          }
          // Recalculate pct
          var newPool = Number(LIVE[ideaIdx].pool) || 0;
          var minBet2 = LIVE[ideaIdx].minBet || 10;
          LIVE[ideaIdx].pct = newPool > 0 ? Math.min(Math.round((newPool / Math.max(minBet2 * 5, 1)) * 100), 999) : 0;
        }
      }
    }
    // Update investments_count locally
    PROFILE.investments_count = (PROFILE.investments_count || 0) + 1;
    renderFeed();
    renderTrends();
    renderProfile();
    renderLeaders(); // БАГ #14: после транзакции лидерборд перечитывается из БД
  } catch (e) {
    reportClientError('invest_failed', {
      message: e && e.message ? e.message : String(e),
      amount: amt,
      ideaId: CUR_IDEA ? CUR_IDEA.id : null
    });
    console.warn(e);
    var msg = String((e && e.message) || '').toLowerCase();
    if (msg.includes('insufficient_balance')) toast('❌ ' + T('insufficientBalance'), 'var(--red)');
    else if (msg.includes('amount_below_min_bet')) toast('❌ ' + T('amountBelowMinBet'), 'var(--red)');
    else if (msg.includes('idea_not_found')) toast('❌ ' + T('ideaNotFound'), 'var(--red)');
    else if (msg.includes('auth_required')) toast('❌ ' + T('signInRequired'), 'var(--red)');
    else toast('❌ ' + T('secureInvestFailed'), 'var(--red)');
  } finally {
    if (btn) btn.disabled = false;
  }
}

var selDur = '24h';

function openCreate() {
  ['ciTitle', 'ciDesc', 'ciTarget'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var ciMin = document.getElementById('ciMin');
  if (ciMin) ciMin.value = '10';
  selDur = '24h';
  document.querySelectorAll('.dur-btn:not(.locked)').forEach(function (b) {
    b.classList.toggle('sel', b.dataset.dur === '24h');
  });
  openMo('moCreate');
  attachHold('btnPub', 2000, doPublish);
}

async function doPublish() {
  var ciTitle = document.getElementById('ciTitle');
  var ciDesc = document.getElementById('ciDesc');
  var ciMin = document.getElementById('ciMin');
  var ciTarget = document.getElementById('ciTarget');
  if (!ciTitle) return;
  var title = ciTitle.value.trim();
  var desc = ciDesc ? ciDesc.value.trim() : '';
  
  // Валидация Min. bet (SPK) - проверяем исходное значение ДО clampAmount
  var minVal = ciMin ? parseFloat(ciMin.value) : 10;
  if (!minVal || minVal <= 0 || !Number.isFinite(minVal)) {
    toast('❌ Min. bet must be greater than 0', 'var(--red)');
    if (ciMin) ciMin.focus();
    return;
  }
  
  var min = ciMin ? clampAmount(ciMin.value, 1, 1000000) : 10;
  if (!title) { toast('❌ Add a title', 'var(--red)'); return; }
  var _linkRe = /(https?:\/\/|www\.|t\.me\/)/i;
  if (_linkRe.test(title) || _linkRe.test(desc)) {
    toast('[SYSTEM ERROR]: Публикация отклонена. Контент нарушает протокол безопасности сети SPARK', 'var(--red)');
    return;
  }
  var secs = { '24h': 86400, '7d': 604800 }[selDur] || 86400;
  var exp = new Date(Date.now() + secs * 1000).toISOString();
  var uname = PROFILE.username;
  var letter = uname.replace('@', '').charAt(0).toUpperCase();
  if (supa) {
    try {
      var modR = await callEdgeFunction('moderate-content', { text: (title + ' ' + desc).slice(0, 400) });
      if (modR.ok && modR.data && modR.data.allowed === false) {
        toast('[SYSTEM ERROR]: Публикация отклонена. Контент нарушает протокол безопасности сети SPARK', 'var(--red)');
        return;
      }
    } catch (modErr) {
      console.warn('[moderation] check failed, continuing:', modErr);
    }
    try {
      var r = await supa.from('ideas').insert({
        title: title,
        description: desc,
        min_bet: min,
        target_sum: ciTarget ? (parseInt(ciTarget.value, 10) || null) : null,
        expires_at: exp,
        created_at: new Date().toISOString(),
        author_id: ME ? ME.id : null
      }).select().single();
      if (r.error) throw r.error;
      if (r.data) insertLive(r.data, uname, letter);
      closeMo('moCreate');
      toast('🚀 ' + (LANG === 'ru' ? 'Идея опубликована!' : 'Idea published!'), 'var(--ac)');
      return;
    } catch (e) {
      console.warn('insert error', e);
      toast('❌ Publish failed. Try again.', 'var(--red)');
      return;
    }
  } else {
    insertLive({ id: Date.now(), title: title, desc: desc, min_bet: min, expires_at: exp }, uname, letter);
  }
  closeMo('moCreate');
  toast('🚀 ' + (LANG === 'ru' ? 'Идея опубликована!' : 'Idea published!'), 'var(--ac)');
}

function openCmenDropdown(cmenEl) {
  // Remove any existing dropdowns
  document.querySelectorAll('.cmen-dropdown').forEach(function (d) { d.remove(); });

  var ideaId = cmenEl.dataset.ideaId;
  var isImmune = cmenEl.dataset.immune === '1';
  var isReported = MY_REPORTED_IDEAS.indexOf(ideaId) !== -1;
  var ru = LANG === 'ru';

  // Проверяем, принадлежит ли идея текущему пользователю
  var idea = LIVE.filter(function (x) { return String(x.id) === String(ideaId); })[0];
  var isOwnIdea = idea && ME && idea.author_id === ME.id;

  var dd = document.createElement('div');
  dd.className = 'cmen-dropdown';

  if (isImmune) {
    dd.innerHTML = '<button class="cmen-dropdown-item cmen-dropdown-item--disabled" disabled>'
      + '🛡 ' + (ru ? 'Защищено иммунитетом' : 'Protected by immunity') + '</button>';
  } else if (isReported) {
    dd.innerHTML = '<button class="cmen-dropdown-item cmen-dropdown-item--disabled" disabled>'
      + '✓ ' + (ru ? 'Вы пожаловались' : 'Reported') + '</button>';
  } else if (isOwnIdea) {
    dd.innerHTML = '<button class="cmen-dropdown-item cmen-dropdown-item--disabled" disabled>'
      + '🚫 ' + (ru ? 'Нельзя пожаловаться на свой пост' : 'Cannot report your own post') + '</button>';
  } else {
    dd.innerHTML = '<button class="cmen-dropdown-item cmen-report-btn" data-report-id="' + ideaId + '">'
      + '⚠ ' + (ru ? 'Пожаловаться' : 'Report') + '</button>';
  }

  cmenEl.style.position = 'relative';
  cmenEl.appendChild(dd);
}

function doShareIdea(ideaId) {
  var idea = LIVE.filter(function(x) { return x.id === ideaId; })[0];
  if (!idea) return;

  var shareUrl = window.location.origin + window.location.pathname + '?search=' + encodeURIComponent(idea.title);
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=9b5fff&bgcolor=080c1c&qzone=1&data=' + encodeURIComponent(shareUrl);

  var mo = document.getElementById('moShare');
  if (!mo) return;

  var el = function(id) { return document.getElementById(id); };
  var shareCardTitle = el('shareCardTitle');
  var shareCardBody = el('shareCardBody');
  var shareCardAuthor = el('shareCardAuthor');
  var shareQR = el('shareQR');
  var shareUrlInput = el('shareUrlInput');
  var shareModalTitle = el('shareModalTitle');
  var shareCopyBtn = el('shareCopyBtn');

  if (shareModalTitle) shareModalTitle.textContent = T('shareTitle');
  if (shareCopyBtn) shareCopyBtn.textContent = T('shareCopyLink');
  if (shareCardTitle) shareCardTitle.textContent = idea.title || '';
  if (shareCardBody) shareCardBody.textContent = (idea.body || '').slice(0, 100) + ((idea.body || '').length > 100 ? '…' : '');
  if (shareCardAuthor) shareCardAuthor.textContent = idea.u || '';
  if (shareQR) { shareQR.src = qrUrl; shareQR.alt = 'QR'; }
  if (shareUrlInput) shareUrlInput.value = shareUrl;

  openMo('moShare');
}

var MY_REPORTED_IDEAS = []; // session-local set of idea IDs the user has reported
var _reportLastMs = 0; // rate limit: 1 report per 10s per client session
var _pendingReport = { ideaId: null, btn: null };

// Step 1: validate + open confirmation modal
function doReportIdea(ideaId, btn) {
  if (!supa || !ME) {
    toast('❌ ' + (LANG === 'ru' ? 'Войдите, чтобы пожаловаться' : 'Sign in to report'), 'var(--red)');
    return;
  }
  var now = Date.now();
  if (now - _reportLastMs < 10000) {
    var wait = Math.ceil((10000 - (now - _reportLastMs)) / 1000);
    toast('⏳ ' + (LANG === 'ru' ? 'Подождите ' + wait + ' сек.' : 'Wait ' + wait + 's'), 'var(--mu)');
    return;
  }
  _pendingReport.ideaId = ideaId;
  _pendingReport.btn    = btn;
  var ru = LANG === 'ru';
  var el = function(id) { return document.getElementById(id); };
  var t  = el('rcmTitle');   if (t)  t.textContent  = ru ? 'Пожаловаться на пост?' : 'Report this post?';
  var tx = el('rcmText');    if (tx) tx.textContent  = ru
    ? 'Репорт отправляется за нарушения: неуважение к собеседникам, оскорбления, спам, нарушение этикета сообщества.'
    : 'Reports are sent for violations: harassment, spam, offensive content, or community guideline breaches.';
  var cc = el('rcmCancel');  if (cc) cc.textContent  = ru ? 'Отмена'       : 'Cancel';
  var cf = el('rcmConfirm'); if (cf) cf.textContent  = ru ? 'Пожаловаться' : 'Report';
  openMo('reportConfirmModal');
}

// Step 2: user confirmed — run the actual API call
function _markIdeaReported(ideaId) {
  if (!ideaId) return;
  if (MY_REPORTED_IDEAS.indexOf(ideaId) === -1) MY_REPORTED_IDEAS.push(ideaId);
  var cmenEl = document.querySelector('.cmen[data-idea-id="' + ideaId + '"]');
  if (cmenEl) {
    cmenEl.classList.add('cmen--reported');
    cmenEl.title = LANG === 'ru' ? 'Вы пожаловались на этот пост' : 'You reported this post';
  }
}

async function _doSubmitReport() {
  var ideaId = _pendingReport.ideaId;
  _pendingReport.ideaId = null;
  _pendingReport.btn    = null;
  closeMo('reportConfirmModal');
  if (!ideaId) return;
  _reportLastMs = Date.now();
  var r = await callEdgeFunction('submit-report', { idea_id: ideaId });
  if (r.ok && r.data && r.data.ok) {
    toast('⚠ ' + (LANG === 'ru' ? 'Жалоба принята. Спасибо за бдительность.' : 'Report submitted. Thanks for keeping SPARK safe.'), 'var(--ac)');
    _markIdeaReported(ideaId);
  } else {
    var errCode = (r.data && r.data.message) || 'error';
    var errMsg = {
      already_reported:       LANG === 'ru' ? 'Вы уже жаловались на этот пост.' : 'You already reported this post.',
      post_is_immune:         LANG === 'ru' ? 'Этот пост защищён иммунитетом.' : 'This post has immunity.',
      post_already_moderated: LANG === 'ru' ? 'Пост уже рассматривается.' : 'Post is already under review.',
      idea_not_found:         LANG === 'ru' ? 'Пост не найден.' : 'Post not found.',
    }[errCode] || (LANG === 'ru' ? 'Ошибка. Попробуйте позже.' : 'Error. Try again later.');
    toast('⚠ ' + errMsg, errCode === 'already_reported' || errCode === 'post_is_immune' ? 'var(--mu)' : 'var(--red)');
    if (errCode === 'already_reported') _markIdeaReported(ideaId);
  }
}

// Cancel: close modal, clear pending state
function _cancelPendingReport() {
  _pendingReport.ideaId = null;
  _pendingReport.btn    = null;
  closeMo('reportConfirmModal');
}

function insertLive(row, uname, letter) {
  var idStr = String(row.id || '');
  if (LIVE.filter(function (x) { return String(x.id) === idStr; }).length) return;
  // Use full mapping if possible, otherwise minimal fallback
  var ideaObj;
  if (row.author_id) {
    var fakeProfilesMap = {};
    fakeProfilesMap[row.author_id] = uname;
    ideaObj = dbRowToLiveIdea(row, fakeProfilesMap);
  } else {
    ideaObj = {
      id: row.id,
      u: uname,
      av: letter || uname.replace('@', '').charAt(0).toUpperCase(),
      bg: 'linear-gradient(135deg,#e8c55a,#5ae8c5)',
      tm: 'just now',
      tag: detectTag(row.title || ''),
      minBet: row.min_bet || 10,
      title: row.title || '',
      body: row.description || row.body || '',
      investors: 0,
      pool: '0',
      cd: '24',
      pct: 0,
      investment_history: [],
      expires_at: row.expires_at
    };
  }
  LIVE.unshift(ideaObj);
  renderFeed();
  renderTrends();
}

function attachHold(id, ms, cb) {
  var el = document.getElementById(id);
  if (!el) return;
  var fresh = el.cloneNode(true);
  el.parentNode.replaceChild(fresh, el);
  el = fresh;
  el.style.setProperty('--hms', ms / 1000 + 's');
  var t = null, on = false;
  function start(e) {
    if ((e.button !== undefined && e.button !== 0) || on) return;
    on = true;
    triggerVibration([50, 100, 50]);
    el.classList.add('holding');
    t = setTimeout(function () { triggerVibration(40); cb(); reset(); }, ms);
  }
  function reset() {
    clearTimeout(t); t = null; on = false; el.classList.remove('holding');
  }
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', reset);
  el.addEventListener('mouseleave', reset);
  el.addEventListener('touchstart', function (e) { e.preventDefault(); start(e); }, { passive: false });
  el.addEventListener('touchend', function (e) { e.preventDefault(); reset(); }, { passive: false });
  el.addEventListener('touchcancel', reset);
}

var pollingTimer = null;

function initRealtime() {
  if (!supa || REALTIME_MODE === 'none') return;

  if (REALTIME_MODE === 'polling') {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async function() {
      try {
        // Fetch new ideas check
        if (LIVE.length > 0) {
          var latestId = LIVE[0].id;
          var latest = await supa.from('ideas').select('id, title')
            .or('status.eq.active,status.eq.immune,status.is.null')
            .order('created_at', {ascending: false}).limit(1).single();
          if (latest.data && latest.data.id && latest.data.id !== latestId) {
            if (!LIVE.filter(function(x) { return x.id === latest.data.id; }).length) {
              var prefs = ME && ME.user_metadata ? ME.user_metadata : {};
              if (prefs.prefs_new_posts !== false) {
                toast('✨ New: ' + (latest.data.title || '').slice(0, 26), 'var(--ac2)');
              }
            }
          }
        }
        
        // Fetch updates for visible ideas (reactions included so polling clients see other users' reactions)
        var visibleIds = LIVE.slice((page - 1) * PER, page * PER).map(function(x) { return x.id; });
        if (visibleIds.length > 0) {
          var { data } = await supa.from('ideas').select('id, total_invested, investment_history, investor_ids, reactions').in('id', visibleIds);
          if (data && data.length) {
            var changed = false;
            data.forEach(function(updated) {
              var idx = LIVE.findIndex(function(x) { return x.id === updated.id; });
              if (idx !== -1) {
                var poolStr = String(Number(updated.total_invested) || 0);
                var invCount = countUniqueInvestors(updated.investor_ids, updated.investment_history);
                if (String(LIVE[idx].pool) !== poolStr || LIVE[idx].investors !== invCount) {
                  changed = true;
                  LIVE[idx].pool = poolStr;
                  LIVE[idx].investment_history = updated.investment_history || [];
                  LIVE[idx].investors = invCount;
                  var newPool2 = Number(LIVE[idx].pool) || 0;
                  var mb2 = LIVE[idx].minBet || 10;
                  LIVE[idx].pct = newPool2 > 0 ? Math.min(Math.round((newPool2 / Math.max(mb2 * 5, 1)) * 100), 999) : 0;
                }
                // Sync reactions from poll — skip while a local reaction is in-flight to avoid
                // overwriting the optimistic update with stale DB data (fixes count flicker bug)
                if (updated.reactions && typeof updated.reactions === 'object' && !_reactInflight.has(updated.id)) {
                  var rsP = getRS(updated.id);
                  EMOJIS.forEach(function (e) {
                    if (updated.reactions[e] !== undefined) {
                      rsP.counts[e] = Math.max(0, Number(updated.reactions[e]) || 0);
                    }
                  });
                  _renderReactContainer(updated.id);
                }
              }
            });
            if (changed) { renderFeed(); renderTrends(); }
          }
        }
        
        // Fetch balance
        if (ME) {
          var { data: pd } = await supa.from('profiles').select('spk_balance').eq('id', ME.id).single();
          if (pd && pd.spk_balance !== PROFILE.spk_balance) {
            PROFILE.spk_balance = pd.spk_balance;
            updateHeader();
            renderLeaders(); // БАГ #14: кошелёк и «Топ Пророков» обновляются вместе
          }
        }
      } catch (e) {
        console.warn('Polling error', e);
      }
    }, 12000); // Poll every 12 seconds
    return;
  }

  // WebSocket mode
  try {
    if (realtimeIdeasChannel) supa.removeChannel(realtimeIdeasChannel);
    if (realtimeBalanceChannel) supa.removeChannel(realtimeBalanceChannel);
    realtimeIdeasChannel = supa.channel('ideas-rt');
    realtimeIdeasChannel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ideas' }, function (p) {
        var r = p.new;
        if (!LIVE.filter(function (x) { return x.id === r.id; }).length) {
          var rtUsername = r.author_username || '@anon';
          insertLive(r, rtUsername, rtUsername.replace('@', '').charAt(0).toUpperCase() || 'A');
        }
        var rtPrefs = ME && ME.user_metadata ? ME.user_metadata : {};
        if (rtPrefs.prefs_new_posts !== false) {
          toast('✨ New: ' + (r.title || '').slice(0, 26), 'var(--ac2)');
        }
      }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ideas' }, function (p2) {
        // Update existing idea in LIVE with fresh investment + reaction data
        var updated = p2.new;
        var idx = LIVE.findIndex(function(x) { return x.id === updated.id; });
        if (idx !== -1) {
          if (updated.total_invested !== undefined) LIVE[idx].pool = String(Number(updated.total_invested) || 0);
          if (Array.isArray(updated.investment_history)) {
            LIVE[idx].investment_history = updated.investment_history;
            LIVE[idx].investors = countUniqueInvestors(updated.investor_ids, updated.investment_history);
            var newPool2 = Number(LIVE[idx].pool) || 0;
            var mb2 = LIVE[idx].minBet || 10;
            LIVE[idx].pct = newPool2 > 0 ? Math.min(Math.round((newPool2 / Math.max(mb2 * 5, 1)) * 100), 999) : 0;
          }
          // Sync reaction counts from realtime payload so other users' reactions appear live
          // Skip while a local reaction is in-flight — the RPC response handles the authoritative sync
          if (updated.reactions && typeof updated.reactions === 'object' && !_reactInflight.has(updated.id)) {
            var rsRt = getRS(updated.id);
            EMOJIS.forEach(function (e) {
              if (updated.reactions[e] !== undefined) {
                rsRt.counts[e] = Math.max(0, Number(updated.reactions[e]) || 0);
              }
            });
            _renderReactContainer(updated.id);
          }
          // Re-render only if the updated idea is visible on current page
          var visibleIds = LIVE.slice((page - 1) * PER, page * PER).map(function(x) { return x.id; });
          if (visibleIds.indexOf(updated.id) !== -1) { renderFeed(); renderTrends(); }
        }
      }).subscribe();
    if (ME) {
      realtimeBalanceChannel = supa.channel('bal-rt');
      realtimeBalanceChannel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + ME.id }, function (p2) {
          PROFILE.spk_balance = p2.new.spk_balance;
          updateHeader();
          renderLeaders(); // БАГ #14: кошелёк и «Топ Пророков» обновляются вместе
        }).subscribe();
    }
  } catch (e) {
    console.warn('Realtime error', e);
    featureToast('realtime', e);
  }
}

function triggerVibration(pattern) {
  if (!navigator.vibrate) return;
  var prefs = ME && ME.user_metadata ? ME.user_metadata : {};
  if (prefs.prefs_vibration !== false) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Vibration failed", e);
    }
  }
}

function openPanel(name, pushHistory) {
  // БАГ #16: не выходим раньше времени, если _activePanel рассинхронизировался
  // с реальным DOM (например, после истории навигации в чатах) — повторный клик
  // по табу заново применяет состояние UI. История/вибрация — только при смене.
  var isSamePanel = (name === _activePanel);
  if (!isSamePanel) {
    triggerVibration(10);
    if (pushHistory !== false) {
      window.history.pushState({ type: 'panel', name: name }, '');
    }
  }
  _activePanel = name;

  document.querySelectorAll('.mob-tab').forEach(function (t) { t.classList.remove('active'); });
  var tab = document.querySelector('.mob-tab[data-panel="' + name + '"]');
  if (tab) tab.classList.add('active');
  var feed = document.querySelector('.feed');
  ['trends', 'leaders', 'chats', 'profile'].forEach(function (id) {
    var p = document.getElementById('panel-' + id);
    if (p) p.classList.remove('open');
  });

  // Sync desktop chats button active state
  var btnChatsDesk = document.getElementById('btnChatsDesk');
  if (btnChatsDesk) {
    btnChatsDesk.classList.toggle('active', name === 'chats');
  }

  // Toggle header visibility on mobile based on whether the feed panel is open
  var header = document.querySelector('header');
  if (header) {
    if (name === 'feed') {
      header.classList.remove('hide-on-mobile');
    } else {
      header.classList.add('hide-on-mobile');
    }
  }

  // Restore taskbar when switching panels
  var mobBar = document.querySelector('.mob-bar');
  if (mobBar) mobBar.classList.remove('hide-bar');

  // Restore panel boundaries when switching tabs
  var chatsPanel = document.getElementById('panel-chats');
  if (chatsPanel) chatsPanel.classList.remove('fullscreen-chat');

  if (name === 'feed') { if (feed) feed.style.display = ''; }
  else { if (feed) feed.style.display = 'none'; var t2 = document.getElementById('panel-' + name); if (t2) t2.classList.add('open'); }
}

function switchChatTab(tab) {
  triggerVibration(10);
  document.querySelectorAll('.chat-tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.chatTab === tab); });
  var dms = document.getElementById('chat-dms');
  var topics = document.getElementById('chat-topics');
  if (dms) dms.classList.toggle('active', tab === 'dms');
  if (topics) topics.classList.toggle('active', tab === 'topics');
}

// БАГ #13: копирование адреса поддержки кликом (фолбэк, когда mailto не настроен)
function copySupportEmail() {
  var email = 'spark.supp.team@gmail.com';
  function done() { toast(LANG === 'ru' ? '✓ Адрес скопирован' : '✓ Email copied', 'var(--ac2)'); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(email).then(done).catch(function () { _copySupportFallback(email, done); });
  } else {
    _copySupportFallback(email, done);
  }
}
function _copySupportFallback(text, done) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    done();
  } catch (e) {
    toast(text, 'var(--ac2)');
  }
}
window.copySupportEmail = copySupportEmail;

function openMo(id) { var el = document.getElementById(id); if (el) { el.classList.add('open'); window.history.pushState({ type: 'modal', id: id }, ''); triggerVibration(15); } }
function closeMo(id) { var el = document.getElementById(id); if (el) { el.classList.remove('open'); triggerVibration(10); } }
window.openMo = openMo;
window.closeMo = closeMo;
window.toast = toast;

function toast(msg, color, type) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  /* Remove old type classes */
  t.classList.remove('toast-success', 'toast-error', 'toast-info');
  /* Determine type from CSS colour string if not passed explicitly */
  var resolvedType = type;
  if (!resolvedType) {
    if (color && (color.indexOf('red') !== -1 || color.indexOf('--red') !== -1)) resolvedType = 'error';
    else if (color && (color.indexOf('ac2') !== -1 || color.indexOf('ac)') !== -1)) resolvedType = 'success';
    else if (color && (color.indexOf('vl') !== -1 || color.indexOf('vl)') !== -1)) resolvedType = 'info';
  }
  if (resolvedType === 'success') { t.classList.add('toast-success'); t.style.background = ''; }
  else if (resolvedType === 'error') { t.classList.add('toast-error'); t.style.background = ''; }
  else if (resolvedType === 'info') { t.classList.add('toast-info'); t.style.background = ''; }
  else { t.style.background = color || 'rgba(8,12,28,0.95)'; }
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t = setTimeout(function () {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(14px)';
  }, 2600);
  if (resolvedType === 'error' || (color && (color.indexOf('red') !== -1 || color.indexOf('#e25c5c') !== -1))) {
    triggerVibration([60, 60, 60]);
  } else {
    triggerVibration(30);
  }
  /* Alias for profile-edit.js */
  window.showToast = toast;
}

async function reportClientError(kind, details) {
  var payload = {
    kind: kind,
    details: details || {},
    ts: new Date().toISOString(),
    lang: LANG
  };
  console.warn('[telemetry]', payload);
  if (!supa || !ENABLE_CLIENT_TELEMETRY) return;
  try {
    await supa.from('client_events').insert({
      user_id: ME ? ME.id : null,
      event_type: kind,
      payload: payload
    });
  } catch (e) {
    console.warn('telemetry skipped', e && e.message ? e.message : e);
  }
}

function pulse(el) {
  el.style.background = 'var(--sf2)';
  setTimeout(function () { el.style.background = ''; }, 180);
}

function bindAuthListener() {
  if (!supa || authListenerBound) return;
  authListenerBound = true;
  supa.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT') {
      ME = null;
      PROFILE = { username: '@user', spk_balance: 0, ideas_count: 0, rank: null, investments_count: 0, bio: '', avatar_color: 0, is_admin: false, special_badges: [] };
      ADMIN_USER_IDS.clear();
      appEntered = false;
      _repostCodeCache = null;
      document.documentElement.classList.remove('spark-presession');
      document.documentElement.classList.add('auth-active');
      var authScreen = document.getElementById('authScreen');
      if (authScreen) authScreen.classList.remove('gone');
      var launchOverlay = document.getElementById('launchOverlay');
      if (launchOverlay) launchOverlay.classList.add('gone');
      return;
    }
    if (!session || !session.user) return;
    ME = session.user;
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      return;
    }
    if (appEntered) return;
    if (!session.user.email_confirmed_at) {
      PENDING_EMAIL = session.user.email || PENDING_EMAIL;
      showVerify(PENDING_EMAIL, PENDING_NICK);
      return;
    }
    setTimeout(function () {
      if (appEntered) return;
      fetchProfile().then(function () {
        enterApp();
      }).catch(function (e) {
        console.warn('profile on auth change', e);
        enterApp();
      });
    }, 100);
  });
}

async function restoreSession() {
  if (!supa) return false;
  try {
    if (window.location.hash.includes('access_token')) {
      var hashSession = await supa.auth.getSession();
      if (hashSession.data && hashSession.data.session && hashSession.data.session.user) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        ME = hashSession.data.session.user;
        if (!ME.email_confirmed_at) {
          showVerify(ME.email || '', PENDING_NICK);
          return true;
        }
        await fetchProfile();
        enterApp();
        return true;
      }
    }
    var res = await safeSupabaseCall('auth', function () {
      return supa.auth.getSession();
    }, { silent: true, timeout: 25000 });
    
    if (!res.ok) {
      console.warn('getSession timeout/error', res.error);
      return false;
    }
    var r = res.data;
    if (r && r.error) {
      console.warn('getSession error', r.error);
      return false;
    }
    if (r.data && r.data.session && r.data.session.user) {
      ME = r.data.session.user;
      if (!ME.email_confirmed_at) {
        showVerify(ME.email || '', PENDING_NICK);
        return true;
      }
      await fetchProfile();
      enterApp();
      return true;
    }
  } catch (e2) {
    console.warn('restoreSession error', e2);
  }
  return false;
}

function showConfigSetupMessage() {
  var msg = T('configSetup');
  console.warn('[SPARK]', msg);
  setAuthErr(msg);
}

async function bootApp() {
  if (!SUPABASE_CONFIGURED) {
    showConfigSetupMessage();
  }
  bindAuthListener();
  if (supa) {
    var restored = await restoreSession();
    if (restored) {
      // enterApp() inside restoreSession already called applyLang() — skip duplicate
      return;
    }
  }
  // No session - new OnboardingEngine v1 (spark-onboarding.js) handles pre-reg guide
  // It fires via its own setTimeout after the intro animation.
  // SparkOnboarding (old Phase1) is superseded — we just open auth here if already seen.
  document.documentElement.classList.remove('spark-presession');
  var launchOverlay = document.getElementById('launchOverlay');
  if (launchOverlay) launchOverlay.classList.add('gone');
  applyLang();
  var _obSeen = false;
  try { _obSeen = !!localStorage.getItem('spark_ob3_seen'); } catch(e) {}
  if (_obSeen) {
    /* User already saw the onboarding guide — open auth directly */
    document.documentElement.classList.add('auth-active');
    var authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.remove('gone');
  } else {
    /* Hide auth form during onboarding — spark-onboarding.js will reveal it after the 9-slide guide */
    document.documentElement.classList.remove('auth-active');
    var authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('gone');
  }
}

window.addEventListener('error', function (event) {
  reportClientError('window_error', {
    message: event.message,
    source: event.filename,
    line: event.lineno,
    col: event.colno
  });
});

window.addEventListener('unhandledrejection', function (event) {
  var reason = event && event.reason;
  reportClientError('unhandled_rejection', {
    message: reason && reason.message ? reason.message : String(reason)
  });
});

/* --- SPARK SETTINGS & PRIVACY INJECTION --- */
document.addEventListener('DOMContentLoaded', function() {
  var moNotif = document.getElementById('moNotifications');
  if (moNotif) {
    moNotif.addEventListener('click', function (event) {
      if (event.target === moNotif) closeMo('moNotifications');
    });
  }
  var moShareEl = document.getElementById('moShare');
  if (moShareEl) {
    moShareEl.addEventListener('click', function (event) {
      if (event.target === moShareEl) closeMo('moShare');
    });
  }
  var moPriv = document.getElementById('moPrivacy');
  if (moPriv) {
    moPriv.addEventListener('click', function (event) {
      if (event.target === moPriv) closeMo('moPrivacy');
    });
  }

  var moDel = document.getElementById('delete-modal');
  if (moDel) {
    moDel.addEventListener('click', function (event) {
      if (event.target === moDel) moDel.classList.remove('active');
    });
  }
  
  var delClose = document.getElementById('modal-close-x');
  if (delClose) {
    delClose.addEventListener('click', function() {
      if (moDel) moDel.classList.remove('active');
    });
  }
  
  var togVib = document.getElementById('toggle-vibration');
  if (togVib) {
    togVib.addEventListener('change', async function() {
      if (!ME) return;
      var val = togVib.checked;
      if (!ME.user_metadata) ME.user_metadata = {};
      ME.user_metadata.prefs_vibration = val;
      triggerVibration(50);
      try {
        await supa.auth.updateUser({ data: { prefs_vibration: val } });
        var { data: { user } } = await supa.auth.getUser();
        if (user) ME = user;
      } catch (e) {}
    });
  }
  
  var togNP = document.getElementById('toggle-new-posts');
  if (togNP) {
    togNP.addEventListener('change', async function() {
      if (!ME) return;
      var val = togNP.checked;
      if (!ME.user_metadata) ME.user_metadata = {};
      ME.user_metadata.prefs_new_posts = val;
      try {
        await supa.auth.updateUser({ data: { prefs_new_posts: val } });
        var { data: { user: npUser } } = await supa.auth.getUser();
        if (npUser) ME = npUser;
      } catch (e) {}
    });
  }

  var togEm = document.getElementById('toggle-email');
  if (togEm) {
    togEm.addEventListener('change', async function() {
      if (!ME) return;
      var val = togEm.checked;
      try {
        await supa.auth.updateUser({ data: { prefs_email: val } });
        var { data: { user } } = await supa.auth.getUser();
        if (user) ME = user;
      } catch (e) {}
    });
  }

  var pwdForm = document.getElementById('privacy-form-password');
  if (pwdForm) {
    pwdForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!ME) return;
      var btn = document.getElementById('btnUpdatePwd');
      var currPwd = document.getElementById('current-password').value;
      var newPwd = document.getElementById('new-password').value;
      
      btn.disabled = true;
      btn.textContent = '...';
      try {
        var { error: verifyErr } = await supa.auth.signInWithPassword({
          email: ME.email,
          password: currPwd
        });
        if (verifyErr) throw verifyErr;
        
        var { error: updErr } = await supa.auth.updateUser({ password: newPwd });
        if (updErr) throw updErr;
        
        toast(T('pwdUpdated'), 'var(--ac2)');
        pwdForm.reset();
      } catch (err) {
        toast(T('pwdErr') + ': ' + (err.message || ''), 'var(--red)');
      }
      btn.disabled = false;
      btn.textContent = T('privUpdatePwd');
    });
  }

  var btnOpenDel = document.getElementById('btn-open-delete-modal');
  if (btnOpenDel) {
    btnOpenDel.addEventListener('click', function() {
      closeMo('moPrivacy');
      var moDel = document.getElementById('delete-modal');
      if (moDel) {
        document.getElementById('confirm-step-password').classList.remove('modal-step-hidden');
        document.getElementById('confirm-step-code').classList.add('modal-step-hidden');
        document.getElementById('form-delete-pwd').reset();
        document.getElementById('form-delete-code').reset();
        moDel.classList.add('active');
      }
    });
  }

  window.doConfirmDeleteAccount = async function () {
    if (!ME) return;
    if (AuthFlowManager.isProcessing()) return;

    var btn = document.getElementById('btnConfirmDel');
    var rawCode = document.getElementById('delete-verify-code').value;
    var code = rawCode.replace(/\D/g, '');

    if (!/^\d{6}$/.test(code)) {
      toast(T('regInvalidCode'), 'var(--red)');
      return;
    }

    AuthFlowManager.start('DEL_CONFIRMING', btn);
    try {
      var r = await callEdgeFunction('privacy-delete-account', { code: code });
      if (!r.ok) throw new Error(r.error?.message || r.error || 'Failed');

      // Optimistic Deletion Close & Complete session wipe
      toast(T('delSuccess'), 'var(--ac2)');
      var moDel = document.getElementById('delete-modal');
      if (moDel) moDel.classList.remove('active');

      // Instantly invoke doLogout to drop the user back to the signup screen within 100ms
      doLogout(true);
    } catch (err) {
      toast(T('regInvalidCode') + ': ' + (err.message || ''), 'var(--red)');
    } finally {
      AuthFlowManager.stop();
    }
  };

  var formDelPwd = document.getElementById('form-delete-pwd');
  if (formDelPwd) {
    formDelPwd.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!ME) { toast(T('signInRequired') || 'Войдите в аккаунт', 'var(--red)'); return; }
      if (AuthFlowManager.isProcessing()) return;

      var btn = document.getElementById('btnSendDelCode');
      var currPwd = document.getElementById('delete-curr-pwd').value;

      AuthFlowManager.start('DEL_SENDING_CODE', btn);
      try {
        var r = await callEdgeFunction('privacy-send-delete-code', { password: currPwd, lang: LANG });
        if (!r.ok) throw new Error((r.body && r.body.error) || r.error?.message || r.error || 'Failed');

        toast(T('delCodeSent'), 'var(--ac2)');
        document.getElementById('confirm-step-password').classList.add('modal-step-hidden');
        document.getElementById('confirm-step-code').classList.remove('modal-step-hidden');

        var codeEl = document.getElementById('delete-verify-code');
        if (codeEl) {
          codeEl.value = '';
          codeEl.focus();
        }
      } catch (err) {
        var errMsg = err.message || '';
        if (errMsg.indexOf('Incorrect password') !== -1 || errMsg.indexOf('Incorrect') !== -1) {
          errMsg = T('pwdErr') || 'Неверный пароль';
        }
        toast(T('delErr') + ': ' + errMsg, 'var(--red)');
      } finally {
        AuthFlowManager.stop();
      }
    });
  }

  var formDelCode = document.getElementById('form-delete-code');
  if (formDelCode) {
    formDelCode.addEventListener('submit', function (e) {
      e.preventDefault();
      doConfirmDeleteAccount();
    });
  }
});

window.showNotifications = function() {
  var prefs = ME && ME.user_metadata ? ME.user_metadata : {};
  var togVib = document.getElementById('toggle-vibration');
  if (togVib) togVib.checked = prefs.prefs_vibration !== false;
  var togNP = document.getElementById('toggle-new-posts');
  if (togNP) togNP.checked = prefs.prefs_new_posts !== false;
  var togEm = document.getElementById('toggle-email');
  if (togEm) togEm.checked = prefs.prefs_email === true;
  openMo('moNotifications');
};

window.showPrivacy = function() {
  var pwdForm = document.getElementById('privacy-form-password');
  if (pwdForm) pwdForm.reset();
  openMo('moPrivacy');
};

/* Modal swipe-down-to-close logic */
document.addEventListener('DOMContentLoaded', function() {
  var moBoxes = document.querySelectorAll('.mo-box');
  moBoxes.forEach(function(box) {
    var startY = 0;
    var currentY = 0;
    var isDragging = false;
    var handle = box.querySelector('.mo-handle');
    var dragTarget = handle || box; /* fallback to box if no handle */

    dragTarget.addEventListener('touchstart', function(e) {
      if (box.scrollTop > 0 && e.target !== handle) return; /* don't drag if scrolled down, unless handle */
      startY = e.touches[0].clientY;
      isDragging = true;
      box.style.transition = 'none';
    }, {passive: true});

    dragTarget.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      var dy = currentY - startY;
      if (dy > 0) {
        box.style.transform = 'translateY(' + dy + 'px)';
      }
    }, {passive: true});

    dragTarget.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      isDragging = false;
      var dy = currentY - startY;
      box.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      if (dy > 80) {
        /* close */
        var mo = box.closest('.mo');
        if (mo) closeMo(mo.id);
        setTimeout(function() { box.style.transform = ''; }, 300);
      } else {
        /* snap back */
        box.style.transform = '';
      }
    });

    if (handle) {
      handle.addEventListener('click', function() {
        var mo = box.closest('.mo');
        if (mo) closeMo(mo.id);
      });
    }
  });

  // ═══ CHATS SYSTEM INITIALIZATION ═══
  var btnChatsDesk = document.getElementById('btnChatsDesk');
  if (btnChatsDesk) {
    btnChatsDesk.addEventListener('click', function () {
      var p = document.getElementById('panel-chats');
      var feed = document.querySelector('.feed');
      if (p && p.classList.contains('open')) {
        // Toggle off
        p.classList.remove('open');
        if (feed) feed.style.display = '';
        btnChatsDesk.classList.remove('active');
        _activePanel = 'feed';
      } else {
        // Toggle on
        openPanel('chats');
        btnChatsDesk.classList.add('active');
      }
    });
  }

  var btnCloseChats = document.getElementById('btnCloseChats');
  if (btnCloseChats) {
    btnCloseChats.addEventListener('click', function () {
      var p = document.getElementById('panel-chats');
      if (p) p.classList.remove('open');
      var feed = document.querySelector('.feed');
      if (feed) feed.style.display = ''; // Restore feed regardless of screen width
      document.querySelectorAll('.mob-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.panel === 'feed');
      });
      var btnChatsDesk = document.getElementById('btnChatsDesk');
      if (btnChatsDesk) btnChatsDesk.classList.remove('active');
      _activePanel = 'feed';
    });
  }

  // Logo home button to return to feed on desktop
  var logoBlock = document.querySelector('.logo-block');
  if (logoBlock) {
    logoBlock.style.cursor = 'pointer';
    logoBlock.addEventListener('click', function () {
      var p = document.getElementById('panel-chats');
      if (p && p.classList.contains('open')) {
        p.classList.remove('open');
        var feed = document.querySelector('.feed');
        if (feed) feed.style.display = '';
        var btnChatsDesk = document.getElementById('btnChatsDesk');
        if (btnChatsDesk) btnChatsDesk.classList.remove('active');
        _activePanel = 'feed';
      }
    });
  }

  if (window.ChatsEngine) {
    ChatsEngine.init();
  }

  // Handle Android / browser hardware back button for modals and chat view
  window.addEventListener('popstate', function (event) {
    // 1. Close active mobile chat view
    var chatPane = document.getElementById('chatActivePane');
    if (chatPane && chatPane.classList.contains('open-active')) {
      var backBtn = document.getElementById('chatBackBtnMob');
      if (backBtn) {
        backBtn.click();
        return;
      }
    }

    // 2. Close desktop profile overlay if open
    var dpOverlay = document.getElementById('dpOverlay');
    if (dpOverlay && dpOverlay.classList.contains('open')) {
      dpOverlay.classList.remove('open');
      var b = document.getElementById('btnProfDesk');
      if (b) b.classList.remove('active');
      return;
    }

    // 3. Close any generic open modals
    var openModals = document.querySelectorAll('.mo.open');
    if (openModals.length > 0) {
      openModals.forEach(function (modal) {
        closeMo(modal.id);
      });
      return;
    }

    // 4. Close delete-modal if active
    var moDel = document.getElementById('delete-modal');
    if (moDel && moDel.classList.contains('active')) {
      moDel.classList.remove('active');
      return;
    }

    // 5. Handle panel history state
    if (event.state && event.state.type === 'panel') {
      openPanel(event.state.name, false);
    } else {
      openPanel('feed', false);
    }
  });

  // ════ Cross-device sync on tab focus: reactions + theme ════
  // When the user returns to this tab (from another tab or OS-level switch), silently
  // pull fresh data so any changes made on the Android app are immediately visible
  // without requiring a manual refresh.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (!window.ME || !window.supa) return;

    // 1. Refresh reaction picks so cross-device toggles are reflected in the feed UI.
    loadUserReactionsFromDB();

    // 2. Pull the current theme preset from the DB and apply it if it changed.
    supa.from('profiles')
      .select('theme_preset_id')
      .eq('id', ME.id)
      .single()
      .then(function (result) {
        var row = result.data;
        if (!row || !row.theme_preset_id) return;
        if (window.ThemeEngine && ThemeEngine.PRESETS && ThemeEngine.PRESETS[row.theme_preset_id]) {
          var active = ThemeEngine.getActive ? ThemeEngine.getActive() : {};
          if (active.id !== row.theme_preset_id) {
            ThemeEngine.applyPreset(row.theme_preset_id);
          }
        }
      })
      .catch(function () {});
  });
});
