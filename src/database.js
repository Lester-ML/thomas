// ============================================================
//  database.js — Veritabanı modülü
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
  // user_id      → Discord kullanıcı kimliği (string, benzersiz)
  // rep          → Toplam repütasyon puanı (varsayılan 0)
  // last_gave_at → Son rep verme zamanı (Unix timestamp, ms)
  //                Cooldown hesabı için kullanılır
  db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
      user_id     TEXT PRIMARY KEY,
      rep         INTEGER NOT NULL DEFAULT 0,
      last_gave_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  console.log('[DB] Veritabanı başlatıldı → database.sqlite');
  return db;
}

/**
 * Hazır veritabanı bağlantısını döndürür.
 * initDatabase() çağrılmadan kullanılırsa hata fırlatır.
 */
function getDb() {
  if (!db) throw new Error('[DB] Veritabanı henüz başlatılmadı. Önce initDatabase() çağırın.');
  return db;
}

/**
 * Bir ayarı veritabanından okur.
 * @param {string} key - Ayar anahtarı
 * @returns {string|null}
 */
function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Bir ayarı veritabanına yazar (yoksa oluşturur).
 * @param {string} key   - Ayar anahtarı
 * @param {string} value - Ayar değeri
 */
function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

module.exports = { initDatabase, getDb, getSetting, setSetting };
