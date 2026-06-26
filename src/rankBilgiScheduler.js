// ============================================================
//  src/rankBilgiScheduler.js — 4 Saatlik Rank Bilgilendirme
//  Görev: Her 4 saatte bir belirlenen kanala rank/rütbe tablosunu
//         gösteren güzel bir bilgilendirme embed'i gönderir.
//
//  Kurulum:
//    Bu modülü index.js içinde client "ready" olduktan sonra
//    başlatın:
//      const { startRankBilgiScheduler } = require('./src/rankBilgiScheduler');
//      client.once(Events.ClientReady, (c) => {
//        startRankBilgiScheduler(c);
//      });
//
//  Kanal:
//    .env dosyasına RANK_INFO_CHANNEL_ID=kanal_id ekleyin.
// ============================================================

const { EmbedBuilder } = require('discord.js');
const { RANKS } = require('./rankConfig');

// ── Sabitler ─────────────────────────────────────────────────
const INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 saat

// ── Tier Grupları ─────────────────────────────────────────────
// Rank'ları tier'lara göre grupla, her tier için ayrı bir field oluştur
const TIER_GROUPS = [
  {
    label: '🌱 Junior Tier',
    color: '`░░░░░░░░░░░░░░░░░░░░`',
    filter: (r) => r.name.startsWith('Junior'),
    barEmoji: '🟢',
  },
  {
    label: '⚡ Mid Tier',
    filter: (r) => r.name.startsWith('Mid'),
    barEmoji: '🔵',
  },
  {
    label: '🔥 Senior Tier',
    filter: (r) => r.name.startsWith('Senior'),
    barEmoji: '🟣',
  },
  {
    label: '👑 Boss Tier',
    filter: (r) => r.name.startsWith('Boss'),
    barEmoji: '🟡',
  },
  {
    label: '⚡ Legend',
    filter: (r) => r.name === 'God of Code',
    barEmoji: '⚪',
  },
];

// ── Rank Tablosu Satırı Oluştur ───────────────────────────────
function buildRankLine(rank, nextRank) {
  const repRange = nextRank
    ? `${rank.minRep} – ${nextRank.minRep - 1} rep`
    : `${rank.minRep}+ rep`;

  return `${rank.emoji} **${rank.name}** — \`${repRange}\``;
}

// ── Ana Embed Oluşturucu ──────────────────────────────────────
async function buildRankInfoEmbed(guild) {
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setTitle('🏅  Sunucu Rütbe Sistemi')
    .setDescription(
      '> Mesajlaşarak, teşekkür ederek ve reaksiyon vererek **rep** kazanırsın.\n' +
      '> Yeterli repe ulaştığında rütben **otomatik olarak** yükseltilir! 🚀\n' +
      '> ─────────────────────────────────────'
    );

  // Her tier grubu için bir field ekle
  for (const tier of TIER_GROUPS) {
    const tierRanks = RANKS.filter(tier.filter);
    if (tierRanks.length === 0) continue;

    const lines = tierRanks.map((rank, i) => {
      const nextRank = RANKS[RANKS.indexOf(rank) + 1] ?? null;
      return buildRankLine(rank, nextRank);
    });

    embed.addFields({
      name: tier.label,
      value: lines.join('\n'),
      inline: false,
    });
  }

  // Rep Kazanma Yolları
  embed.addFields(
    {
      name: '─────────────────────────────────────',
      value: '\u200b', // Görsel ayraç
      inline: false,
    },
    {
      name: '💡 Rep Nasıl Kazanılır?',
      value:
        '✅ Birini **teşekkür** içeren mesajla etiketle → **+1 rep**\n' +
        '✅ Mesajlara **✅** reaksiyonu ver → **+2 rep**\n' +
        '⏳ Cooldown süresi: **5 dakika** (aynı kişi tekrar rep veremez)',
      inline: false,
    },
    {
      name: '📊 Mevcut Sıralamayi Görmek İçin',
      value: '`/liderlik` komutunu kullan!',
      inline: true,
    },
    {
      name: '👤 Kendi Rütbeni Görmek İçin',
      value: '`/profil` komutunu kullan!',
      inline: true,
    }
  )
  .setFooter({
    text: `${guild.name} • Bu mesaj 4 saatte bir güncellenir`,
    iconURL: guild.iconURL({ dynamic: true }) ?? undefined,
  })
  .setTimestamp();

  return embed;
}

// ── Tek Gönderim Fonksiyonu ───────────────────────────────────
async function sendRankBilgi(client) {
  const channelId = process.env.RANK_INFO_CHANNEL_ID;

  if (!channelId) {
    throw new Error('RANK_INFO_CHANNEL_ID .env dosyasında tanımlı değil.');
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased()) {
    throw new Error(`Kanal bulunamadı veya metin kanalı değil (ID: ${channelId})`);
  }

  const guild = channel.guild;
  const embed = await buildRankInfoEmbed(guild);

  await channel.send({
    content:
      '╔══════════════════════════════════╗\n' +
      '║   📋  **RANK BİLGİLENDİRMESİ**   ║\n' +
      '╚══════════════════════════════════╝',
    embeds: [embed],
  });

  console.log(`[RankBilgi] Rank bilgilendirmesi gönderildi → #${channel.name}`);
}

// ── Scheduler için güvenli wrapper (hatayı loglar, çökmez) ────
async function sendRankBilgiSafe(client) {
  try {
    await sendRankBilgi(client);
  } catch (err) {
    console.error('[RankBilgi] Gönderim sırasında hata:', err.message);
  }
}


// ── Scheduler Başlatıcı ───────────────────────────────────────
/**
 * 4 saatlik döngüyü başlatır.
 * Bot hazır olduktan sonra çağrılmalıdır.
 *
 * @param {Client} client - Discord.js Client nesnesi
 */
function startRankBilgiScheduler(client) {
  console.log('[RankBilgi] 4 saatlik rank bilgilendirme zamanlayıcısı başlatıldı.');

  // İlk çalışma: Bot açıldığında hemen bir kez gönder
  sendRankBilgiSafe(client);

  // Sonraki çalışmalar: Her 4 saatte bir
  setInterval(() => {
    sendRankBilgiSafe(client);
  }, INTERVAL_MS);
}

module.exports = { startRankBilgiScheduler, sendRankBilgi };
