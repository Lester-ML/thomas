// ============================================================
//  commands/item-duzenle.js — /item-duzenle Kullanıcı Komutu
//  Görev: Kullanıcının marketten satın aldığı renk rollerini
//         listeler ve butonlarla tak/çıkar yapmasını sağlar.
//
//  Çalışma Mantığı:
//    1. Veritabanından kullanıcının sahip olduğu ürünleri çek
//    2. Her ürün için Discord'da rolu var mı kontrol et
//    3. "TAK ✅" veya "ÇIKAR ❌" butonlarıyla göster
//    4. Buton tıklanınca interactionCreate.js üzerinden işle
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('item-duzenle')
    .setDescription('Sahip olduğun market ürünlerini tak veya çıkar.'),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const db = getDb();
    const userId = interaction.user.id;

    // ── Kullanıcının Sahip Olduğu Ürünleri Çek ───────────────
    const ownedItems = db.prepare(`
      SELECT mi.id, mi.name, mi.roleId
      FROM user_items ui
      JOIN market_items mi ON ui.item_id = mi.id
      WHERE ui.user_id = ?
      ORDER BY mi.id ASC
    `).all(userId);

    // Hiç ürün yoksa bildir
    if (ownedItems.length === 0) {
      return interaction.editReply({
        content:
          '🛒 Henüz hiç market ürünün yok!\n' +
          '> `/market liste` komutuyla mevcut ürünleri görebilirsin.',
      });
    }

    // ── Üyeyi Çek (hangi rollere sahip?) ─────────────────────
    const member = await interaction.guild.members.fetch(userId);

    // ── Her Ürün İçin Buton Satırı Oluştur ───────────────────
    const rows = [];

    for (const item of ownedItems) {
      // Kullanıcının şu an bu role sahip mi?
      const hasRole = member.roles.cache.has(item.roleId);

      const button = new ButtonBuilder()
        .setCustomId(`item_toggle_${item.id}_${userId}`)
        .setLabel(hasRole ? `${item.name} — ÇIKAR` : `${item.name} — TAK`)
        .setStyle(hasRole ? ButtonStyle.Danger : ButtonStyle.Success)
        .setEmoji(hasRole ? '❌' : '✅');

      // Discord max 5 buton/satır, 5 satır/mesaj
      rows.push(new ActionRowBuilder().addComponents(button));
    }

    // ── Embed Oluştur ─────────────────────────────────────────
    const lines = ownedItems.map((item) => {
      const hasRole = member.roles.cache.has(item.roleId);
      return `${hasRole ? '✅' : '⬜'} **${item.name}** — ${hasRole ? 'Takılı' : 'Çıkarılmış'}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🎨  Renk Koleksiyonum')
      .setDescription(lines.join('\n'))
      .addFields({
        name: '💡 Nasıl Kullanılır?',
        value: 'Aşağıdaki butonlarla rengi **tak** veya **çıkar**.\nBirden fazla rengi aynı anda takabilirsin!',
      })
      .setFooter({
        text: `${interaction.guild.name} • Yeni renk için /market satin-al`,
        iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined,
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], components: rows });
  },
};
