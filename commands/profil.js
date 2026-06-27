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
const { getActiveItems, getDb } = require('../src/database');

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

    // Üyenin Discord sunucusundaki rengini al (Marketten alınan rol rengini yansıtmak için)
    let nameColor = '#FFFFFF';
    try {
      const member = await interaction.guild.members.fetch(target.id);
      if (member && member.displayHexColor !== '#000000') {
        nameColor = member.displayHexColor;
      }
    } catch { /* Member bulunamazsa varsayılan beyaz kalır */ }

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
      // ── Aktif Özelleştirmeleri Çek ──────────────────────
      let activeBgUrl = null;
      let activeNameColorHex = null;
      let activeProfileFrameHex = null;
      let activeAvatarFrameHex = null;

      try {
        const actives = getActiveItems(target.id);

        // Arka Plan
        if (actives.active_bg_id) {
          const item = getDb().prepare("SELECT dataValue FROM market_items WHERE id = ?").get(actives.active_bg_id);
          if (item && item.dataValue) activeBgUrl = item.dataValue.trim();
        }
        
        // İsim Rengi
        if (actives.active_name_color_id) {
          const item = getDb().prepare("SELECT dataValue FROM market_items WHERE id = ?").get(actives.active_name_color_id);
          if (item && item.dataValue) activeNameColorHex = item.dataValue.trim();
        }
        
        // Profil Çerçevesi
        if (actives.active_profile_frame_id) {
          const item = getDb().prepare("SELECT dataValue FROM market_items WHERE id = ?").get(actives.active_profile_frame_id);
          if (item && item.dataValue) activeProfileFrameHex = item.dataValue.trim();
        }
        
        // Avatar Çerçevesi
        if (actives.active_avatar_frame_id) {
          const item = getDb().prepare("SELECT dataValue FROM market_items WHERE id = ?").get(actives.active_avatar_frame_id);
          if (item && item.dataValue) activeAvatarFrameHex = item.dataValue.trim();
        }

      } catch (dbErr) {
        console.error(`[profil/${target.username}] DB'den eşyalar okunurken hata:`, dbErr.message);
      }

      // ── Canvas ile Kart Üret ───────────────────────────────
      const imageBuffer = await generateProfileCard({
        username:    target.username,
        avatarURL,
        rep,
        balance,
        currentRank,
        nextRank,
        activeBgUrl,
        nameColor:       activeNameColorHex || nameColor, // Canvas ismi rengi, aktif yoksa discord rol rengi
        profileFrameHex: activeProfileFrameHex,           // Custom profil çerçevesi rengi
        avatarFrameHex:  activeAvatarFrameHex,            // Custom avatar çerçevesi rengi
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
