// ============================================================
//  events/messageReactionAdd.js — Reaksiyon Dinleyici
//  Görev: ✅ emojisi ile yapılan reaksiyonları yakalar ve
//         mesaj sahibine +2 rep verir.
//
//  ÖNEMLİ NOT: Bot başlatılmadan önce gönderilen mesajlara
//  (eski mesajlar / "partial" mesajlar) verilen reaksiyonları
//  da algılayabilmek için 'fetchPartials' mantığı kullanılır.
// ============================================================

const { Events, EmbedBuilder } = require('discord.js');
const { giveRep, formatCooldown } = require('../src/repService');
const { checkRank } = require('../src/rankService');

const CHECK_MARK_EMOJI = '✅';

module.exports = {
  name: Events.MessageReactionAdd,

  // Partial mesajları/reaksiyonları da dinlemek istiyoruz
  async execute(reaction, user) {
    // ── Partial (Kısmi) Veri Yükleme ─────────────────────────
    // Discord, önbelleğe alınmamış eski mesajlar için kısmi veri gönderir.
    // Fetch ile tam veriyi çekmemiz gerekir.
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (err) {
      console.error('[ReactionAdd] Kısmi veri yüklenirken hata:', err);
      return;
    }

    // ── Temel Filtreleme ──────────────────────────────────────

    // Bot reaksiyonlarını yoksay
    if (user.bot) return;

    // Sunucu mesajı değilse yoksay
    if (!reaction.message.guild) return;

    // Sadece ✅ emojisine tepki ver
    if (reaction.emoji.name !== CHECK_MARK_EMOJI) return;

    const message = reaction.message;
    const targetUser = message.author;

    // Mesaj sahibi bot ise yoksay
    if (targetUser.bot) return;

    // ── Kendi Mesajına Reaksiyon Verme Koruması ───────────────
    if (user.id === targetUser.id) {
      // Uyarıyı özel mesaj olarak gönder (kanala çöp atmayalım)
      try {
        await user.send('🚫 Kendi mesajınıza ✅ reaksiyonu vererek kendinize rep kazanamazsınız!');
      } catch {
        // DM kapalıysa sessizce devam et
      }
      return;
    }

    // ── Rep Ver ───────────────────────────────────────────────
    const result = giveRep(user.id, targetUser.id, 2);

    if (!result.success) {
      if (result.reason === 'cooldown') {
        const timeLeft = formatCooldown(result.remainingMs);
        try {
          await user.send(
            `⏳ Biraz yavaş! Tekrar rep verebilmek için **${timeLeft}** beklemeniz gerekiyor.`
          );
        } catch {
          // DM kapalıysa sessizce devam et
        }
      }
      return;
    }

    // ── Başarı Embed'i ────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x5865f2) // Discord bluru (Blurple)
      .setTitle('✅ Repütasyon Verildi!')
      .setDescription(
        `${user} → ${targetUser} mesajını ✅ ile onayladı!\n` +
        `${targetUser.username} artık **${result.newRep} rep** puanına sahip. **(+2)**`
      )
      .setFooter({ text: 'Kaliteli katkılar ödüllendirilir 🏆' })
      .setTimestamp();

    try {
      // Reaksiyonu yapılan mesajın kanalına bildirim gönder
      await message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[ReactionAdd] Embed gönderilemedi:', err);
    }

    // ── Otomatik Rol Güncelleme ────────────────────────────────
    // Rep verildikten sonra hedefin rütbesini kontrol et ve rolleri güncelle
    try {
      const guild = message.guild;
      const targetMember = await guild.members.fetch(targetUser.id);
      // giveRep +2 ekledi; bir önceki puan = newRep - 2
      await checkRank({
        member: targetMember,
        oldRep: result.newRep - 2,
        newRep: result.newRep,
        guild,
        client: reaction.client,
      });
    } catch (err) {
      console.error('[ReactionAdd] checkRank çağrısı başarısız:', err);
    }
  },
};
