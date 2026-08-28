/* ═══════════════════════════════════════════
   DIGITAL VOTING SYSTEM — STATE MANAGEMENT
   ═══════════════════════════════════════════ */

// ── State ──
const state = {
  currentScreen: 'auth',
  user: null,
  candidates: { rural: [], urban: [] },
  ruralSelected: new Set(),
  urbanSelected: new Set(),
  RURAL_REQUIRED: 14,
  URBAN_REQUIRED: 16,
  adminToken: null,
  selectedRegion: 'both',
};

// ── DOM Cache ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─────────────────────────────────────────────
// SCREEN NAVIGATION
// ─────────────────────────────────────────────
function showScreen(screenId) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = $(`#screen-${screenId}`);
  // Force reflow for animation
  void target.offsetWidth;
  target.classList.add('active');
  state.currentScreen = screenId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─────────────────────────────────────────────
// AUTH TABS
// ─────────────────────────────────────────────
$$('.auth-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.auth-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $(`#${btn.dataset.tab}`).classList.add('active');
    hideMessages();
  });
});

function hideMessages() {
  $('#auth-error').classList.add('hidden');
  $('#auth-success').classList.add('hidden');
}

function showAuthError(msg) {
  hideMessages();
  const el = $('#auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showAuthSuccess(msg) {
  hideMessages();
  const el = $('#auth-success');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─────────────────────────────────────────────
// AUTH: MEMBER ID
// ─────────────────────────────────────────────
$('#btn-auth-id')?.addEventListener('click', async () => {
  const memberId = $('#input-member-id').value.trim();
  if (!memberId) return showAuthError('Please enter your Member ID.');

  try {
    const res = await fetch('/api/auth/id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId })
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error);
    handleAuthSuccess(data);
  } catch (err) {
    showAuthError('Network error. Please try again.');
  }
});

// Enter key support
$('#input-member-id')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#btn-auth-id').click();
});

// ─────────────────────────────────────────────
// AUTH: OTP FLOW
// ─────────────────────────────────────────────
let otpPhone = '';
let otpToken = '';

$('#btn-send-otp')?.addEventListener('click', async () => {
  const phone = $('#input-phone').value.trim();
  if (!phone || phone.length < 10) return showAuthError('Enter a valid 10-digit phone number.');

  try {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error);

    otpPhone = phone;
    otpToken = data.token || '';
    showAuthSuccess(data.message);
    $('#otp-step-phone').classList.add('hidden');
    $('#otp-step-verify').classList.remove('hidden');
    $('#input-otp').focus();
  } catch (err) {
    showAuthError('Network error. Please try again.');
  }
});

$('#btn-verify-otp')?.addEventListener('click', async () => {
  const otp = $('#input-otp').value.trim();
  if (!otp) return showAuthError('Please enter the OTP.');

  try {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: otpPhone, otp, token: otpToken })
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error);
    handleAuthSuccess(data);
  } catch (err) {
    showAuthError('Network error. Please try again.');
  }
});

$('#input-otp')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#btn-verify-otp').click();
});

$('#btn-otp-back')?.addEventListener('click', () => {
  $('#otp-step-verify').classList.add('hidden');
  $('#otp-step-phone').classList.remove('hidden');
  $('#input-otp').value = '';
  hideMessages();
});

// ─────────────────────────────────────────────
// AUTH SUCCESS HANDLER
// ─────────────────────────────────────────────
function handleAuthSuccess(data) {
  state.user = data.member;

  // Update header
  $('#header-user').textContent = `👤 ${data.member.name} (${data.member.id})`;
  $('#header-user').classList.remove('hidden');

  if (data.hasMissing) {
    showProfileScreen();
  } else {
    promptRegionSelection();
  }
}

// ─────────────────────────────────────────────
// PROFILE COMPLETION
// ─────────────────────────────────────────────
function showProfileScreen() {
  $('#profile-name').textContent = `${state.user.name} — ${state.user.id}`;

  const fieldsDiv = $('#profile-fields');
  fieldsDiv.innerHTML = '';

  if (!state.user.email) {
    fieldsDiv.innerHTML += `
      <div class="form-group">
        <label for="profile-email">Email Address</label>
        <input type="email" id="profile-email" placeholder="your.email@example.com" />
      </div>`;
  }
  if (!state.user.address) {
    fieldsDiv.innerHTML += `
      <div class="form-group">
        <label for="profile-address">Address</label>
        <input type="text" id="profile-address" placeholder="Your full address" />
      </div>`;
  }

  showScreen('profile');
}

