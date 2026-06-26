// ============================================================
//  index.js — Botun Ana Kalbi (Gateway)
//  Görev: Discord istemcisini oluşturur, gerekli Intent'leri
//         ayarlar, tüm komut ve olay dosyalarını dinamik olarak
//         yükler ve botu Discord'a bağlar.
// ============================================================

require('dotenv').config();

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./src/database');

// ── Ortam Değişkeni Doğrulaması ───────────────────────────────
const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('❌ .env dosyasında DISCORD_TOKEN eksik! Bot başlatılamıyor.');
  process.exit(1);
}

// ── Veritabanını Başlat ───────────────────────────────────────
initDatabase();

// ── Discord İstemcisi ─────────────────────────────────────────
// Intent: Botun hangi olayları dinleyeceğini belirler.
// Partial: Önbellekte olmayan (eski) mesaj/reaksiyonları da yakalamamızı sağlar.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,              // Sunucu bilgileri
    GatewayIntentBits.GuildMessages,       // Mesajları dinle
    GatewayIntentBits.MessageContent,      // Mesaj içeriğini oku (Privileged Intent!)
    GatewayIntentBits.GuildMessageReactions, // Reaksiyonları dinle
    GatewayIntentBits.GuildMembers,        // Üye bilgilerini çek (liderlik için)
  ],
  partials: [
    Partials.Message,   // Eski mesajlardaki reaksiyonlar
    Partials.Channel,   // Eski kanallar
    Partials.Reaction,  // Kısmi reaksiyon verisi
  ],
});

// ── Komutları Yükle ───────────────────────────────────────────
// client.commands: Komut adı → komut modülü eşlemesi
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (!command.data || !command.execute) {
    console.warn(`[Komut] ${file} dosyasında 'data' veya 'execute' eksik, atlandı.`);
    continue;
  }

  client.commands.set(command.data.name, command);
  console.log(`[Komut] Yüklendi: /${command.data.name}`);
}

// ── Olayları (Events) Yükle ───────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (!event.name || !event.execute) {
    console.warn(`[Olay] ${file} dosyasında 'name' veya 'execute' eksik, atlandı.`);
    continue;
  }

  // once: true ise olay yalnızca bir kez dinlenir (örn: ready)
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }

  console.log(`[Olay] Yüklendi: ${event.name}`);
}

// ── Genel Hata Yakalama ───────────────────────────────────────
// İşlenmeyen reddedilen promise'leri yakala (botu çökertmez)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Hata] İşlenmeyen Promise reddi:', promise, '→ Sebep:', reason);
});

// ── Discord'a Bağlan ──────────────────────────────────────────
client.login(DISCORD_TOKEN).catch((err) => {
  console.error('❌ Discord bağlantısı başarısız:', err.message);
  process.exit(1);
});
