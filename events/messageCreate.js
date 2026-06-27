// ============================================================
//  events/messageCreate.js — Mesaj Dinleyici
//  Görev: Teşekkür içeren ve kullanıcı etiketleyen mesajları
//         yakalar ve etiketlenen kişiye +1 rep verir.
// ============================================================

const { Events, EmbedBuilder } = require('discord.js');
const { giveRep, formatCooldown } = require('../src/repService');
const { checkRank } = require('../src/rankService');
const { getChannelMode } = require('../src/database');

// Spam takibi için bellekte geçici harita (userId -> { count, firstMessage })
const spamTracker = new Map();

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

      // ── Spam Kontrolü (4 mesajdan sonra 5 dk Timeout) ─────
      const now = Date.now();
      const SPAM_WINDOW = 15000; // 15 saniyelik pencere
      const SPAM_LIMIT = 4;
      
      let userData = spamTracker.get(message.author.id) || { count: 0, firstMessage: now };
      
      if (now - userData.firstMessage > SPAM_WINDOW) {
        // Süre geçtiyse sıfırla
        userData = { count: 1, firstMessage: now };
      } else {
        userData.count += 1;
      }
      spamTracker.set(message.author.id, userData);

      if (userData.count >= SPAM_LIMIT) {
        // Sınır aşıldı -> 5 dakika timeout (300.000 ms)
        try {
          const member = await message.guild.members.fetch(message.author.id);
          if (member.moderatable) {
            await member.timeout(5 * 60 * 1000, 'Komut kanalında spam yapma');
            
            // Özelden ekstra ban mesajı gönder
            const banEmbed = new EmbedBuilder()
              .setColor(0x992d22)
              .setTitle('🚫 Susturuldun (Timeout)!')
              .setDescription(`**${message.guild.name}** sunucusunda komut kanalını spamladığın için **5 dakika** boyunca tüm kanallarda susturuldun. Lütfen kurallara uy.`)
              .setTimestamp();
            await message.author.send({ embeds: [banEmbed] }).catch(() => {});
          }
        } catch (err) {
          console.error('[SpamKoruma] Timeout atılamadı:', err);
        }
        
        // Ceza sonrası sayacı sıfırla ki üst üste ceza yemeye çalışıp hata atmasın
        spamTracker.delete(message.author.id);
        return; // İşlemi bitir (normal uyarıyı gönderme)
      }

      // ── Normal Uyarı (İlk 3 mesaj için) ───────────────────
      try {
        const uyariEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⚠️ Mesajın Silindi!')
          .setDescription(
            `**${message.guild.name}** sunucusunda **#${message.channel.name}** kanalı şu anda **sohbet engellidir.**\n\n` +
            '❌ Bu kanalda normal mesaj gönderemezsin.\n' +
            '✅ Sadece **slash komutları** kullanabilirsin (örn: `/profil`, `/market`)\n\n' +
            `*Not: Spam yapmaya devam edersen (**${userData.count}/${SPAM_LIMIT}**) 5 dakika susturulacaksın!*`
          )
          .setFooter({ text: 'Anlayışın için teşekkürler 🙏' })
          .setTimestamp();

        await message.author.send({ embeds: [uyariEmbed] });
      } catch {
        // DM kapalıysa sessizce devam et
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
