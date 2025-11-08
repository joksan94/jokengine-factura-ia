const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const {
  WHATSAPP_API_URL,
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
} = require("../config/env");

// Función para normalizar teléfono a formato con 52 sin +
const formatPhoneNumber = (phoneNumber) => {
  let clean = phoneNumber.replace(/^\+/, "");
  if (clean.startsWith("52")) {
    clean = clean.slice(2);
  }
  return `52${clean}`;
};

// Enviar texto
const sendWhatsAppMessage = async (phoneNumber, message) => {
  try {
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: formattedPhoneNumber,
        type: "text",
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ Mensaje enviado:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error al enviar mensaje:", error.response?.data);
    throw error;
  }
};

// Subir documento a WhatsApp (PDF/XML)
const uploadMediaToWhatsApp = async (filePath, mimeType) => {
  try {
    const data = new FormData();
    data.append("file", fs.createReadStream(filePath));
    data.append("type", mimeType);
    data.append("messaging_product", "whatsapp"); // ✅ AÑADIDO

    const res = await axios.post(
      `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/media`,
      data,
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          ...data.getHeaders(),
        },
      }
    );

    console.log("✅ Media subida:", res.data);
    return res.data.id;
  } catch (error) {
    console.error(
      "❌ Error al subir media:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Enviar archivo/documento
const sendDocumentMessage = async (phoneNumber, mediaId, filename) => {
  try {
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: formattedPhoneNumber,
        type: "document",
        document: {
          id: mediaId,
          filename: filename,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Documento enviado:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error al enviar documento:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Enviar lista interactiva
const sendWhatsAppList = async (
  phoneNumber,
  bodyText,
  buttonText,
  options,
  sectionTitle = "Opciones"
) => {
  try {
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    const items = options.map((opt) => ({
      id: opt.value,
      title: opt.label.slice(0, 20), // WhatsApp permite máx 20 caracteres
    }));

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: formattedPhoneNumber,
        type: "interactive",
        interactive: {
          type: "list",
          body: {
            text: bodyText.slice(0, 1024),
          },
          action: {
            button: buttonText.slice(0, 20),
            sections: [
              {
                title: sectionTitle,
                rows: items,
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Lista enviada:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error al enviar lista:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Enviar opciones con botones (respuestas rápidas)
const sendWhatsAppOptions = async (phoneNumber, bodyText, options) => {
  try {
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    const buttons = options.slice(0, 3).map((opt, i) => ({
      type: "reply",
      reply: {
        id: opt.value,
        title: opt.label.slice(0, 20), // WhatsApp permite máx 20 caracteres
      },
    }));

    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: "whatsapp",
        to: formattedPhoneNumber,
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: bodyText.slice(0, 1024),
          },
          action: {
            buttons,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Botones enviados:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error al enviar botones:",
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = {
  sendWhatsAppMessage,
  uploadMediaToWhatsApp,
  sendDocumentMessage,
  sendWhatsAppList,
  sendWhatsAppOptions,
};
