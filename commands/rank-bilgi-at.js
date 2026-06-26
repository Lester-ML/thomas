// ============================================================
//  commands/rank-bilgi-at.js — /rank-bilgi-at Admin Komutu
//  Görev: Rank bilgilendirme embed'ini anında belirlenen
//         kanala (RANK_INFO_CHANNEL_ID) manuel olarak gönderir.
//
//  YETKİ: Sadece Administrator yetkisine sahip kişiler kullanabilir.
// ============================================================

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendRankBilgi } = require('../src/rankBilgiScheduler');



module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank-bilgi-at')
    .setDescription('[Admin] Rank bilgilendirme mesajını şimdi kanala gönderir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Yetki kontrolü
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 Bu komut sadece **Administrator** yetkisine sahip kişiler tarafından kullanılabilir.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await sendRankBilgi(interaction.client);

      return interaction.editReply({
        content: '✅ Rank bilgilendirme mesajı başarıyla gönderildi!',
      });
    } catch (err) {
      console.error('[rank-bilgi-at] Hata:', err);
      return interaction.editReply({
        content: `❌ Mesaj gönderilemedi: \`${err.message}\``,
      });
    }
  },
};
