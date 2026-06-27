// ============================================================
//  commands/chat-koruma.js — /chat-koruma Slash Komutu
//  Görev: Yöneticilerin bulundukları kanalı normal üyelerin
//         mesaj yazımına kapatmasını veya açmasını sağlar.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('chat-koruma')
    .setDescription('(YÖNETİCİ) Bulunduğunuz kanalı normal üyelere kapatır veya açar.')
    // Komutu yalnızca "Kanalları Yönet" ya da "Yönetici" yetkisi olanlara göster
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels | PermissionFlagsBits.Administrator
    )
    .addStringOption((option) =>
      option
        .setName('durum')
        .setDescription('Kanalı kapat veya aç.')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Kapat', value: 'kapat' },
          { name: '🔓 Aç',    value: 'ac'    }
        )
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    const { channel, guild, user, options } = interaction;
    const durum = options.getString('durum');

    // Discord'un 3 saniyelik zaman aşımını önlemek için hemen ertele.
    // permissionOverwrites.edit() bir API çağrısıdır ve zaman alabilir.
    await interaction.deferReply();

    // Sunucudaki @everyone rolünü bul
    const everyoneRole = guild.roles.everyone;

    try {
      if (durum === 'kapat') {
        // @everyone için SendMessages iznini kapat (false)
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        });

        const kapalıEmbed = new EmbedBuilder()
          .setColor(0xe74c3c) // Kırmızı
          .setTitle('🔒 Kanal Kilitlendi')
          .setDescription(
            'Bu kanal geçici olarak yöneticiler tarafından mesaj yazımına kapatılmıştır.'
          )
          .setFooter({
            text: `İşlemi yapan: ${user.tag}`,
            iconURL: user.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [kapalıEmbed] });
      } else {
        // @everyone için SendMessages iznini varsayılana döndür (null)
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        });

        const açıkEmbed = new EmbedBuilder()
          .setColor(0x2ecc71) // Yeşil
          .setTitle('🔓 Kanal Açıldı')
          .setDescription(
            'Kanalın kilidi kaldırıldı, üyeler tekrar mesaj gönderebilir.'
          )
          .setFooter({
            text: `İşlemi yapan: ${user.tag}`,
            iconURL: user.displayAvatarURL({ dynamic: true }),
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [açıkEmbed] });
      }
    } catch (hata) {
      console.error('[chat-koruma] İzin güncellenirken hata oluştu:', hata);

      // Interaction zaten deferReply ile ertelendi → editReply kullan
      await interaction.editReply({
        content:
          '❌ Kanal izinleri güncellenirken bir hata oluştu. Botun **Kanalları Yönet** yetkisine sahip olduğundan emin olun.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
