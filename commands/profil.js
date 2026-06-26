// ============================================================
//  commands/profil.js — /profil Slash Komutu
//  Görev: Belirtilen kullanıcının (veya komutu yazanın)
//         repütasyon profilini şık bir Embed ile gösterir.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserRep } = require('../src/repService');

module.exports = {
  // ── Komut Tanımı (Discord'a Kayıt İçin) ──────────────────
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Bir kullanıcının repütasyon profilini gösterir.')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Profili görüntülenecek kullanıcı (boş bırakılırsa kendiniz)')
        .setRequired(false)
    ),

  // ── Komut Yürütücüsü ──────────────────────────────────────
  async execute(interaction) {
    // Kullanıcı seçimi: Parametreden al, yoksa komutu yazanı kullan
    const target = interaction.options.getUser('kullanici') ?? interaction.user;

    // Botların profili yok
    if (target.bot) {
      return interaction.reply({
        content: '🤖 Botların repütasyon profili bulunmamaktadır.',
        ephemeral: true,
      });
    }

    // Veritabanından rep bilgisini al
    const record = getUserRep(target.id);
    const rep = record.rep;

    // ── Rep Rozetini Belirle ──────────────────────────────────
    const badge = getRepBadge(rep);

    // ── Embed Oluştur ─────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(getRepColor(rep))
      .setAuthor({
        name: `${target.username} — Repütasyon Profili`,
        iconURL: target.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '⭐ Toplam Repütasyon',
          value: `**${rep}** puan`,
          inline: true,
        },
        {
          name: '🏅 Rozet',
          value: badge,
          inline: true,
        }
      )
      .setFooter({
        text: `Kullanıcı ID: ${target.id} • /liderlik ile sıralamayı gör`,
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};

// ── Yardımcı: Rep'e Göre Rozet ───────────────────────────────
function getRepBadge(rep) {
  if (rep >= 500) return '💎 Efsane';
  if (rep >= 200) return '🥇 Altın';
  if (rep >= 100) return '🥈 Gümüş';
  if (rep >= 50)  return '🥉 Bronz';
  if (rep >= 10)  return '⭐ Yıldız';
  return '🌱 Yeni';
}

// ── Yardımcı: Rep'e Göre Renk ────────────────────────────────
function getRepColor(rep) {
  if (rep >= 500) return 0x00b4d8; // Elmas mavi
  if (rep >= 200) return 0xffd700; // Altın
  if (rep >= 100) return 0xc0c0c0; // Gümüş
  if (rep >= 50)  return 0xcd7f32; // Bronz
  if (rep >= 10)  return 0x57f287; // Yeşil
  return 0x99aab5;                 // Gri (yeni)
}
