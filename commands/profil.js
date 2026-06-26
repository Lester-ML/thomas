// ============================================================
//  commands/profil.js — /profil Slash Komutu (Canvas Sürümü)
//  Görev: Kullanıcının görsel profil kartını canvas ile oluşturur
//         ve kanala PNG resim olarak gönderir.
//         Embed yerine AttachmentBuilder kullanılır.
// ============================================================

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUserRep }          = require('../src/repService');
const { getRankForRep, getNextRank } = require('../src/rankConfig');
const { generateProfileCard } = require('../src/profileCard');

module.exports = {
  // ── Komut Tanımı ─────────────────────────────────────────
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Görsel profil kartını gösterir.')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Profili görüntülenecek kullanıcı (boş = kendiniz)')
        .setRequired(false)
    ),

  // ── Komut Yürütücüsü ─────────────────────────────────────
  async execute(interaction) {
    // Hedef kullanıcıyı belirle: parametre yoksa komutu yazan kişi
    const target = interaction.options.getUser('kullanici') ?? interaction.user;

    // Bot kontrolü
    if (target.bot) {
      return interaction.reply({
        content: '🤖 Botların profil kartı bulunmamaktadır.',
        ephemeral: true,
      });
    }

    // Kartı oluşturmak biraz sürebilir — hemen "işleniyor" göster
    await interaction.deferReply();

    // ── Veritabanından Puan Bilgileri ─────────────────────────
    const record  = getUserRep(target.id);
    const rep     = record.rep;
    const balance = record.balance ?? 0;

    // ── Rütbe Hesaplama ───────────────────────────────────────
    const currentRank = getRankForRep(rep);
    const nextRank    = getNextRank(currentRank.name);

    // ── Avatar URL (PNG, 256px) ───────────────────────────────
    // .png formatı zorunlu — canvas JPEG/WEBP'de de çalışır ama PNG daha stabil
    const avatarURL = target.displayAvatarURL({ extension: 'png', size: 256 });

    try {
      // ── Canvas ile Kart Üret ───────────────────────────────
      const imageBuffer = await generateProfileCard({
        username:    target.username,
        avatarURL,
        rep,
        balance,
        currentRank,
        nextRank,
      });

      // ── PNG Buffer'ı Discord'a Gönder ──────────────────────
      // AttachmentBuilder: Embed yerine dosya olarak gönderim
      const attachment = new AttachmentBuilder(imageBuffer, {
        name:        'profil.png',
        description: `${target.username} profil kartı`,
      });

      return interaction.editReply({ files: [attachment] });

    } catch (err) {
      console.error('[profil] Kart oluşturma hatası:', err);
      return interaction.editReply({
        content: '❌ Profil kartı oluşturulurken bir hata oluştu. Lütfen tekrar dene.',
      });
    }
  },
};
