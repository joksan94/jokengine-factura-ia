const { getSession, deleteSession } = require("../utils/sessionManager");
const { obtenerIdDeRespuesta } = require("../utils/messageParser");
const {
  handleMenuInicial,
  handleEsperandoOpcion,
  handlePidiendoRFC,
  handlePidiendoNombre,
  handlePidiendoTipoPersona,
  handlePidiendoFiscalRegime,
  handlePidiendoCFDIUse,
  handlePidiendoTotal,
  handleEsperandoConfirmacion,
  handleReintentarRegimen,
  handleReintentarCFDIUse,
  handleEsperandoFactura,
  handleConfirmarRFCGuardado,
  handleConfirmarDatosFiscalesGuardados,
  handleActualizandoRFC,
  handleActualizandoNombre,
  handleActualizandoTipoPersona,
  handleActualizandoRegimen,
  handleActualizandoUsoCFDI,
} = require("../handlers/stateHandlers");
const { handlePidiendoFolioVenta } = require("../handlers/airtableHandlers");
const {
  handlePidiendoTotalAirtable,
} = require("../handlers/airtableTotalHandler");

const { sendWhatsAppMessage } = require("../services/whatsappService");

const handleWhatsAppWebhook = async (req, res) => {
  // Log de extracción de entry y message
  const entry = req.body.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];
  // console.log("📥 message:", JSON.stringify(message, null, 2));
  if (!message) {
    // console.warn("⚠️ No se encontró mensaje en el webhook. No se responde.");
    return res.sendStatus(200);
  }

  const phoneFrom = message.from;
  const phoneTo = entry?.metadata?.display_phone_number;
  const msgText = message.text?.body?.trim();
  const buttonReply = message?.interactive?.button_reply;
  const listReply = message?.interactive?.list_reply;
  const msg = obtenerIdDeRespuesta(buttonReply, listReply, msgText);
  const session = getSession(phoneFrom);
  console.log("📦 Estado de la sesión:", session);

  try {
    switch (session.estado) {
      case "PIDIENDO_FOLIO_VENTA":
        await handlePidiendoFolioVenta(phoneFrom, msgText, session);
        break;
      case "CONFIRMAR_RFC_GUARDADO":
        await handleConfirmarRFCGuardado(phoneFrom, msg, session);
        break;
      case "MENU_INICIAL":
        await handleMenuInicial(phoneFrom, session, phoneTo);
        break;
      case "ESPERANDO_OPCION":
        await handleEsperandoOpcion(phoneFrom, msg, session);
        break;
      case "PIDIENDO_RFC":
        await handlePidiendoRFC(phoneFrom, msgText, session);
        break;
      case "PIDIENDO_NOMBRE":
        await handlePidiendoNombre(phoneFrom, msgText, session);
        break;
      case "PIDIENDO_TIPO_PERSONA":
        await handlePidiendoTipoPersona(phoneFrom, msg, session);
        break;
      case "PIDIENDO_FISCALREGIME":
        await handlePidiendoFiscalRegime(phoneFrom, msg, session);
        break;
      case "PIDIENDO_CFDIUSE":
        await handlePidiendoCFDIUse(phoneFrom, msg, session);
        break;
      case "PIDIENDO_TOTAL":
        if (session.ticketAirtable) {
          await handlePidiendoTotalAirtable(phoneFrom, msgText, session);
        } else {
          await handlePidiendoTotal(phoneFrom, msgText, session);
        }
        break;
      case "ESPERANDO_CONFIRMACION":
        await handleEsperandoConfirmacion(phoneFrom, msg, session, phoneTo);
        break;
      case "ESPERANDO_FACTURA":
        await handleEsperandoFactura(phoneFrom, msg, session);
        break;
      case "REINTENTAR_REGIMEN":
        await handleReintentarRegimen(phoneFrom, msg, session);
        break;
      case "REINTENTAR_CFDIUSE":
        await handleReintentarCFDIUse(phoneFrom, msg, session);
        break;
      case "CONFIRMAR_DATOS_FISCALES_GUARDADOS":
        await handleConfirmarDatosFiscalesGuardados(phoneFrom, msg, session);
        break;
      case "ACTUALIZANDO_RFC":
        await handleActualizandoRFC(phoneFrom, msgText, session);
        break;
      case "ACTUALIZANDO_NOMBRE":
        await handleActualizandoNombre(phoneFrom, msgText, session);
        break;
      case "ACTUALIZANDO_TIPO_PERSONA":
        await handleActualizandoTipoPersona(phoneFrom, msg, session);
        break;
      case "ACTUALIZANDO_REGIMEN":
        await handleActualizandoRegimen(phoneFrom, msg, session);
        break;
      case "ACTUALIZANDO_USO_CFDI":
        await handleActualizandoUsoCFDI(phoneFrom, msg, session);
        break;
      default:
        await sendWhatsAppMessage(
          phoneFrom,
          "Error inesperado, reiniciando..."
        );
        deleteSession(phoneFrom);
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en flujo de factura:", error);
    if (error.response) {
      console.error("❌ Error response data:", error.response.data);
    }
    if (error.stack) {
      console.error("❌ Error stack:", error.stack);
    }
    await sendWhatsAppMessage(
      phoneFrom,
      "❌ Ocurrió un error, intenta nuevamente. (Soporte: revisa logs del servidor)"
    );
    // No borrar la sesión automáticamente para facilitar depuración
    res.sendStatus(500);
  }
};

const verifyWebhook = (req, res) => {
  console.log("🔔 Verificación de webhook de WhatsApp");

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Validar que los parámetros estén presentes
  if (!mode || !token || !challenge) {
    console.error("❌ Faltan parámetros en la solicitud");
    return res.status(400).send("Faltan parámetros en la solicitud");
  }

  // Verificar el modo y el token
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Token correcto, respondiendo con challenge");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Error de validación");
    if (mode !== "subscribe") console.error("  Modo incorrecto:", mode);
    if (token !== process.env.VERIFY_TOKEN)
      console.error("  Token no coincide:", token);
    res.status(403).send("Token o modo incorrecto");
  }
};

module.exports = {
  handleWhatsAppWebhook,
  verifyWebhook,
};
