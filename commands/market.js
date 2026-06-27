// ============================================================
//  commands/market.js — /market Slash Komutu (v2 — Envanter)
//  Görev: Ürünleri kategoriye göre listeler; satın alınan
//         ürünler envantere eklenir ve otomatik kuşanılır.
//
//  Alt Komutlar:
//    /market liste    → Renk & Arka Plan kategorili ürün listesi
//    /market satin-al → Ürün satın al (envantere ekle + aktif yap)
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserRep, spendBalance }  = require('../src/repService');
const { getDb, getActiveItems, setActiveItem } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Kuantum Kredi ile özel item\'lar satın al!')
    .addSubcommand((sub) =>
      sub
        .setName('liste')
        .setDescription('Mevcut market ürünlerini ve bakiyeni gösterir.')
    )
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
    if (sub === 'liste')    return handleListe(interaction);
    if (sub === 'satin-al') return handleSatinAl(interaction);
  },
};

// ── /market liste ─────────────────────────────────────────────
async function handleListe(interaction) {
  await interaction.deferReply();

  const db = getDb();
  // Tüm ürünleri çek
  const items   = db.prepare('SELECT * FROM market_items ORDER BY type, price ASC').all();
  const record  = getUserRep(interaction.user.id);
  const balance = record.balance ?? 0;

  if (items.length === 0) {
    return interaction.editReply({ content: '🛒 Market şu an boş. Yakında ürünler eklenecek!' });
  }

  // ── Kategoriye göre ayır ─────────────────────────────────
  const colors        = items.filter((i) => i.type === 'color');
  const nameColors    = items.filter((i) => i.type === 'name_color');
  const profileFrames = items.filter((i) => i.type === 'profile_frame');
  const avatarFrames  = items.filter((i) => i.type === 'avatar_frame');
  const bgs           = items.filter((i) => i.type === 'bg');

  const formatItem = (item) => {
    const canAfford = balance >= item.price ? '✅' : '❌';
    return `${canAfford} **[ID: ${item.id}]** ${item.name} — \`${item.price} kredi\``;
  };

  // ── Embed Oluştur ─────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🛒  Quantum Market')
    .setDescription('Kuantum Kredi ile özel isim renkleri, çerçeveler ve profil arka planları satın al!\n\n> ✅ = Satın alabilirsin  |  ❌ = Yetersiz bakiye')
    .addFields(
      {
        name: '🎨 Rol Renkleri',
        value: colors.length > 0 ? colors.map(formatItem).join('\n') : '_Şu an rol rengi ürünü yok._',
      },
      {
        name: '🔤 İsim Renkleri',
        value: nameColors.length > 0 ? nameColors.map(formatItem).join('\n') : '_Şu an isim rengi ürünü yok._',
      },
      {
        name: '🖼️ Profil Çerçeveleri',
        value: profileFrames.length > 0 ? profileFrames.map(formatItem).join('\n') : '_Şu an profil çerçevesi yok._',
      },
      {
        name: '🔘 Avatar Çerçeveleri',
        value: avatarFrames.length > 0 ? avatarFrames.map(formatItem).join('\n') : '_Şu an avatar çerçevesi yok._',
      },
      {
        name: '🌄 Profil Arka Planları',
        value: bgs.length > 0 ? bgs.map(formatItem).join('\n') : '_Şu an arka plan ürünü yok._',
      },
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
      text: `${interaction.guild.name} • Kredi rep kazanarak artar | /envanter ile tak/çıkar`,
      iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined,
    })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ── /market satin-al ──────────────────────────────────────────
async function handleSatinAl(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const urunId = interaction.options.getInteger('urun_id');
  const db     = getDb();
  const userId = interaction.user.id;

  // ── Ürünü bul ────────────────────────────────────────────
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(urunId);
  if (!item) {
    return interaction.editReply({
      content: `❌ **ID: ${urunId}** numaralı ürün bulunamadı. \`/market liste\` ile kontrol et.`,
    });
  }

  // ── Bakiye kontrolü ──────────────────────────────────────
  const record  = getUserRep(userId);
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

  // ── Zaten envanterde mi? ─────────────────────────────────
  const alreadyOwned = db
    .prepare('SELECT 1 FROM user_inventory WHERE userId = ? AND itemId = ?')
    .get(userId, item.id);

  if (alreadyOwned) {
    return interaction.editReply({
      content:
        `ℹ️ **${item.name}** zaten envanterende!\n` +
        `> Takmak veya çıkarmak için \`/envanter\` komutunu kullan.`,
    });
  }

  // ── Renk ürünü ise Discord rolü ver ─────────────────────
  if (item.type === 'color') {
    if (!item.dataValue || item.dataValue === 'ROLE_ID_GIRIN') {
      return interaction.editReply({
        content: '⚠️ Bu ürünün Discord rolü henüz tanımlanmamış. Lütfen bir admin ile iletişime geçin.',
      });
    }

    let role;
    try { role = await interaction.guild.roles.fetch(item.dataValue); }
    catch { role = null; }

    if (!role) {
      return interaction.editReply({
        content: `⚠️ Ürüne ait Discord rolü bulunamadı (ID: \`${item.dataValue}\`). Admin ile iletişime geçin.`,
      });
    }

    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.roles.add(role, `Market satın alımı: ${item.name}`);
    } catch (err) {
      console.error('[Market] Rol atanamadı:', err);
      return interaction.editReply({
        content: '❌ Rol atanırken hata oluştu. Bot yetkim yetersiz olabilir.',
      });
    }
  }

  // ── Bakiyeyi düş ─────────────────────────────────────────
  const spendResult = spendBalance(userId, item.price);
  if (!spendResult.success) {
    return interaction.editReply({ content: '❌ Bakiye düşülürken hata oluştu.' });
  }

  // ── Envantere ekle ───────────────────────────────────────
  db.prepare('INSERT OR IGNORE INTO user_inventory (userId, itemId) VALUES (?, ?)').run(userId, item.id);

  // ── Otomatik aktif yap ───────────────────────────────────
  // Aynı türden önceki aktifi otomatik çıkar, yenisini tak
  setActiveItem(userId, item.type, item.id);

  // ── Başarı embed'i ───────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Satın Alma Başarılı!')
    .setDescription(
      `**${item.name}** envanterine eklendi ve otomatik kuşanıldı! 🎉\n` +
      `> Harcanan: **${item.price} Kuantum Kredi**\n` +
      `> Kalan bakiye: **${spendResult.newBalance} kredi**`
    )
    .addFields({
      name: '💡 İpucu',
      value: '`/envanter` komutuyla sahip olduğun ürünleri istediğin zaman tak/çıkar yapabilirsin!',
    })
    .setFooter({ text: 'İyi kullanımlar! | /market liste ile diğer ürünlere bak' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
