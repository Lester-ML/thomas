// ============================================================
//  events/interactionCreate.js — Interaction Yönlendiricisi (v2)
//  Görev: Gelen tüm interaction'ları yakalar:
//    • Slash komutlarını ilgili komut dosyasına yönlendirir
//    • StringSelectMenu: envanter_menu_* → tak/çıkar işlemi
//    • Buton tıklamalarını (item_toggle_*) işler (eski sistem)
// ============================================================

const { Events, MessageFlags } = require('discord.js');
const { handleEnvanterSelect } = require('../commands/envanter');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {

    // ── STRING SELECT MENU — envanter_menu ───────────────────
    if (interaction.isStringSelectMenu()) {
      const { customId } = interaction;

      if (customId.startsWith('envanter_menu_')) {
        // customId formatı: envanter_menu_USERID
        const ownerId = customId.replace('envanter_menu_', '');

        // Sadece menünün sahibi kullanabilir
        if (interaction.user.id !== ownerId) {
          return interaction.reply({
            content: '🚫 Bu menü sana ait değil!',
            flags: MessageFlags.Ephemeral,
          });
        }

        return handleEnvanterSelect(interaction);
      }
    }

    // ── SLASH KOMUT ──────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`[Interaction] '${interaction.commandName}' komutu bulunamadı.`);
        return interaction.reply({
          content: '❌ Bu komut tanımlı değil veya yüklenmedi.',
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`[Interaction] '${interaction.commandName}' çalışırken hata:`, err);

        // 40060: Interaction zaten yanıtlanmış (çift instance vb.) → sessizce geç
        if (err.code === 40060) return;

        const errorPayload = {
          content: '❌ Bu komut çalışırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
          flags: MessageFlags.Ephemeral,
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorPayload);
          } else {
            await interaction.reply(errorPayload);
          }
        } catch (replyErr) {
          console.error(`[Interaction] Hata yanıtı gönderilemedi:`, replyErr.message);
        }
      }

      return;
    }
  },
};
