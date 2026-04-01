// ═══════════════════════════════════════════
//  SKIBIDIBOSS X LINING TIERS — app.js
// ═══════════════════════════════════════════

var currentUser = null;
var currentPage = 'home';
var pollInterval = null;
var finishQueueId = null;

var MODE_ICONS = {
  sumo: '🤼', bedwars: '🛏️', bedfight: '🛡️',
  classic: '⚔️', nodebuff: '💊', spleef: '❄️'
};

var TIER_ORDER = ['Unrated','LT5','HT5','LT4','HT4','LT3','HT3','LT2','HT2','LT1','HT1'];

// ─── INIT ───
document.addEventListener('DOMContentLoaded', function() {
  checkAuth().then(function() {
    navigate('home');
    startPolling();
  });
});

// ─── AUTH CHECK ───
async function checkAuth() {
  try {
    var r = await fetch('/api/auth/me');
    var d = await r.json();
    if (d.banned) {
      showBannedOverlay();
      return;
    }
    if (d.user) {
      setUser(d.user);
    } else {
      clearUser();
    }
  } catch(e) {
    console.log('Auth check error:', e);
  }
}

function setUser(user) {
  currentUser = user;

  var authEl = document.getElementById('sidebar-auth');
  var profileNav = document.getElementById('profile-nav');
  var logoutNav = document.getElementById('logout-nav');

  if (authEl) authEl.classList.add('hidden');
  if (profileNav) profileNav.classList.remove('hidden');
  if (logoutNav) logoutNav.classList.remove('hidden');

  var testerEls = document.querySelectorAll('.tester-only');
  testerEls.forEach(function(el) {
    if (user.role === 'tester' || user.role === 'admin') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  var adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(function(el) {
    if (user.role === 'admin') {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

function clearUser() {
  currentUser = null;

  var authEl = document.getElementById('sidebar-auth');
  var profileNav = document.getElementById('profile-nav');
  var logoutNav = document.getElementById('logout-nav');

  if (authEl) authEl.classList.remove('hidden');
  if (profileNav) profileNav.classList.add('hidden');
  if (logoutNav) logoutNav.classList.add('hidden');

  document.querySelectorAll('.tester-only').forEach(function(el) {
    el.classList.add('hidden');
  });
  document.querySelectorAll('.admin-only').forEach(function(el) {
    el.classList.add('hidden');
  });
}

function showBannedOverlay() {
  currentUser = null;
  var el = document.getElementById('banned-overlay');
  if (el) el.classList.remove('hidden');
}

function handleBannedContinue() {
  var el = document.getElementById('banned-overlay');
  if (el) el.classList.add('hidden');
  navigate('leaderboard');
}

// ─── NAVIGATION ───
function navigate(page) {
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.remove('active');
  });

  var pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  var navEl = document.querySelector('[data-page="' + page + '"]');
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  if (page === 'home') renderHome();
  else if (page === 'leaderboard') loadLeaderboard('overall', null);
  else if (page === 'forum') loadForum();
  else if (page === 'queues') renderQueues();
  else if (page === 'results-low') loadResults('low');
  else if (page === 'results-high') loadResults('high');
  else if (page === 'apply') renderApply();
  else if (page === 'ban-forum') loadBanForum();
  else if (page === 'tickets') loadTickets();
  else if (page === 'profile') renderProfile(null);
  else if (page === 'admin') adminTab('users', null);
}

// ─── HOME ───
async function renderHome() {
  try {
    var r = await fetch('/api/leaderboard?mode=overall');
    var data = await r.json();
    var el = document.getElementById('home-leaderboard');
    if (el) el.innerHTML = renderLeaderboardTable(data.slice(0, 5), 'overall');
  } catch(e) {
    console.log('Home error:', e);
  }
}

// ─── LEADERBOARD ───
async function loadLeaderboard(mode, btn) {
  if (btn) {
    document.querySelectorAll('.mode-tabs .tab-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
  }
  try {
    var r = await fetch('/api/leaderboard?mode=' + mode);
    var data = await r.json();
    var el = document.getElementById('leaderboard-content');
    if (el) el.innerHTML = renderLeaderboardTable(data, mode);
  } catch(e) {
    console.log('Leaderboard error:', e);
  }
}

function renderLeaderboardTable(rows, mode) {
  if (!rows || !rows.length) return '<div class="empty-state">No ranked players yet</div>';

  var isOverall = mode === 'overall';
  var html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th>';
  if (isOverall) {
    html += '<th>Best Tier</th><th>Modes Ranked</th>';
  } else {
    html += '<th>' + (MODE_ICONS[mode] || '') + ' Tier</th>';
  }
  html += '</tr></thead><tbody>';

  rows.forEach(function(row, i) {
    var rank = i + 1;
    var rankClass = rank <= 3 ? 'rank-' + rank : '';
    var rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
    var initial = (row.username || '?')[0].toUpperCase();
    var pfpHtml = row.pfp ? '<img src="' + escHtml(row.pfp) + '" alt="" />' : initial;

    var tierDisplay = '';
    if (isOverall) {
      var bestVal = row.best_val || 0;
      var bestTier = TIER_ORDER[bestVal] || 'Unrated';
      tierDisplay = '<td>' + tierBadge(bestTier) + '</td><td>' + (row.tier_count || 0) + '</td>';
    } else {
      tierDisplay = '<td>' + tierBadge(row.tier) + ' ' + (MODE_ICONS[row.mode] || '') + '</td>';
    }

    var roleHtml = row.role !== 'user' ? '<span class="role-badge role-' + row.role + '">' + row.role + '</span>' : '';
    var bannedHtml = row.banned ? '<span class="status-badge status-voided">Banned</span>' : '';

    html += '<tr>' +
      '<td><span class="rank-badge ' + rankClass + '">' + rankIcon + '</span></td>' +
      '<td><div class="username-cell" onclick="viewProfile(\'' + row.id + '\')">' +
        '<div class="avatar">' + pfpHtml + '</div>' +
        '<div><div class="username-text"><strong>' + escHtml(row.username) + '</strong></div>' +
        '<div style="font-size:11px;color:var(--text-muted)">' + escHtml(row.ign || '') + '</div></div>' +
        roleHtml + bannedHtml +
      '</div></td>' +
      tierDisplay +
      '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

function tierBadge(tier) {
  if (!tier || tier === 'Unrated') return '<span class="tier-badge tier-Unrated">Unrated</span>';
  return '<span class="tier-badge tier-' + tier + '">' + tier + '</span>';
}

// ─── FORUM ───
async function loadForum() {
  try {
    var r = await fetch('/api/forum');
    var msgs = await r.json();
    var el = document.getElementById('forum-messages');
    if (el) {
      el.innerHTML = msgs.map(function(m) { return renderMsg(m, 'forum'); }).join('');
      el.scrollTop = el.scrollHeight;
    }

    var inputArea = document.getElementById('forum-input-area');
    var loginPrompt = document.getElementById('forum-login-prompt');
    if (currentUser) {
      if (inputArea) inputArea.classList.remove('hidden');
      if (loginPrompt) loginPrompt.classList.add('hidden');
    } else {
      if (inputArea) inputArea.classList.add('hidden');
      if (loginPrompt) loginPrompt.classList.remove('hidden');
    }
  } catch(e) {
    console.log('Forum error:', e);
  }
}

function renderMsg(m, type) {
  var initial = (m.username || '?')[0].toUpperCase();
  var isAdminOrTester = currentUser && (currentUser.role === 'admin' || currentUser.role === 'tester');
  var pfpHtml = m.pfp ? '<img src="' + escHtml(m.pfp) + '" alt="" />' : initial;
  var nameClass = m.role === 'admin' ? 'admin-name' : m.role === 'tester' ? 'tester-name' : '';
  var roleTag = m.role !== 'user' ? '<span class="role-badge role-' + m.role + '">' + m.role + '</span>' : '';
  var delBtn = isAdminOrTester
    ? '<button class="msg-delete" onclick="deleteMsg(\'' + type + '\',\'' + m.id + '\')">🗑 Delete</button>'
    : '';

  return '<div class="message" id="msg-' + m.id + '">' +
    '<div class="msg-avatar"><div class="avatar">' + pfpHtml + '</div></div>' +
    '<div class="msg-body">' +
      '<div class="msg-header">' +
        '<span class="msg-name ' + nameClass + '">' + escHtml(m.username) + '</span>' +
        roleTag +
        '<span class="msg-time">' + fmtTime(m.created_at) + '</span>' +
      '</div>' +
      '<div class="msg-content">' + escHtml(m.content) + '</div>' +
    '</div>' +
    delBtn +
  '</div>';
}

async function sendForum() {
  var input = document.getElementById('forum-input');
  if (!input) return;
  var content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    var r = await fetch('/api/forum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    });
    if (r.ok) {
      var msg = await r.json();
      var el = document.getElementById('forum-messages');
      if (el) {
        el.insertAdjacentHTML('beforeend', renderMsg(msg, 'forum'));
        el.scrollTop = el.scrollHeight;
      }
    }
  } catch(e) {
    console.log('Send forum error:', e);
  }
}

async function deleteMsg(type, id) {
  var url = type === 'forum' ? '/api/forum/' + id : '/api/banforum/' + id;
  try {
    await fetch(url, { method: 'DELETE' });
    var el = document.getElementById('msg-' + id);
    if (el) el.remove();
  } catch(e) {
    console.log('Delete error:', e);
  }
}

// ─── BAN FORUM ───
async function loadBanForum() {
  try {
    var r = await fetch('/api/banforum');
    if (!r.ok) return;
    var msgs = await r.json();
    var el = document.getElementById('banforum-messages');
    if (el) {
      el.innerHTML = msgs.map(function(m) { return renderMsg(m, 'banforum'); }).join('');
      el.scrollTop = el.scrollHeight;
    }
  } catch(e) {
    console.log('Ban forum error:', e);
  }
}

async function sendBanForum() {
  var input = document.getElementById('banforum-input');
  if (!input) return;
  var content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    var r = await fetch('/api/banforum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    });
    if (r.ok) {
      var msg = await r.json();
      var el = document.getElementById('banforum-messages');
      if (el) {
        el.insertAdjacentHTML('beforeend', renderMsg(msg, 'banforum'));
        el.scrollTop = el.scrollHeight;
      }
    }
  } catch(e) {
    console.log('Ban forum send error:', e);
  }
}

// ─── QUEUES ───
async function renderQueues() {
  var el = document.getElementById('queues-content');
  if (!el) return;

  if (!currentUser) {
    el.innerHTML = '<div class="join-queue-btn-wrap"><p class="text-muted" style="margin-bottom:16px">You need to be logged in to join a queue.</p><button class="btn-primary" onclick="navigate(\'auth\')">Login / Sign Up</button></div>';
    return;
  }

  if (currentUser.role === 'user') {
    el.innerHTML = '<div class="join-queue-btn-wrap"><p class="text-muted" style="margin-bottom:16px">Select a mode and join the queue to get tested.</p><button class="btn-primary" onclick="openQueuePopup()">⚔️ Join Queue</button></div>';
    return;
  }

  try {
    var r = await fetch('/api/queue');
    if (!r.ok) { el.innerHTML = '<div class="empty-state">Error loading queues</div>'; return; }
    var queues = await r.json();

    if (!queues.length) { el.innerHTML = '<div class="empty-state">No active queues right now</div>'; return; }

    el.innerHTML = queues.map(function(q) {
      return '<div class="queue-card">' +
        '<div class="queue-card-header">' +
          '<span class="queue-mode-badge">' + (MODE_ICONS[q.mode] || '') + ' ' + (q.mode || '').toUpperCase() + '</span>' +
          '<span class="status-badge status-waiting">Waiting</span>' +
        '</div>' +
        '<div class="queue-info">' +
          '<div class="queue-info-item"><span class="queue-info-label">Player</span><span class="queue-info-value">' + escHtml(q.username) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">IGN</span><span class="queue-info-value">' + escHtml(q.ign) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Timezone</span><span class="queue-info-value">' + escHtml(q.timezone) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Region</span><span class="queue-info-value">' + escHtml(q.region) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Server</span><span class="queue-info-value">' + escHtml(q.server) + '</span></div>' +
        '</div>' +
        '<div class="queue-actions">' +
          '<button class="btn-success" onclick="acceptQueue(\'' + q.id + '\')">✅ Accept</button>' +
          '<button class="btn-danger" onclick="voidQueue(\'' + q.id + '\')">❌ Void</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    console.log('Queues error:', e);
    el.innerHTML = '<div class="empty-state">Error loading queues</div>';
  }
}

function openQueuePopup() {
  var el = document.getElementById('queue-popup');
  if (el) el.classList.remove('hidden');
}

function closeQueuePopup() {
  var el = document.getElementById('queue-popup');
  if (el) el.classList.add('hidden');
}

async function submitQueue() {
  var mode = document.getElementById('queue-mode') ? document.getElementById('queue-mode').value : '';
  var ign = document.getElementById('queue-ign') ? document.getElementById('queue-ign').value.trim() : '';
  var timezone = document.getElementById('queue-timezone') ? document.getElementById('queue-timezone').value.trim() : '';
  var region = document.getElementById('queue-region') ? document.getElementById('queue-region').value.trim() : '';
  var server = document.getElementById('queue-server') ? document.getElementById('queue-server').value.trim() : '';

  if (!mode || !ign || !timezone || !region || !server) {
    alert('Please fill in all fields');
    return;
  }

  try {
    var r = await fetch('/api/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: mode, ign: ign, timezone: timezone, region: region, server: server })
    });
    var d = await r.json();
    if (r.ok) {
      closeQueuePopup();
      alert('You have joined the queue! A tester will accept your ticket soon.');
    } else {
      alert('Error: ' + d.error);
    }
  } catch(e) {
    alert('Network error. Please try again.');
  }
}

async function acceptQueue(id) {
  try {
    var r = await fetch('/api/queue/' + id + '/accept', { method: 'POST' });
    if (r.ok) {
      navigate('tickets');
    } else {
      var d = await r.json();
      alert('Error: ' + d.error);
    }
  } catch(e) {
    alert('Network error.');
  }
}

async function voidQueue(id) {
  if (!confirm('Void this queue ticket?')) return;
  try {
    var r = await fetch('/api/queue/' + id + '/void', { method: 'POST' });
    if (r.ok) renderQueues();
  } catch(e) {
    alert('Network error.');
  }
}

// ─── TICKETS ───
async function loadTickets() {
  var el = document.getElementById('tickets-content');
  if (!el) return;
  if (!currentUser) { el.innerHTML = '<div class="empty-state">Login required</div>'; return; }

  try {
    var r = await fetch('/api/tickets/my');
    var tickets = await r.json();
    if (!tickets.length) { el.innerHTML = '<div class="empty-state">No tickets yet</div>'; return; }
    el.innerHTML = tickets.map(function(t) { return renderTicket(t); }).join('');
  } catch(e) {
    console.log('Tickets error:', e);
  }
}

function renderTicket(t) {
  var isTesterOfTicket = currentUser && t.tester_id === currentUser.id;
  var isAdmin = currentUser && currentUser.role === 'admin';
  var isTester = currentUser && currentUser.role === 'tester';
  var canFinish = (isTesterOfTicket || isAdmin) && t.status === 'active';
  var canVoid = (isTester || isAdmin) && t.status === 'active';

  var otherName = t.testee_name || t.tester_name || '?';
  var inputRow = t.status === 'active'
    ? '<div class="ticket-input-row">' +
        '<input type="text" id="ticket-input-' + t.id + '" placeholder="Type a message..." onkeydown="if(event.key===\'Enter\')sendTicketMsg(\'' + t.id + '\')" />' +
        '<button class="btn-send" onclick="sendTicketMsg(\'' + t.id + '\')">Send</button>' +
      '</div>'
    : '';

  var actionRow = '';
  if (canFinish || canVoid) {
    actionRow = '<div class="ticket-actions">';
    if (canFinish) actionRow += '<button class="btn-primary" onclick="openFinishPopup(\'' + t.id + '\',\'' + t.mode + '\')">🏁 Finish Test</button>';
    if (canVoid) actionRow += '<button class="btn-danger" onclick="voidTicket(\'' + t.id + '\')">❌ Void</button>';
    actionRow += '</div>';
  }

  return '<div class="ticket-wrap" id="ticket-' + t.id + '">' +
    '<div class="ticket-header" onclick="toggleTicket(\'' + t.id + '\')">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<span>' + (MODE_ICONS[t.mode] || '') + ' <strong>' + (t.mode || '').toUpperCase() + '</strong></span>' +
        '<span class="text-muted" style="font-size:13px">vs ' + escHtml(otherName) + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="status-badge status-' + t.status + '">' + t.status + '</span>' +
        '<span style="color:var(--text-muted)">▾</span>' +
      '</div>' +
    '</div>' +
    '<div class="ticket-body" id="ticket-body-' + t.id + '">' +
      '<div class="ticket-chat" id="ticket-chat-' + t.id + '"></div>' +
      inputRow +
      actionRow +
    '</div>' +
  '</div>';
}

function toggleTicket(id) {
  var body = document.getElementById('ticket-body-' + id);
  if (!body) return;
  var isOpen = body.classList.contains('open');
  body.classList.toggle('open');
  if (!isOpen) loadTicketMessages(id);
}

async function loadTicketMessages(id) {
  try {
    var r = await fetch('/api/tickets/' + id + '/messages');
    if (!r.ok) return;
    var msgs = await r.json();
    var el = document.getElementById('ticket-chat-' + id);
    if (!el) return;
    el.innerHTML = msgs.map(function(m) {
      var nameClass = m.role === 'admin' ? 'admin-name' : '';
      return '<div class="message">' +
        '<div class="msg-avatar"><div class="avatar">' + (m.username || '?')[0].toUpperCase() + '</div></div>' +
        '<div class="msg-body">' +
          '<div class="msg-header">' +
            '<span class="msg-name ' + nameClass + '">' + escHtml(m.username) + '</span>' +
            '<span class="msg-time">' + fmtTime(m.created_at) + '</span>' +
          '</div>' +
          '<div class="msg-content">' + escHtml(m.content) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  } catch(e) {
    console.log('Ticket messages error:', e);
  }
}

async function sendTicketMsg(id) {
  var input = document.getElementById('ticket-input-' + id);
  if (!input) return;
  var content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    var r = await fetch('/api/tickets/' + id + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    });
    if (r.ok) loadTicketMessages(id);
  } catch(e) {
    console.log('Send ticket error:', e);
  }
}

async function voidTicket(id) {
  if (!confirm('Void this ticket?')) return;
  try {
    var r = await fetch('/api/queue/' + id + '/void', { method: 'POST' });
    if (r.ok) loadTickets();
  } catch(e) {
    alert('Network error.');
  }
}

// ─── FINISH TEST ───
function openFinishPopup(queueId, mode) {
  finishQueueId = queueId;
  var info = document.getElementById('finish-popup-info');
  if (info) info.textContent = 'Mode: ' + (mode || '').toUpperCase() + ' | FT5';
  var ts = document.getElementById('finish-tester-score');
  var tes = document.getElementById('finish-testee-score');
  var tier = document.getElementById('finish-tier');
  if (ts) ts.value = '';
  if (tes) tes.value = '';
  if (tier) tier.value = '';
  var popup = document.getElementById('finish-popup');
  if (popup) popup.classList.remove('hidden');
}

function closeFinishPopup() {
  var popup = document.getElementById('finish-popup');
  if (popup) popup.classList.add('hidden');
  finishQueueId = null;
}

async function submitFinish() {
  var tsEl = document.getElementById('finish-tester-score');
  var tesEl = document.getElementById('finish-testee-score');
  var tierEl = document.getElementById('finish-tier');

  var ts = parseInt(tsEl ? tsEl.value : '');
  var tes = parseInt(tesEl ? tesEl.value : '');
  var tier = tierEl ? tierEl.value : '';

  if (isNaN(ts) || isNaN(tes) || ts < 0 || tes < 0 || ts > 5 || tes > 5) {
    alert('Enter valid scores (0-5)');
    return;
  }
  if (ts + tes > 5) { alert('Total cannot exceed 5'); return; }

  try {
    var body = { testerScore: ts, testeeScore: tes };
    if (tier) body.tierAwarded = tier;

    var r = await fetch('/api/queue/' + finishQueueId + '/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    var d = await r.json();
    if (r.ok) {
      closeFinishPopup();
      alert('Test complete! Tier awarded: ' + d.tierAwarded);
      loadTickets();
    } else {
      alert('Error: ' + d.error);
    }
  } catch(e) {
    alert('Network error.');
  }
}

// ─── RESULTS ───
async function loadResults(type) {
  var el = document.getElementById('results-' + type + '-content');
  if (!el) return;

  try {
    var param = type === 'high' ? 'high' : 'low';
    var r = await fetch('/api/results?type=' + param);
    var results = await r.json();
    if (!results.length) { el.innerHTML = '<div class="empty-state">No results yet</div>'; return; }
    el.innerHTML = results.map(function(res) {
      return '<div class="result-card">' +
        '<div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + fmtDate(res.created_at) + '</div>' +
          '<div style="font-weight:600">' + (MODE_ICONS[res.mode] || '') + ' ' + (res.mode || '').toUpperCase() + '</div>' +
        '</div>' +
        '<div style="text-align:center">' +
          '<div style="font-size:12px;color:var(--text-muted)">Score</div>' +
          '<div style="font-weight:700;font-size:16px">' + escHtml(res.score) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:12px;color:var(--text-muted)">Testee</div>' +
          '<div style="font-weight:500">' + escHtml(res.testee_name) + '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:12px;color:var(--text-muted)">Tier Awarded</div>' +
          tierBadge(res.tier_awarded) +
        '</div>' +
        '<div>' +
          '<div style="font-size:12px;color:var(--text-muted)">Tester</div>' +
          '<div style="font-size:13px;color:var(--text-muted)">' + escHtml(res.tester_name) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch(e) {
    console.log('Results error:', e);
  }
}

// ─── APPLY ───
function renderApply() {
  var el = document.getElementById('apply-content');
  if (!el) return;
  el.innerHTML = '<div class="apply-form">' +
    '<h2 style="font-family:\'Orbitron\',sans-serif;font-size:18px">Tester Application</h2>' +
    '<div><label>Why do you want to be a tester?</label>' +
    '<textarea id="apply-reason" placeholder="Explain your motivation, experience, etc..."></textarea></div>' +
    '<div><label>Are you LT3 or above in any mode?</label>' +
    '<select id="apply-lt3" class="input-field" onchange="toggleFightFields(this.value)">' +
      '<option value="yes">Yes, I am LT3+</option>' +
      '<option value="no">No, I need to prove myself</option>' +
    '</select></div>' +
    '<div id="apply-fight-fields" style="display:none;display:flex;flex-direction:column;gap:12px">' +
      '<div><label>When can you fight a tester/admin? (Time & Date)</label>' +
      '<input id="apply-time" class="input-field" type="text" placeholder="e.g. Saturday 8PM EST" /></div>' +
      '<div><label>Region</label>' +
      '<input id="apply-region" class="input-field" type="text" placeholder="e.g. NA, EU" /></div>' +
      '<div><label>Preferred Server</label>' +
      '<input id="apply-server" class="input-field" type="text" placeholder="e.g. Hypixel, Minemen" /></div>' +
    '</div>' +
    '<button class="btn-primary" onclick="submitApply()" style="align-self:flex-start">Submit Application</button>' +
    '<div id="apply-msg"></div>' +
  '</div>';

  // hide fight fields by default
  var ff = document.getElementById('apply-fight-fields');
  if (ff) ff.style.display = 'none';
}

function toggleFightFields(val) {
  var ff = document.getElementById('apply-fight-fields');
  if (ff) ff.style.display = val === 'no' ? 'flex' : 'none';
}

async function submitApply() {
  if (!currentUser) { navigate('auth'); return; }
  var reason = document.getElementById('apply-reason') ? document.getElementById('apply-reason').value.trim() : '';
  var is_lt3 = document.getElementById('apply-lt3') ? document.getElementById('apply-lt3').value : 'yes';
  var fight_time = document.getElementById('apply-time') ? document.getElementById('apply-time').value.trim() : '';
  var fight_region = document.getElementById('apply-region') ? document.getElementById('apply-region').value.trim() : '';
  var fight_server = document.getElementById('apply-server') ? document.getElementById('apply-server').value.trim() : '';
  var msgEl = document.getElementById('apply-msg');

  if (!reason) {
    if (msgEl) msgEl.innerHTML = '<span class="err-msg">Please explain your motivation</span>';
    return;
  }

  try {
    var r = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason, is_lt3: is_lt3, fight_time: fight_time, fight_server: fight_server, fight_region: fight_region })
    });
    if (r.ok) {
      if (msgEl) msgEl.innerHTML = '<span class="success-msg">✅ Application submitted! An admin will review it.</span>';
    } else {
      var d = await r.json();
      if (msgEl) msgEl.innerHTML = '<span class="err-msg">Error: ' + d.error + '</span>';
    }
  } catch(e) {
    if (msgEl) msgEl.innerHTML = '<span class="err-msg">Network error.</span>';
  }
}

// ─── PROFILE ───
async function renderProfile(userId) {
  var el = document.getElementById('profile-content');
  if (!el) return;
  var id = userId || (currentUser ? currentUser.id : null);
  if (!id) { el.innerHTML = '<div class="empty-state">Login required to view profile</div>'; return; }

  try {
    var r = await fetch('/api/profile/' + id);
    var profile = await r.json();
    var isOwnProfile = currentUser && currentUser.id === id;

    var pfpHtml = profile.pfp
      ? '<img src="' + escHtml(profile.pfp) + '" alt="" />'
      : (profile.username || '?')[0].toUpperCase();

    var tiersHtml = '<div class="profile-tiers">';
    (profile.tiers || []).forEach(function(t) {
      tiersHtml += '<div class="profile-tier-item">' +
        '<div class="profile-tier-mode">' + (MODE_ICONS[t.mode] || '') + ' ' + t.mode + '</div>' +
        tierBadge(t.tier) +
      '</div>';
    });
    tiersHtml += '</div>';

    var editHtml = '';
    if (isOwnProfile && !profile.banned) {
      editHtml = '<hr style="border-color:var(--border);margin:20px 0"/>' +
        '<h3 style="margin-bottom:16px;font-family:\'Rajdhani\',sans-serif;font-size:18px;font-weight:700">Edit Profile</h3>' +
        '<div class="edit-form">' +
          '<div class="edit-group"><label>Username</label><input class="input-field" id="edit-username" type="text" value="' + escHtml(profile.username) + '" /></div>' +
          '<div class="edit-group"><label>IGN</label><input class="input-field" id="edit-ign" type="text" value="' + escHtml(profile.ign || '') + '" /></div>' +
          '<div class="edit-group"><label>Profile Picture URL</label><input class="input-field" id="edit-pfp" type="text" value="' + escHtml(profile.pfp || '') + '" placeholder="https://..." /></div>' +
          '<div class="edit-group"><label>New Password (leave blank to keep)</label><input class="input-field" id="edit-pass" type="password" placeholder="New password" /></div>' +
          '<button class="btn-primary" onclick="saveProfile()" style="align-self:flex-start">Save Changes</button>' +
          '<div id="profile-msg"></div>' +
        '</div>';
    }

    var extraInfo = (profile.role === 'tester' || profile.role === 'admin')
      ? '<div style="font-size:13px;color:var(--text-muted)">Tests Completed: <strong style="color:var(--text)">' + (profile.tests_done || 0) + '</strong></div>'
      : '';

    var roleHtml = profile.role !== 'user' ? '<span class="role-badge role-' + profile.role + '">' + profile.role + '</span>' : '';
    var bannedHtml = profile.banned ? '<span class="status-badge status-voided">Banned</span>' : '';

    el.innerHTML = '<div class="profile-card">' +
      '<div class="profile-header">' +
        '<div class="profile-avatar">' + pfpHtml + '</div>' +
        '<div class="profile-info">' +
          '<h2>' + escHtml(profile.username) + '</h2>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">' + roleHtml + bannedHtml + '</div>' +
          '<div style="font-size:13px;color:var(--text-muted);margin-top:6px">IGN: ' + escHtml(profile.ign || '-') + '</div>' +
          extraInfo +
        '</div>' +
      '</div>' +
      '<div class="profile-body">' +
        '<h3 style="margin-bottom:14px;font-family:\'Rajdhani\',sans-serif;font-size:16px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Tiers</h3>' +
        tiersHtml +
        editHtml +
      '</div>' +
    '</div>';
  } catch(e) {
    console.log('Profile error:', e);
    el.innerHTML = '<div class="empty-state">Error loading profile</div>';
  }
}

async function saveProfile() {
  var username = document.getElementById('edit-username') ? document.getElementById('edit-username').value.trim() : '';
  var ign = document.getElementById('edit-ign') ? document.getElementById('edit-ign').value.trim() : '';
  var pfp = document.getElementById('edit-pfp') ? document.getElementById('edit-pfp').value.trim() : '';
  var password = document.getElementById('edit-pass') ? document.getElementById('edit-pass').value : '';
  var msgEl = document.getElementById('profile-msg');

  try {
    var r = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, ign: ign, pfp: pfp, password: password })
    });
    if (r.ok) {
      if (msgEl) msgEl.innerHTML = '<span class="success-msg">✅ Profile updated!</span>';
      await checkAuth();
      renderProfile(null);
    } else {
      var d = await r.json();
      if (msgEl) msgEl.innerHTML = '<span class="err-msg">Error: ' + d.error + '</span>';
    }
  } catch(e) {
    if (msgEl) msgEl.innerHTML = '<span class="err-msg">Network error.</span>';
  }
}

function viewProfile(id) {
  navigate('profile');
  renderProfile(id);
}

// ─── AUTH ───
function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var loginForm = document.getElementById('auth-login');
  var regForm = document.getElementById('auth-register');
  if (loginForm) loginForm.classList.toggle('hidden', tab !== 'login');
  if (regForm) regForm.classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  var username = document.getElementById('login-user') ? document.getElementById('login-user').value.trim() : '';
  var password = document.getElementById('login-pass') ? document.getElementById('login-pass').value : '';
  var err = document.getElementById('login-err');
  if (err) err.textContent = '';

  try {
    var r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    var d = await r.json();
    if (r.ok) {
      setUser(d.user);
      navigate('home');
    } else {
      if (d.banned) showBannedOverlay();
      else if (err) err.textContent = d.error || 'Login failed';
    }
  } catch(e) {
    if (err) err.textContent = 'Network error. Try again.';
  }
}

async function doRegister() {
  var username = document.getElementById('reg-user') ? document.getElementById('reg-user').value.trim() : '';
  var ign = document.getElementById('reg-ign') ? document.getElementById('reg-ign').value.trim() : '';
  var password = document.getElementById('reg-pass') ? document.getElementById('reg-pass').value : '';
  var err = document.getElementById('reg-err');
  if (err) err.textContent = '';

  try {
    var r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, ign: ign, password: password })
    });
    var d = await r.json();
    if (r.ok) {
      setUser(d.user);
      navigate('home');
    } else {
      if (err) err.textContent = d.error || 'Registration failed';
    }
  } catch(e) {
    if (err) err.textContent = 'Network error. Try again.';
  }
}

