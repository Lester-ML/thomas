// ============================================================
//  commands/seviye-kanal.js — /seviye-kanal Admin Komutu
//  Görev: Seviye atlama tebrik mesajlarının gönderileceği
//         kanalı ayarlar ve veritabanına kaydeder.
//
//  YETKİ: Sadece Administrator yetkisine sahip kişiler kullanabilir.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { setSetting, getSetting } = require('../src/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seviye-kanal')
    .setDescription('[Admin] Seviye atlama tebrik mesajlarının gönderileceği kanalı ayarla.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName('kanal')
        .setDescription('Tebrik mesajlarının gönderileceği kanal')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Yetki kontrolü
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 Bu komut sadece **Administrator** yetkisine sahip kişiler tarafından kullanılabilir.',
        ephemeral: true,
      });
    }

    const kanal = interaction.options.getChannel('kanal');

    // Kanal metin kanalı mı kontrol et
    if (!kanal.isTextBased()) {
      return interaction.reply({
        content: '❌ Lütfen bir **metin kanalı** seçin.',
        ephemeral: true,
      });
    }

    // Eski ayarı al
    const eskiKanalId = getSetting('level_up_channel_id');

    // Yeni ayarı kaydet
    setSetting('level_up_channel_id', kanal.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2) // Discord blurple
      .setTitle('✅ Seviye Kanal Ayarlandı')
      .setDescription(`Bundan sonra seviye atlama tebrik mesajları ${kanal}'a gönderilecek! 🎉`)
      .addFields(
        {
          name: '📢 Yeni Kanal',
          value: `${kanal} (\`${kanal.id}\`)`,
          inline: true,
        },
        {
          name: '🗑️ Eski Kanal',
          value: eskiKanalId ? `<#${eskiKanalId}>` : 'Ayarlanmamıştı',
          inline: true,
        }
      )
      .setFooter({
        text: `Ayarlayan: ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
