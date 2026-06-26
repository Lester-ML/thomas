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
const { getSetting } = require('./database');

// ── Tüm Rank Rol ID'lerini Bir Sete Topla ────────────────────
const ALL_RANK_ROLE_IDS = new Set(
  RANKS.map((r) => r.roleId).filter((id) => id !== 'ROLE_ID')
);

// ── Tier'a Göre Tema & Mesaj Havuzu ──────────────────────────
function getTierTheme(rankName) {
  if (rankName.startsWith('Junior')) {
    return {
      flare: '╔══════════════════════╗\n║   🌱  YENİ RÜTBE  🌱  ║\n╚══════════════════════╝',
      messages: [
        'Küçük bir adım, büyük bir başlangıç! Devam et!',
        'Yolculuğun yeni bir sayfası açılıyor. 📖',
        'Her uzman, bir zamanlar sıfırdan başladı. Sen de yoldasın!',
      ],
      footerIcon: '🌱',
    };
  }
  if (rankName.startsWith('Mid')) {
    return {
      flare: '╔══════════════════════╗\n║   ⚡  SEVİYE ATLA!  ⚡ ║\n╚══════════════════════╝',
      messages: [
        'Artık işler ciddileşiyor. Potansiyelini göstermeye devam et! 💥',
        'Orta yoldasın ama tempo kesilmesin!',
        'Mid seviyeye ulaştın. Topluluk seni fark ediyor! 👀',
      ],
      footerIcon: '⚡',
    };
  }
  if (rankName.startsWith('Senior')) {
    return {
      flare: '╔══════════════════════╗\n║  🔥  SENIOR RÜTBE  🔥 ║\n╚══════════════════════╝',
      messages: [
        'Senior seviyeye ulaştın. Artık efsane yazılıyor! 🖊️',
        'Bu rütbe çalışmanın ödülü. Harika iş! 🏅',
        'Topluluk seni tanıyor. Senior olmanın ağırlığını hissediyor musun?',
      ],
      footerIcon: '🔥',
    };
  }
  if (rankName.startsWith('Boss')) {
    return {
      flare: '╔══════════════════════╗\n║   👑   BOSS MODE   👑  ║\n╚══════════════════════╝',
      messages: [
        'BOSS moduna girdin. Artık sen bir efsanesin! 💎',
        'Bu sunucunun zirvesine tırmanıyorsun. Durma! 🚀',
        'Sıradan değil, olağanüstü. Tebrikler, Boss!',
      ],
      footerIcon: '👑',
    };
  }
  return {
    flare: '',
    messages: ['Harika iş!'],
    footerIcon: '⭐',
  };
}

// ── ASCII Progress Bar ────────────────────────────────────────
function buildProgressBar(current, min, max, length = 14) {
  if (max <= min) return '`' + '█'.repeat(length) + '` 100%';
  const pct = Math.min((current - min) / (max - min), 1);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\`${bar}\` ${Math.round(pct * 100)}%`;
}

/**
 * Kullanıcının repütasyonu değiştiğinde rütbesini günceller.
 *
 * @param {GuildMember} options.member
 * @param {number}      options.oldRep
 * @param {number}      options.newRep
 * @param {Guild}       options.guild
 * @param {Client}      options.client
 */
