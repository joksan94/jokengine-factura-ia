const { buscarTicketPorFolio } = require("../services/airtableService");
const { sendWhatsAppMessage } = require("../services/whatsappService");

async function handlePidiendoFolioVenta(phone, msgText, session) {
  const folio = (msgText || "").trim();
  if (!folio) {
    await sendWhatsAppMessage(phone, "Por favor ingresa un folio válido.");
    session.estado = "PIDIENDO_FOLIO_VENTA";
    return;
  }
  const ticket = await buscarTicketPorFolio(folio);
  if (!ticket) {
    await sendWhatsAppMessage(
      phone,
      `No se encontró el folio ${folio}. Intenta de nuevo o revisa el número.`
    );
    session.estado = "PIDIENDO_FOLIO_VENTA";
    return;
  }
  session.ticketAirtable = ticket;
  await sendWhatsAppMessage(
    phone,
    `Folio encontrado. Por favor, indica el *monto a facturar* (debe coincidir con el ticket):`
  );
  session.estado = "PIDIENDO_TOTAL";
}

module.exports = { handlePidiendoFolioVenta };
