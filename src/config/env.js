require("dotenv").config();

module.exports = {
  // WhatsApp Cloud API
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,

  // Facturama API
  FACTURAMA_USER: process.env.FACTURAMA_USER,
  FACTURAMA_PASS: process.env.FACTURAMA_PASS,

  // Verificación Webhook
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || "jokengine-verify",

  // IA u OCR (opcional, para siguientes pasos)
  AI_PROVIDER: process.env.AI_PROVIDER || "gemini",
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
};