$('#btn-profile-save')?.addEventListener('click', async () => {
  const email = $('#profile-email')?.value.trim() || '';
  const address = $('#profile-address')?.value.trim() || '';

  if ((!state.user.email && !email) || (!state.user.address && !address)) {
    showToast('Please fill in all missing fields.', 'error');
    return;
  }

  try {
    await fetch('/api/member/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: state.user.id, email, address })
    });
    if (email) state.user.email = email;
    if (address) state.user.address = address;
    showToast('Profile updated!');
    promptRegionSelection();
  } catch (err) {
    showToast('Error updating profile.', 'error');
  }
});

$('#btn-profile-skip')?.addEventListener('click', () => {
  promptRegionSelection();
});

// ─────────────────────────────────────────────
// REGION SELECTION
// ─────────────────────────────────────────────
function promptRegionSelection() {
  if (state.user.hasVotedRural && state.user.hasVotedUrban) {
     showToast('You have already cast all your votes.', 'error');
     return;
  }
  
  // If they already voted for Rural, force them to Urban and show popup
  if (state.user.hasVotedRural) {
     state.selectedRegion = 'urban';
     const msg = document.getElementById('resume-vote-message');
     if (msg) msg.innerHTML = 'You have successfully cast your vote for the Rural Region.<br><br><span style="color:var(--accent);font-size:1.1rem;"><strong>Pending: Urban Region</strong></span>';
     document.getElementById('modal-resume-vote')?.classList.remove('hidden');
     return;
  }
  
  // If they already voted for Urban, force them to Rural and show popup
  if (state.user.hasVotedUrban) {
     state.selectedRegion = 'rural';
     const msg = document.getElementById('resume-vote-message');
     if (msg) msg.innerHTML = 'You have successfully cast your vote for the Urban Region.<br><br><span style="color:var(--accent);font-size:1.1rem;"><strong>Pending: Rural Region</strong></span>';
     document.getElementById('modal-resume-vote')?.classList.remove('hidden');
     return;
  }

  $('#modal-region-select').classList.remove('hidden');
}

$('#btn-resume-vote')?.addEventListener('click', () => {
  $('#modal-resume-vote').classList.add('hidden');
  loadBallot();
});

$('#btn-region-both')?.addEventListener('click', () => {
  state.selectedRegion = 'both';
  $('#modal-region-select').classList.add('hidden');
  loadBallot();
});

$('#btn-region-rural')?.addEventListener('click', () => {
  state.selectedRegion = 'rural';
  $('#modal-region-select').classList.add('hidden');
  loadBallot();
});

$('#btn-region-urban')?.addEventListener('click', () => {
  state.selectedRegion = 'urban';
  $('#modal-region-select').classList.add('hidden');
  loadBallot();
});

$('#btn-region-nota')?.addEventListener('click', async () => {
  $('#modal-region-select').classList.add('hidden');
  try {
    await fetch('/api/vote/nota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId: state.user.id })
    });
    showToast('You have chosen not to participate. Logging out...');
  } catch (err) {
    console.error('Error submitting NOTA:', err);
  }
  
  setTimeout(() => {
    $('#btn-back-to-auth').click();
  }, 1500);
});

