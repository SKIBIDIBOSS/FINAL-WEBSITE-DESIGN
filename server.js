const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { db, init } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

init();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'skibidiboss-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const MODES = ['sumo', 'bedwars', 'classic', 'spleef', 'nodebuff', 'bedfight'];
const TIERS = ['Unrated', 'LT5', 'HT5', 'LT4', 'HT4', 'LT3', 'HT3', 'LT2', 'HT2', 'LT1', 'HT1'];
const TIER_RANK = {};
TIERS.forEach((t, i) => TIER_RANK[t] = i);

function tierValue(tier) { return TIER_RANK[tier] || 0; }

function calculateAwardedTier(testerTier, testeeTier, testerScore, testeeScore) {
  const testerVal = tierValue(testerTier);
  const testeeVal = tierValue(testeeTier);
  const total = testerScore + testeeScore; // ft5 so max 5
  const testeeWins = testeeScore;
  const testerWins = testerScore;

  // If testee beats tester 5-0 to 5-2, promote above tester tier
  if (testerWins === 0) {
    // Clean sweep - promote 2 above tester
    return TIERS[Math.min(TIERS.length - 1, testerVal + 2)] || testerTier;
  }
  if (testeeWins >= 4) {
    // Strong win - promote 1 above tester
    return TIERS[Math.min(TIERS.length - 1, testerVal + 1)] || testerTier;
  }
  if (testeeWins === 3) {
    // Close win - match tester tier
    return testerTier;
  }
  if (testeeWins === 2) {
    // Decent showing - promote one below tester
    const newVal = Math.max(testeeVal, testerVal - 1);
    return TIERS[newVal] || testeeTier;
  }
  if (testeeWins === 1) {
    // Weak showing - stay at current or slight bump
    const newVal = Math.max(testeeVal, testerVal - 2);
    return TIERS[Math.max(1, newVal)] || testeeTier;
  }
  // 0 wins - stay unrated or minimal tier
  return testeeTier === 'Unrated' ? 'LT5' : testeeTier;
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireTesterOrAdmin(req, res, next) {
  if (!req.session.userId || !['tester','admin'].includes(req.session.role)) return res.status(403).json({ error: 'Tester/Admin only' });
  next();
}

// AUTH
app.post('/api/auth/register', (req, res) => {
  const { username, password, ign } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username too short' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    db.prepare("INSERT INTO users (id, username, password, role, ign) VALUES (?, ?, ?, 'user', ?)").run(id, username, hash, ign || username);
    for (const mode of MODES) {
      db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?, ?, 'Unrated')").run(id, mode);
    }
    req.session.userId = id;
    req.session.username = username;
    req.session.role = 'user';
    res.json({ success: true, user: { id, username, role: 'user', ign: ign || username } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.banned) return res.status(403).json({ error: 'BANNED', banned: true });
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;
  res.json({ success: true, user: { id: user.id, username: user.username, role: user.role, ign: user.ign, pfp: user.pfp } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT id, username, role, ign, pfp, banned FROM users WHERE id = ?").get(req.session.userId);
  if (!user) return res.json({ user: null });
  if (user.banned) { req.session.destroy(); return res.json({ user: null, banned: true }); }
  res.json({ user });
});

// LEADERBOARD
app.get('/api/leaderboard', (req, res) => {
  const mode = req.query.mode;
  let rows;
  if (mode && mode !== 'overall') {
    rows = db.prepare(`
      SELECT u.id, u.username, u.ign, u.pfp, u.banned, t.mode, t.tier
      FROM users u
      JOIN tiers t ON t.user_id = u.id
      WHERE t.mode = ? AND t.tier != 'Unrated'
      ORDER BY t.tier DESC
    `).all(mode);
  } else {
    // Overall: best tier across all modes
    rows = db.prepare(`
      SELECT u.id, u.username, u.ign, u.pfp, u.banned,
        MAX(CASE WHEN t.tier='HT1' THEN 10 WHEN t.tier='LT1' THEN 9 WHEN t.tier='HT2' THEN 8 WHEN t.tier='LT2' THEN 7 WHEN t.tier='HT3' THEN 6 WHEN t.tier='LT3' THEN 5 WHEN t.tier='HT4' THEN 4 WHEN t.tier='LT4' THEN 3 WHEN t.tier='HT5' THEN 2 WHEN t.tier='LT5' THEN 1 ELSE 0 END) as best_val,
        COUNT(CASE WHEN t.tier != 'Unrated' THEN 1 END) as tier_count
      FROM users u
      JOIN tiers t ON t.user_id = u.id
      GROUP BY u.id
      HAVING best_val > 0
      ORDER BY best_val DESC, tier_count DESC
    `).all();
  }
  res.json(rows);
});

// USER TIERS
app.get('/api/users/:id/tiers', (req, res) => {
  const tiers = db.prepare("SELECT mode, tier FROM tiers WHERE user_id = ?").all(req.params.id);
  res.json(tiers);
});

// PROFILE
app.get('/api/profile/:id', (req, res) => {
  const user = db.prepare("SELECT id, username, role, ign, pfp, banned FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  const tiers = db.prepare("SELECT mode, tier FROM tiers WHERE user_id = ?").all(req.params.id);
  let extra = {};
  if (user.role === 'tester' || user.role === 'admin') {
    const done = db.prepare("SELECT COUNT(*) as c FROM results WHERE tester_id = ?").get(req.params.id);
    extra.tests_done = done.c;
  }
  res.json({ ...user, tiers, ...extra });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const { username, password, ign, pfp } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (user.banned) return res.status(403).json({ error: 'Banned' });
  let newUsername = username || user.username;
  let newHash = user.password;
  if (password && password.length >= 6) newHash = bcrypt.hashSync(password, 10);
  try {
    db.prepare("UPDATE users SET username=?, password=?, ign=?, pfp=? WHERE id=?")
      .run(newUsername, newHash, ign || user.ign, pfp || user.pfp, user.id);
    req.session.username = newUsername;
    res.json({ success: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

// FORUM
app.get('/api/forum', (req, res) => {
  const msgs = db.prepare(`
    SELECT fm.id, fm.content, fm.created_at, fm.deleted, u.username, u.role, u.pfp
    FROM forum_messages fm JOIN users u ON u.id = fm.user_id
    WHERE fm.deleted = 0
    ORDER BY fm.created_at ASC LIMIT 200
  `).all();
  res.json(msgs);
});

app.post('/api/forum', requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
  if (user.banned) return res.status(403).json({ error: 'Banned' });
  const { content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Empty message' });
  const id = uuidv4();
  db.prepare("INSERT INTO forum_messages (id, user_id, content) VALUES (?, ?, ?)").run(id, req.session.userId, content.trim());
  const msg = db.prepare("SELECT fm.id, fm.content, fm.created_at, fm.deleted, u.username, u.role, u.pfp FROM forum_messages fm JOIN users u ON u.id=fm.user_id WHERE fm.id=?").get(id);
  res.json(msg);
});

app.delete('/api/forum/:id', requireTesterOrAdmin, (req, res) => {
  db.prepare("UPDATE forum_messages SET deleted=1 WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// BAN FORUM
app.get('/api/banforum', requireTesterOrAdmin, (req, res) => {
  const msgs = db.prepare(`
    SELECT bf.id, bf.content, bf.created_at, bf.deleted, u.username, u.role, u.pfp
    FROM ban_forum_messages bf JOIN users u ON u.id = bf.user_id
    WHERE bf.deleted = 0 ORDER BY bf.created_at ASC LIMIT 200
  `).all();
  res.json(msgs);
});

app.post('/api/banforum', requireTesterOrAdmin, (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Empty' });
  const id = uuidv4();
  db.prepare("INSERT INTO ban_forum_messages (id, user_id, content) VALUES (?, ?, ?)").run(id, req.session.userId, content.trim());
  const msg = db.prepare("SELECT bf.id, bf.content, bf.created_at, bf.deleted, u.username, u.role, u.pfp FROM ban_forum_messages bf JOIN users u ON u.id=bf.user_id WHERE bf.id=?").get(id);
  res.json(msg);
});

app.delete('/api/banforum/:id', requireAdmin, (req, res) => {
  db.prepare("UPDATE ban_forum_messages SET deleted=1 WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

// QUEUES
app.post('/api/queue/join', requireAuth, (req, res) => {
  const { mode, ign, timezone, region, server } = req.body;
  if (!mode || !ign || !timezone || !region || !server) return res.status(400).json({ error: 'All fields required' });
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
  if (user.banned) return res.status(403).json({ error: 'Banned' });
  const existing = db.prepare("SELECT id FROM queues WHERE user_id=? AND status='waiting'").get(req.session.userId);
  if (existing) return res.status(400).json({ error: 'Already in queue' });
  const id = uuidv4();
  db.prepare("INSERT INTO queues (id, user_id, mode, ign, timezone, region, server) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, req.session.userId, mode, ign, timezone, region, server);
  res.json({ success: true, queueId: id });
});

app.get('/api/queue', requireTesterOrAdmin, (req, res) => {
  const { mode } = req.query;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.session.userId);
  let queues;
  if (user.role === 'admin') {
    queues = mode
      ? db.prepare("SELECT q.*, u.username, u.pfp FROM queues q JOIN users u ON u.id=q.user_id WHERE q.mode=? AND q.status='waiting' ORDER BY q.created_at ASC").all(mode)
      : db.prepare("SELECT q.*, u.username, u.pfp FROM queues q JOIN users u ON u.id=q.user_id WHERE q.status='waiting' ORDER BY q.created_at ASC").all();
  } else {
    // Tester can only see modes they are LT3+ in
    const testerTiers = db.prepare("SELECT mode, tier FROM tiers WHERE user_id=?").all(req.session.userId);
    const allowedModes = testerTiers.filter(t => tierValue(t.tier) >= tierValue('LT3')).map(t => t.mode);
    if (allowedModes.length === 0) return res.json([]);
    const placeholders = allowedModes.map(() => '?').join(',');
    queues = db.prepare(`SELECT q.*, u.username, u.pfp FROM queues q JOIN users u ON u.id=q.user_id WHERE q.mode IN (${placeholders}) AND q.status='waiting' ORDER BY q.created_at ASC`).all(...allowedModes);
  }
  res.json(queues);
});

app.post('/api/queue/:id/accept', requireTesterOrAdmin, (req, res) => {
  const queue = db.prepare("SELECT * FROM queues WHERE id=?").get(req.params.id);
  if (!queue || queue.status !== 'waiting') return res.status(400).json({ error: 'Queue not available' });
  db.prepare("UPDATE queues SET status='active', tester_id=? WHERE id=?").run(req.session.userId, req.params.id);
  res.json({ success: true });
});

app.post('/api/queue/:id/void', requireTesterOrAdmin, (req, res) => {
  const queue = db.prepare("SELECT * FROM queues WHERE id=?").get(req.params.id);
  if (!queue) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE queues SET status='voided' WHERE id=?").run(req.params.id);
  // Post in results as voided
  const id = uuidv4();
  const testeeId = queue.user_id;
  const testeeMode = db.prepare("SELECT tier FROM tiers WHERE user_id=? AND mode=?").get(testeeId, queue.mode);
  db.prepare("INSERT INTO results (id, queue_id, tester_id, testee_id, mode, score, tier_awarded, voided) VALUES (?,?,?,?,?,?,?,1)")
    .run(id, queue.id, req.session.userId, testeeId, queue.mode, '0-0', testeeMode?.tier || 'Unrated');
  res.json({ success: true });
});

app.post('/api/queue/:id/finish', requireTesterOrAdmin, (req, res) => {
  const { testerScore, testeeScore, tierAwarded } = req.body;
  const queue = db.prepare("SELECT * FROM queues WHERE id=?").get(req.params.id);
  if (!queue || queue.status !== 'active') return res.status(400).json({ error: 'Queue not active' });
  if (queue.tester_id !== req.session.userId && req.session.role !== 'admin') return res.status(403).json({ error: 'Not your ticket' });

  // Calculate tier dynamically
  const testerTierRow = db.prepare("SELECT tier FROM tiers WHERE user_id=? AND mode=?").get(queue.tester_id, queue.mode);
  const testeeTierRow = db.prepare("SELECT tier FROM tiers WHERE user_id=? AND mode=?").get(queue.user_id, queue.mode);
  const testerTier = testerTierRow?.tier || 'Unrated';
  const testeeTier = testeeTierRow?.tier || 'Unrated';

  const finalTier = tierAwarded || calculateAwardedTier(testerTier, testeeTier, parseInt(testerScore), parseInt(testeeScore));
  
  // Update testee's tier
  db.prepare("INSERT OR REPLACE INTO tiers (user_id, mode, tier) VALUES (?, ?, ?)").run(queue.user_id, queue.mode, finalTier);
  db.prepare("UPDATE queues SET status='completed' WHERE id=?").run(queue.id);

  const id = uuidv4();
  db.prepare("INSERT INTO results (id, queue_id, tester_id, testee_id, mode, score, tier_awarded) VALUES (?,?,?,?,?,?,?)")
    .run(id, queue.id, queue.tester_id, queue.user_id, queue.mode, `${testerScore}-${testeeScore}`, finalTier);
  res.json({ success: true, tierAwarded: finalTier });
});

// TICKETS / CHAT
app.get('/api/tickets/my', requireAuth, (req, res) => {
  let tickets;
  const role = req.session.role;
  if (role === 'admin') {
    tickets = db.prepare("SELECT q.*, u.username as testee_name, t2.username as tester_name FROM queues q JOIN users u ON u.id=q.user_id LEFT JOIN users t2 ON t2.id=q.tester_id WHERE q.status IN ('active','completed','voided') ORDER BY q.created_at DESC").all();
  } else if (role === 'tester') {
    tickets = db.prepare("SELECT q.*, u.username as testee_name FROM queues q JOIN users u ON u.id=q.user_id WHERE q.tester_id=? AND q.status IN ('active','completed','voided') ORDER BY q.created_at DESC").all(req.session.userId);
  } else {
    tickets = db.prepare("SELECT q.*, u.username as tester_name FROM queues q LEFT JOIN users u ON u.id=q.tester_id WHERE q.user_id=? AND q.status IN ('active','completed','voided') ORDER BY q.created_at DESC").all(req.session.userId);
  }
  res.json(tickets);
});

app.get('/api/tickets/:id/messages', requireAuth, (req, res) => {
  const queue = db.prepare("SELECT * FROM queues WHERE id=?").get(req.params.id);
  if (!queue) return res.status(404).json({ error: 'Not found' });
  const isParty = queue.user_id === req.session.userId || queue.tester_id === req.session.userId || req.session.role === 'admin';
  if (!isParty) return res.status(403).json({ error: 'Forbidden' });
  const msgs = db.prepare("SELECT tm.*, u.username, u.role FROM ticket_messages tm JOIN users u ON u.id=tm.user_id WHERE tm.queue_id=? ORDER BY tm.created_at ASC").all(req.params.id);
  res.json(msgs);
});

app.post('/api/tickets/:id/messages', requireAuth, (req, res) => {
  const queue = db.prepare("SELECT * FROM queues WHERE id=?").get(req.params.id);
  if (!queue) return res.status(404).json({ error: 'Not found' });
  const isParty = queue.user_id === req.session.userId || queue.tester_id === req.session.userId || req.session.role === 'admin';
  if (!isParty) return res.status(403).json({ error: 'Forbidden' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Empty' });
  const id = uuidv4();
  db.prepare("INSERT INTO ticket_messages (id, queue_id, user_id, content) VALUES (?,?,?,?)").run(id, req.params.id, req.session.userId, content.trim());
  const msg = db.prepare("SELECT tm.*, u.username, u.role FROM ticket_messages tm JOIN users u ON u.id=tm.user_id WHERE tm.id=?").get(id);
  res.json(msg);
});

// RESULTS
app.get('/api/results', (req, res) => {
  const { type } = req.query; // 'high' or 'low'
  let rows;
  if (type === 'high') {
    rows = db.prepare(`SELECT r.*, u1.username as tester_name, u2.username as testee_name FROM results r JOIN users u1 ON u1.id=r.tester_id JOIN users u2 ON u2.id=r.testee_id WHERE r.voided=0 AND (r.tier_awarded IN ('HT3','LT2','HT2','LT1','HT1')) ORDER BY r.created_at DESC LIMIT 50`).all();
  } else {
    rows = db.prepare(`SELECT r.*, u1.username as tester_name, u2.username as testee_name FROM results r JOIN users u1 ON u1.id=r.tester_id JOIN users u2 ON u2.id=r.testee_id WHERE r.voided=0 ORDER BY r.created_at DESC LIMIT 50`).all();
  }
  res.json(rows);
});

// TESTER APPLICATIONS
app.post('/api/apply', requireAuth, (req, res) => {
  const { reason, is_lt3, fight_time, fight_server, fight_region } = req.body;
  if (!reason || !is_lt3) return res.status(400).json({ error: 'Required fields missing' });
  const id = uuidv4();
  db.prepare("INSERT INTO tester_applications (id, user_id, reason, is_lt3, fight_time, fight_server, fight_region) VALUES (?,?,?,?,?,?,?)")
    .run(id, req.session.userId, reason, is_lt3, fight_time || '', fight_server || '', fight_region || '');
  res.json({ success: true });
});

app.get('/api/apply', requireAdmin, (req, res) => {
  const apps = db.prepare("SELECT ta.*, u.username FROM tester_applications ta JOIN users u ON u.id=ta.user_id ORDER BY ta.created_at DESC").all();
  res.json(apps);
});

// ADMIN PANEL
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, username, role, ign, pfp, banned FROM users ORDER BY role DESC, username ASC").all();
  const withTiers = users.map(u => {
    const tiers = db.prepare("SELECT mode, tier FROM tiers WHERE user_id=?").all(u.id);
    return { ...u, tiers };
  });
  res.json(withTiers);
});

app.post('/api/admin/testers', requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    db.prepare("INSERT INTO users (id, username, password, role, ign) VALUES (?,?,?,'tester',?)").run(id, username, hash, username);
    for (const mode of MODES) {
      db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?,?,'Unrated')").run(id, mode);
    }
    res.json({ success: true, id });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { username, role, ign, banned, tiers } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (username) {
    try { db.prepare("UPDATE users SET username=? WHERE id=?").run(username, req.params.id); }
    catch(e) { if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username taken' }); }
  }
  if (role) db.prepare("UPDATE users SET role=? WHERE id=?").run(role, req.params.id);
  if (ign !== undefined) db.prepare("UPDATE users SET ign=? WHERE id=?").run(ign, req.params.id);
  if (banned !== undefined) db.prepare("UPDATE users SET banned=? WHERE id=?").run(banned ? 1 : 0, req.params.id);
  if (tiers && Array.isArray(tiers)) {
    for (const { mode, tier } of tiers) {
      db.prepare("INSERT OR REPLACE INTO tiers (user_id, mode, tier) VALUES (?,?,?)").run(req.params.id, mode, tier);
    }
  }
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  db.prepare("UPDATE users SET banned=1 WHERE id=?").run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/queues', requireAdmin, (req, res) => {
  const queues = db.prepare("SELECT q.*, u.username as testee_name, t.username as tester_name FROM queues q JOIN users u ON u.id=q.user_id LEFT JOIN users t ON t.id=q.tester_id ORDER BY q.created_at DESC LIMIT 100").all();
  res.json(queues);
});

app.listen(PORT, () => console.log(`SKIBIDIBOSS X LINING TIERS running on port ${PORT}`));
