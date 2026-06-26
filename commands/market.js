// ============================================================
//  commands/market.js — /market Slash Komutu
//  Görev: Kullanıcıların market ürünlerini listelemesini ve
//         Kuantum Kredi (balance) harcayarak satın almasını sağlar.
//
//  Alt Komutlar:
//    /market liste      → Mevcut ürünleri ve kullanıcı bakiyesini gösterir
//    /market satin-al   → Seçilen ürünü satın alır ve Discord rolü verir
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getUserRep, spendBalance } = require('../src/repService');
const { getDb } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Kuantum Kredi ile özel roller satın al!')
    // ── Alt Komut: liste ────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('liste')
        .setDescription('Mevcut market ürünlerini ve bakiyeni gösterir.')
    )
    // ── Alt Komut: satin-al ─────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('satin-al')
        .setDescription('Bir ürünü Kuantum Kredi ile satın al.')
        .addIntegerOption((opt) =>
          opt
            .setName('urun_id')
            .setDescription('Satın almak istediğin ürünün ID numarası')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'liste') {
      return handleListe(interaction);
    } else if (sub === 'satin-al') {
      return handleSatinAl(interaction);
    }
  },
};

// ── /market liste ─────────────────────────────────────────────
async function handleListe(interaction) {
  await interaction.deferReply();

  const db = getDb();
  // Tüm ürünleri veritabanından çek
  const items = db.prepare('SELECT * FROM market_items ORDER BY price ASC').all();

  // Kullanıcının güncel bakiyesini al
  const record = getUserRep(interaction.user.id);
  const balance = record.balance ?? 0;

  if (items.length === 0) {
    return interaction.editReply({
      content: '🛒 Market şu an boş. Yakında ürünler eklenecek!',
    });
  }

  // ── Ürün Listesi Satırları ──────────────────────────────────
  const lines = items.map((item) => {
    const canAfford = balance >= item.price ? '✅' : '❌';
    return `${canAfford} **[ID: ${item.id}]** ${item.name} — \`${item.price} kredi\``;
  });

  // ── Embed Oluştur ───────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🛒  Quantum Market')
    .setDescription(
      lines.join('\n') +
      '\n\n' +
      '> ✅ = Satın alabilirsin  |  ❌ = Yetersiz bakiye'
    )
    .addFields(
      {
        name: '💰 Mevcut Bakiyen',
        value: `**${balance} Kuantum Kredi**`,
        inline: true,
      },
      {
        name: '🛍️ Satın Almak İçin',
        value: '`/market satin-al [ID]` komutunu kullan',
        inline: true,
      }
    )
    .setFooter({
      text: `${interaction.guild.name} • Kredi rep kazanarak artar`,
      iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined,
    })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /market satin-al ──────────────────────────────────────────
async function handleSatinAl(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const urunId = interaction.options.getInteger('urun_id');
  const db = getDb();

  // ── Ürünü Veritabanında Bul ─────────────────────────────────
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(urunId);

  if (!item) {
    return interaction.editReply({
      content: `❌ **ID: ${urunId}** numaralı ürün bulunamadı. \`/market liste\` ile ürünleri kontrol et.`,
    });
  }

  // ── Bakiye Kontrolü ─────────────────────────────────────────
  const record = getUserRep(interaction.user.id);
  const balance = record.balance ?? 0;

  if (balance < item.price) {
    const fark = item.price - balance;
    return interaction.editReply({
      content:
        `❌ **Yetersiz bakiye!**\n` +
        `> ${item.name} için **${item.price} kredi** gerekiyor.\n` +
        `> Mevcut bakiyen: **${balance} kredi**\n` +
        `> Eksik: **${fark} kredi** daha kazanman gerekiyor.`,
    });
  }

  // ── Rol Atama ────────────────────────────────────────────────
  // Rol ID geçersizse (ROLE_ID_GIRIN yazısı) uyar
  if (item.roleId === 'ROLE_ID_GIRIN' || !item.roleId) {
    return interaction.editReply({
      content: '⚠️ Bu ürünün Discord rolü henüz tanımlanmamış. Lütfen bir admin ile iletişime geçin.',
    });
  }

  let role;
  try {
    role = await interaction.guild.roles.fetch(item.roleId);
  } catch {
    role = null;
  }

  if (!role) {
    return interaction.editReply({
      content: `⚠️ Ürüne ait Discord rolü bulunamadı (ID: \`${item.roleId}\`). Lütfen bir admin ile iletişime geçin.`,
    });
  }

  // ── Üyeye Rolü Ekle ─────────────────────────────────────────
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(role, `Market satın alımı: ${item.name}`);
  } catch (err) {
    console.error('[Market] Rol atanamadı:', err);
    return interaction.editReply({
      content: '❌ Rol atanırken bir hata oluştu. Yetkim yeterli olmayabilir. Lütfen bir admin ile iletişime geçin.',
    });
  }

  // ── Bakiyeyi Düş (sadece balance, rep'e dokunulmuyor!) ───────
  const spendResult = spendBalance(interaction.user.id, item.price);

  if (!spendResult.success) {
    // Teorik olarak buraya gelmemeli ama güvenlik için kontrol
    return interaction.editReply({ content: '❌ Bakiye düşülürken hata oluştu.' });
  }

  // ── Başarı Mesajı ────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Satın Alma Başarılı!')
    .setDescription(
      `**${item.name}** rolü hesabına eklendi! 🎉\n` +
      `> Harcanan: **${item.price} Kuantum Kredi**\n` +
      `> Kalan bakiye: **${spendResult.newBalance} kredi**`
    )
    .setFooter({ text: 'İyi kullanımlar! | /market liste ile diğer ürünlere bak' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
