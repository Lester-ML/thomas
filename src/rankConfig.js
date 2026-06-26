// ============================================================
//  src/rankConfig.js — Rütbe Konfigürasyonu
//  Görev: Tüm rütbe tanımlarını (isim, puan eşiği, Discord rol ID'si)
//         tek bir yerde tutar. Yeni rütbe eklemek veya puan
//         eşiklerini değiştirmek için sadece bu dosyayı düzenleyin.
//
//  ÖNEMLİ: roleId alanlarını kendi Discord sunucunuzdaki
//           rol ID'leriyle değiştirmeyi unutmayın!
//           Rol ID almak için: Sunucu Ayarları → Roller →
//           İstediğin role sağ tıkla → "Rol ID'sini Kopyala"
//           (Geliştirici Modu açık olmalı)
// ============================================================

/**
 * Rütbe Tablosu — Sıralama: En düşük puandan en yükseğe.
 *
 * @property {string} name    - Rütbenin görünen adı
 * @property {number} minRep  - Bu rütbeye ulaşmak için gereken minimum puan
 * @property {string} roleId  - Discord'daki ilgili rol ID'si (ROLE_ID olarak bırakılan yerler doldurulmalı)
 * @property {string} emoji   - Rütbeyi temsil eden emoji (embed'lerde kullanılır)
 * @property {number} color   - Embed rengi (hex)
 */
const RANKS = [
  {
    name: 'Junior 1',
    minRep: 0,
    roleId: '1493344807450579134', // Junior 1
    emoji: '🌱',
    color: 0x8bc34a, // Açık yeşil
  },
  {
    name: 'Junior 2',
    minRep: 15,
    roleId: '1493346624993362071', // Junior 2
    emoji: '🌱',
    color: 0x4caf50, // Yeşil
  },
  {
    name: 'Junior 3',
    minRep: 30,
    roleId: '1493346706157211719', // Junior 3
    emoji: '🌱',
    color: 0x009688, // Teal
  },
  {
    name: 'Mid 1',
    minRep: 45,
    roleId: '1493346778680922163', // Mid 1
    emoji: '🔷',
    color: 0x03a9f4, // Açık mavi
  },
  {
    name: 'Mid 2',
    minRep: 75,
    roleId: '1493347264700223759', // Mid 2
    emoji: '🔷',
    color: 0x2196f3, // Mavi
  },
  {
    name: 'Mid 3',
    minRep: 105,
    roleId: '1493347331267891402', // Mid 3
    emoji: '🔷',
    color: 0x3f51b5, // Indigo
  },
  {
    name: 'Senior 1',
    minRep: 135,
    roleId: '1493347479901569100', // Senior 1
    emoji: '🌟',
    color: 0x9c27b0, // Mor
  },
  {
    name: 'Senior 2',
    minRep: 235,
    roleId: '1493347647107633192', // Senior 2
    emoji: '🌟',
    color: 0x673ab7, // Koyu mor
  },
  {
    name: 'Senior 3',
    minRep: 335,
    roleId: '1493347716707909743', // Senior 3
    emoji: '🌟',
    color: 0xff5722, // Turuncu
  },
  {
    name: 'Boss 1',
    minRep: 435,
    roleId: '1493347879010570422', // Boss 1
    emoji: '💎',
    color: 0xff9800, // Amber
  },
  {
    name: 'Boss 2',
    minRep: 685,
    roleId: '1493347947142975550', // Boss 2
    emoji: '💎',
    color: 0xffc107, // Altın
  },
  {
    name: 'Boss 3',
    minRep: 935,
    roleId: '1493348027425882222', // Boss 3
    emoji: '💎',
    color: 0xffd700, // Parlak altın
  },
  {
    name: 'God of Code',
    minRep: 1000,
    roleId: '1520090320191230103', // God of Code
    emoji: '⚡',
    color: 0xffffff, // Beyaz / epik
  },
];

/**
 * Verilen puana göre hak edilen rütbeyi döndürür.
 * Listeyi sondan başa tarar; ilk eşleşen (en yüksek hak edilen) rütbeyi döndürür.
 *
 * @param {number} rep - Kullanıcının mevcut rep puanı
 * @returns {{ name, minRep, roleId, emoji, color }} Rütbe nesnesi
 */
function getRankForRep(rep) {
  // Listeyi tersine tara → en yüksek minRep'e sahip, hak edilen ilk rütbeyi bul
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (rep >= RANKS[i].minRep) {
      return RANKS[i];
    }
  }
  // Güvenlik: Puan eksi ise bile en alt rütbeyi döndür
  return RANKS[0];
}

/**
 * Bir sonraki rütbeyi döndürür.
 * Kullanıcı zaten maksimum seviyedeyse null döner.
 *
 * @param {string} currentRankName - Mevcut rütbenin adı
 * @returns {{ name, minRep, roleId, emoji, color } | null}
 */
function getNextRank(currentRankName) {
  const idx = RANKS.findIndex((r) => r.name === currentRankName);
  if (idx === -1 || idx === RANKS.length - 1) return null;
  return RANKS[idx + 1];
}

module.exports = { RANKS, getRankForRep, getNextRank };
