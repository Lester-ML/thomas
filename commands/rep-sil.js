// ============================================================
//  commands/rep-sil.js — /rep-sil Admin Komutu
//  Görev: Seçilen kullanıcıdan belirtilen miktarda rep siler.
//
//  YETKİ:  Sadece Administrator yetkisine sahip kişiler kullanabilir.
//  KURAL:  Puan hiçbir zaman 0'ın altına düşmez.
//  ETKİ:   updateRep ile veritabanı güncellenir, checkRank ile
//          roller otomatik olarak ayarlanır (rütbe DÜŞER).
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getUserRep, updateRep } = require('../src/repService');
const { checkRank } = require('../src/rankService');
const { getRankForRep } = require('../src/rankConfig');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('rep-sil')
    .setDescription('[Admin] Seçilen kullanıcıdan rep puanı siler.')
    // Komut yalnızca Administrator yetkisi olan kişilere görünsün
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Rep silinecek kullanıcı')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('miktar')
        .setDescription('Silinecek rep miktarı (1 veya daha fazla)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000) // Güvenlik sınırı
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    // ── Yetki Kontrolü (İkinci Katman Güvenlik) ───────────────
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 Bu komut sadece **Administrator** yetkisine sahip kişiler tarafından kullanılabilir.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('kullanici');
    const amount = interaction.options.getInteger('miktar');

    // Bot kontrolü
    if (targetUser.bot) {
      return interaction.reply({
        content: '🤖 Botlardan rep silinemez.',
        ephemeral: true,
      });
    }

    // Mevcut puanı al
    const currentRecord = getUserRep(targetUser.id);
    const oldRep = currentRecord.rep;

    // Puan 0'ın altına düşmesin — updateRep zaten Math.max(0,...) uygular,
    // ama kullanıcıya anlamlı bir mesaj için burada da hesaplıyoruz.
    const rawNewRep = oldRep - amount;
    const clampedNewRep = Math.max(0, rawNewRep);

    if (oldRep === 0) {
      return interaction.reply({
        content: `⚠️ **${targetUser.username}** zaten **0 rep** puanına sahip, daha fazla silinemez.`,
        ephemeral: true,
      });
    }

    // Veritabanını güncelle (updateRep içinde de güvenlik var)
    const result = updateRep(targetUser.id, clampedNewRep);

    // ── checkRank: Rol güncelleme (rütbe düşebilir) ──────────
    try {
      const member = await interaction.guild.members.fetch(targetUser.id);
      await checkRank({
        member,
        oldRep: result.oldRep,
        newRep: result.newRep,
        guild: interaction.guild,
        client: interaction.client,
      });
    } catch (err) {
      console.error('[rep-sil] checkRank çağrısı başarısız:', err);
    }

    // ── Başarı Embed'i ────────────────────────────────────────
    const newRank = getRankForRep(result.newRep);

    // Eğer silme işlemi nedeniyle puan 0'a kenetlendiyse bunu belirt
    const actuallyRemoved = result.oldRep - result.newRep;
    const clampNote =
      rawNewRep < 0
        ? `\n⚠️ *Puan 0'ın altına düşemeyeceği için yalnızca **${actuallyRemoved} rep** silindi.*`
        : '';

    const embed = new EmbedBuilder()
      .setColor(0xed4245) // Discord kırmızısı
      .setTitle('🗑️ Rep Silindi')
      .setDescription(
        `${interaction.user} tarafından ${targetUser}'dan **-${actuallyRemoved} rep** silindi.${clampNote}`
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '📊 Eski Puan', value: `**${result.oldRep} rep**`, inline: true },
        { name: '📉 Yeni Puan', value: `**${result.newRep} rep**`, inline: true },
        { name: '🏅 Mevcut Rütbe', value: `${newRank.emoji} **${newRank.name}**`, inline: true }
      )
      .setFooter({
        text: `Yönetici işlemi • ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
