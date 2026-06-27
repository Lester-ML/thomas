// ============================================================
//  src/profileCard.js — Görsel Profil Kartı Üretici
//  Görev: @napi-rs/canvas kullanarak 700x250 px boyutunda
//         dinamik, rütbeye göre arka planlı bir profil kartı
//         oluşturur ve PNG buffer olarak döndürür.
//
//  Kullanım:
//    const { generateProfileCard } = require('./profileCard');
//    const buffer = await generateProfileCard({ ... });
// ============================================================

const { createCanvas, loadImage } = require('@napi-rs/canvas');

// ── Canvas Boyutları ──────────────────────────────────────────
const WIDTH  = 700;
const HEIGHT = 250;

// ── Avatar Sabitleri ──────────────────────────────────────────
const AV_X      = 125;  // Avatar merkezi X
const AV_Y      = 125;  // Avatar merkezi Y
const AV_RADIUS = 75;   // Avatar yarıçapı (piksel)

// ── Tier'a Göre Gradyan Renkleri ─────────────────────────────
/**
 * Rütbeye göre arka plan başlangıç rengi ve accent rengi döndürür.
 * @param {string} rankName - Rütbe adı (örn: "Junior 1", "God of Code")
 * @returns {{ primary: string, dark: string, accent: string }}
 */
function getTierTheme(rankName) {
  if (rankName === 'God of Code') {
    return { primary: '#B8860B', dark: '#1a0d00', accent: '#FFD700' };
  }
  if (rankName.startsWith('Boss')) {
    return { primary: '#CC5500', dark: '#110500', accent: '#FF8C00' };
  }
  if (rankName.startsWith('Senior')) {
    return { primary: '#7B0000', dark: '#0d0000', accent: '#FF2020' };
  }
  if (rankName.startsWith('Mid')) {
    return { primary: '#4A0080', dark: '#0a0015', accent: '#BF5FFF' };
  }
  // Junior — Siberpunk Mavisi
  return { primary: '#005B8E', dark: '#000d1a', accent: '#00BFFF' };
}

