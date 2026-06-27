// ============================================================
//  commands/chat-koruma.js — /chat-koruma Slash Komutu
//  Görev: Yöneticilerin bulundukları kanalı yönetmesini sağlar.
//
//  Modlar:
//    kapat          → @everyone SendMessages: false (tam kilit)
//    sohbet-engelle → Mesajlar serbest ama normal mesaj yazanlar
//                     uyarılır ve mesajları silinir (bot koruması)
//    ac             → Tüm kısıtları kaldır
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { setChannelMode, removeChannelMode } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('chat-koruma')
    .setDescription('(YÖNETİCİ) Bulunduğunuz kanalı normal üyelere kapatır, kısıtlar veya açar.')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels | PermissionFlagsBits.Administrator
    )
    .addStringOption((option) =>
      option
        .setName('durum')
        .setDescription('Kanalı kapat, sohbeti engelle veya aç.')
        .setRequired(true)
        .addChoices(
          { name: '🔒 Kapat  — Kimse mesaj yazamaz',                         value: 'kapat'          },
          { name: '🛡️ Sohbet Engelle  — Sadece slash komutları kullanılabilir', value: 'sohbet-engelle' },
          { name: '🔓 Aç  — Tüm kısıtları kaldır',                           value: 'ac'             }
        )
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    const { channel, guild, user, options } = interaction;
    const durum = options.getString('durum');

    // Discord 3 saniyelik timeout'u önle
    await interaction.deferReply();

    const everyoneRole = guild.roles.everyone;

    try {
      // ── 🔒 KAPAT ─────────────────────────────────────────
      if (durum === 'kapat') {
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
        setChannelMode(channel.id, 'kapat');

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('🔒 Kanal Kilitlendi')
              .setDescription('Bu kanal geçici olarak yöneticiler tarafından **mesaj yazımına kapatılmıştır.**')
              .setFooter({ text: `İşlemi yapan: ${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
              .setTimestamp(),
          ],
        });

      // ── 🛡️ SOHBET ENGELLE ────────────────────────────────
      } else if (durum === 'sohbet-engelle') {
        // SendMessages iznini varsayılana bırak (yazabilirler),
        // bot mesajları silecek ve DM uyarısı atacak.
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
        setChannelMode(channel.id, 'sohbet-engelle');

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xe67e22)
              .setTitle('🛡️ Sohbet Engeli Aktif')
              .setDescription(
                'Bu kanalda artık **sadece slash komutları** kullanılabilir.\n' +
                'Normal mesaj atan üyeler **uyarı alacak** ve mesajları **silinecek.**'
              )
              .setFooter({ text: `İşlemi yapan: ${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
              .setTimestamp(),
          ],
        });

      // ── 🔓 AÇ ────────────────────────────────────────────
      } else {
        await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
        removeChannelMode(channel.id);

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ecc71)
              .setTitle('🔓 Kanal Açıldı')
              .setDescription('Kanalın tüm kısıtları kaldırıldı, üyeler tekrar serbestçe mesaj gönderebilir.')
              .setFooter({ text: `İşlemi yapan: ${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
              .setTimestamp(),
          ],
        });
      }
    } catch (hata) {
      console.error('[chat-koruma] İşlem sırasında hata:', hata);
      await interaction.editReply({
        content: '❌ Kanal izinleri güncellenirken bir hata oluştu. Botun **Kanalları Yönet** yetkisine sahip olduğundan emin olun.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
