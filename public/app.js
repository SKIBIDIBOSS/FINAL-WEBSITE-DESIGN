// ═══════════════════════════════════════════
//  SKIBIDIBOSS X LINING TIERS — app.js
// ═══════════════════════════════════════════

let currentUser = null;
let currentPage = 'home';
let pollInterval = null;
let activeTicketId = null;
let finishQueueId = null;

const MODE_ICONS = {
  sumo: '🤼', bedwars: '🛏️', bedfight: '🛡️',
  classic: '⚔️', nodebuff: '💊', spleef: '❄️'
};

const TIER_ORDER = ['Unrated','LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'];

function tierVal(t) { return TIER_ORDER.indexOf(t); }

// ─── INIT ───
window.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  navigate('home');
  startPolling();
});

async function checkAuth() {
  try {
    const r = await fetch('/api/auth/me');
    const d = await r.json();
    if (d.banned) { showBannedOverlay(); return; }
    if (d.user) setUser(d.user);
    else clearUser();
  } catch {}
}

function setUser(user) {
  currentUser = user;
  document.getElementById('sidebar-auth').classList.add('hidden');
  document.getElementById('profile-nav').classList.remove('hidden');
  document.getElementById('logout-nav').classList.remove('hidden');

  document.querySelectorAll('.tester-only').forEach(el => {
    if (user.role === 'tester' || user.role === 'admin') el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
  document.querySelectorAll('.admin-only').forEach(el => {
    if (user.role === 'admin') el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

function clearUser() {
  currentUser = null;
  document.getElementById('sidebar-auth').classList.remove('hidden');
  document.getElementById('profile-nav').classList.add('hidden');
  document.getElementById('logout-nav').classList.add('hidden');
  document.querySelectorAll('.tester-only').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}

function showBannedOverlay() {
  currentUser = null;
  document.getElementById('banned-overlay').classList.remove('hidden');
}

function handleBannedContinue() {
  document.getElementById('banned-overlay').classList.add('hidden');
  navigate('leaderboard');
}

// ─── NAVIGATION ───
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'home') renderHome();
  else if (page === 'leaderboard') loadLeaderboard('overall');
  else if (page === 'forum') loadForum();
  else if (page === 'queues') renderQueues();
  else if (page === 'results-low') loadResults('low');
  else if (page === 'results-high') loadResults('high');
  else if (page === 'apply') renderApply();
  else if (page === 'ban-forum') loadBanForum();
  else if (page === 'tickets') loadTickets();
  else if (page === 'profile') renderProfile();
  else if (page === 'admin') adminTab('users');
  else if (page === 'auth') {}
}

// ─── HOME ───
async function renderHome() {
  const r = await fetch('/api/leaderboard?mode=overall');
  const data = await r.json();
  const el = document.getElementById('home-leaderboard');
  el.innerHTML = renderLeaderboardTable(data.slice(0,5), 'overall');
}

// ─── LEADERBOARD ───
async function loadLeaderboard(mode, btn) {
  if (btn) {
    document.querySelectorAll('.mode-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const r = await fetch('/api/leaderboard?mode=' + mode);
  const data = await r.json();
  document.getElementById('leaderboard-content').innerHTML = renderLeaderboardTable(data, mode);
}

function renderLeaderboardTable(rows, mode) {
  if (!rows.length) return '<div class="empty-state">No ranked players yet</div>';
  
  const isOverall = mode === 'overall';
  let html = `<table class="leaderboard-table"><thead><tr>
    <th>#</th><th>Player</th>`;
  
  if (isOverall) {
    html += '<th>Best Tier</th><th>Modes Ranked</th>';
  } else {
    html += `<th>${MODE_ICONS[mode]||''} Tier</th>`;
  }
  html += '</tr></thead><tbody>';

  rows.forEach((row, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const initial = (row.username || '?')[0].toUpperCase();
    const pfpHtml = row.pfp
      ? `<img src="${escHtml(row.pfp)}" alt="" />`
      : initial;

    let tierDisplay = '';
    if (isOverall) {
      const bestVal = row.best_val || 0;
      const bestTier = TIER_ORDER[bestVal] || 'Unrated';
      tierDisplay = `<td>${tierBadge(bestTier)}</td><td>${row.tier_count||0}</td>`;
    } else {
      tierDisplay = `<td>${tierBadge(row.tier)} ${modeIcon(row.mode)}</td>`;
    }

    html += `<tr>
      <td><span class="rank-badge ${rankClass}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</span></td>
      <td>
        <div class="username-cell" onclick="viewProfile('${row.id}')">
          <div class="avatar">${pfpHtml}</div>
          <div>
            <div class="username-text"><strong>${escHtml(row.username)}</strong></div>
            <div style="font-size:11px;color:var(--text-muted)">${escHtml(row.ign||'')}</div>
          </div>
          ${row.role !== 'user' ? `<span class="role-badge role-${row.role}">${row.role}</span>` : ''}
          ${row.banned ? '<span class="status-badge status-voided">Banned</span>' : ''}
        </div>
      </td>
      ${tierDisplay}
    </tr>`;
  });

  html += '</tbody></table>';
  return html;
}

function tierBadge(tier) {
  if (!tier || tier === 'Unrated') return `<span class="tier-badge tier-Unrated">Unrated</span>`;
  return `<span class="tier-badge tier-${tier}">${tier}</span>`;
}

function modeIcon(mode) {
  return MODE_ICONS[mode] || '';
}

// ─── FORUM ───
async function loadForum() {
  const r = await fetch('/api/forum');
  const msgs = await r.json();
  const el = document.getElementById('forum-messages');
  el.innerHTML = msgs.map(m => renderMsg(m, 'forum')).join('');
  el.scrollTop = el.scrollHeight;

  const inputArea = document.getElementById('forum-input-area');
  const loginPrompt = document.getElementById('forum-login-prompt');
  if (currentUser) {
    inputArea.classList.remove('hidden');
    loginPrompt.classList.add('hidden');
  } else {
    inputArea.classList.add('hidden');
    loginPrompt.classList.remove('hidden');
  }
}

function renderMsg(m, type) {
  const initial = (m.username||'?')[0].toUpperCase();
  const isAdminOrTester = currentUser && (currentUser.role === 'admin' || currentUser.role === 'tester');
  const pfpHtml = m.pfp ? `<img src="${escHtml(m.pfp)}" alt="" />` : initial;
  const nameClass = m.role === 'admin' ? 'admin-name' : m.role === 'tester' ? 'tester-name' : '';
  const roleTag = m.role !== 'user' ? `<span class="role-badge role-${m.role}">${m.role}</span>` : '';
  const delBtn = isAdminOrTester
    ? `<button class="msg-delete" onclick="deleteMsg('${type}','${m.id}')">🗑 Delete</button>`
    : '';

  return `<div class="message" id="msg-${m.id}">
    <div class="msg-avatar"><div class="avatar">${pfpHtml}</div></div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-name ${nameClass}">${escHtml(m.username)}</span>
        ${roleTag}
        <span class="msg-time">${fmtTime(m.created_at)}</span>
      </div>
      <div class="msg-content">${escHtml(m.content)}</div>
    </div>
    ${delBtn}
  </div>`;
}

async function sendForum() {
  const input = document.getElementById('forum-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const r = await fetch('/api/forum', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ content })
  });
  if (r.ok) {
    const msg = await r.json();
    const el = document.getElementById('forum-messages');
    el.insertAdjacentHTML('beforeend', renderMsg(msg, 'forum'));
    el.scrollTop = el.scrollHeight;
  }
}

async function deleteMsg(type, id) {
  const url = type === 'forum' ? `/api/forum/${id}` : `/api/banforum/${id}`;
  await fetch(url, { method: 'DELETE' });
  const el = document.getElementById('msg-' + id);
  if (el) el.remove();
}

// ─── BAN FORUM ───
async function loadBanForum() {
  const r = await fetch('/api/banforum');
  if (!r.ok) return;
  const msgs = await r.json();
  const el = document.getElementById('banforum-messages');
  el.innerHTML = msgs.map(m => renderMsg(m, 'banforum')).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendBanForum() {
  const input = document.getElementById('banforum-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const r = await fetch('/api/banforum', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ content })
  });
  if (r.ok) {
    const msg = await r.json();
    const el = document.getElementById('banforum-messages');
    el.insertAdjacentHTML('beforeend', renderMsg(msg, 'banforum'));
    el.scrollTop = el.scrollHeight;
  }
}

// ─── QUEUES ───
async function renderQueues() {
  const el = document.getElementById('queues-content');

  if (!currentUser) {
    el.innerHTML = `<div class="join-queue-btn-wrap">
      <p class="text-muted">You need to be logged in to join a queue.</p>
      <button class="btn-primary" onclick="navigate('auth')">Login / Sign Up</button>
    </div>`;
    return;
  }

  if (currentUser.role === 'user') {
    el.innerHTML = `<div class="join-queue-btn-wrap">
      <p class="text-muted">Select a mode and join the queue to get tested.</p>
      <button class="btn-primary" onclick="openQueuePopup()">⚔️ Join Queue</button>
    </div>`;
    return;
  }

  // Tester / admin: show queues
  const r = await fetch('/api/queue');
  if (!r.ok) { el.innerHTML = '<div class="empty-state">Error loading queues</div>'; return; }
  const queues = await r.json();

  if (!queues.length) { el.innerHTML = '<div class="empty-state">No active queues</div>'; return; }

  el.innerHTML = queues.map(q => `
    <div class="queue-card">
      <div class="queue-card-header">
        <span class="queue-mode-badge">${MODE_ICONS[q.mode]||''} ${q.mode.toUpperCase()}</span>
        <span class="status-badge status-waiting">Waiting</span>
      </div>
      <div class="queue-info">
        <div class="queue-info-item"><span class="queue-info-label">Player</span><span class="queue-info-value">${escHtml(q.username)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">IGN</span><span class="queue-info-value">${escHtml(q.ign)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Timezone</span><span class="queue-info-value">${escHtml(q.timezone)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Region</span><span class="queue-info-value">${escHtml(q.region)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Server</span><span class="queue-info-value">${escHtml(q.server)}</span></div>
      </div>
      <div class="queue-actions">
        <button class="btn-success" onclick="acceptQueue('${q.id}')">✅ Accept</button>
        <button class="btn-danger" onclick="voidQueue('${q.id}')">❌ Void</button>
      </div>
    </div>
  `).join('');
}

function openQueuePopup() {
  document.getElementById('queue-popup').classList.remove('hidden');
}

function closeQueuePopup() {
  document.getElementById('queue-popup').classList.add('hidden');
}

async function submitQueue() {
  const mode = document.getElementById('queue-mode').value;
  const ign = document.getElementById('queue-ign').value.trim();
  const timezone = document.getElementById('queue-timezone').value.trim();
  const region = document.getElementById('queue-region').value.trim();
  const server = document.getElementById('queue-server').value.trim();

  if (!mode || !ign || !timezone || !region || !server) {
    alert('Please fill in all fields');
    return;
  }

  const r = await fetch('/api/queue/join', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ mode, ign, timezone, region, server })
  });
  const d = await r.json();
  if (r.ok) {
    closeQueuePopup();
    alert('✅ You have joined the queue! A tester will accept your ticket soon.');
  } else {
    alert('Error: ' + d.error);
  }
}

async function acceptQueue(id) {
  const r = await fetch(`/api/queue/${id}/accept`, { method: 'POST' });
  if (r.ok) {
    renderQueues();
    navigate('tickets');
    loadTickets();
  } else {
    const d = await r.json();
    alert('Error: ' + d.error);
  }
}

async function voidQueue(id) {
  if (!confirm('Void this queue ticket?')) return;
  const r = await fetch(`/api/queue/${id}/void`, { method: 'POST' });
  if (r.ok) renderQueues();
}

// ─── TICKETS ───
async function loadTickets() {
  const el = document.getElementById('tickets-content');
  if (!currentUser) { el.innerHTML = '<div class="empty-state">Login required</div>'; return; }
  const r = await fetch('/api/tickets/my');
  const tickets = await r.json();
  if (!tickets.length) { el.innerHTML = '<div class="empty-state">No tickets yet</div>'; return; }
  el.innerHTML = tickets.map(t => renderTicket(t)).join('');
}

function renderTicket(t) {
  const isTestParty = currentUser && (currentUser.role === 'tester' || currentUser.role === 'admin');
  const isTesterOfTicket = currentUser && t.tester_id === currentUser.id;
  const canFinish = (isTesterOfTicket || currentUser?.role === 'admin') && t.status === 'active';
  const canVoid = isTestParty && t.status === 'active';

  return `<div class="ticket-wrap" id="ticket-${t.id}">
    <div class="ticket-header" onclick="toggleTicket('${t.id}')">
      <div style="display:flex;align-items:center;gap:12px">
        <span>${MODE_ICONS[t.mode]||''} <strong>${t.mode?.toUpperCase()}</strong></span>
        <span class="text-muted" style="font-size:13px">vs ${escHtml(t.testee_name || t.tester_name || '?')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="status-badge status-${t.status}">${t.status}</span>
        <span style="color:var(--text-muted)">▾</span>
      </div>
    </div>
    <div class="ticket-body" id="ticket-body-${t.id}">
      <div class="ticket-chat" id="ticket-chat-${t.id}"></div>
      ${t.status === 'active' ? `
        <div class="ticket-input-row">
          <input type="text" id="ticket-input-${t.id}" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendTicketMsg('${t.id}')" />
          <button class="btn-send" onclick="sendTicketMsg('${t.id}')">Send</button>
        </div>` : ''}
      ${canFinish || canVoid ? `
        <div class="ticket-actions">
          ${canFinish ? `<button class="btn-primary" onclick="openFinishPopup('${t.id}','${t.mode}')">🏁 Finish Test</button>` : ''}
          ${canVoid ? `<button class="btn-danger" onclick="voidTicket('${t.id}')">❌ Void</button>` : ''}
        </div>` : ''}
    </div>
  </div>`;
}

function toggleTicket(id) {
  const body = document.getElementById('ticket-body-' + id);
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open');
  if (!isOpen) loadTicketMessages(id);
}

async function loadTicketMessages(id) {
  const r = await fetch(`/api/tickets/${id}/messages`);
  if (!r.ok) return;
  const msgs = await r.json();
  const el = document.getElementById('ticket-chat-' + id);
  if (!el) return;
  el.innerHTML = msgs.map(m => `
    <div class="message">
      <div class="msg-avatar"><div class="avatar">${(m.username||'?')[0].toUpperCase()}</div></div>
      <div class="msg-body">
        <div class="msg-header">
          <span class="msg-name ${m.role === 'admin' ? 'admin-name' : ''}">${escHtml(m.username)}</span>
          <span class="msg-time">${fmtTime(m.created_at)}</span>
        </div>
        <div class="msg-content">${escHtml(m.content)}</div>
      </div>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

async function sendTicketMsg(id) {
  const input = document.getElementById('ticket-input-' + id);
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  const r = await fetch(`/api/tickets/${id}/messages`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ content })
  });
  if (r.ok) loadTicketMessages(id);
}

async function voidTicket(id) {
  if (!confirm('Void this ticket?')) return;
  const r = await fetch(`/api/queue/${id}/void`, { method: 'POST' });
  if (r.ok) loadTickets();
}

// ─── FINISH TEST ───
function openFinishPopup(queueId, mode) {
  finishQueueId = queueId;
  document.getElementById('finish-popup-info').textContent = `Mode: ${mode?.toUpperCase()} | FT5`;
  document.getElementById('finish-tester-score').value = '';
  document.getElementById('finish-testee-score').value = '';
  document.getElementById('finish-tier').value = '';
  document.getElementById('finish-popup').classList.remove('hidden');
}

function closeFinishPopup() {
  document.getElementById('finish-popup').classList.add('hidden');
  finishQueueId = null;
}

async function submitFinish() {
  const ts = parseInt(document.getElementById('finish-tester-score').value);
  const tes = parseInt(document.getElementById('finish-testee-score').value);
  const tier = document.getElementById('finish-tier').value;

  if (isNaN(ts) || isNaN(tes) || ts < 0 || tes < 0 || ts > 5 || tes > 5) {
    alert('Enter valid scores (0-5)');
    return;
  }
  if (ts + tes > 5) { alert('Total cannot exceed 5'); return; }

  const r = await fetch(`/api/queue/${finishQueueId}/finish`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ testerScore: ts, testeeScore: tes, tierAwarded: tier || undefined })
  });
  const d = await r.json();
  if (r.ok) {
    closeFinishPopup();
    alert(`✅ Test complete! Tier awarded: ${d.tierAwarded}`);
    loadTickets();
  } else {
    alert('Error: ' + d.error);
  }
}

// ─── RESULTS ───
async function loadResults(type) {
  const el = document.getElementById('results-' + type + '-content');
  const r = await fetch('/api/results?type=' + (type === 'high' ? 'high' : 'low'));
  const results = await r.json();
  if (!results.length) { el.innerHTML = '<div class="empty-state">No results yet</div>'; return; }
  el.innerHTML = results.map(res => `
    <div class="result-card">
      <div>
        <div style="font-size:13px;color:var(--text-muted)">${fmtDate(res.created_at)}</div>
        <div style="font-weight:600">${MODE_ICONS[res.mode]||''} ${res.mode?.toUpperCase()}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:12px;color:var(--text-muted)">Score</div>
        <div style="font-weight:700;font-size:16px">${escHtml(res.score)}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Testee</div>
        <div style="font-weight:500">${escHtml(res.testee_name)}</div>
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Tier Awarded</div>
        ${tierBadge(res.tier_awarded)}
      </div>
      <div>
        <div style="font-size:12px;color:var(--text-muted)">Tester</div>
        <div style="font-size:13px;color:var(--text-muted)">${escHtml(res.tester_name)}</div>
      </div>
    </div>
  `).join('');
}

// ─── APPLY ───
async function renderApply() {
  const el = document.getElementById('apply-content');
  el.innerHTML = `<div class="apply-form">
    <h2 style="font-family:'Orbitron',sans-serif;font-size:18px">Tester Application</h2>
    <div>
      <label>Why do you want to be a tester?</label>
      <textarea id="apply-reason" placeholder="Explain your motivation, experience, etc..."></textarea>
    </div>
    <div>
      <label>Are you LT3 or above in any mode?</label>
      <select id="apply-lt3" class="input-field">
        <option value="yes">Yes, I am LT3+</option>
        <option value="no">No, I need to prove myself</option>
      </select>
    </div>
    <div id="apply-fight-fields">
      <label>If not LT3, when can you fight a tester/admin? (Time & Date)</label>
      <input id="apply-time" class="input-field" type="text" placeholder="e.g. Saturday 8PM EST" />
      <br/><br/>
      <label>Region</label>
      <input id="apply-region" class="input-field" type="text" placeholder="e.g. NA, EU" />
      <br/><br/>
      <label>Preferred Server</label>
      <input id="apply-server" class="input-field" type="text" placeholder="e.g. Hypixel, Minemen" />
    </div>
    <button class="btn-primary" onclick="submitApply()" style="align-self:flex-start">Submit Application</button>
    <div id="apply-msg"></div>
  </div>`;

  document.getElementById('apply-lt3').addEventListener('change', function() {
    const ff = document.getElementById('apply-fight-fields');
    ff.style.display = this.value === 'no' ? 'block' : 'none';
  });
  document.getElementById('apply-fight-fields').style.display = 'none';
}

async function submitApply() {
  if (!currentUser) { navigate('auth'); return; }
  const reason = document.getElementById('apply-reason').value.trim();
  const is_lt3 = document.getElementById('apply-lt3').value;
  const fight_time = document.getElementById('apply-time')?.value.trim();
  const fight_region = document.getElementById('apply-region')?.value.trim();
  const fight_server = document.getElementById('apply-server')?.value.trim();
  const msgEl = document.getElementById('apply-msg');

  if (!reason) { msgEl.innerHTML = '<span class="err-msg">Please explain your motivation</span>'; return; }

  const r = await fetch('/api/apply', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ reason, is_lt3, fight_time, fight_server, fight_region })
  });
  if (r.ok) {
    msgEl.innerHTML = '<span class="success-msg">✅ Application submitted! An admin will review it.</span>';
  } else {
    const d = await r.json();
    msgEl.innerHTML = `<span class="err-msg">Error: ${d.error}</span>`;
  }
}

// ─── PROFILE ───
async function renderProfile(userId) {
  const el = document.getElementById('profile-content');
  const id = userId || currentUser?.id;
  if (!id) { el.innerHTML = '<div class="empty-state">Login required</div>'; return; }

  const r = await fetch('/api/profile/' + id);
  const profile = await r.json();
  const isOwnProfile = currentUser?.id === id;

  const pfpHtml = profile.pfp
    ? `<img src="${escHtml(profile.pfp)}" alt="" />`
    : (profile.username||'?')[0].toUpperCase();

  let tiersHtml = '<div class="profile-tiers">';
  (profile.tiers||[]).forEach(t => {
    tiersHtml += `<div class="profile-tier-item">
      <div class="profile-tier-mode">${MODE_ICONS[t.mode]||''} ${t.mode}</div>
      ${tierBadge(t.tier)}
    </div>`;
  });
  tiersHtml += '</div>';

  let editHtml = '';
  if (isOwnProfile && !profile.banned) {
    editHtml = `<hr style="border-color:var(--border);margin:20px 0"/>
    <h3 style="margin-bottom:16px;font-family:'Rajdhani',sans-serif;font-size:18px;font-weight:700">Edit Profile</h3>
    <div class="edit-form">
      <div class="edit-group"><label>Username</label><input class="input-field" id="edit-username" type="text" value="${escHtml(profile.username)}" /></div>
      <div class="edit-group"><label>IGN</label><input class="input-field" id="edit-ign" type="text" value="${escHtml(profile.ign||'')}" /></div>
      <div class="edit-group"><label>Profile Picture URL</label><input class="input-field" id="edit-pfp" type="text" value="${escHtml(profile.pfp||'')}" placeholder="https://..." /></div>
      <div class="edit-group"><label>New Password (leave blank to keep)</label><input class="input-field" id="edit-pass" type="password" placeholder="New password" /></div>
      <button class="btn-primary" onclick="saveProfile()" style="align-self:flex-start">Save Changes</button>
      <div id="profile-msg"></div>
    </div>`;
  }

  const extraInfo = (profile.role === 'tester' || profile.role === 'admin')
    ? `<div style="font-size:13px;color:var(--text-muted)">Tests Completed: <strong style="color:var(--text)">${profile.tests_done||0}</strong></div>`
    : '';

  el.innerHTML = `<div class="profile-card">
    <div class="profile-header">
      <div class="profile-avatar">${pfpHtml}</div>
      <div class="profile-info">
        <h2>${escHtml(profile.username)}</h2>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          ${profile.role !== 'user' ? `<span class="role-badge role-${profile.role}">${profile.role}</span>` : ''}
          ${profile.banned ? '<span class="status-badge status-voided">Banned</span>' : ''}
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:6px">IGN: ${escHtml(profile.ign||'-')}</div>
        ${extraInfo}
      </div>
    </div>
    <div class="profile-body">
      <h3 style="margin-bottom:14px;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Tiers</h3>
      ${tiersHtml}
      ${editHtml}
    </div>
  </div>`;
}

async function saveProfile() {
  const username = document.getElementById('edit-username')?.value.trim();
  const ign = document.getElementById('edit-ign')?.value.trim();
  const pfp = document.getElementById('edit-pfp')?.value.trim();
  const password = document.getElementById('edit-pass')?.value;
  const msgEl = document.getElementById('profile-msg');

  const r = await fetch('/api/profile', {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, ign, pfp, password })
  });
  if (r.ok) {
    msgEl.innerHTML = '<span class="success-msg">✅ Profile updated!</span>';
    await checkAuth();
    renderProfile();
  } else {
    const d = await r.json();
    msgEl.innerHTML = `<span class="err-msg">Error: ${d.error}</span>`;
  }
}

function viewProfile(id) {
  navigate('profile');
  renderProfile(id);
}

// ─── AUTH ───
function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err = document.getElementById('login-err');
  err.textContent = '';
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, password })
  });
  const d = await r.json();
  if (r.ok) {
    setUser(d.user);
    navigate('home');
  } else {
    if (d.banned) showBannedOverlay();
    else err.textContent = d.error || 'Login failed';
  }
}

async function doRegister() {
  const username = document.getElementById('reg-user').value.trim();
  const ign = document.getElementById('reg-ign').value.trim();
  const password = document.getElementById('reg-pass').value;
  const err = document.getElementById('reg-err');
  err.textContent = '';
  const r = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, ign, password })
  });
  const d = await r.json();
  if (r.ok) {
    setUser(d.user);
    navigate('home');
  } else {
    err.textContent = d.error || 'Registration failed';
  }
}

async function doLogout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  clearUser();
  navigate('home');
}

// ─── ADMIN PANEL ───
async function adminTab(tab, btn) {
  if (btn) {
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const el = document.getElementById('admin-content');
  el.innerHTML = '<div class="empty-state">Loading...</div>';

  if (tab === 'users') await adminRenderUsers(el);
  else if (tab === 'testers') adminRenderAddTester(el);
  else if (tab === 'queues') await adminRenderQueues(el);
  else if (tab === 'applications') await adminRenderApplications(el);
}

async function adminRenderUsers(el) {
  const r = await fetch('/api/admin/users');
  const users = await r.json();
  if (!users.length) { el.innerHTML = '<div class="empty-state">No users</div>'; return; }
  el.innerHTML = users.map(u => adminUserCard(u)).join('');
}

function adminUserCard(u) {
  const tiersHtml = u.tiers.map(t => `
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:12px;color:var(--text-muted);width:70px">${MODE_ICONS[t.mode]||''} ${t.mode}</span>
      ${tierBadge(t.tier)}
    </div>
  `).join('');

  const tierEdits = u.tiers.map(t => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="width:80px;font-size:13px">${MODE_ICONS[t.mode]||''} ${t.mode}</span>
      <select class="input-field" id="tier-${u.id}-${t.mode}" style="width:auto">
        ${TIER_ORDER.map(tier => `<option value="${tier}" ${tier===t.tier?'selected':''}>${tier}</option>`).join('')}
      </select>
    </div>
  `).join('');

  return `<div class="admin-user-card" id="auc-${u.id}">
    <div class="admin-user-header">
      <div class="admin-user-info">
        <div class="avatar">${(u.username||'?')[0].toUpperCase()}</div>
        <div>
          <div style="font-weight:700">${escHtml(u.username)} <span class="role-badge role-${u.role}">${u.role}</span></div>
          <div style="font-size:12px;color:var(--text-muted)">IGN: ${escHtml(u.ign||'-')}</div>
          ${u.banned ? '<span class="status-badge status-voided">Banned</span>' : ''}
        </div>
      </div>
      <div class="admin-actions">
        <button class="btn-secondary" onclick="adminToggleEdit('${u.id}')">✏️ Edit</button>
        ${!u.banned
          ? `<button class="btn-danger" onclick="adminBanUser('${u.id}')">🔨 Ban</button>`
          : `<button class="btn-success" onclick="adminUnbanUser('${u.id}')">✅ Unban</button>`
        }
      </div>
    </div>
    <div class="admin-tiers-row">${tiersHtml}</div>
    <div id="admin-edit-${u.id}" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div><label class="label">Username</label><input class="input-field" id="aedit-user-${u.id}" value="${escHtml(u.username)}" /></div>
        <div><label class="label">IGN</label><input class="input-field" id="aedit-ign-${u.id}" value="${escHtml(u.ign||'')}" /></div>
        <div><label class="label">Role</label>
          <select class="input-field" id="aedit-role-${u.id}">
            <option value="user" ${u.role==='user'?'selected':''}>User</option>
            <option value="tester" ${u.role==='tester'?'selected':''}>Tester</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">${tierEdits}</div>
      <button class="btn-primary" onclick="adminSaveUser('${u.id}', ${JSON.stringify(u.tiers.map(t=>t.mode)).replace(/"/g,'&quot;')})">💾 Save</button>
      <div id="aedit-msg-${u.id}" style="margin-top:8px"></div>
    </div>
  </div>`;
}

function adminToggleEdit(id) {
  const el = document.getElementById('admin-edit-' + id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function adminSaveUser(id, modes) {
  const username = document.getElementById(`aedit-user-${id}`)?.value.trim();
  const ign = document.getElementById(`aedit-ign-${id}`)?.value.trim();
  const role = document.getElementById(`aedit-role-${id}`)?.value;
  const msgEl = document.getElementById(`aedit-msg-${id}`);

  const tiers = modes.map(m => ({
    mode: m,
    tier: document.getElementById(`tier-${id}-${m}`)?.value || 'Unrated'
  }));

  const r = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, ign, role, tiers })
  });
  if (r.ok) {
    msgEl.innerHTML = '<span class="success-msg">✅ Saved</span>';
    setTimeout(() => adminTab('users'), 800);
  } else {
    const d = await r.json();
    msgEl.innerHTML = `<span class="err-msg">Error: ${d.error}</span>`;
  }
}

