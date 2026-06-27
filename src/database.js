// ============================================================
//  database.js — Veritabanı Modülü (v2 — Envanter Sistemi)
//  Görev: SQLite bağlantısını ve tablo şemasını yönetir.
//  Modül: better-sqlite3 (senkron, hızlı, sunucusuz)
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');

// Veritabanı dosyasını proje kök dizininde oluştur
const DB_PATH = path.join(__dirname, '..', 'database.sqlite');

let db;

/**
 * Veritabanı bağlantısını başlatır ve tabloları oluşturur.
 * @returns {Database} Hazır SQLite bağlantı nesnesi
 */
function initDatabase() {
  if (db) return db; // Singleton — tekrar bağlanma

  db = new Database(DB_PATH);

  // WAL modu: Eş zamanlı okuma/yazma performansını artırır
  db.pragma('journal_mode = WAL');

  // ── Kullanıcı Repütasyon Tablosu ──────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
      user_id         TEXT    PRIMARY KEY,
      rep             INTEGER NOT NULL DEFAULT 0,
      balance         INTEGER NOT NULL DEFAULT 0,
      last_gave_at    INTEGER NOT NULL DEFAULT 0,
      active_color_id INTEGER DEFAULT NULL,
      active_bg_id    INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Market ürünleri — type: 'color' | 'bg'
    -- dataValue: color → Discord Rol ID'si, bg → Resim URL'si
    CREATE TABLE IF NOT EXISTS market_items (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      price     INTEGER NOT NULL,
      type      TEXT    NOT NULL DEFAULT 'color',
      dataValue TEXT    NOT NULL DEFAULT ''
    );

    -- Kullanıcı envanteri (satın alınan ürünler kaybolmaz)
    CREATE TABLE IF NOT EXISTS user_inventory (
      userId  TEXT    NOT NULL,
      itemId  INTEGER NOT NULL,
      PRIMARY KEY (userId, itemId)
    );

    -- Kanal kilit modu tablosu (chat-koruma)
    CREATE TABLE IF NOT EXISTS locked_channels (
      channel_id TEXT PRIMARY KEY,
      mode       TEXT NOT NULL
    );
  `);

  // ── Migration: Eski sütun yapısını güncelle ───────────────
  // Her ALTER TABLE ifadesi try/catch ile sarılmış;
  // sütun zaten varsa SQLite hata fırlatır, biz sessizce geçeriz.

  const migrations = [
    'ALTER TABLE reputation ADD COLUMN balance INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE reputation ADD COLUMN active_color_id INTEGER DEFAULT NULL',
    'ALTER TABLE reputation ADD COLUMN active_bg_id    INTEGER DEFAULT NULL',
    'ALTER TABLE market_items ADD COLUMN type      TEXT NOT NULL DEFAULT "color"',
    'ALTER TABLE market_items ADD COLUMN dataValue TEXT NOT NULL DEFAULT ""',
  ];

  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* Sütun zaten mevcut — normal durum */ }
  }

  // ── Eski roleId sütununu dataValue'ya taşı (one-time migration) ─
  try {
    // Eğer roleId sütunu hâlâ varsa dataValue'ya kopyala
    const cols = db.pragma('table_info(market_items)').map((c) => c.name);
    if (cols.includes('roleId') && !cols.includes('_roleId_migrated')) {
      db.exec(`UPDATE market_items SET dataValue = roleId WHERE dataValue = '' OR dataValue IS NULL`);
      console.log('[DB] Migration: roleId → dataValue kopyalandı.');
    }
  } catch { /* roleId sütunu yoksa geç */ }

  // ── Market Varsayılan Ürünleri (Seed) ────────────────────
  // Tablo boşsa ilk ürünleri ekle
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM market_items').get();
  if (itemCount.cnt === 0) {
    const insert = db.prepare(
      'INSERT INTO market_items (name, price, type, dataValue) VALUES (?, ?, ?, ?)'
    );
    const seed = db.transaction(() => {
      // İsim renkleri — dataValue = Discord Rol ID'si
      insert.run('🍏 Matrix Yeşili',    300, 'color', '1520168372547883209');
      insert.run('🟣 Kuantum Moru',     500, 'color', '1520168823741747302');
      // Profil arka planları — dataValue = resim URL'si (placeholder)
      insert.run('🌌 Siber Şehir',      800, 'bg', 'https://i.imgur.com/placeholder1.png');
      insert.run('💻 Hacker Terminali', 800, 'bg', 'https://i.imgur.com/placeholder2.png');
    });
    seed();
    console.log('[DB] Market varsayılan ürünleri eklendi (4 ürün).');
  } else {
    // ── Mevcut kayıtların type/dataValue değerlerini güncelle ─
    const updates = [
      { id: 1, name: '🍏 Matrix Yeşili',    price: 300, type: 'color', dataValue: '1520168372547883209' },
      { id: 2, name: '🟣 Kuantum Moru',     price: 500, type: 'color', dataValue: '1520168823741747302' },
      { id: 3, name: '🌌 Siber Şehir',      price: 800, type: 'bg',    dataValue: 'https://i.imgur.com/placeholder1.png' },
      { id: 4, name: '💻 Hacker Terminali', price: 800, type: 'bg',    dataValue: 'https://i.imgur.com/placeholder2.png' },
    ];
    const upStmt = db.prepare(
      'UPDATE market_items SET name = ?, price = ?, type = ?, dataValue = ? WHERE id = ?'
    );
    const upAll = db.transaction(() => {
      for (const u of updates) upStmt.run(u.name, u.price, u.type, u.dataValue, u.id);
    });
    upAll();
    console.log('[DB] Market ürünleri güncellendi (v2 şema).');
  }

  console.log('[DB] Veritabanı başlatıldı → database.sqlite');
  return db;
}

/**
 * Hazır veritabanı bağlantısını döndürür.
 */
function getDb() {
  if (!db) throw new Error('[DB] Veritabanı henüz başlatılmadı. Önce initDatabase() çağırın.');
  return db;
}

// ── Ayar Fonksiyonları ────────────────────────────────────────
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// ── Envanter Fonksiyonları ────────────────────────────────────

/**
 * Kullanıcının envanterindeki tüm ürünleri döndürür (market_items JOIN).
 * @param {string} userId
 * @returns {Array<{id, name, price, type, dataValue}>}
 */
function getInventory(userId) {
  return getDb().prepare(`
    SELECT mi.id, mi.name, mi.price, mi.type, mi.dataValue
    FROM user_inventory ui
    JOIN market_items mi ON mi.id = ui.itemId
    WHERE ui.userId = ?
    ORDER BY mi.type, mi.price
  `).all(userId);
}

/**
 * Kullanıcının aktif eşyalarını döndürür.
 * @param {string} userId
 * @returns {{ active_color_id: number|null, active_bg_id: number|null }}
 */
function getActiveItems(userId) {
  const row = getDb()
    .prepare('SELECT active_color_id, active_bg_id FROM reputation WHERE user_id = ?')
    .get(userId);
  return row ?? { active_color_id: null, active_bg_id: null };
}

/**
 * Kullanıcının aktif eşyasını günceller.
 * @param {string} userId
 * @param {'color'|'bg'} type - Eşya türü
 * @param {number|null} itemId - null = çıkar
 */
function setActiveItem(userId, type, itemId) {
  const col = type === 'color' ? 'active_color_id' : 'active_bg_id';
  // Kullanıcı satırı yoksa oluştur
  getDb().prepare('INSERT OR IGNORE INTO reputation (user_id) VALUES (?)').run(userId);
  getDb().prepare(`UPDATE reputation SET ${col} = ? WHERE user_id = ?`).run(itemId, userId);
}

// ── Kanal Kilit Fonksiyonları ─────────────────────────────────

function getChannelMode(channelId) {
  const row = getDb().prepare('SELECT mode FROM locked_channels WHERE channel_id = ?').get(channelId);
  return row ? row.mode : null;
}

function setChannelMode(channelId, mode) {
  getDb().prepare('INSERT OR REPLACE INTO locked_channels (channel_id, mode) VALUES (?, ?)').run(channelId, mode);
}

function removeChannelMode(channelId) {
  getDb().prepare('DELETE FROM locked_channels WHERE channel_id = ?').run(channelId);
}

module.exports = {
  initDatabase, getDb,
  getSetting, setSetting,
  getInventory, getActiveItems, setActiveItem,
  getChannelMode, setChannelMode, removeChannelMode,
};
