// ============================================================
//  commands/liderlik.js — /liderlik Slash Komutu
//  Görev: Sunucudaki en yüksek repütasyona sahip ilk 10
//         kullanıcıyı şık bir Embed ile listeler.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../src/repService');

// Sıralama için özel madalya emojileri
const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('liderlik')
    .setDescription('Sunucudaki en yüksek repütasyona sahip ilk 10 kişiyi gösterir.'),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    // Komutu hemen deferle: Kullanıcı listesi fetchleme biraz sürebilir
    await interaction.deferReply();

    // Veritabanından sıralı listeyi al
    const leaderboard = getLeaderboard();

    if (leaderboard.length === 0) {
      return interaction.editReply({
        content: '📊 Henüz hiç repütasyon verisi yok. İlk repütasyonu sen ver! ⭐',
      });
    }

    // ── Her Kullanıcı İçin Satır Oluştur ─────────────────────
    const lines = await Promise.all(
      leaderboard.map(async ({ user_id, rep }, index) => {
        const rank = index + 1;
        const medal = MEDALS[index] ?? `**${rank}.**`;

        // Kullanıcıyı Discord'dan çekmeye çalış (önbelleği yoksa fetch et)
        let displayName = `<@${user_id}>`;
        try {
          const member = await interaction.guild.members.fetch(user_id);
          displayName = member.displayName;
        } catch {
          // Kullanıcı sunucudan ayrılmış olabilir — mention formatını kullan
        }

        return `${medal} **${displayName}** — \`${rep} rep\``;
      })
    );

    // ── Embed Oluştur ─────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0xffd700) // Altın sarısı
      .setTitle('🏆 Repütasyon Liderlik Tablosu')
      .setDescription(lines.join('\n'))
      .addFields({
        name: '📌 Nasıl Rep Kazanılır?',
        value:
          '• Mesajında **teşekkür** ettiğin birini etiketle → **+1 rep**\n' +
          '• Kaliteli bir mesaja **✅** reaksiyonu ver → **+2 rep**',
      })
      .setFooter({
        text: `${interaction.guild.name} • Anlık Sıralama`,
        iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined,
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
