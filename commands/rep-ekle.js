// ============================================================
//  commands/rep-ekle.js — /rep-ekle Admin Komutu
//  Görev: Seçilen kullanıcıya belirtilen miktarda rep ekler.
//
//  YETKİ: Sadece Administrator yetkisine sahip kişiler kullanabilir.
//  ETKİ: updateRep ile veritabanı güncellenir, checkRank ile
//        roller otomatik olarak ayarlanır.
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
    .setName('rep-ekle')
    .setDescription('[Admin] Seçilen kullanıcıya rep puanı ekler.')
    // Komut yalnızca Administrator yetkisi olan kişilere görünsün
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Rep eklenecek kullanıcı')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('miktar')
        .setDescription('Eklenecek rep miktarı (1 veya daha fazla)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10000) // Güvenlik sınırı
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    // ── Yetki Kontrolü (İkinci Katman Güvenlik) ───────────────
    // setDefaultMemberPermissions zaten Discord tarafında filtreler,
    // ancak elle de kontrol ederek olası boşlukları kapatıyoruz.
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
        content: '🤖 Botlara rep eklenemez.',
        ephemeral: true,
      });
    }

    // Mevcut puanı al
    const currentRecord = getUserRep(targetUser.id);
    const oldRep = currentRecord.rep;
    const newRep = oldRep + amount;

    // Veritabanını güncelle
    const result = updateRep(targetUser.id, newRep);

    // ── checkRank: Rol güncelleme ve kutlama ──────────────────
    try {
      // Hedef kullanıcının GuildMember nesnesini çek
      const member = await interaction.guild.members.fetch(targetUser.id);
      await checkRank({
        member,
        oldRep: result.oldRep,
        newRep: result.newRep,
        guild: interaction.guild,
        client: interaction.client,
      });
    } catch (err) {
      // Rol hatası komutu durdurmasın
      console.error('[rep-ekle] checkRank çağrısı başarısız:', err);
    }

    // ── Başarı Embed'i ────────────────────────────────────────
    const newRank = getRankForRep(result.newRep);

    const embed = new EmbedBuilder()
      .setColor(0x57f287) // Discord yeşili
      .setTitle('✅ Rep Eklendi')
      .setDescription(
        `${interaction.user} tarafından ${targetUser}'a **+${amount} rep** eklendi.`
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '📊 Eski Puan', value: `**${result.oldRep} rep**`, inline: true },
        { name: '📈 Yeni Puan', value: `**${result.newRep} rep**`, inline: true },
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
