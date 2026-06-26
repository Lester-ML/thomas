// ============================================================
//  events/interactionCreate.js — Slash Komut Yönlendiricisi
//  Görev: Gelen tüm interaction'ları yakalar ve doğru slash
//         komut dosyasına yönlendirir. Hata yönetimini merkezi
//         olarak burada halleder.
// ============================================================

const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // Sadece slash komutlarını işle
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

      // Eğer cevap henüz verilmediyse reply, verildiyse followUp kullan
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorPayload);
      } else {
        await interaction.reply(errorPayload);
      }
    }
  },
};
