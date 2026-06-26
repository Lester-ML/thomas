// ============================================================
//  src/rankService.js — Otomatik Rol (Leveling) Servisi
//  Görev: Kullanıcının rep puanı değiştiğinde çağrılır.
//         Doğru rütbeyi hesaplar, eski rank rollerini alır,
//         yeni rolü atar ve gerekirse kutlama mesajı gönderir.
//
//  Kullanım:
//    const { checkRank } = require('./rankService');
//    await checkRank({ member, oldRep, newRep, guild, client });
// ============================================================

const { EmbedBuilder } = require('discord.js');
const { RANKS, getRankForRep, getNextRank } = require('./rankConfig');

// ── Sabitler ─────────────────────────────────────────────────
// Seviye atlamak için kutlama mesajının gönderileceği kanal ID'si.
// .env dosyasına LEVEL_UP_CHANNEL_ID=<kanal_id> satırını ekleyin.
const LEVEL_UP_CHANNEL_ID = process.env.LEVEL_UP_CHANNEL_ID;

// ── Tüm Rank Rol ID'lerini Bir Sete Topla ────────────────────
// checkRank içinde "bu kullanıcının hangi rank rolleri var" kontrolü
// için kullanılır. ROLE_ID yer tutucularını filtreler.
const ALL_RANK_ROLE_IDS = new Set(
  RANKS.map((r) => r.roleId).filter((id) => id !== 'ROLE_ID')
);

/**
 * Kullanıcının repütasyonu değiştiğinde rütbesini günceller.
 *
 * @param {object}      options
 * @param {GuildMember} options.member  - Discord sunucu üyesi nesnesi
 * @param {number}      options.oldRep  - Önceki rep puanı
 * @param {number}      options.newRep  - Yeni rep puanı
 * @param {Guild}       options.guild   - Discord sunucu nesnesi
 * @param {Client}      options.client  - Discord istemci nesnesi
 * @returns {Promise<void>}
 */
async function checkRank({ member, oldRep, newRep, guild, client }) {
  try {
    // ── Eski ve Yeni Rütbeleri Hesapla ───────────────────────
    const oldRank = getRankForRep(oldRep);
    const newRank = getRankForRep(newRep);

    // Rütbe değişmemişse rol işlemi yapma
    if (oldRank.name === newRank.name) return;

    // ── Rol İşlemleri ─────────────────────────────────────────
    // Önce tüm eski rank rollerini kullanıcıdan kaldır
    const rolesToRemove = member.roles.cache.filter((role) =>
      ALL_RANK_ROLE_IDS.has(role.id)
    );

    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, 'Rütbe güncellendi — eski roller kaldırıldı');
    }

    // Yeni rütbenin rolünü ata (yer tutucu değilse)
    if (newRank.roleId !== 'ROLE_ID') {
      const newRole = guild.roles.cache.get(newRank.roleId);
      if (newRole) {
        await member.roles.add(newRole, `Yeni rütbe: ${newRank.name}`);
      } else {
        console.warn(
          `[RankService] '${newRank.name}' rolü bulunamadı (ID: ${newRank.roleId}). ` +
          `Rol ID'sini rankConfig.js'de doğru girdiğinizden emin olun.`
        );
      }
    }

    // ── Seviye Atlama Kontrolü ────────────────────────────────
    // Sadece puan arttığında (yukarı yönlü değişim) kutlama gönder
    if (newRep <= oldRep) return;

    // Kutlama kanalını bul
    if (!LEVEL_UP_CHANNEL_ID) {
      console.warn('[RankService] LEVEL_UP_CHANNEL_ID .env dosyasında tanımlı değil, kutlama mesajı atlanıyor.');
      return;
    }

    const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
    if (!levelUpChannel) {
      console.warn(`[RankService] Kutlama kanalı bulunamadı (ID: ${LEVEL_UP_CHANNEL_ID}).`);
      return;
    }

    // ── Kutlama Embed'ini Oluştur ─────────────────────────────
    let embed;

    if (newRank.name === 'God of Code') {
      // EPİK "God of Code" mesajı
      embed = new EmbedBuilder()
        .setColor(0xffd700) // Parlak altın
        .setTitle('⚡ GÖKLER GÜRLÜYOR! ⚡')
        .setDescription(
          `> **GÖKLER GÜRLÜYOR! ⚡**\n\n` +
          `${member} artık ölümlü bir yazılımcı değil,\n` +
          `o bir **God of Code**! 🌩️\n\n` +
          `*Kodun tanrıları arasına katıldın. Efsaneler seni selamlıyor.*`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { name: '👑 Rütbe', value: '⚡ God of Code', inline: true },
          { name: '⭐ Puan', value: `**${newRep} rep**`, inline: true },
          { name: '🏆 Durum', value: 'MAKSİMUM SEVİYE', inline: true }
        )
        .setImage('https://i.imgur.com/placeholder.gif') // İsteğe bağlı: Epik bir GIF eklenebilir
        .setFooter({ text: '⚡ Ölümsüz yazılımcılar topluluğuna hoş geldin.' })
        .setTimestamp();

    } else {
      // Normal seviye atlama mesajı
      const nextRank = getNextRank(newRank.name);
      const nextRankText = nextRank
        ? `${nextRank.emoji} **${nextRank.name}** — ${nextRank.minRep - newRep} puan kaldı`
        : '🏆 Maksimum seviye!';

      embed = new EmbedBuilder()
        .setColor(newRank.color)
        .setTitle(`${newRank.emoji} Seviye Atladı!`)
        .setDescription(
          `Tebrikler ${member}! Yeni rütbene ulaştın: **${newRank.name}** ${newRank.emoji}\n\n` +
          `Harika işler çıkarmaya devam et! 🚀`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '🆕 Yeni Rütbe', value: `${newRank.emoji} **${newRank.name}**`, inline: true },
          { name: '⭐ Toplam Puan', value: `**${newRep} rep**`, inline: true },
          { name: '⏭️ Sonraki Hedef', value: nextRankText, inline: false }
        )
        .setFooter({ text: 'Çalışmaya devam et, daha büyük rütbeler seni bekliyor!' })
        .setTimestamp();
    }

    await levelUpChannel.send({ embeds: [embed] });

  } catch (err) {
    // Rol hatası botu durdurmasın, sadece logla
    console.error('[RankService] checkRank sırasında hata:', err);
  }
}

module.exports = { checkRank };