// ─────────────────────────────────────────────
// BALLOT
// ─────────────────────────────────────────────
async function loadBallot() {
  try {
    const res = await fetch('/api/candidates');
    const data = await res.json();
    state.candidates = data;
    state.ruralSelected.clear();
    state.urbanSelected.clear();

    renderCandidates('rural', data.rural, state.ruralSelected, state.RURAL_REQUIRED);
    renderCandidates('urban', data.urban, state.urbanSelected, state.URBAN_REQUIRED);
    updateAllCounters();

    $$('.ballot-panel').forEach(p => p.classList.remove('active'));
    
    if (state.user.hasVotedRural || state.selectedRegion === 'urban') {
      const uPanel = $('#panel-urban');
      if (uPanel) uPanel.classList.add('active');
      const backBtn = $('#btn-back-rural');
      if (backBtn) backBtn.style.display = 'none'; // Hide back button if rural is already submitted
      $('#title-rural')?.classList.add('hidden');
      $('#title-urban')?.classList.remove('hidden');
    } else {
      const rPanel = $('#panel-rural');
      if (rPanel) rPanel.classList.add('active');
      const backBtn = $('#btn-back-rural');
      if (backBtn && state.selectedRegion === 'both') backBtn.style.display = 'inline-block';
      else if (backBtn) backBtn.style.display = 'none';
      $('#title-urban')?.classList.add('hidden');
      $('#title-rural')?.classList.remove('hidden');
    }

    $('#ballot-voter-name').textContent = `Voting as: ${state.user.name} (${state.user.id})`;
    showScreen('ballot');
  } catch (err) {
    showToast('Error loading candidates.', 'error');
  }
}

