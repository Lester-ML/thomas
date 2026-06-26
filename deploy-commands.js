// ============================================================
//  deploy-commands.js — Slash Komutlarını Discord'a Kaydeder
//  Görev: commands/ klasöründeki tüm komutları Discord API'ye
//         kaydeder. Sadece komut ekleme/güncelleme sonrasında
//         çalıştırılır: `node deploy-commands.js`
//
//  GUILD_ID varsa → Sadece o sunucuya kaydeder (anlık, test)
//  GUILD_ID yoksa → Tüm Discord'a global olarak kaydeder
//                   (dağılması ~1 saat sürebilir)
// ============================================================

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const path = require('path');
const fs = require('fs');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ .env dosyasında DISCORD_TOKEN veya CLIENT_ID eksik!');
  process.exit(1);
}

// commands/ klasöründeki tüm .js dosyalarını oku
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

const commands = commandFiles.map((file) => {
  const command = require(path.join(commandsPath, file));
  return command.data.toJSON();
});

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 ${commands.length} slash komutu kaydediliyor...`);

    let data;
    if (GUILD_ID) {
      // Guild (sunucu) bazlı kayıt — anlık aktif olur (geliştirme için ideal)
      data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log(`✅ ${data.length} komut sunucuya (${GUILD_ID}) başarıyla kaydedildi.`);
    } else {
      // Global kayıt — tüm sunuculara, ~1 saat içinde yayılır
      data = await rest.put(Routes.applicationCommands(CLIENT_ID), {
        body: commands,
      });
      console.log(`✅ ${data.length} komut global olarak kaydedildi.`);
    }
  } catch (err) {
    console.error('❌ Komut kaydı sırasında hata:', err);
    process.exit(1);
  }
})();
