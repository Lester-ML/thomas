// ============================================================
//  src/aiService.js — Yapay Zeka Kalite Kontrol Servisi
//  Görev: Teşekkür edilen mesajların teknik yardım içerip 
//         içermediğini OpenAI uyumlu API'ler ile analiz eder.
//         Çoklu API Key (Key Rotation) destekler.
// ============================================================

// Global fetch kullanıyoruz (Node 18+)

// ── Yapılandırma ───────────────────────────────────────────
const API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const API_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// API Key'leri al ve diziye çevir
const keysRaw = process.env.AI_API_KEYS || '';
const API_KEYS = keysRaw.split(',').map((k) => k.trim()).filter((k) => k.length > 0);

let currentKeyIndex = 0;

/**
 * Mesajın teknik yardım içerip içermediğini AI'a sorar.
 * @param {string} question - Yardım isteyenin orijinal sorusu (yoksa boş string)
 * @param {string} answer - Yardım edenin yanıt mesajı
 * @returns {Promise<boolean>} AI "YES" derse true, "NO" veya hata durumunda false
 */
async function analyzeHelpMessage(question, answer) {
  if (API_KEYS.length === 0) {
    console.warn('[AI Service] AI_API_KEYS bulunamadı. Tüm mesajlar onaylanıyor (varsayılan).');
    return true; 
  }

  const systemPrompt = `Sen bir yazılımcı Discord sunucusunda kalite kontrol yapay zekasısın. 
Görevin, sana verilen 'Yanıt Mesajı'nın gerçekten bir yazılım, kod, donanım veya teknik destek yardımı içerip içermediğini analiz etmektir. 
Eğer mesaj sadece 'selam', 'iyiyim', 'önemli değil', 'ne demek', 'rica ederim' gibi günlük sohbet veya alakasız bir cevap ise NO yaz. 
Eğer mesajda kod, teknik bir açıklama, döküman linki veya sorunu çözen mantıklı bir yönlendirme varsa YES yaz. 
Sadece YES veya NO olarak cevap ver, başka hiçbir şey yazma. Noktalama işareti kullanma.`;

  const userPrompt = `Orijinal Soru: ${question || '(Bulunamadı)'}\nYanıt Mesajı: ${answer}`;

  // Key'lerin hepsini denemek için döngü (Key sayısı kadar maksimum deneme)
  let attempts = 0;
  while (attempts < API_KEYS.length) {
    const currentKey = API_KEYS[currentKeyIndex];

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentKey}`,
        },
        body: JSON.stringify({
          model: API_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1, // Net ve sabit cevaplar için düşük sıcaklık
          max_tokens: 5,
        }),
      });

      // Başarılı cevap
      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.choices[0].message.content.trim().toUpperCase();
        
        console.log(`[AI Service] Analiz Tamamlandı. Cevap: ${aiResponse} (Kullanılan Key Index: ${currentKeyIndex})`);
        return aiResponse.includes('YES');
      }

      // 429 Too Many Requests, 401 Unauthorized, 402 Payment Required vb. Kota/Yetki Hataları
      if (response.status === 429 || response.status === 401 || response.status === 402 || response.status === 403) {
        console.warn(`[AI Service] Key Index ${currentKeyIndex} hata verdi (Status: ${response.status}). Sonraki key'e geçiliyor...`);
        rotateKey();
        attempts++;
        continue;
      }

      // Diğer hatalar (500 Server Error vs)
      console.error(`[AI Service] Beklenmeyen API hatası (Status: ${response.status}).`);
      rotateKey(); // Yine de rotasyon yapalım ki bir sunucuda takılıp kalmayalım
      attempts++;
      continue;

    } catch (error) {
      console.error(`[AI Service] İstek atılırken hata oluştu:`, error.message);
      rotateKey();
      attempts++;
    }
  }

  // Tüm keyler denendi ve başarısız oldu
  console.error('[AI Service] Tüm API Keyleri denendi ancak cevap alınamadı. Sistem yoğun.');
  // Puan sisteminin çökmemesi için true (veya false) dönebiliriz. Şimdilik red atalım veya Exception fırlatalım.
  throw new Error('ALL_KEYS_EXHAUSTED');
}

/**
 * Mevcut key indeksini bir artırır (sona gelince başa döner).
 */
function rotateKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
}

module.exports = { analyzeHelpMessage };