function renderCandidates(type, candidates, selectedSet, required) {
  const grid = $(`#grid-${type}`);
  grid.innerHTML = '';

  candidates.forEach((c, index) => {
    const card = document.createElement('div');
    card.className = 'candidate-card animate-slide-up';
    card.style.animationDelay = `${(0.05 * index).toFixed(2)}s`;
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="candidate-symbol">${c.symbol}</div>
      <div class="candidate-info">
        <div class="candidate-name">${c.name}</div>
        <div class="candidate-number">No. ${c.number}</div>
      </div>
      <div class="candidate-check">✓</div>
    `;

    card.addEventListener('click', () => {
      if (selectedSet.has(c.id)) {
        selectedSet.delete(c.id);
        card.classList.remove('selected');
      } else {
        if (selectedSet.size >= required) {
          showToast(`Maximum ${required} candidates allowed. Deselect one first.`, 'error');
          // Shake animation
          card.style.animation = 'none';
          void card.offsetWidth;
          card.style.animation = 'shake 0.4s ease';
          return;
        }
        selectedSet.add(c.id);
        card.classList.add('selected');
      }
      updateAllCounters();
    });

    grid.appendChild(card);
  });
}

// ── Ballot Navigation ──
$('#btn-next-urban')?.addEventListener('click', () => {
  $$('.ballot-panel').forEach(p => p.classList.remove('active'));
  $('#panel-urban').classList.add('active');
  $('#title-rural')?.classList.add('hidden');
  $('#title-urban')?.classList.remove('hidden');
});

$('#btn-back-rural')?.addEventListener('click', () => {
  $$('.ballot-panel').forEach(p => p.classList.remove('active'));
  $('#panel-rural').classList.add('active');
  $('#title-urban')?.classList.add('hidden');
  $('#title-rural')?.classList.remove('hidden');
});

// ── Counter Updates ──
function updateAllCounters() {
  updateCounter('rural', state.ruralSelected.size, state.RURAL_REQUIRED);
  updateCounter('urban', state.urbanSelected.size, state.URBAN_REQUIRED);
  updateSubmitButton();
}

function updateCounter(type, count, required) {
  const pct = Math.min((count / required) * 100, 100);
  const status = count === required ? 'complete' : count > required ? 'over' : 'partial';

  // Tab counter
  const counter = $(`#counter-${type}`);
  if (counter) {
    counter.textContent = `${count} / ${required}`;
    counter.className = `counter ${count > 0 ? status : ''}`;
  }

  // Progress bar
  const bar = $(`#progress-${type}`);
  if (bar) {
    bar.style.width = `${pct}%`;
    bar.className = `progress-bar ${status === 'complete' ? 'complete' : status === 'over' ? 'over' : ''}`;
  }

  // Counter text
  const text = $(`#counter-${type}-text`);
  if (text) {
    text.textContent = `${count} of ${required} selected`;
    text.className = `counter-text ${status === 'complete' ? 'complete' : status === 'over' ? 'over' : ''}`;
  }

  // Summary chip
  const chip = $(`#summary-${type}`);
  if (chip) {
    const label = type.charAt(0).toUpperCase() + type.slice(1);
    chip.textContent = `${label}: ${count}/${required}`;
    chip.className = `summary-chip ${count === required ? 'complete' : 'incomplete'}`;
  }
}

function updateSubmitButton() {
  const ruralOk = state.ruralSelected.size === state.RURAL_REQUIRED;
  const urbanOk = state.urbanSelected.size === state.URBAN_REQUIRED;

  const btnSubmitRural = $('#btn-submit-rural');
  const btnSubmitUrban = $('#btn-submit-urban');

  if (btnSubmitRural) {
    btnSubmitRural.disabled = false;
    btnSubmitRural.style.opacity = ruralOk ? '1' : '0.7';
  }
  
  if (btnSubmitUrban) {
    btnSubmitUrban.disabled = false;
    btnSubmitUrban.style.opacity = urbanOk ? '1' : '0.7';
  }
}

// ── Submit Logic ──
let pendingSubmitType = null;

$('#btn-submit-rural')?.addEventListener('click', () => {
  const selected = state.ruralSelected.size;
  const required = state.RURAL_REQUIRED;
  if (selected < required) {
    const remaining = required - selected;
    showToast(`⚠️ Please select ${remaining} more candidate${remaining > 1 ? 's' : ''}. You need exactly ${required} for Rural region. (${selected}/${required} selected)`, 'error');
    return;
  }
  pendingSubmitType = 'rural';
  const summary = document.querySelector('.modal-summary');
  if (summary) summary.innerHTML = `<div><strong>Rural:</strong> ${state.RURAL_REQUIRED} candidates selected</div>`;
  $('#modal-confirm').classList.remove('hidden');
});

$('#btn-submit-urban')?.addEventListener('click', () => {
  const selected = state.urbanSelected.size;
  const required = state.URBAN_REQUIRED;
  if (selected < required) {
    const remaining = required - selected;
    showToast(`⚠️ Please select ${remaining} more candidate${remaining > 1 ? 's' : ''}. You need exactly ${required} for Urban region. (${selected}/${required} selected)`, 'error');
    return;
  }
  pendingSubmitType = 'urban';
  const summary = document.querySelector('.modal-summary');
  if (summary) summary.innerHTML = `<div><strong>Urban:</strong> ${state.URBAN_REQUIRED} candidates selected</div>`;
  $('#modal-confirm').classList.remove('hidden');
});

$('#btn-confirm-no')?.addEventListener('click', () => {
  $('#modal-confirm').classList.add('hidden');
  pendingSubmitType = null;
});

$('#btn-confirm-yes')?.addEventListener('click', async () => {
  $('#modal-confirm').classList.add('hidden');
  if (!pendingSubmitType) return;

  const isRural = pendingSubmitType === 'rural';
  const payload = {
    memberId: state.user.id,
  };
  
  if (isRural) {
    payload.rural = [...state.ruralSelected];
  } else {
    payload.urban = [...state.urbanSelected];
  }

  const endpoint = `/api/vote/${pendingSubmitType}`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error, 'error');
      return;
    }
    
    showToast('🎉 ' + data.message);
    
    // Update local state and proceed
    if (isRural) {
      state.user.hasVotedRural = true;
      
      if (state.selectedRegion === 'rural') {
         showToast('🎉 Your vote has been securely recorded. Thank you!');
         $('#btn-back-to-auth').click();
      } else {
         // Navigate to Urban
         $$('.ballot-panel').forEach(p => p.classList.remove('active'));
         const uPanel = $('#panel-urban');
         if (uPanel) uPanel.classList.add('active');
         $('#title-rural')?.classList.add('hidden');
         $('#title-urban')?.classList.remove('hidden');
      }
    } else {
      state.user.hasVotedUrban = true;
      // Vote complete, logout to protect privacy and results
      showToast('🎉 Your vote has been securely recorded. Thank you!');
      $('#btn-back-to-auth').click();
    }
  } catch (err) {
    showToast('Network error submitting vote.', 'error');
  }
  
  pendingSubmitType = null;
});