async function adminBanUser(id) {
  if (!confirm('Ban this user?')) return;
  await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ banned: true })
  });
  adminTab('users');
}

async function adminUnbanUser(id) {
  await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ banned: false })
  });
  adminTab('users');
}

function adminRenderAddTester(el) {
  el.innerHTML = `<div class="tester-form">
    <h2 style="font-family:'Orbitron',sans-serif;font-size:18px">Add Tester</h2>
    <div><label class="label">Username</label><input class="input-field" id="new-tester-user" placeholder="Tester username" /></div>
    <div><label class="label">Password</label><input class="input-field" id="new-tester-pass" type="password" placeholder="Min 6 characters" /></div>
    <button class="btn-primary" onclick="adminAddTester()">Add Tester</button>
    <div id="tester-add-msg"></div>
  </div>`;
}

async function adminAddTester() {
  const username = document.getElementById('new-tester-user')?.value.trim();
  const password = document.getElementById('new-tester-pass')?.value;
  const msgEl = document.getElementById('tester-add-msg');

  const r = await fetch('/api/admin/testers', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, password })
  });
  if (r.ok) {
    msgEl.innerHTML = `<span class="success-msg">✅ Tester "${username}" added! They can now login.</span>`;
    document.getElementById('new-tester-user').value = '';
    document.getElementById('new-tester-pass').value = '';
  } else {
    const d = await r.json();
    msgEl.innerHTML = `<span class="err-msg">Error: ${d.error}</span>`;
  }
}

