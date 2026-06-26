// ============================================================
//  commands/profil.js — /profil Slash Komutu (Güncellenmiş)
//  Görev: Belirtilen kullanıcının (veya komutu yazanın)
//         repütasyon profilini, mevcut rütbesini ve bir
//         sonraki rütbeye kalan puanı şık bir Embed ile gösterir.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserRep } = require('../src/repService');
const { getRankForRep, getNextRank } = require('../src/rankConfig');

module.exports = {
  // ── Komut Tanımı (Discord'a Kayıt İçin) ──────────────────
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Bir kullanıcının repütasyon profilini ve rütbesini gösterir.')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Profili görüntülenecek kullanıcı (boş bırakılırsa kendiniz)')
        .setRequired(false)
    ),

  // ── Komut Yürütücüsü ──────────────────────────────────────
  async execute(interaction) {
    // Kullanıcı seçimi: Parametreden al, yoksa komutu yazanı kullan
    const target = interaction.options.getUser('kullanici') ?? interaction.user;

    // Botların profili yok
    if (target.bot) {
      return interaction.reply({
        content: '🤖 Botların repütasyon profili bulunmamaktadır.',
        ephemeral: true,
      });
    }

    // Veritabanından rep bilgisini al
    const record = getUserRep(target.id);
    const rep = record.rep;

    // ── Rütbe Hesaplama ───────────────────────────────────────
    const currentRank = getRankForRep(rep);
    const nextRank = getNextRank(currentRank.name);

    // ── Sonraki Seviye Bilgisi ─────────────────────────────────
    let nextRankField;
    if (!nextRank) {
      // Maksimum seviye — God of Code
      nextRankField = '🏆 **MAKSİMUM SEVİYE**\nTüm rütbelerin zirvesine ulaştın!';
    } else {
      const remaining = nextRank.minRep - rep;
      nextRankField = `${nextRank.emoji} **${nextRank.name}**\n\`${remaining} puan\` daha kazan!`;
    }

    // ── Embed Oluştur ─────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(currentRank.color)
      .setAuthor({
        name: `${target.username} — Repütasyon Profili`,
        iconURL: target.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '⭐ Toplam Repütasyon',
          value: `**${rep}** puan`,
          inline: true,
        },
        {
          name: `${currentRank.emoji} Mevcut Rütbe`,
          value: `**${currentRank.name}**`,
          inline: true,
        },
        {
          // Boş alan — embed'i düzgün hizalar (3'lü grid için)
          name: '\u200B',
          value: '\u200B',
          inline: true,
        },
        {
          name: '⏭️ Sonraki Rütbe',
          value: nextRankField,
          inline: false,
        }
      )
      .setFooter({
        text: `Kullanıcı ID: ${target.id} • /liderlik ile sıralamayı gör`,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