// ─────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────
async function refreshResultsStats() {
  try {
    const res = await fetch('/api/results', {
      headers: { 'x-admin-token': state.adminToken }
    });
    const data = await res.json();
    if (!res.ok) return;

    $('#results-stats').innerHTML = `
      <div class="stat-item animated" style="animation-delay: 0.1s">
        <div class="stat-value">${data.totalVoters}</div>
        <div class="stat-label">Total Votes Cast</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.2s">
        <div class="stat-value">${data.totalNota || 0}</div>
        <div class="stat-label">NOTA Votes</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.3s">
        <div class="stat-value">${data.totalMembers}</div>
        <div class="stat-label">Total Members</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.4s">
        <div class="stat-value">${((data.totalVoters / data.totalMembers) * 100).toFixed(1)}%</div>
        <div class="stat-label">Turnout</div>
      </div>
    `;
  } catch (err) {
    console.error('Error refreshing stats:', err);
  }
}

async function loadResults() {
  try {
    const res = await fetch('/api/results', {
      headers: { 'x-admin-token': state.adminToken }
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error, 'error');
      return;
    }

    // Stats
    $('#results-stats').innerHTML = `
      <div class="stat-item animated" style="animation-delay: 0.1s">
        <div class="stat-value">${data.totalVoters}</div>
        <div class="stat-label">Total Votes Cast</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.2s">
        <div class="stat-value">${data.totalNota || 0}</div>
        <div class="stat-label">NOTA Votes</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.3s">
        <div class="stat-value">${data.totalMembers}</div>
        <div class="stat-label">Total Members</div>
      </div>
      <div class="stat-item animated" style="animation-delay: 0.4s">
        <div class="stat-value">${((data.totalVoters / data.totalMembers) * 100).toFixed(1)}%</div>
        <div class="stat-label">Turnout</div>
      </div>
    `;

    renderResultsList('results-rural-list', data.rural);
    renderResultsList('results-urban-list', data.urban);

    showScreen('results');
  } catch (err) {
    showToast('Error loading results.', 'error');
  }
}

async function loadAdminSettings() {
  try {
    const settingsRes = await fetch('/api/admin/settings', {
      headers: { 'x-admin-token': state.adminToken }
    });
    const settings = await settingsRes.json();
    $('#admin-open').value = settings.votingOpen.slice(0, 16);
    $('#admin-close').value = settings.votingClose.slice(0, 16);
    $('#admin-ringcaptcha-app-key').value = settings.ringcaptchaAppKey || '';
    $('#admin-ringcaptcha-api-key').value = settings.ringcaptchaApiKey || '';
    $('#admin-smtp-host').value = settings.smtpHost || '';
    $('#admin-smtp-port').value = settings.smtpPort || 587;
    $('#admin-smtp-secure').checked = settings.smtpSecure === true || settings.smtpSecure === 'true';
    $('#admin-smtp-user').value = settings.smtpUser || '';
    $('#admin-smtp-pass').value = settings.smtpPass || '';
    $('#admin-smtp-sender').value = settings.smtpSender || '';
    updateCountdown(settings.votingClose);

    await loadAdminMembers();
  } catch (err) {
    showToast('Error loading admin settings. Please verify login.', 'error');
  }
}

function renderResultsList(containerId, results) {
  const container = $(`#${containerId}`);
  const maxVotes = Math.max(...results.map(r => r.votes), 1);

  container.innerHTML = results.map((r, i) => `
    <div class="result-row animated" style="animation-delay: ${(0.1 * i).toFixed(1)}s">
      <div class="result-rank">${i + 1}</div>
      <div class="result-symbol">${r.symbol}</div>
      <div class="result-name">${r.name}</div>
      <div class="result-bar-wrap">
        <div class="result-bar" style="width:${(r.votes / maxVotes) * 100}%"></div>
      </div>
      <div class="result-votes">${r.votes} vote${r.votes !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

// ── Results Tabs ──
$$('.results-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.results;
    if (target === 'results-admin') {
      verifyAdminAccess(async () => {
        await loadAdminSettings();
        $$('.results-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.results-panel').forEach(p => p.classList.remove('active'));
        $(`#${target}`).classList.add('active');
      });
      return;
    }
    
    $$('.results-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.results-panel').forEach(p => p.classList.remove('active'));
    $(`#${target}`).classList.add('active');
  });
});

