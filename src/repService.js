// ============================================================
//  repService.js — Repütasyon İş Mantığı Katmanı
//  Görev: Tüm rep okuma/yazma işlemlerini merkezi bir yerde toplar.
//  Bu sayede event/command dosyaları temiz kalır.
// ============================================================

const { getDb } = require('./database');

// ── Sabitler ─────────────────────────────────────────────────
const COOLDOWN_MS = 5 * 60 * 1000; // 5 dakika (milisaniye)
const TOP_LIST_LIMIT = 10;          // Liderlik tablosu boyutu

// ── Yardımcı: Kullanıcı kaydı al veya oluştur ────────────────
function ensureUser(userId) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM reputation WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO reputation (user_id, rep, last_gave_at) VALUES (?, 0, 0)').run(userId);
    return { user_id: userId, rep: 0, last_gave_at: 0 };
  }
  return existing;
}

// ── Kullanıcı Puanını Getir ───────────────────────────────────
/**
 * Belirtilen kullanıcının mevcut repütasyon kaydını döndürür.
 * Kayıt yoksa otomatik oluşturur.
 * @param {string} userId
 * @returns {{ user_id: string, rep: number, last_gave_at: number }}
 */
function getUserRep(userId) {
  return ensureUser(userId);
}

// ── Rep Ver ───────────────────────────────────────────────────
/**
 * giverId'nin targetId'ye rep vermeye çalışır.
 * Tüm güvenlik kontrolleri burada yapılır.
 *
 * @param {string} giverId   — Rep veren kullanıcının Discord ID'si
 * @param {string} targetId  — Rep alan kullanıcının Discord ID'si
 * @param {number} amount    — Verilecek rep miktarı (+1 veya +2)
 *
 * @returns {{ success: boolean, reason?: string, newRep?: number, remainingMs?: number }}
 */
function giveRep(giverId, targetId, amount) {
  const db = getDb();

  // Güvenlik: Kendi kendine rep verme
  if (giverId === targetId) {
    return { success: false, reason: 'self' };
  }

  // Cooldown kontrolü (giver bazlı — aynı kişi 5 dk içinde kimseye rep veremez)
  ensureUser(giverId);
  const giver = db.prepare('SELECT last_gave_at FROM reputation WHERE user_id = ?').get(giverId);
  const now = Date.now();
  const elapsed = now - giver.last_gave_at;

  if (elapsed < COOLDOWN_MS) {
    const remaining = COOLDOWN_MS - elapsed;
    return { success: false, reason: 'cooldown', remainingMs: remaining };
  }

  // Rep al (hedef kullanıcıyı oluştur/güncelle)
  ensureUser(targetId);

  // Atomic transaction: giver'ın cooldown'ını güncelle + target'ın repini artır
  const transaction = db.transaction(() => {
    db.prepare('UPDATE reputation SET last_gave_at = ? WHERE user_id = ?').run(now, giverId);
    db.prepare('UPDATE reputation SET rep = rep + ? WHERE user_id = ?').run(amount, targetId);
  });
  transaction();

  const updated = db.prepare('SELECT rep FROM reputation WHERE user_id = ?').get(targetId);
  return { success: true, newRep: updated.rep };
}

// ── Top 10 Liderlik Tablosu ───────────────────────────────────
/**
 * Sunucudaki en yüksek rep'e sahip ilk N kullanıcıyı döndürür.
 * @returns {Array<{ user_id: string, rep: number }>}
 */
function getLeaderboard() {
  const db = getDb();
  return db
    .prepare('SELECT user_id, rep FROM reputation ORDER BY rep DESC LIMIT ?')
    .all(TOP_LIST_LIMIT);
}

// ── Cooldown Süresini İnsanca Biçimlendir ─────────────────────
/**
 * Milisaniyeyi "X dakika Y saniye" formatına çevirir.
 * @param {number} ms
 * @returns {string}
 */
function formatCooldown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes} dakika ${seconds} saniye`;
  return `${seconds} saniye`;
}

module.exports = { getUserRep, giveRep, getLeaderboard, formatCooldown, COOLDOWN_MS };
