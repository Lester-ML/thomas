// ============================================================
//  repService.js — Repütasyon İş Mantığı Katmanı
//  Görev: Tüm rep okuma/yazma işlemlerini merkezi bir yerde toplar.
//  Bu sayede event/command dosyaları temiz kalır.
//
//  Fonksiyonlar:
//    getUserRep(userId)          → Kullanıcının kaydını döndürür
//    giveRep(giverId, targetId)  → Cooldown'lu rep verme (normal akış)
//    updateRep(userId, newRep)   → Direkt puan yazma (admin komutları)
//    getLeaderboard()            → İlk 10 listesi
//    formatCooldown(ms)          → Süre biçimlendirme
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
    db.prepare(
      'INSERT INTO reputation (user_id, rep, balance, last_gave_at) VALUES (?, 0, 0, 0)'
    ).run(userId);
    return { user_id: userId, rep: 0, balance: 0, last_gave_at: 0 };
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

  // Hedef kullanıcıyı oluştur/güncelle
  ensureUser(targetId);

  // ── Atomic Transaction ────────────────────────────────────
  // giver cooldown güncelle + target rep VE balance arttır (Çift Kasa)
  const transaction = db.transaction(() => {
    db.prepare('UPDATE reputation SET last_gave_at = ? WHERE user_id = ?').run(now, giverId);
    db.prepare(
      'UPDATE reputation SET rep = rep + ?, balance = balance + ? WHERE user_id = ?'
    ).run(amount, amount, targetId);
  });
  transaction();

  const updated = db
    .prepare('SELECT rep, balance FROM reputation WHERE user_id = ?')
    .get(targetId);
  return { success: true, newRep: updated.rep, newBalance: updated.balance };
}

// ── Admin: Direkt Puan Güncelle ──────────────────────────────
/**
 * Bir kullanıcının rep puanını doğrudan belirtilen değere ayarlar.
 * Cooldown kontrolü yapılmaz — sadece yönetici komutları tarafından kullanılır.
 *
 * @param {string} userId  — Güncellenecek kullanıcının Discord ID'si
 * @param {number} newRep  — Ayarlanacak yeni rep değeri (negatif olamaz)
 * @returns {{ oldRep: number, newRep: number }}
 */
function updateRep(userId, newRep) {
  const db = getDb();
  const record = ensureUser(userId);
  const oldRep = record.rep;
  const oldBalance = record.balance ?? 0;

  // Güvenlik: Puan hiçbir zaman eksi olamaz
  const safeNewRep = Math.max(0, newRep);
  // Fark hesapla, balance'a da ekle (negatif fark balance'ı düşürmez)
  const diff = safeNewRep - oldRep;
  const safeNewBalance = Math.max(0, oldBalance + (diff > 0 ? diff : 0));

  db.prepare(
    'UPDATE reputation SET rep = ?, balance = ? WHERE user_id = ?'
  ).run(safeNewRep, safeNewBalance, userId);

  return { oldRep, newRep: safeNewRep, newBalance: safeNewBalance };
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

// ── Market Bakiyesi Harca ─────────────────────────────────────
/**
 * Kullanıcının SADECE balance değerinden belirtilen miktarı düşer.
 * Rep puanına kesinlikle dokunulmaz — rütbe korunur.
 *
 * @param {string} userId  — Kullanıcının Discord ID'si
 * @param {number} amount  — Harcanacak miktar
 * @returns {{ success: boolean, newBalance?: number, reason?: string }}
 */
function spendBalance(userId, amount) {
  const db = getDb();
  const record = ensureUser(userId);

  if (record.balance < amount) {
    return { success: false, reason: 'insufficient', balance: record.balance };
  }

  const newBalance = record.balance - amount;
  db.prepare('UPDATE reputation SET balance = ? WHERE user_id = ?').run(newBalance, userId);
  return { success: true, newBalance };
}


module.exports = { getUserRep, giveRep, updateRep, getLeaderboard, formatCooldown, COOLDOWN_MS, spendBalance };