// ── Admin Settings ──
$('#btn-admin-save')?.addEventListener('click', async () => {
  const votingOpen = $('#admin-open').value;
  const votingClose = $('#admin-close').value;
  const ringcaptchaAppKey = $('#admin-ringcaptcha-app-key').value.trim();
  const ringcaptchaApiKey = $('#admin-ringcaptcha-api-key').value.trim();
  const smtpHost = $('#admin-smtp-host').value.trim();
  const smtpPort = parseInt($('#admin-smtp-port').value) || 587;
  const smtpSecure = $('#admin-smtp-secure').checked;
  const smtpUser = $('#admin-smtp-user').value.trim();
  const smtpPass = $('#admin-smtp-pass').value.trim();
  const smtpSender = $('#admin-smtp-sender').value.trim();

  if (!votingOpen || !votingClose) {
    showToast('Please set both dates.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-token': state.adminToken
      },
      body: JSON.stringify({ 
        votingOpen, 
        votingClose,
        ringcaptchaAppKey,
        ringcaptchaApiKey,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        smtpSender
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Settings saved!');
      const msg = $('#admin-msg');
      msg.textContent = '✅ Settings saved successfully';
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 3000);
      updateCountdown(votingClose);
    }
  } catch (err) {
    showToast('Error saving settings.', 'error');
  }
});

// ── Countdown ──
let countdownInterval = null;
function updateCountdown(closeDate) {
  if (countdownInterval) clearInterval(countdownInterval);

  const target = new Date(closeDate);
  const container = $('#admin-countdown');

  function tick() {
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) {
      container.innerHTML = `
        <div class="cd-label">Voting Status</div>
        <div style="font-size:1.2rem; font-weight:700; color:var(--danger);">Voting has closed</div>
      `;
      clearInterval(countdownInterval);
      return;
    }

    const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs  = Math.floor((diff % (1000 * 60)) / 1000);

    container.innerHTML = `
      <div class="cd-label">Time Remaining Until Close</div>
      <div class="cd-time">
        <div class="cd-unit"><span class="cd-value">${days}</span><span class="cd-name">Days</span></div>
        <div class="cd-unit"><span class="cd-value">${String(hours).padStart(2,'0')}</span><span class="cd-name">Hours</span></div>
        <div class="cd-unit"><span class="cd-value">${String(mins).padStart(2,'0')}</span><span class="cd-name">Mins</span></div>
        <div class="cd-unit"><span class="cd-value">${String(secs).padStart(2,'0')}</span><span class="cd-name">Secs</span></div>
      </div>
    `;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ── Navigation Buttons ──
$('#btn-back-to-auth')?.addEventListener('click', () => {
  state.user = null;
  state.ruralSelected.clear();
  state.urbanSelected.clear();
  $('#header-user').classList.add('hidden');
  $('#input-member-id').value = '';
  $('#input-phone').value = '';
  $('#input-otp').value = '';
  $('#input-email-auth').value = '';
  $('#input-email-otp').value = '';
  $('#otp-step-verify').classList.add('hidden');
  $('#otp-step-phone').classList.remove('hidden');
  $('#email-step-verify').classList.add('hidden');
  $('#email-step-input').classList.remove('hidden');
  hideMessages();
  showScreen('auth');
});

$('#btn-view-results')?.addEventListener('click', () => {
  verifyAdminAccess(() => loadResults());
});

// ── AUTH: EMAIL OTP FLOW ──
let authEmail = '';

$('#btn-send-email-otp')?.addEventListener('click', async () => {
  const email = $('#input-email-auth').value.trim();
  if (!email) return showAuthError('Please enter a registered email address.');

  try {
    const res = await fetch('/api/auth/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error);

    authEmail = email;
    showAuthSuccess(data.message);
    $('#email-step-input').classList.add('hidden');
    $('#email-step-verify').classList.remove('hidden');
    $('#input-email-otp').focus();
  } catch (err) {
    showAuthError('Network error. Please try again.');
  }
});

$('#btn-verify-email-otp')?.addEventListener('click', async () => {
  const otp = $('#input-email-otp').value.trim();
  if (!otp) return showAuthError('Please enter the OTP.');

  try {
    const res = await fetch('/api/auth/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, otp })
    });
    const data = await res.json();
    if (!res.ok) return showAuthError(data.error);
    handleAuthSuccess(data);
  } catch (err) {
    showAuthError('Network error. Please try again.');
  }
});

$('#input-email-otp')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#btn-verify-email-otp').click();
});

