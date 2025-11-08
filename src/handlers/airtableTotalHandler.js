const {
  sendWhatsAppMessage,
  sendWhatsAppOptions,
} = require("../services/whatsappService");

// Handler para validar el monto contra el ticket de Airtable y llenar datos fiscales
async function handlePidiendoTotalAirtable(phone, msgText, session) {
  const ticket = session.ticketAirtable;
  if (!ticket) {
    await sendWhatsAppMessage(
      phone,
      "Error: No se encontró el ticket en sesión. Por favor, reinicia el flujo."
    );
    session.estado = "PIDIENDO_FOLIO_VENTA";
    return;
  }
  const totalNum = parseFloat((msgText || "").replace(/[^0-9.]/g, "").trim());
  if (isNaN(totalNum) || totalNum <= 0) {
    await sendWhatsAppMessage(
      phone,
      "Por favor ingresa un número válido para el total."
    );
    session.estado = "PIDIENDO_TOTAL";
    return;
  }
  // Leer el campo 'Monto' y limpiar formato ($, comas, espacios)
  let ticketMontoRaw =
    ticket.Monto || ticket.monto || ticket.Total || ticket.total || "0";
  let ticketMontoClean = String(ticketMontoRaw)
    .replace(/[^0-9.,]/g, "") // quitar $ y otros símbolos
    .replace(/,/g, ""); // quitar comas
  let ticketTotal = parseFloat(ticketMontoClean.replace(/\s/g, ""));
  if (isNaN(ticketTotal)) ticketTotal = 0;
  if (Math.abs(totalNum - ticketTotal) > 0.01) {
    await sendWhatsAppMessage(
      phone,
      `El monto ingresado no coincide con el ticket. Intenta de nuevo.`
    );
    session.estado = "PIDIENDO_TOTAL";
    return;
  }
  // Llenar datos fiscales desde el ticket si existen
  session.datosFactura = session.datosFactura || {};
  // Mantener el RFC de Firestore si ya existe
  if (!session.datosFactura.rfc && ticket.RFC)
    session.datosFactura.rfc = ticket.RFC;
  if (ticket.Nombre) session.datosFactura.nombre = ticket.Nombre;
  if (ticket["Régimen Fiscal"])
    session.datosFactura.regimenFiscal = ticket["Régimen Fiscal"];
  if (ticket["Uso CFDI"]) session.datosFactura.usoCfdi = ticket["Uso CFDI"];
  session.datosFactura.total = totalNum;

  // Mostrar resumen usando el RFC ya guardado en Firestore si existe
  const resumen =
    `Resumen de factura:\n` +
    `RFC: ${session.datosFactura.rfc || "-"}\n` +
    `Nombre: ${session.datosFactura.nombre || "-"}\n` +
    `Régimen Fiscal: ${session.datosFactura.regimenFiscal || "-"}\n` +
    `Uso CFDI: ${session.datosFactura.usoCfdi || "-"}\n` +
    `Total: $${session.datosFactura.total.toFixed(2)}\n\n`;
  await sendWhatsAppOptions(phone, resumen + "¿Deseas confirmar la factura?", [
    { label: "CONFIRMAR", value: "confirmar" },
    { label: "CANCELAR", value: "cancelar" },
  ]);
  session.estado = "ESPERANDO_CONFIRMACION";
}

module.exports = { handlePidiendoTotalAirtable };
