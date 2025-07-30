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
} = require("../handlers/stateHandlers");
const { sendWhatsAppMessage } = require("../services/whatsappService");

const handleWhatsAppWebhook = async (req, res) => {
  // console.log(
  //   "🔔 Webhook de WhatsApp recibido:",
  //   JSON.stringify(req.body, null, 2)
  // );

  const entry = req.body.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const phoneFrom = message.from; // Número del remitente
  const phoneTo = entry?.metadata?.display_phone_number; // Número de destino (display_phone_number)
  console.log("📞 Número de teléfono del remitente:", phoneFrom);
  console.log("📞 Número de teléfono de destino:", phoneTo);

  const msgText = message.text?.body?.trim();
  const buttonReply = message?.interactive?.button_reply;
  const listReply = message?.interactive?.list_reply;

  const msg = obtenerIdDeRespuesta(buttonReply, listReply, msgText);
  const session = getSession(phoneFrom);

  try {
    switch (session.estado) {
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
        await handlePidiendoTotal(phoneFrom, msgText, session);
        break;
      case "ESPERANDO_CONFIRMACION":
        await handleEsperandoConfirmacion(phoneFrom, msg, session, phoneTo);
        break;
      case "ESPERANDO_FACTURA": // Conectar aquí
        await handleEsperandoFactura(phoneFrom, msg, session);
        break;
      case "REINTENTAR_REGIMEN":
        await handleReintentarRegimen(phoneFrom, msg, session);
        break;
      case "REINTENTAR_CFDIUSE":
        await handleReintentarCFDIUse(phoneFrom, msg, session);
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
    await sendWhatsAppMessage(
      phoneFrom,
      "❌ Ocurrió un error, intenta nuevamente."
    );
    deleteSession(phoneFrom);
    res.sendStatus(500);
  }
};

const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === process.env.VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

module.exports = {
  handleWhatsAppWebhook,
  verifyWebhook,
};