$('#btn-email-back')?.addEventListener('click', () => {
  $('#email-step-verify').classList.add('hidden');
  $('#email-step-input').classList.remove('hidden');
  $('#input-email-otp').value = '';
  hideMessages();
});

// ── Admin Panel Navigation from Auth Screen ──
$('#btn-goto-admin')?.addEventListener('click', () => {
  verifyAdminAccess(async () => {
    await loadResults();
    await loadAdminSettings();
    // Activate Admin Tab and Panel
    $$('.results-tab-btn').forEach(b => b.classList.remove('active'));
    const adminTab = $('[data-results="results-admin"]');
    if (adminTab) adminTab.classList.add('active');
    $$('.results-panel').forEach(p => p.classList.remove('active'));
    $('#results-admin').classList.add('active');
  });
});

let currentAdminFilter = ''; // Store active filter

// ── Load Registered Members List for Admin ──
async function loadAdminMembers(searchQuery = '') {
  try {
    const res = await fetch(`/api/admin/members?search=${encodeURIComponent(searchQuery)}&filter=${encodeURIComponent(currentAdminFilter)}`, {
      headers: { 'x-admin-token': state.adminToken }
    });
    const data = await res.json();
    
    // Update filter counts
    if ($('#filter-count-all')) $('#filter-count-all').textContent = data.totalAll || 0;
    if ($('#filter-count-voted')) $('#filter-count-voted').textContent = data.totalVoted || 0;
    if ($('#filter-count-not-voted')) $('#filter-count-not-voted').textContent = data.totalNotVoted || 0;
    if ($('#filter-count-nota')) $('#filter-count-nota').textContent = data.totalNota || 0;

    const tbody = $('#admin-members-list-body');
    tbody.innerHTML = '';
    
    if (!data.members || data.members.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-dim);">No members found.</td></tr>`;
      return;
    }
    
    data.members.forEach((m, index) => {
      const tr = document.createElement('tr');
      tr.className = 'animate-slide-left';
      tr.style.animationDelay = `${(0.02 * index).toFixed(2)}s`;
      tr.style.borderBottom = '1px solid var(--border)';
      
      let statusBadge = '';
      if (m.status === 'NOTA') {
        statusBadge = `<span style="background: var(--bg-card); color: var(--text-dim); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); font-size: 0.8rem; font-weight: 600;">NOTA</span>`;
      } else if (m.status === 'Voted') {
        statusBadge = `<span class="badge-voted">Voted</span>`;
      } else {
        statusBadge = `<span class="badge-not-voted">Pending</span>`;
      }
        
      const deleteBtn = m.hasVoted
        ? `<span style="color: var(--text-dim); font-size: 0.8rem;">Locked</span>`
        : `<button class="btn-delete-member" data-id="${m.id}">Delete</button>`;
        
      tr.innerHTML = `
        <td style="padding: 10px; font-weight: 600;">${m.id}</td>
        <td style="padding: 10px;">${m.name}</td>
        <td style="padding: 10px;">${m.phone}</td>
        <td style="padding: 10px;">${statusBadge}</td>
        <td style="padding: 10px; text-align: center;">${deleteBtn}</td>
      `;
      tbody.appendChild(tr);
    });
    
    // Add click listeners to delete buttons
    tbody.querySelectorAll('.btn-delete-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm(`Are you sure you want to delete member ${id}?`)) {
          try {
            const deleteRes = await fetch(`/api/admin/members/${id}`, { 
              method: 'DELETE',
              headers: { 'x-admin-token': state.adminToken }
            });
            const deleteData = await deleteRes.json();
            if (deleteRes.ok) {
              showToast('Member deleted successfully.');
              loadAdminMembers($('#input-member-search').value.trim());
              
              // Reload turnout stats
              await refreshResultsStats();
            } else {
              showToast(deleteData.error, 'error');
            }
          } catch (err) {
            showToast('Error deleting member.', 'error');
          }
        }
      });
    });
  } catch (err) {
    console.error('Error loading admin members:', err);
  }
}

// ── Search Member Typing Event ──
$('#input-member-search')?.addEventListener('input', (e) => {
  loadAdminMembers(e.target.value.trim());
});

