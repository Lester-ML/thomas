// ============================================================
//  database.js — Veritabanı Modülü (v2 — Envanter Sistemi)
//  Görev: SQLite bağlantısını ve tablo şemasını yönetir.
//  Modül: better-sqlite3 (senkron, hızlı, sunucusuz)
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

// ── Veritabanı Yolu — Railway Volume ile Uyumlu ────────────────
// Öncelik sırası:
//   1) Railway Environment Variables'dan DATABASE_PATH
//   2) Varsayılan: /app/data/kratos.sqlite (Railway Volume mount noktası)
// Railway Dashboard → Service → Variables → DATABASE_PATH = /app/data/kratos.sqlite
const DB_PATH = process.env.DATABASE_PATH || '/app/data/kratos.sqlite';

let db;

/**
 * Veritabanı bağlantısını başlatır ve tabloları oluşturur.
 * Railway Volume yoksa yerel klasör de oluşturulur.
 * @returns {Database} Hazır SQLite bağlantı nesnesi
 */
function initializeDatabase() {
  if (db) return db; // Singleton — tekrar bağlanma

  // ── Klasör Kontrolü (Yoksa Oluştur) ────────────────────
  const dir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[DB] Klasör oluşturuldu: ${dir}`);
    }
  } catch (err) {
    console.error(`[DB] Klasör oluşturulamadı: ${dir}`, err.message);
    // Bot çökmeden devam etmeye çalış
  }

  // ── Veritabanı Bağlantısı ────────────────────────────
  try {
    db = new Database(DB_PATH);
    console.log(`[DB] Veritabanı bağlantısı kuruldu: ${DB_PATH}`);
  } catch (err) {
    console.error('[DB] Veritabanı açılamadı:', err.message);
    process.exit(1); // DB olmadan bot çalışamaz
  }

  // WAL modu: Eş zamanlı okuma/yazma performansını artırır
  db.pragma('journal_mode = WAL');

  // ── Tablolar ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
      user_id         TEXT    PRIMARY KEY,
      rep             INTEGER NOT NULL DEFAULT 0,
      balance         INTEGER NOT NULL DEFAULT 0,
      last_gave_at    INTEGER NOT NULL DEFAULT 0,
      active_color_id INTEGER DEFAULT NULL,
      active_bg_id    INTEGER DEFAULT NULL,
      active_name_color_id INTEGER DEFAULT NULL,
      active_profile_frame_id INTEGER DEFAULT NULL,
      active_avatar_frame_id INTEGER DEFAULT NULL
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
  const migrations = [
    'ALTER TABLE reputation ADD COLUMN balance INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE reputation ADD COLUMN active_color_id INTEGER DEFAULT NULL',
    'ALTER TABLE reputation ADD COLUMN active_bg_id    INTEGER DEFAULT NULL',
    'ALTER TABLE reputation ADD COLUMN active_name_color_id INTEGER DEFAULT NULL',
    'ALTER TABLE reputation ADD COLUMN active_profile_frame_id INTEGER DEFAULT NULL',
    'ALTER TABLE reputation ADD COLUMN active_avatar_frame_id INTEGER DEFAULT NULL',
    'ALTER TABLE market_items ADD COLUMN type      TEXT NOT NULL DEFAULT "color"',
    'ALTER TABLE market_items ADD COLUMN dataValue TEXT NOT NULL DEFAULT ""',
  ];

  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* Sütun zaten mevcut — normal durum */ }
  }

  // ── Eski roleId → dataValue migration ────────────────────
  // Eski şemada roleId NOT NULL vardı; yeni INSERT'ler bunu sağlamıyor → crash
  // Çözüm: roleId sütunu varsa önce dataValue'ya kopyala, sonra roleId'yi NULL yapılabilir hale getir
  try {
    const cols = db.pragma('table_info(market_items)').map((c) => c.name);
    if (cols.includes('roleId')) {
      console.log('[DB] Eski roleId şeması tespit edildi, migration uygulanıyor...');
      db.exec(`UPDATE market_items SET dataValue = roleId WHERE (dataValue = '' OR dataValue IS NULL) AND roleId IS NOT NULL`);
      // roleId sütununun NOT NULL kısıtını kaldırmak için tabloyu yeniden oluştur
      try {
        db.exec(`
          CREATE TABLE IF NOT EXISTS market_items_new (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            name      TEXT    NOT NULL,
            price     INTEGER NOT NULL,
            type      TEXT    NOT NULL DEFAULT 'color',
            dataValue TEXT    NOT NULL DEFAULT ''
          );
          INSERT OR IGNORE INTO market_items_new (id, name, price, type, dataValue)
            SELECT id, name, price,
              COALESCE(type, 'color'),
              COALESCE(NULLIF(dataValue, ''), roleId, '')
            FROM market_items;
          DROP TABLE market_items;
          ALTER TABLE market_items_new RENAME TO market_items;
        `);
        console.log('[DB] Migration: roleId sütunu kaldırıldı, şema güncellendi.');
      } catch (rebuildErr) {
        console.error('[DB] Tablo yeniden oluşturma başarısız (zararsız):', rebuildErr.message);
      }
    }
  } catch (migErr) { console.error('[DB] roleId migration hatası:', migErr.message); }

  // ── Renk Ürünleri (ID 1-2) — Upsert ─────────────────────
  // Önce sütun listesini kontrol et — eski şemada roleId hâlâ varsa ona da yaz
  const colorUpsertCols = db.pragma('table_info(market_items)').map((c) => c.name);
  const hasRoleId = colorUpsertCols.includes('roleId');

  const colorUpsert = hasRoleId
    ? db.prepare(`
        INSERT INTO market_items (id, name, price, type, dataValue, roleId)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, type=excluded.type, dataValue=excluded.dataValue, roleId=excluded.roleId
      `)
    : db.prepare(`
        INSERT INTO market_items (id, name, price, type, dataValue)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, type=excluded.type, dataValue=excluded.dataValue
      `);
  const colorSeed = db.transaction(() => {
    if (hasRoleId) {
      // Eski şema: roleId sütununa da değer ver (NOT NULL kısıtı için)
      colorUpsert.run(1, '🍏 Matrix Yeşili', 300, 'color', '1520168372547883209', '1520168372547883209');
      colorUpsert.run(2, '🟣 Kuantum Moru',  500, 'color', '1520168823741747302', '1520168823741747302');
    } else {
      colorUpsert.run(1, '🍏 Matrix Yeşili', 300, 'color', '1520168372547883209');
      colorUpsert.run(2, '🟣 Kuantum Moru',  500, 'color', '1520168823741747302');
    }
  });
  colorSeed();

  // ── Arka Plan Ürünleri (ID 3-11) — INSERT OR IGNORE ──────
  // Var olanları etkilemez, eksik olanları ekler.
  // Sonra isim/fiyat/URL'yi günceller.
  const bgItems = [
    // 💻 Kuantum & Donanım Serisi
    { id: 3,  name: '💻 Hacker Terminali',     price: 250, url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=700&h=250&fit=crop' },
    { id: 4,  name: '🔵 Çekirdek Devre',       price: 250, url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=700&h=250&fit=crop' },
    { id: 5,  name: '🟣 Kuantum Ağı',          price: 250, url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=700&h=250&fit=crop' },
    { id: 6,  name: '🌌 Derin Uzay',           price: 250, url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=700&h=250&fit=crop' },
    { id: 7,  name: '⚡ Veri Akışı',           price: 250, url: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?q=80&w=700&h=250&fit=crop' },
    // 🌃 Siber Şehir Serisi
    { id: 8,  name: '🏙️ Neon Tokyo',          price: 250, url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=700&h=250&fit=crop' },
    { id: 9,  name: '🌆 Karanlık Metropol',    price: 250, url: 'https://image.pollinations.ai/prompt/dark%20metropolis%20from%20above%20night%20aerial%20view%20cyberpunk%20city?width=700&height=250&nologo=true' },
    { id: 10, name: '🌧️ Yağmurlu Gece Şehri', price: 250, url: 'https://images.unsplash.com/photo-1555448248-2571daf6344b?q=80&w=700&h=250&fit=crop' },
    { id: 11, name: '🏢 Dev Gökdelenler',      price: 250, url: 'https://image.pollinations.ai/prompt/futuristic%20mega%20skyscrapers%20night%20cyberpunk%20cityscape%20neon?width=700&height=250&nologo=true' },
  ];

  const genericUpsert = db.prepare(`
    INSERT INTO market_items (id, name, price, type, dataValue)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, price=excluded.price, type=excluded.type, dataValue=excluded.dataValue
  `);
  
  const bgSeed = db.transaction(() => {
    for (const item of bgItems) {
      genericUpsert.run(item.id, item.name, item.price, 'bg', item.url);
    }
  });
  bgSeed();

  // ── Yeni Eşyalar (İsim Renkleri, Çerçeveler) ──────
  const newItems = [
    // İsim Renkleri (name_color) - 300
    { id: 12, name: 'Hacker Red İsim Rengi', type: 'name_color', price: 300, val: '#FF003C' },
    { id: 13, name: 'Matrix Green İsim Rengi', type: 'name_color', price: 300, val: '#00FF41' },
    { id: 14, name: 'Cyber Blue İsim Rengi', type: 'name_color', price: 300, val: '#00F0FF' },
    { id: 15, name: 'Neon Pink İsim Rengi', type: 'name_color', price: 300, val: '#FF00FF' },
    // Profil Çerçeveleri (profile_frame) - 500
    { id: 20, name: 'Sarı Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#FFD700' },
    { id: 21, name: 'Mavi Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#00BFFF' },
    { id: 22, name: 'Kırmızı Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#FF2020' },
    { id: 23, name: 'Yeşil Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#00FF00' },
    { id: 24, name: 'Mor Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#8A2BE2' },
    { id: 25, name: 'Beyaz Profil Çerçevesi', type: 'profile_frame', price: 500, val: '#FFFFFF' },
    // Avatar Çerçeveleri (avatar_frame) - 300
    { id: 30, name: 'Sarı Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#FFD700' },
    { id: 31, name: 'Mavi Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#00BFFF' },
    { id: 32, name: 'Kırmızı Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#FF2020' },
    { id: 33, name: 'Yeşil Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#00FF00' },
    { id: 34, name: 'Mor Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#8A2BE2' },
    { id: 35, name: 'Beyaz Avatar Çerçevesi', type: 'avatar_frame', price: 300, val: '#FFFFFF' },
  ];

  const newItemsSeed = db.transaction(() => {
    for (const item of newItems) {
      genericUpsert.run(item.id, item.name, item.price, item.type, item.val);
    }
  });
  newItemsSeed();

  console.log('[DB] Market urunleri senkronize edildi (2 rol, 9 bg, 4 isim, 6 profil_frame, 6 avatar_frame).');
  console.log(`[DB] Hazir → ${DB_PATH}`);
  return db;
}

// initDatabase eski adıyla da çalışsın (geriye dönük uyumluluk)
const initDatabase = initializeDatabase;

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
 * @returns {object} { active_color_id, active_bg_id, active_name_color_id, active_profile_frame_id, active_avatar_frame_id }
 */
function getActiveItems(userId) {
  const row = getDb()
    .prepare('SELECT active_color_id, active_bg_id, active_name_color_id, active_profile_frame_id, active_avatar_frame_id FROM reputation WHERE user_id = ?')
    .get(userId);
  return row ?? { 
    active_color_id: null, 
    active_bg_id: null,
    active_name_color_id: null,
    active_profile_frame_id: null,
    active_avatar_frame_id: null
  };
}

/**
 * Kullanıcının aktif eşyasını günceller.
 * @param {string} userId
 * @param {'color'|'bg'|'name_color'|'profile_frame'|'avatar_frame'} type - Eşya türü
 * @param {number|null} itemId - null = çıkar
 */
function setActiveItem(userId, type, itemId) {
  let col;
  switch (type) {
    case 'color': col = 'active_color_id'; break;
    case 'bg': col = 'active_bg_id'; break;
    case 'name_color': col = 'active_name_color_id'; break;
    case 'profile_frame': col = 'active_profile_frame_id'; break;
    case 'avatar_frame': col = 'active_avatar_frame_id'; break;
    default: return;
  }
  
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
  initDatabase,
  initializeDatabase,
  getDb,
  getSetting, setSetting,
  getInventory, getActiveItems, setActiveItem,
  getChannelMode, setChannelMode, removeChannelMode,
};
