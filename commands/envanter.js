// ============================================================
//  commands/envanter.js — /envanter Slash Komutu
//  Görev: Kullanıcının sahip olduğu ürünleri listeler ve
//         bir StringSelectMenu üzerinden tak/çıkar yapmasını sağlar.
//
//  Mantık:
//    • Seçilen ürün zaten aktifse → ÇIKAR (null yap, rol al)
//    • Seçilen ürün aktif değilse → TAK (aynı tür varsa onu çıkar, yenisini tak)
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getInventory, getActiveItems, setActiveItem, getDb } = require('../src/database');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('envanter')
    .setDescription('Sahip olduğun ürünleri gör ve tak/çıkar yap.'),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;

    // ── Envanteri ve aktif eşyaları al ───────────────────────
    const items   = getInventory(userId);
    const actives = getActiveItems(userId);

    if (items.length === 0) {
      return interaction.editReply({
        content: '🎒 Henüz hiçbir şey satın almadın! `/market liste` ile ürünlere göz at.',
      });
    }

    // ── Embed'i ve Select Menu'yü oluştur ───────────────────
    const { embed, row } = buildEnvanterUI(items, actives, userId);

    return interaction.editReply({ embeds: [embed], components: [row] });
  },
};

// ── UI Oluşturucu ─────────────────────────────────────────────
/**
 * Envanter Embed'ini ve StringSelectMenu'sünü oluşturur.
 * @param {Array} items   - Kullanıcı envanterindeki ürünler
 * @param {object} actives - { active_color_id, active_bg_id }
 * @param {string} userId
 * @returns {{ embed: EmbedBuilder, row: ActionRowBuilder }}
 */
function buildEnvanterUI(items, actives, userId) {
  const colors = items.filter((i) => i.type === 'color');
  const bgs    = items.filter((i) => i.type === 'bg');

  // Aktif ID'leri belirle
  const activeColorId = actives.active_color_id;
  const activeBgId    = actives.active_bg_id;

  // Ürün satırı formatı
  const fmt = (item) => {
    const isActive =
      (item.type === 'color' && item.id === activeColorId) ||
      (item.type === 'bg'    && item.id === activeBgId);
    return `${isActive ? '✅' : '▫️'} **${item.name}** — \`${item.price} kr\`${isActive ? ' *(Kullanılıyor)*' : ''}`;
  };

  // ── Embed ─────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎒 Envanterin')
    .setDescription('Aşağıdaki menüden bir ürün seç: **zaten takılıysa çıkar, takılı değilse tak.**')
    .addFields(
      {
        name: '🎨 İsim Renkleri',
        value: colors.length > 0 ? colors.map(fmt).join('\n') : '_Renk yok._',
      },
      {
        name: '🖼️ Profil Arka Planları',
        value: bgs.length > 0 ? bgs.map(fmt).join('\n') : '_Arka plan yok._',
      }
    )
    .setFooter({ text: '✅ = Şu an kullanılıyor  |  ▫️ = Takılı değil' })
    .setTimestamp();

  // ── StringSelectMenu ─────────────────────────────────────
  const menuOptions = items.map((item) => {
    const isActive =
      (item.type === 'color' && item.id === activeColorId) ||
      (item.type === 'bg'    && item.id === activeBgId);

    return {
      label: isActive ? `${item.name} ✅` : item.name,
      description: isActive
        ? `${item.type === 'color' ? '🎨 İsim rengi' : '🖼️ Arka plan'} — Seçersen ÇIKARIR`
        : `${item.type === 'color' ? '🎨 İsim rengi' : '🖼️ Arka plan'} — Seçersen TAKAR`,
      value: String(item.id),
    };
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`envanter_menu_${userId}`)
    .setPlaceholder('Bir ürün seç...')
    .addOptions(menuOptions);

  const row = new ActionRowBuilder().addComponents(menu);

  return { embed, row };
}

// ── Select Menu Handler (interactionCreate'den çağrılır) ──────
/**
 * Kullanıcı envanter menüsünden seçim yaptığında çağrılır.
 * @param {StringSelectMenuInteraction} interaction
 */
async function handleEnvanterSelect(interaction) {
  await interaction.deferUpdate();

  const userId     = interaction.user.id;
  const selectedId = parseInt(interaction.values[0]);
  const db         = getDb();

  // ── Seçilen ürünü bul ────────────────────────────────────
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(selectedId);
  if (!item) {
    return interaction.followUp({ content: '❌ Ürün bulunamadı.', flags: MessageFlags.Ephemeral });
  }

  // ── Aktif eşyaları kontrol et ────────────────────────────
  const actives     = getActiveItems(userId);
  const activeField = item.type === 'color' ? 'active_color_id' : 'active_bg_id';
  const currentId   = actives[activeField];
  const isActive    = currentId === selectedId;

  try {
    const member = await interaction.guild.members.fetch(userId);

    if (isActive) {
      // ── ÇIKAR ────────────────────────────────────────────
      setActiveItem(userId, item.type, null);

      // Renk ise Discord rolünü al
      if (item.type === 'color') {
        try {
          const role = await interaction.guild.roles.fetch(item.dataValue);
          if (role) await member.roles.remove(role, 'Envanter: çıkarıldı');
        } catch { /* Rol bulunamazsa sessizce geç */ }
      }

      await interaction.followUp({
        content: `▫️ **${item.name}** başarıyla çıkarıldı.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // ── TAK ──────────────────────────────────────────────
      // Aynı türde başka bir şey takılıysa önce onu çıkar
      if (currentId !== null) {
        const oldItem = db.prepare('SELECT * FROM market_items WHERE id = ?').get(currentId);
        if (oldItem && oldItem.type === 'color') {
          try {
            const oldRole = await interaction.guild.roles.fetch(oldItem.dataValue);
            if (oldRole) await member.roles.remove(oldRole, 'Envanter: değiştirildi');
          } catch { /* Rol bulunamazsa sessizce geç */ }
        }
      }

      // Yeni ürünü aktif yap
      setActiveItem(userId, item.type, selectedId);

      // Renk ise Discord rolünü ver
      if (item.type === 'color') {
        try {
          const role = await interaction.guild.roles.fetch(item.dataValue);
          if (role) await member.roles.add(role, 'Envanter: takıldı');
        } catch { /* Rol bulunamazsa sessizce geç */ }
      }

      await interaction.followUp({
        content: `✅ **${item.name}** başarıyla kuşanıldı!`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (err) {
    console.error('[Envanter] Tak/çıkar hatası:', err);
    await interaction.followUp({
      content: '❌ İşlem sırasında bir hata oluştu.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── Menüyü güncelle (yeni aktif durumu yansıt) ───────────
  try {
    const updatedItems   = getInventory(userId);
    const updatedActives = getActiveItems(userId);
    const { embed, row } = buildEnvanterUI(updatedItems, updatedActives, userId);
    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch { /* Güncelleme başarısız olursa kullanıcı zaten uyarı aldı */ }
}

module.exports.handleEnvanterSelect = handleEnvanterSelect;
module.exports.buildEnvanterUI      = buildEnvanterUI;