// ── Filter Tab Click Events ──
$$('.member-filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Update active class
    $$('.member-filter-btn').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Update current filter and reload
    currentAdminFilter = e.currentTarget.dataset.filter || '';
    loadAdminMembers($('#input-member-search')?.value.trim() || '');
  });
});

// ── Add Member Form Submit ──
$('#form-add-member')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = $('#admin-member-id').value.trim();
  const name = $('#admin-member-name').value.trim();
  const phone = $('#admin-member-phone').value.trim();
  const email = $('#admin-member-email').value.trim();
  const address = $('#admin-member-address').value.trim();
  
  try {
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-admin-token': state.adminToken
      },
      body: JSON.stringify({ id, name, phone, email, address })
    });
    const data = await res.json();
    
    if (res.ok) {
      showToast(`Member ${id} added successfully!`);
      $('#form-add-member').reset();
      loadAdminMembers($('#input-member-search').value.trim());
      
      // Reload stats
      await refreshResultsStats();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Error adding member.', 'error');
  }
});

// ── Danger Zone Reset Votes ──
$('#btn-admin-reset')?.addEventListener('click', async () => {
  if (confirm('⚠️ WARNING: Are you sure you want to reset all votes? This will clear all tallies and set all member statuses back to "Not Voted". This cannot be undone!')) {
    try {
      const res = await fetch('/api/admin/reset-votes', { 
        method: 'POST',
        headers: { 'x-admin-token': state.adminToken }
      });
      const data = await res.json();
      if (res.ok) {
        showToast('🔄 ' + data.message);
        await loadResults();
        // Keep the Admin panel active
        $$('.results-tab-btn').forEach(b => b.classList.remove('active'));
        const adminTab = $('[data-results="results-admin"]');
        if (adminTab) adminTab.classList.add('active');
        $$('.results-panel').forEach(p => p.classList.remove('active'));
        $('#results-admin').classList.add('active');
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Error resetting votes.', 'error');
    }
  }
});

// ── Admin Authentication Helper and Modal Handlers ──
function verifyAdminAccess(onSuccess) {
  if (state.adminToken) {
    if (onSuccess) onSuccess();
    return;
  }
  
  // Show admin login modal
  $('#modal-admin-login').classList.remove('hidden');
  $('#input-admin-username').focus();
  $('#admin-login-error').classList.add('hidden');
  
  // Store the success callback
  state.adminSuccessCallback = onSuccess;
}

$('#form-admin-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = $('#input-admin-username').value.trim();
  const password = $('#input-admin-password').value.trim();
  const errorEl = $('#admin-login-error');
  
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      state.adminToken = data.adminToken;
      $('#modal-admin-login').classList.add('hidden');
      $('#form-admin-login').reset();
      
      showToast('Successfully authenticated as Admin.');
      if (state.adminSuccessCallback) {
        state.adminSuccessCallback();
        state.adminSuccessCallback = null;
      }
    } else {
      errorEl.textContent = data.error || 'Invalid credentials.';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = 'Network error. Please try again.';
    errorEl.classList.remove('hidden');
  }
});

$('#btn-admin-login-cancel')?.addEventListener('click', () => {
  $('#modal-admin-login').classList.add('hidden');
  $('#form-admin-login').reset();
  state.adminSuccessCallback = null;
});

// ── Shake Animation (injected) ──
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ── Scroll Sync Animations ──
const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate-slide-up');
      scrollObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

// Observe existing elements on load and when screens change
function observeScrollElements() {
  document.querySelectorAll('.scroll-reveal:not(.animate-slide-up)').forEach(el => {
    scrollObserver.observe(el);
  });
}
observeScrollElements();

// Re-observe when changing screens to trigger animations
const originalShowScreen = showScreen;
window.showScreen = function(screenId) {
  originalShowScreen(screenId);
  setTimeout(observeScrollElements, 100);
};

// Scroll down button
$('#btn-scroll-down')?.addEventListener('click', () => {
  const appSection = $('#app');
  if (appSection) {
    appSection.scrollIntoView({ behavior: 'smooth' });
  }
});

// ── Init ──
console.log('Digital Voting System initialized');
