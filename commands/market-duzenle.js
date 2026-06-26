// ============================================================
//  commands/market-duzenle.js — /market-duzenle Admin Komutu
//  Görev: Market'teki bir ürünün fiyatını günceller.
//
//  YETKİ: Sadece Administrator yetkisine sahip kişiler kullanabilir.
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('market-duzenle')
    .setDescription('[Admin] Market ürününün fiyatını günceller.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt
        .setName('urun_id')
        .setDescription('Fiyatı değiştirilecek ürünün ID numarası')
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('yeni_fiyat')
        .setDescription('Ürünün yeni fiyatı (Kuantum Kredi)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100000)
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    // ── Yetki Kontrolü ─────────────────────────────────────
    if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '🚫 Bu komut sadece **Administrator** yetkisine sahip kişiler tarafından kullanılabilir.',
        ephemeral: true,
      });
    }

    const urunId    = interaction.options.getInteger('urun_id');
    const yeniFiyat = interaction.options.getInteger('yeni_fiyat');
    const db = getDb();

    // ── Ürünü Bul ───────────────────────────────────────────
    const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(urunId);

    if (!item) {
      return interaction.reply({
        content: `❌ **ID: ${urunId}** numaralı ürün bulunamadı.`,
        ephemeral: true,
      });
    }

    const eskiFiyat = item.price;

    // ── Fiyatı Güncelle ─────────────────────────────────────
    try {
      db.prepare('UPDATE market_items SET price = ? WHERE id = ?').run(yeniFiyat, urunId);
    } catch (err) {
      console.error('[market-duzenle] Güncelleme hatası:', err);
      return interaction.reply({
        content: '❌ Ürün fiyatı güncellenirken bir hata oluştu.',
        ephemeral: true,
      });
    }

    // ── Başarı Embed'i ───────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✅ Ürün Fiyatı Güncellendi')
      .addFields(
        { name: '🛒 Ürün',         value: `**${item.name}**`,              inline: true },
        { name: '🔖 ID',           value: `\`${urunId}\``,                 inline: true },
        { name: '\u200B',           value: '\u200B',                        inline: true },
        { name: '📉 Eski Fiyat',   value: `~~${eskiFiyat}~~ kredi`,        inline: true },
        { name: '📈 Yeni Fiyat',   value: `**${yeniFiyat} kredi**`,        inline: true },
      )
      .setFooter({
        text: `Güncelleyen: ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