async function adminRenderQueues(el) {
  const r = await fetch('/api/admin/queues');
  const queues = await r.json();
  if (!queues.length) { el.innerHTML = '<div class="empty-state">No queues</div>'; return; }
  el.innerHTML = queues.map(q => `
    <div class="queue-card">
      <div class="queue-card-header">
        <span class="queue-mode-badge">${MODE_ICONS[q.mode]||''} ${q.mode?.toUpperCase()}</span>
        <span class="status-badge status-${q.status}">${q.status}</span>
      </div>
      <div class="queue-info">
        <div class="queue-info-item"><span class="queue-info-label">Testee</span><span class="queue-info-value">${escHtml(q.testee_name||'?')}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Tester</span><span class="queue-info-value">${escHtml(q.tester_name||'Unassigned')}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">IGN</span><span class="queue-info-value">${escHtml(q.ign)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Region</span><span class="queue-info-value">${escHtml(q.region)}</span></div>
        <div class="queue-info-item"><span class="queue-info-label">Server</span><span class="queue-info-value">${escHtml(q.server)}</span></div>
      </div>
      ${q.status === 'waiting' ? `<div class="queue-actions">
        <button class="btn-success" onclick="acceptQueue('${q.id}')">✅ Accept</button>
        <button class="btn-danger" onclick="voidQueue('${q.id}')">❌ Void</button>
      </div>` : ''}
    </div>
  `).join('');
}

