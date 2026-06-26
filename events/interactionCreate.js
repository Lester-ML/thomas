// ============================================================
//  events/interactionCreate.js — Interaction Yönlendiricisi
//  Görev: Gelen tüm interaction'ları yakalar:
//    • Slash komutlarını ilgili komut dosyasına yönlendirir
//    • Buton tıklamalarını (item_toggle_*) işler
// ============================================================

const { Events } = require('discord.js');
const { getDb } = require('../src/database');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ── BUTON İNTERACTION — item_toggle ──────────────────────
    if (interaction.isButton()) {
      const { customId } = interaction;

      // Sadece item_toggle_ ile başlayan butonları işle
      if (customId.startsWith('item_toggle_')) {
        // customId formatı: item_toggle_ITEMID_USERID
        const parts   = customId.split('_');
        const itemId  = parseInt(parts[2]);
        const ownerId = parts[3];

        // Sadece butonun sahibi kullanabilir
        if (interaction.user.id !== ownerId) {
          return interaction.reply({
            content: '🚫 Bu buton sana ait değil!',
            ephemeral: true,
          });
        }

        await interaction.deferUpdate();

        const db   = getDb();
        const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(itemId);

        if (!item) {
          return interaction.followUp({ content: '❌ Ürün bulunamadı.', ephemeral: true });
        }

        // Kullanıcının şu an bu role sahip mi?
        const member  = await interaction.guild.members.fetch(ownerId);
        const hasRole = member.roles.cache.has(item.roleId);
        let   role;

        try {
          role = await interaction.guild.roles.fetch(item.roleId);
        } catch {
          role = null;
        }

        if (!role) {
          return interaction.followUp({
            content: '❌ Rol bulunamadı, admin ile iletişime geç.',
            ephemeral: true,
          });
        }

        try {
          if (hasRole) {
            // Rolü çıkar
            await member.roles.remove(role, 'Item-düzenle: çıkarıldı');
            await interaction.followUp({
              content: `✅ **${item.name}** rengi çıkarıldı!`,
              ephemeral: true,
            });
          } else {
            // Rolü tak
            await member.roles.add(role, 'Item-düzenle: takıldı');
            await interaction.followUp({
              content: `✅ **${item.name}** rengi takıldı!`,
              ephemeral: true,
            });
          }
        } catch (err) {
          console.error('[item-toggle] Rol değiştirilemedi:', err);
          await interaction.followUp({
            content: '❌ Rol değiştirilemedi. Bot yetkim yeterli olmayabilir.',
            ephemeral: true,
          });
        }

        return; // Buton işlemi bitti
      }
    }

    // ── SLASH KOMUT ──────────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`[Interaction] '${interaction.commandName}' komutu bulunamadı.`);
      return interaction.reply({
        content: '❌ Bu komut tanımlı değil veya yüklenmedi.',
        ephemeral: true,
      });
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[Interaction] '${interaction.commandName}' çalışırken hata:`, err);

      const errorPayload = {
        content: '❌ Bu komut çalışırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorPayload);
      } else {
        await interaction.reply(errorPayload);
      }
    }
  },
};