async function checkRank({ member, oldRep, newRep, guild, client }) {
  try {
    const oldRank = getRankForRep(oldRep);
    const newRank = getRankForRep(newRep);

    // Rütbe değişmemişse çık
    if (oldRank.name === newRank.name) return;

    // ── Rol İşlemleri ─────────────────────────────────────────
    const rolesToRemove = member.roles.cache.filter((role) =>
      ALL_RANK_ROLE_IDS.has(role.id)
    );
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, 'Rütbe güncellendi — eski roller kaldırıldı');
    }

    if (newRank.roleId !== 'ROLE_ID') {
      const newRole = guild.roles.cache.get(newRank.roleId);
      if (newRole) {
        await member.roles.add(newRole, `Yeni rütbe: ${newRank.name}`);
      } else {
        console.warn(`[RankService] '${newRank.name}' rolü bulunamadı (ID: ${newRank.roleId}).`);
      }
    }

    // Sadece puan arttığında kutlama gönder
    if (newRep <= oldRep) return;

    // ── Kanal Kontrolü ────────────────────────────────────────
    const LEVEL_UP_CHANNEL_ID = getSetting('level_up_channel_id');
    if (!LEVEL_UP_CHANNEL_ID) {
      console.warn('[RankService] Seviye kanal ayarlanmamış. /seviye-kanal komutuyla ayarlayın.');
      return;
    }

    const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
    if (!levelUpChannel) {
      console.warn(`[RankService] Kutlama kanalı bulunamadı (ID: ${LEVEL_UP_CHANNEL_ID}).`);
      return;
    }

    // ── Kutlama Embed'ini Oluştur ─────────────────────────────
    let embed;
    const content = `${member}`; // Ping bildirimi

    if (newRank.name === 'God of Code') {
      // ── EPİK GOD OF CODE MESAJI ───────────────────────────
      embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setAuthor({
          name: '⚡ EFSANE DOĞDU ⚡',
          iconURL: member.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle('╔══════════════════════╗\n║  ⚡  GOD OF CODE  ⚡  ║\n╚══════════════════════╝')
        .setDescription(
          `> ${member} artık ölümlü değil.\n` +
          `> Kodun tanrıları arasına katıldı.\n\n` +
          `*"Efsaneler yazılır, sen kendin efsanesin."*\n\n` +
          `🌩️ Sunucunun **en yüksek** rütbesine ulaştın!\n` +
          `Topluluk seni selamlıyor. 🫡`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { name: '👑 Rütbe',       value: '⚡ **God of Code**',       inline: true },
          { name: '⭐ Toplam Puan', value: `**${newRep} rep**`,         inline: true },
          { name: '🏆 Durum',       value: '**MAKSİMUM SEVİYE**',      inline: true },
          { name: '📈 Yolculuk',    value: `${oldRank.emoji} ${oldRank.name}  →  ⚡ God of Code`, inline: false },
        )
        .setFooter({ text: '⚡ Ölümsüz yazılımcılar topluluğuna hoş geldin.' })
        .setTimestamp();

    } else {
      // ── NORMAL SEVİYE ATLAMA ──────────────────────────────
      const theme = getTierTheme(newRank.name);
      const nextRank = getNextRank(newRank.name);
      const randomMsg = theme.messages[Math.floor(Math.random() * theme.messages.length)];

      const barMin = newRank.minRep;
      const barMax = nextRank ? nextRank.minRep : newRank.minRep;
      const progressBar = nextRank
        ? buildProgressBar(newRep, barMin, barMax)
        : '`██████████████` MAX 🏆';

      const nextRankText = nextRank
        ? `${nextRank.emoji} **${nextRank.name}** ─ *${nextRank.minRep - newRep} puan kaldı*`
        : '🏆 **Maksimum seviye!**';

      embed = new EmbedBuilder()
        .setColor(newRank.color)
        .setAuthor({
          name: `${member.user.username} seviye atladı!`,
          iconURL: member.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`${newRank.emoji}  ${newRank.name}`)
        .setDescription(
          `\`\`\`\n${theme.flare}\n\`\`\`` +
          `\n> *${randomMsg}*`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '📊 Rütbe Geçişi',
            value: `${oldRank.emoji} ~~${oldRank.name}~~  ➜  ${newRank.emoji} **${newRank.name}**`,
            inline: false,
          },
          {
            name: '⭐ Toplam Puan',
            value: `**${newRep} rep**`,
            inline: true,
          },
          {
            name: '⏭️ Sonraki Rütbe',
            value: nextRankText,
            inline: true,
          },
          {
            name: `📈 İlerleme  (${newRep} / ${barMax} rep)`,
            value: progressBar,
            inline: false,
          }
        )
        .setFooter({ text: `${theme.footerIcon} Çalışmaya devam et, zirve yakın!` })
        .setTimestamp();
    }

    // Ping + embed birlikte gönder
    await levelUpChannel.send({ content, embeds: [embed] });

  } catch (err) {
    console.error('[RankService] checkRank sırasında hata:', err);
  }
}

module.exports = { checkRank };