async function adminRenderApplications(el) {
  const r = await fetch('/api/apply');
  const apps = await r.json();
  if (!apps.length) { el.innerHTML = '<div class="empty-state">No applications</div>'; return; }
  el.innerHTML = apps.map(a => `
    <div class="admin-user-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <strong>${escHtml(a.username)}</strong>
          <span class="status-badge status-${a.status}" style="margin-left:8px">${a.status}</span>
        </div>
        <span style="font-size:12px;color:var(--text-muted)">${fmtDate(a.created_at)}</span>
      </div>
      <div style="font-size:13px;margin-bottom:8px"><span class="label">Reason:</span><br/>${escHtml(a.reason)}</div>
      <div style="font-size:13px;margin-bottom:8px"><span class="label">Is LT3:</span> ${a.is_lt3}</div>
      ${a.fight_time ? `<div style="font-size:13px"><span class="label">Fight Time:</span> ${escHtml(a.fight_time)} | <span class="label">Region:</span> ${escHtml(a.fight_region||'')} | <span class="label">Server:</span> ${escHtml(a.fight_server||'')}</div>` : ''}
    </div>
  `).join('');
}

// ─── POLLING ───
function startPolling() {
  pollInterval = setInterval(async () => {
    if (currentPage === 'forum') await refreshForum();
    else if (currentPage === 'tickets') await refreshTickets();
    else if (currentPage === 'ban-forum') await loadBanForum();
  }, 4000);
}

async function refreshForum() {
  const r = await fetch('/api/forum');
  const msgs = await r.json();
  const el = document.getElementById('forum-messages');
  if (!el) return;
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
  el.innerHTML = msgs.map(m => renderMsg(m, 'forum')).join('');
  if (atBottom) el.scrollTop = el.scrollHeight;
}

async function refreshTickets() {
  const openTickets = document.querySelectorAll('.ticket-body.open');
  for (const body of openTickets) {
    const id = body.id.replace('ticket-body-', '');
    await loadTicketMessages(id);
  }
}

// ─── UTILS ───
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal').classList.add('hidden');
}
```

---

## ✅ Admin Login Credentials
```
Username: Localboii
Password: Admin@1234!
