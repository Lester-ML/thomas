# ⭐ Discord Repütasyon (Karma) Botu

Yazılım topluluklarında yardımlaşmayı teşvik etmek için geliştirilmiş, tam özellikli bir Discord bot.

## 🚀 Teknoloji Yığını

| Katman | Teknoloji | Neden? |
|--------|-----------|--------|
| Çalışma Ortamı | Node.js | Bot dünyasının standardı |
| Discord Kütüphanesi | discord.js v14 | En güncel, kararlı, slash komut desteği |
| Veritabanı | better-sqlite3 | Sunucusuz, hızlı, sıfır maliyet |
| Yapılandırma | dotenv | Güvenli token yönetimi |

## 📁 Proje Yapısı

```
reputation-bot/
├── index.js              ← Botun ana kalbi
├── deploy-commands.js    ← Slash komutlarını Discord'a kaydet
├── package.json
├── .env.example          ← Ortam değişkenleri şablonu
│
├── src/
│   ├── database.js       ← SQLite bağlantı ve şema yönetimi
│   └── repService.js     ← Repütasyon iş mantığı katmanı
│
├── commands/
│   ├── profil.js         ← /profil komutu
│   └── liderlik.js       ← /liderlik komutu
│
└── events/
    ├── ready.js           ← Bot hazır olayı
    ├── interactionCreate.js ← Slash komut yönlendiricisi
    ├── messageCreate.js   ← Teşekkür mesajı dinleyici
    └── messageReactionAdd.js ← ✅ reaksiyon dinleyici
```

## ⚙️ Kurulum (Adım Adım)

### 1. Paketleri Yükle

```bash
cd reputation-bot
npm install
```

### 2. Discord Developer Portal Ayarları

1. [Discord Developer Portal](https://discord.com/developers/applications)'e git
2. **New Application** → Bot adını gir
3. Sol menüden **Bot** sekmesi:
   - **Reset Token** → Token'ı kopyala
   - **Privileged Gateway Intents** kısmında şunları **AÇ**:
     - ✅ `SERVER MEMBERS INTENT`
     - ✅ `MESSAGE CONTENT INTENT`
4. Sol menüden **General Information** → **Application ID** → Kopyala
5. Sol menüden **OAuth2 → URL Generator**:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: `Send Messages`, `Read Message History`, `Add Reactions`, `Embed Links`, `Use Slash Commands`, `Read Messages/View Channels`
   - URL'yi kopyala ve botunu sunucuna ekle

### 3. Ortam Değişkenlerini Ayarla

```bash
# .env.example dosyasını kopyala
copy .env.example .env
```

`.env` dosyasını aç ve doldurun:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_test_server_id_here   # Test için, prodüksiyonda silebilirsin
```

> **Guild ID nasıl alınır?** Discord → Ayarlar → Gelişmiş → Geliştirici Modu'nu aç. Sonra sunucuya sağ tıkla → "Sunucu Kimliğini Kopyala"

### 4. Slash Komutlarını Kaydet

```bash
node deploy-commands.js
```

### 5. Botu Başlat

```bash
node index.js
# veya izleme modunda:
node --watch index.js
```

## 🎮 Özellikler

### Repütasyon Kazanma Yolları

| Eylem | Rep Kazanım |
|-------|------------|
| Teşekkür mesajında birini etiketle | `+1 rep` |
| Mesaja ✅ reaksiyonu ekle | `+2 rep` |

**Teşekkür Kelimeleri:** teşekkür, teşekkürler, sağol, sağolasın, eyvallah, thanks, thx, ty, thank you

### 🛡️ Anti-Abuse (Suistimal Koruması)

- ❌ Kendinize rep veremezsiniz
- ❌ Botlara rep verilemez
- ⏳ **5 dakika cooldown** — Kısa sürede çok fazla rep verme engeli

### 📊 Slash Komutları

| Komut | Açıklama |
|-------|----------|
| `/profil` | Kendi profilini göster |
| `/profil @kullanıcı` | Başkasının profilini göster |
| `/liderlik` | Top 10 listesini göster |

### 🏅 Repütasyon Rozet Sistemi

| Rozet | Gerekli Rep |
|-------|------------|
| 🌱 Yeni | 0–9 |
| ⭐ Yıldız | 10–49 |
| 🥉 Bronz | 50–99 |
| 🥈 Gümüş | 100–199 |
| 🥇 Altın | 200–499 |
| 💎 Efsane | 500+ |

## 🔧 Geliştirme Notları

- Veritabanı `database.sqlite` dosyasında tutulur (otomatik oluşturulur)
- Komut eklemek için `commands/` klasörüne yeni `.js` dosyası ekle — otomatik yüklenir
- Olay eklemek için `events/` klasörüne yeni `.js` dosyası ekle — otomatik yüklenir
- `deploy-commands.js` sadece komut değişikliklerinde çalıştırılır
