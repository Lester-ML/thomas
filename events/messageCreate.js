// ============================================================
//  events/messageCreate.js — Mesaj Dinleyici
//  Görev: Teşekkür içeren ve kullanıcı etiketleyen mesajları
//         yakalar ve etiketlenen kişiye +1 rep verir.
// ============================================================

const { Events, EmbedBuilder } = require('discord.js');
const { giveRep, formatCooldown } = require('../src/repService');
const { checkRank } = require('../src/rankService');
const { getChannelMode } = require('../src/database');

// Teşekkür ifadelerinin listesi (küçük harf, Türkçe odaklı)
const THANK_YOU_WORDS = [
  'teşekkür',
  'teşekkürler',
  'sağol',
  'sağolasın',
  'eyvallah',
  'thanks',
  'thx',
  'ty',
  'thank you',
];

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // ── Temel Filtreleme ──────────────────────────────────────

    // Botları yoksay
    if (message.author.bot) return;

    // Sunucu mesajı değilse yoksay (DM vb.)
    if (!message.guild) return;

    // ── 🛡️ Sohbet Engeli Kontrolü ────────────────────────────
    // Kanal "sohbet-engelle" modundaysa slash olmayan mesajları sil
    const channelMode = getChannelMode(message.channel.id);
    if (channelMode === 'sohbet-engelle') {
      try {
        // Mesajı sil
        await message.delete();
      } catch {
        // Silme yetkisi yoksa sessizce devam et
      }

      // Kullanıcıya özelden uyarı gönder
      try {
        const uyariEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⚠️ Mesajın Silindi!')
          .setDescription(
            `**${message.guild.name}** sunucusunda **#${message.channel.name}** kanalı şu anda **sohbet engellidir.**\n\n` +
            '❌ Bu kanalda normal mesaj gönderemezsin.\n' +
            '✅ Sadece **slash komutları** kullanabilirsin (örn: `/profil`, `/market`)'
          )
          .setFooter({ text: 'Anlayışın için teşekkürler 🙏' })
          .setTimestamp();

        await message.author.send({ embeds: [uyariEmbed] });
      } catch {
        // DM kapalıysa (kullanıcı engellemiş vb.) sessizce devam et
      }

      return; // Aşağıdaki rep mantığını çalıştırma
    }

    // Mesaj teşekkür kelimesi içeriyor mu? (büyük/küçük harf duyarsız)
    const lowerContent = message.content.toLowerCase();
    const hasThankYou = THANK_YOU_WORDS.some((word) => lowerContent.includes(word));
    if (!hasThankYou) return;

    // ── Her Etiketlenen Kullanıcı İçin İşlem ─────────────────
    for (const [targetId, targetUser] of message.mentions.users) {
      // Botlara rep verilemez
      if (targetUser.bot) {
        await message.reply({
          content: '🤖 Botlara repütasyon verilemez!',
          allowedMentions: { repliedUser: false },
        });
        continue;
      }

      // Kendi kendine rep verme koruması
      if (message.author.id === targetId) {
        await message.reply({
          content: '🚫 Kendinize repütasyon veremezsiniz!',
          allowedMentions: { repliedUser: false },
        });
        continue;
      }

      // Rep vermeyi dene (cooldown + kayıt işlemi)
      const result = giveRep(message.author.id, targetId, 1);

      if (!result.success) {
        if (result.reason === 'cooldown') {
          const timeLeft = formatCooldown(result.remainingMs);
          await message.reply({
            content: `⏳ Biraz yavaş! Tekrar rep verebilmek için **${timeLeft}** beklemeniz gerekiyor.`,
            allowedMentions: { repliedUser: false },
          });
        }
        // 'self' durumu zaten yukarıda ele alındı
        continue;
      }

      // ── Başarı Embed'i ─────────────────────────────────────────
      const embed = new EmbedBuilder()
        .setColor(0x57f287) // Discord yeşili
        .setTitle('⭐ Repütasyon Verildi!')
        .setDescription(
          `${message.author} → ${targetUser} için **+1 rep** verdi!\n` +
          `${targetUser.username} artık **${result.newRep} rep** puanına sahip.`
        )
        .setFooter({ text: 'Yardımlaşmak güzeldir 💙' })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

      // ── Otomatik Rol Güncelleme ───────────────────────────────────
      // Rep verildikten sonra hedefin rütbesini kontrol et ve rolleri güncelle
      try {
        const member = await message.guild.members.fetch(targetId);
        // newRep: güncel puan | oldRep: önceki puan (newRep - 1 rep)
        await checkRank({
          member,
          oldRep: result.newRep - 1, // giveRep +1 ekledi, bir önceki değer
          newRep: result.newRep,
          guild: message.guild,
          client: message.client,
        });
      } catch (err) {
        console.error('[MessageCreate] checkRank çağrısı başarısız:', err);
      }
    }
  },
};