async function doLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch(e) {}
  clearUser();
  navigate('home');
}

// ─── ADMIN PANEL ───
async function adminTab(tab, btn) {
  if (btn) {
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
  var el = document.getElementById('admin-content');
  if (!el) return;
  el.innerHTML = '<div class="empty-state">Loading...</div>';

  if (tab === 'users') await adminRenderUsers(el);
  else if (tab === 'testers') adminRenderAddTester(el);
  else if (tab === 'queues') await adminRenderQueues(el);
  else if (tab === 'applications') await adminRenderApplications(el);
}

async function adminRenderUsers(el) {
  try {
    var r = await fetch('/api/admin/users');
    var users = await r.json();
    if (!users.length) { el.innerHTML = '<div class="empty-state">No users</div>'; return; }
    el.innerHTML = users.map(function(u) { return adminUserCard(u); }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state">Error loading users</div>';
  }
}

function adminUserCard(u) {
  var tiersHtml = (u.tiers || []).map(function(t) {
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
      '<span style="font-size:12px;color:var(--text-muted);width:80px">' + (MODE_ICONS[t.mode] || '') + ' ' + t.mode + '</span>' +
      tierBadge(t.tier) +
    '</div>';
  }).join('');

  var tierEdits = (u.tiers || []).map(function(t) {
    var options = TIER_ORDER.map(function(tier) {
      return '<option value="' + tier + '"' + (tier === t.tier ? ' selected' : '') + '>' + tier + '</option>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span style="width:80px;font-size:13px">' + (MODE_ICONS[t.mode] || '') + ' ' + t.mode + '</span>' +
      '<select class="input-field" id="tier-' + u.id + '-' + t.mode + '" style="width:auto">' + options + '</select>' +
    '</div>';
  }).join('');

  var modesList = (u.tiers || []).map(function(t) { return t.mode; });
  var modesJson = JSON.stringify(modesList).replace(/"/g, '&quot;');

  var banBtn = !u.banned
    ? '<button class="btn-danger" onclick="adminBanUser(\'' + u.id + '\')">🔨 Ban</button>'
    : '<button class="btn-success" onclick="adminUnbanUser(\'' + u.id + '\')">✅ Unban</button>';

  var roleOptions = ['user','tester','admin'].map(function(role) {
    return '<option value="' + role + '"' + (role === u.role ? ' selected' : '') + '>' + role + '</option>';
  }).join('');

  return '<div class="admin-user-card" id="auc-' + u.id + '">' +
    '<div class="admin-user-header">' +
      '<div class="admin-user-info">' +
        '<div class="avatar">' + (u.username || '?')[0].toUpperCase() + '</div>' +
        '<div>' +
          '<div style="font-weight:700">' + escHtml(u.username) + ' <span class="role-badge role-' + u.role + '">' + u.role + '</span></div>' +
          '<div style="font-size:12px;color:var(--text-muted)">IGN: ' + escHtml(u.ign || '-') + '</div>' +
          (u.banned ? '<span class="status-badge status-voided">Banned</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="admin-actions">' +
        '<button class="btn-secondary" onclick="adminToggleEdit(\'' + u.id + '\')">✏️ Edit</button>' +
        banBtn +
      '</div>' +
    '</div>' +
    '<div class="admin-tiers-row">' + tiersHtml + '</div>' +
    '<div id="admin-edit-' + u.id + '" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:14px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label class="label">Username</label><input class="input-field" id="aedit-user-' + u.id + '" value="' + escHtml(u.username) + '" /></div>' +
        '<div><label class="label">IGN</label><input class="input-field" id="aedit-ign-' + u.id + '" value="' + escHtml(u.ign || '') + '" /></div>' +
        '<div><label class="label">Role</label><select class="input-field" id="aedit-role-' + u.id + '">' + roleOptions + '</select></div>' +
      '</div>' +
      '<div style="margin-bottom:12px">' + tierEdits + '</div>' +
      '<button class="btn-primary" onclick="adminSaveUser(\'' + u.id + '\',' + modesJson + ')">💾 Save</button>' +
      '<div id="aedit-msg-' + u.id + '" style="margin-top:8px"></div>' +
    '</div>' +
  '</div>';
}

function adminToggleEdit(id) {
  var el = document.getElementById('admin-edit-' + id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function adminSaveUser(id, modes) {
  var username = document.getElementById('aedit-user-' + id) ? document.getElementById('aedit-user-' + id).value.trim() : '';
  var ign = document.getElementById('aedit-ign-' + id) ? document.getElementById('aedit-ign-' + id).value.trim() : '';
  var role = document.getElementById('aedit-role-' + id) ? document.getElementById('aedit-role-' + id).value : '';
  var msgEl = document.getElementById('aedit-msg-' + id);

  var tiers = (modes || []).map(function(m) {
    var el = document.getElementById('tier-' + id + '-' + m);
    return { mode: m, tier: el ? el.value : 'Unrated' };
  });

  try {
    var r = await fetch('/api/admin/users/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, ign: ign, role: role, tiers: tiers })
    });
    if (r.ok) {
      if (msgEl) msgEl.innerHTML = '<span class="success-msg">✅ Saved</span>';
      setTimeout(function() { adminTab('users', null); }, 800);
    } else {
      var d = await r.json();
      if (msgEl) msgEl.innerHTML = '<span class="err-msg">Error: ' + d.error + '</span>';
    }
  } catch(e) {
    if (msgEl) msgEl.innerHTML = '<span class="err-msg">Network error.</span>';
  }
}

async function adminBanUser(id) {
  if (!confirm('Ban this user?')) return;
  try {
    await fetch('/api/admin/users/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: true })
    });
    adminTab('users', null);
  } catch(e) {
    alert('Network error.');
  }
}

async function adminUnbanUser(id) {
  try {
    await fetch('/api/admin/users/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: false })
    });
    adminTab('users', null);
  } catch(e) {
    alert('Network error.');
  }
}

function adminRenderAddTester(el) {
  el.innerHTML = '<div class="tester-form">' +
    '<h2 style="font-family:\'Orbitron\',sans-serif;font-size:18px">Add Tester</h2>' +
    '<div><label class="label">Username</label><input class="input-field" id="new-tester-user" placeholder="Tester username" /></div>' +
    '<div><label class="label">Password</label><input class="input-field" id="new-tester-pass" type="password" placeholder="Min 6 characters" /></div>' +
    '<button class="btn-primary" onclick="adminAddTester()">Add Tester</button>' +
    '<div id="tester-add-msg"></div>' +
  '</div>';
}

async function adminAddTester() {
  var username = document.getElementById('new-tester-user') ? document.getElementById('new-tester-user').value.trim() : '';
  var password = document.getElementById('new-tester-pass') ? document.getElementById('new-tester-pass').value : '';
  var msgEl = document.getElementById('tester-add-msg');

  try {
    var r = await fetch('/api/admin/testers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password })
    });
    if (r.ok) {
      if (msgEl) msgEl.innerHTML = '<span class="success-msg">✅ Tester "' + escHtml(username) + '" added!</span>';
      var u = document.getElementById('new-tester-user');
      var p = document.getElementById('new-tester-pass');
      if (u) u.value = '';
      if (p) p.value = '';
    } else {
      var d = await r.json();
      if (msgEl) msgEl.innerHTML = '<span class="err-msg">Error: ' + d.error + '</span>';
    }
  } catch(e) {
    if (msgEl) msgEl.innerHTML = '<span class="err-msg">Network error.</span>';
  }
}

async function adminRenderQueues(el) {
  try {
    var r = await fetch('/api/admin/queues');
    var queues = await r.json();
    if (!queues.length) { el.innerHTML = '<div class="empty-state">No queues</div>'; return; }
    el.innerHTML = queues.map(function(q) {
      var acceptBtn = q.status === 'waiting'
        ? '<button class="btn-success" onclick="acceptQueue(\'' + q.id + '\')">✅ Accept</button>' +
          '<button class="btn-danger" onclick="voidQueue(\'' + q.id + '\')">❌ Void</button>'
        : '';
      return '<div class="queue-card">' +
        '<div class="queue-card-header">' +
          '<span class="queue-mode-badge">' + (MODE_ICONS[q.mode] || '') + ' ' + (q.mode || '').toUpperCase() + '</span>' +
          '<span class="status-badge status-' + q.status + '">' + q.status + '</span>' +
        '</div>' +
        '<div class="queue-info">' +
          '<div class="queue-info-item"><span class="queue-info-label">Testee</span><span class="queue-info-value">' + escHtml(q.testee_name || '?') + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Tester</span><span class="queue-info-value">' + escHtml(q.tester_name || 'Unassigned') + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">IGN</span><span class="queue-info-value">' + escHtml(q.ign) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Region</span><span class="queue-info-value">' + escHtml(q.region) + '</span></div>' +
          '<div class="queue-info-item"><span class="queue-info-label">Server</span><span class="queue-info-value">' + escHtml(q.server) + '</span></div>' +
        '</div>' +
        (acceptBtn ? '<div class="queue-actions">' + acceptBtn + '</div>' : '') +
      '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state">Error loading queues</div>';
  }
}

async function adminRenderApplications(el) {
  try {
    var r = await fetch('/api/apply');
    var apps = await r.json();
    if (!apps.length) { el.innerHTML = '<div class="empty-state">No applications</div>'; return; }
    el.innerHTML = apps.map(function(a) {
      return '<div class="admin-user-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
          '<div><strong>' + escHtml(a.username) + '</strong><span class="status-badge status-' + a.status + '" style="margin-left:8px">' + a.status + '</span></div>' +
          '<span style="font-size:12px;color:var(--text-muted)">' + fmtDate(a.created_at) + '</span>' +
        '</div>' +
        '<div style="font-size:13px;margin-bottom:8px"><span class="label">Reason:</span><br/>' + escHtml(a.reason) + '</div>' +
        '<div style="font-size:13px;margin-bottom:8px"><span class="label">Is LT3:</span> ' + a.is_lt3 + '</div>' +
        (a.fight_time ? '<div style="font-size:13px"><span class="label">Fight Time:</span> ' + escHtml(a.fight_time) + ' | <span class="label">Region:</span> ' + escHtml(a.fight_region || '') + ' | <span class="label">Server:</span> ' + escHtml(a.fight_server || '') + '</div>' : '') +
      '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div class="empty-state">Error loading applications</div>';
  }
}

// ─── POLLING ───
function startPolling() {
  pollInterval = setInterval(async function() {
    try {
      if (currentPage === 'forum') await refreshForum();
      else if (currentPage === 'tickets') await refreshTickets();
      else if (currentPage === 'ban-forum') await loadBanForum();
    } catch(e) {}
  }, 4000);
}

async function refreshForum() {
  var r = await fetch('/api/forum');
  var msgs = await r.json();
  var el = document.getElementById('forum-messages');
  if (!el) return;
  var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
  el.innerHTML = msgs.map(function(m) { return renderMsg(m, 'forum'); }).join('');
  if (atBottom) el.scrollTop = el.scrollHeight;
}

async function refreshTickets() {
  var openBodies = document.querySelectorAll('.ticket-body.open');
  for (var i = 0; i < openBodies.length; i++) {
    var id = openBodies[i].id.replace('ticket-body-', '');
    await loadTicketMessages(id);
  }
}

// ─── UTILS ───
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtTime(ts) {
  if (!ts) return '';
  var d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString();
}

function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  var modal = document.getElementById('modal');
  if (overlay) overlay.classList.add('hidden');
  if (modal) modal.classList.add('hidden');
}
