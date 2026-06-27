// ============================================================
//  events/voiceStateUpdate.js — Sesli Kanal Puan Sistemi
//  Görev: Kullanıcıların sesli kanallarda geçirdikleri süreyi
//         ölçer ve her 4 dakikada 1 rep/balance puanı verir.
// ============================================================

const { Events } = require('discord.js');
const { getDb } = require('../src/database');
const { getUserRep } = require('../src/repService');
const { checkRank } = require('../src/rankService');

// Geçici Hafıza: Kullanıcıların sesli kanala giriş zamanlarını (timestamp) tutar.
// RAM'de tutulduğu için veritabanı yorulmaz. Bot yeniden başlarsa sıfırlanır.
const voiceSessions = new Map();

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member;
    
    // Botları yoksay
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channelId;
    const newChannel = newState.channelId;

    // ── 1. KANALA GİRİŞ (Join) ───────────────────────────────
    if (!oldChannel && newChannel) {
      // Sese ilk giriş: Saati kaydet (Deaf/Mute kontrolleri kasıtlı olarak yok)
      voiceSessions.set(member.id, Date.now());
    }
    
    // ── 2. KANALDAN ÇIKIŞ (Leave) ────────────────────────────
    else if (oldChannel && !newChannel) {
      const joinTime = voiceSessions.get(member.id);
      
      // Kullanıcı bot başlamadan önce seste girdiyse veya map'te yoksa yoksay
      if (!joinTime) return;

      // Hafızadan sil
      voiceSessions.delete(member.id);

      // Süreyi hesapla
      const durationMs = Date.now() - joinTime;
      const durationMinutes = Math.floor(durationMs / 60000);
      
      // Formül: 60 dakikada 15 puan = Her 4 dakikada 1 puan
      const earnedPoints = Math.floor(durationMinutes / 4);

      // Çık-gir (Spam) engeli: 4 dakikadan az duranlar 0 puan alır ve işlem yapılmaz
      if (earnedPoints > 0) {
        try {
          // Kullanıcı kaydı yoksa DB'de oluştur (repService içerisindeki ensureUser dolaylı olarak çağrılır)
          const oldRecord = getUserRep(member.id);
          const oldRep = oldRecord.rep;
          
          // Veritabanında rep ve balance değerlerine ekleme yap
          getDb().prepare(
            'UPDATE reputation SET rep = rep + ?, balance = balance + ? WHERE user_id = ?'
          ).run(earnedPoints, earnedPoints, member.id);

          const newRep = oldRep + earnedPoints;
          
          console.log(`[Voice Leveling] ${member.user.username} seslide ${durationMinutes} dakika durdu, +${earnedPoints} puan verildi.`);

          // Rütbe atlama kontrolü yap
          await checkRank({
            member,
            oldRep: oldRep,
            newRep: newRep,
            guild: newState.guild,
            client: newState.client
          });
        } catch (err) {
          console.error(`[Voice Leveling] Puan verilirken hata:`, err.message);
        }
      }
    }
    
    // ── 3. KANAL DEĞİŞTİRME (Move) ───────────────────────────
    // oldChannel ve newChannel ikisi de varsa, kullanıcı sadece oda değiştirmiştir.
    // Bu durumda sayacın bozulmaması için hiçbir şey yapmıyoruz.
  }
};
