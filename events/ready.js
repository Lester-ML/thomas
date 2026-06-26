// ============================================================
//  events/ready.js — Bot Hazır Olayı
//  Görev: Bot Discord'a başarıyla bağlandığında tetiklenir.
// ============================================================

const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true, // Sadece bir kez çalışır

  execute(client) {
    console.log(`✅ Bot hazır! ${client.user.tag} olarak giriş yapıldı.`);
    console.log(`📊 ${client.guilds.cache.size} sunucuda aktif.`);

    // Bot durumu: İzleme aktivitesi
    client.user.setPresence({
      activities: [
        {
          name: '⭐ Repütasyon takip ediyorum',
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  },
};