// ── Yuvarlak Daire Yolu ───────────────────────────────────────
function circleClip(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

// ── Sayı Formatı (1500 → 1.5K) ───────────────────────────────
function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// ── Ana Kart Üretici ──────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.username      - Discord kullanıcı adı
 * @param {string} opts.avatarURL     - Avatar PNG URL'i (256px önerilir)
 * @param {number} opts.rep           - Toplam rep puanı
 * @param {number} opts.balance       - Market bakiyesi
 * @param {object} opts.currentRank   - rankConfig'den gelen rank nesnesi
 * @param {object|null} opts.nextRank - Bir sonraki rank (null ise max level)
 * @param {string|null} [opts.activeBgUrl] - Aktif arka plan resim URL'si (null = rütbe teması)
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateProfileCard({ username, avatarURL, rep, balance, currentRank, nextRank, activeBgUrl = null }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');
  const theme  = getTierTheme(currentRank.name);

  // ════════════════════════════════════════════════════════════
  // 1) ARKA PLAN
  // ════════════════════════════════════════════════════════════

  // ── 1a) Özel arka plan resmi varsa önce onu çiz ───────────
  if (activeBgUrl) {
    try {
      const bgImg = await loadImage(activeBgUrl);
      // Resmi canvas boyutunu kaplayacak şekilde çiz (cover mantığı)
      const scaleX = WIDTH  / bgImg.width;
      const scaleY = HEIGHT / bgImg.height;
      const scale  = Math.max(scaleX, scaleY);
      const dw     = bgImg.width  * scale;
      const dh     = bgImg.height * scale;
      const dx     = (WIDTH  - dw) / 2;
      const dy     = (HEIGHT - dh) / 2;
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } catch (err) {
      console.error(`[DEBUG - Canvas] ARKA PLAN ÇİZİMİ BAŞARISIZ: URL (${activeBgUrl}) yüklenemedi | Hata: ${err.message}`);
      // Resim yüklenemezse rütbe gradyanı kullan
      activeBgUrl = null;
    }
  }

  // ── 1b) Tema gradyanı (arka plan yoksa tam dolu, varsa yarı saydam overlay) ─
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  if (activeBgUrl) {
    // Arka plan resmi üzerine koyu yarı saydam overlay — metinler okunabilsin
    bg.addColorStop(0,    theme.primary + '99');
    bg.addColorStop(0.45, theme.dark    + 'BB');
    bg.addColorStop(1,    '#000000CC');
  } else {
    // Resim yok — tam opak gradyan (eski davranış)
    bg.addColorStop(0,    theme.primary + 'DD');
    bg.addColorStop(0.45, theme.dark);
    bg.addColorStop(1,    '#000000');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Hafif iç gölge efekti (üstten)
  const topFade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  topFade.addColorStop(0,   'rgba(0,0,0,0.45)');
  topFade.addColorStop(0.3, 'rgba(0,0,0,0)');
  topFade.addColorStop(1,   'rgba(0,0,0,0.55)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ════════════════════════════════════════════════════════════
  // 2) KENAR ÇERÇEVESİ
  // ════════════════════════════════════════════════════════════
  ctx.strokeStyle = theme.accent + 'AA';
  ctx.lineWidth   = 2.5;
  ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);

  // Sol accent dikey çizgi
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.moveTo(3, 20);
  ctx.lineTo(3, HEIGHT - 20);
  ctx.stroke();

  // ════════════════════════════════════════════════════════════
  // 3) AVATAR — Daire Şeklinde, Rütbe Renkli Çerçeve
  // ════════════════════════════════════════════════════════════

  // Dış parlak halka (accent rengi)
  ctx.save();
  circleClip(ctx, AV_X, AV_Y, AV_RADIUS + 8);
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.restore();

  // İç koyu halka (ince boşluk)
  ctx.save();
  circleClip(ctx, AV_X, AV_Y, AV_RADIUS + 4);
  ctx.fillStyle = '#111111';
  ctx.fill();
  ctx.restore();

  // Avatar resmi — daire clip
  ctx.save();
  circleClip(ctx, AV_X, AV_Y, AV_RADIUS);
  ctx.clip();

  try {
    const avatar = await loadImage(avatarURL);
    ctx.drawImage(
      avatar,
      AV_X - AV_RADIUS,
      AV_Y - AV_RADIUS,
      AV_RADIUS * 2,
      AV_RADIUS * 2
    );
  } catch {
    // Avatar yüklenemezse renk gradyan doldur
    const avFill = ctx.createRadialGradient(AV_X, AV_Y, 10, AV_X, AV_Y, AV_RADIUS);
    avFill.addColorStop(0, theme.primary);
    avFill.addColorStop(1, theme.dark);
    ctx.fillStyle = avFill;
    ctx.fillRect(AV_X - AV_RADIUS, AV_Y - AV_RADIUS, AV_RADIUS * 2, AV_RADIUS * 2);
  }
  ctx.restore();

  // ════════════════════════════════════════════════════════════
  // 4) METİNLER — Sağ Taraf
  // ════════════════════════════════════════════════════════════
  const TX = 235;  // Metin başlangıç X koordinatı

  // ── Kullanıcı Adı ─────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 34px sans-serif';

  // Uzun isimleri kırp
  let displayName = username;
  while (ctx.measureText(displayName).width > 300 && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== username) displayName += '...';

  ctx.fillText(displayName, TX, 68);

  // ── Rütbe Adı ─────────────────────────────────────────────
  // Hafif gölge
  ctx.shadowColor   = theme.accent + '88';
  ctx.shadowBlur    = 12;
  ctx.fillStyle     = theme.accent;
  ctx.font          = 'bold 17px sans-serif';
  ctx.fillText(currentRank.name.toUpperCase(), TX, 98);
  ctx.shadowBlur    = 0;

  // ── Yatay Ayraç ───────────────────────────────────────────
  const sepGrad = ctx.createLinearGradient(TX, 0, WIDTH - 30, 0);
  sepGrad.addColorStop(0,   theme.accent + 'CC');
  sepGrad.addColorStop(0.6, theme.accent + '44');
  sepGrad.addColorStop(1,   'transparent');
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(TX, 113);
  ctx.lineTo(WIDTH - 30, 113);
  ctx.stroke();

  // ── İki Sütun: Rep | Balance ──────────────────────────────
  const col1X = TX;
  const col2X = TX + 190;

  // Etiket stili
  ctx.fillStyle = '#888888';
  ctx.font      = '13px sans-serif';
  ctx.fillText('TOTAL REP', col1X, 140);
  ctx.fillText('CREDIT BALANCE', col2X, 140);

  // Değer stili
  ctx.fillStyle = '#FFFFFF';
  ctx.font      = 'bold 30px sans-serif';
  ctx.fillText(formatNumber(rep), col1X, 178);

  ctx.fillStyle = '#FFD700';
  ctx.font      = 'bold 30px sans-serif';
  ctx.fillText(formatNumber(balance), col2X, 178);

  // Küçük birim yazısı
  ctx.fillStyle = '#666666';
  ctx.font      = '12px sans-serif';
  ctx.fillText('puan', col1X + ctx.measureText(formatNumber(rep)).width + 6, 178);
  ctx.fillText('kr',   col2X + ctx.measureText(formatNumber(balance)).width + 6, 178);

  // ── Sonraki Rütbe ─────────────────────────────────────────
  ctx.fillStyle = '#555555';
  ctx.font      = '13px sans-serif';
  const nextText = nextRank
    ? `NEXT RANK: ${nextRank.name.toUpperCase()} (+${nextRank.minRep - rep} rep)`
    : 'MAX LEVEL REACHED  |  God of Code';
  ctx.fillText(nextText, TX, 225);

  // ── Quantum Kratos Marka İzhi ─────────────────────────────
  ctx.fillStyle = theme.accent + '55';
  ctx.font      = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('KRATOS', WIDTH - 18, HEIGHT - 14);
  ctx.textAlign = 'left'; // sıfırla

  // ════════════════════════════════════════════════════════════
  // 5) PNG BUFFER OLARAK DÖNDÜR
  // ════════════════════════════════════════════════════════════
  return canvas.toBuffer('image/png');
}

module.exports = { generateProfileCard };
