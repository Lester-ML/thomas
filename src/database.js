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
  // rep          → Toplam repütasyon puanı — SADECE rütbe için, hiç düşmez
  // balance      → Harcanabilir market kredisi — satın alımda azalır
  // last_gave_at → Son rep verme zamanı (Unix timestamp, ms)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
      user_id      TEXT    PRIMARY KEY,
      rep          INTEGER NOT NULL DEFAULT 0,
      balance      INTEGER NOT NULL DEFAULT 0,
      last_gave_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_items (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT    NOT NULL,
      price  INTEGER NOT NULL,
      roleId TEXT    NOT NULL
    );
  `);

  // ── Mevcut veritabanlarına balance sütunu ekle (migration) ──
  // Eğer eski bir veritabanı varsa ve balance sütunu yoksa ekle.
  // Zaten varsa ALTER TABLE hata verir — try/catch ile yutuyoruz.
  try {
    db.exec('ALTER TABLE reputation ADD COLUMN balance INTEGER NOT NULL DEFAULT 0;');
    console.log('[DB] Migration: balance sütunu eklendi.');
  } catch {
    // Sütun zaten mevcut — normal durum, hata değil
  }

  // ── Market Varsayılan Ürünleri (Seed) ────────────────────
  // Tablo boşsa ilk ürünleri ekle
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM market_items').get();
  if (itemCount.cnt === 0) {
    const insert = db.prepare(
      'INSERT INTO market_items (name, price, roleId) VALUES (?, ?, ?)'
    );
    const seedItems = [
      { name: '🍏 Matrix Yeşili',     price: 300,  roleId: 'ROLE_ID_GIRIN' },
      { name: '🧊 Siber Mavi',        price: 300,  roleId: 'ROLE_ID_GIRIN' },
      { name: '🟣 Kuantum Moru',      price: 500,  roleId: 'ROLE_ID_GIRIN' },
      { name: '🩸 Hacker Kırmızısı', price: 500,  roleId: 'ROLE_ID_GIRIN' },
    ];
    const seedAll = db.transaction(() => {
      for (const item of seedItems) insert.run(item.name, item.price, item.roleId);
    });
    seedAll();
    console.log('[DB] Market varsayılan ürünleri eklendi (4 ürün).');
  }

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
