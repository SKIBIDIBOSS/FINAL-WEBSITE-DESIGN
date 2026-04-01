const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tiers.db');
const db = new Database(DB_PATH);

function init() {
  db.exec(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      ign TEXT DEFAULT '',
      pfp TEXT DEFAULT '',
      banned INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'Unrated',
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, mode)
    );

    CREATE TABLE IF NOT EXISTS forum_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ban_forum_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS queues (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      ign TEXT NOT NULL,
      timezone TEXT NOT NULL,
      region TEXT NOT NULL,
      server TEXT NOT NULL,
      status TEXT DEFAULT 'waiting',
      tester_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(queue_id) REFERENCES queues(id)
    );

    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      tester_id TEXT NOT NULL,
      testee_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      score TEXT NOT NULL,
      tier_awarded TEXT NOT NULL,
      voided INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(queue_id) REFERENCES queues(id)
    );

    CREATE TABLE IF NOT EXISTS tester_applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      is_lt3 TEXT NOT NULL,
      fight_time TEXT,
      fight_server TEXT,
      fight_region TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Seed admin
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'Localboii'").get();
  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const hash = bcrypt.hashSync('Admin@1234!', 10);
    const adminId = uuidv4();
    db.prepare("INSERT INTO users (id, username, password, role, ign) VALUES (?, ?, ?, 'admin', 'Localboii')").run(adminId, 'Localboii', hash);
    const modes = ['sumo','bedwars','classic','spleef','nodebuff','bedfight'];
    for (const mode of modes) {
      db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?, ?, 'HT3')").run(adminId, mode);
    }
  }

  // Seed lining
  const liningExists = db.prepare("SELECT id FROM users WHERE username = 'lining'").get();
  if (!liningExists) {
    const { v4: uuidv4 } = require('uuid');
    const hash = bcrypt.hashSync('lining123', 10);
    const liningId = uuidv4();
    db.prepare("INSERT INTO users (id, username, password, role, ign) VALUES (?, ?, ?, 'user', 'lining')").run(liningId, 'lining', hash);
    db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?, 'sumo', 'LT2')").run(liningId);
    db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?, 'bedfight', 'HT2')").run(liningId);
    db.prepare("INSERT OR IGNORE INTO tiers (user_id, mode, tier) VALUES (?, 'classic', 'HT3')").run(liningId);
  }
}

module.exports = { db, init };
