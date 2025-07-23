const {
  sendWhatsAppMessage,
  sendWhatsAppList,
  uploadMediaToWhatsApp,
  sendDocumentMessage,
  sendWhatsAppOptions,
} = require("../services/whatsappService");

const {
  generarFactura,
  descargarFactura,
} = require("../services/facturacionService");

const {
  regimenesFiscales,
  usosCfdi,
  popularesPersonaFisica,
  popularesPersonaMoral,
} = require("../constants/fiscalConstants");

const sessions = {}; // Sesiones temporales (en producción usar Firestore o Redis)

// Función para interpretar respuesta del usuario, ya sea botón/lista o texto libre
function obtenerIdDeRespuesta(buttonReply, listReply, msgText) {
  if (buttonReply?.id) return buttonReply.id.toLowerCase();
  if (listReply?.id) return listReply.id.toLowerCase();

  if (msgText) {
    const texto = msgText.toLowerCase();

    // Para régimen fiscal: si texto indica ayuda
    if (
      texto.includes("no sé") ||
      texto.includes("no se") ||
      texto.includes("ayuda")
    ) {
      return "regimen_ayuda";
    }
    // Intentar extraer número de régimen de texto libre (ej: "Régimen 616")
    const matchRegimen = texto.match(/reg[ií]men\s*(\d{3})/i);
    if (matchRegimen) {
      return "regimen_" + matchRegimen[1];
    }

    // Para uso CFDI: si texto indica ayuda
    if (
      texto.includes("uso ayuda") ||
      texto.includes("uso cfdi ayuda") ||
      texto.includes("uso no sé")
    ) {
      return "uso_ayuda";
    }
    // Extraer código de uso CFDI (ej: "Uso G03")
    const matchUso = texto.match(/uso\s*([a-z0-9]{3})/i);
    if (matchUso) {
      return "uso_" + matchUso[1].toUpperCase();
    }
  }

  return (buttonReply?.id || listReply?.id || msgText || "").toLowerCase();
}

const handleWhatsAppWebhook = async (req, res) => {
  const entry = req.body.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const phone = message.from;
  const msgText = message.text?.body?.trim();
  const buttonReply = message?.interactive?.button_reply;
  const listReply = message?.interactive?.list_reply;

  // Usar función para obtener el mensaje/ID normalizado
  const msg = obtenerIdDeRespuesta(buttonReply, listReply, msgText);

  if (!sessions[phone]) {
    sessions[phone] = {
      estado: "MENU_INICIAL",
      datosFactura: {},
    };
  }

  const session = sessions[phone];

  try {
    switch (session.estado) {
      case "MENU_INICIAL":
        await sendWhatsAppMessage(
          phone,
          `Hola, ¿qué deseas hacer?\n` +
            `1️⃣ Consultar factura (no implementado)\n` +
            `2️⃣ Generar factura\n\n` +
            `Por favor responde con 1 o 2.`
        );
        session.estado = "ESPERANDO_OPCION";
        break;

      case "ESPERANDO_OPCION":
        if (msg === "1" || msg.includes("consultar")) {
          await sendWhatsAppMessage(
            phone,
            "Función de consultar factura aún no está disponible."
          );
          session.estado = "MENU_INICIAL";
        } else if (msg === "2" || msg.includes("generar")) {
          await sendWhatsAppMessage(
            phone,
            "Por favor proporciona el RFC del receptor:"
          );
          session.estado = "PIDIENDO_RFC";
        } else {
          await sendWhatsAppMessage(phone, "Opción no válida. Responde 1 o 2.");
        }
        break;

      case "PIDIENDO_RFC":
        session.datosFactura.rfc = msgText.toUpperCase();
        await sendWhatsAppMessage(
          phone,
          "Ahora proporciona el nombre del receptor:"
        );
        session.estado = "PIDIENDO_NOMBRE";
        break;

      case "PIDIENDO_NOMBRE":
        session.datosFactura.nombre = msgText;
        session.estado = "PIDIENDO_TIPO_PERSONA";
        await sendWhatsAppOptions(phone, "¿Qué tipo de persona eres?", [
          { label: "Persona Física", value: "tipo_fisica" },
          { label: "Persona Moral", value: "tipo_moral" },
        ]);
        break;

      case "PIDIENDO_TIPO_PERSONA":
        if (msg === "tipo_fisica") {
          session.tipoPersona = "personaFisica";
        } else if (msg === "tipo_moral") {
          session.tipoPersona = "personaMoral";
        } else {
          await sendWhatsAppMessage(
            phone,
            "Opción inválida. Intenta nuevamente."
          );
          break;
        }

        session.estado = "PIDIENDO_FISCALREGIME";

        const regimenes = Object.entries(regimenesFiscales[session.tipoPersona])
          .filter(([clave]) =>
            session.tipoPersona === "personaFisica"
              ? popularesPersonaFisica.includes(clave)
              : popularesPersonaMoral.includes(clave)
          )
          .slice(0, 9)
          .map(([clave]) => ({
            label: `Régimen ${clave}`,
            value: `regimen_${clave}`,
          }));

        regimenes.push({
          label: "No sé cuál es mi régimen",
          value: "regimen_ayuda",
        });

        await sendWhatsAppList(
          phone,
          "Selecciona el régimen fiscal:",
          "Regímenes disponibles",
          regimenes,
          "Régimen Fiscal"
        );
        break;

      case "PIDIENDO_FISCALREGIME":
        if (msg === "regimen_ayuda") {
          await sendWhatsAppMessage(
            phone,
            "Puedes consultar tu régimen fiscal en este enlace oficial del SAT:\n\n👉 https://www.cloudb.sat.gob.mx/datos_fiscales/regimen\n\n¿Deseas volver a ver la lista?"
          );

          await sendWhatsAppOptions(phone, "¿Qué deseas hacer?", [
            {
              label: "🔁 Mostrar lista de regímenes",
              value: "reintentar_regimen",
            },
            { label: "❌ Cancelar", value: "cancelar" },
          ]);
          session.estado = "REINTENTAR_REGIMEN";
          return;
        }

        if (!msg.startsWith("regimen_")) {
          await sendWhatsAppMessage(
            phone,
            "Opción inválida. Intenta nuevamente."
          );
          break;
        }

        const claveRegimen = msg.replace("regimen_", "").toUpperCase();
        const descripcionRegimen =
          regimenesFiscales[session.tipoPersona][claveRegimen];

        if (!descripcionRegimen) {
          await sendWhatsAppMessage(
            phone,
            "Régimen no reconocido. Intenta de nuevo."
          );
          break;
        }

        session.datosFactura.fiscalRegime = claveRegimen;

        await sendWhatsAppMessage(
          phone,
          `✅ Elegiste el régimen ${claveRegimen}: ${descripcionRegimen}`
        );

        session.estado = "PIDIENDO_CFDIUSE";

        const usos = Object.entries(usosCfdi)
          .slice(0, 9)
          .map(([clave]) => ({
            label: `Uso ${clave}`,
            value: `uso_${clave}`,
          }));

        usos.push({
          label: "No sé cuál es el uso CFDI",
          value: "uso_ayuda",
        });

        await sendWhatsAppList(
          phone,
          "Selecciona el uso del CFDI:",
          "Usos disponibles",
          usos,
          "Uso CFDI"
        );
        break;

      case "PIDIENDO_CFDIUSE":
        if (msg === "uso_ayuda") {
          await sendWhatsAppMessage(
            phone,
            "Puedes consultar los usos de CFDI en este PDF oficial:\n\n👉 https://facturama.mx/blog/wp-content/uploads/2023/11/USO-DEL-CFDI.pdf\n\n¿Deseas volver a ver la lista?"
          );
          await sendWhatsAppOptions(phone, "¿Qué deseas hacer?", [
            { label: "🔁 Mostrar lista de usos CFDI", value: "reintentar_uso" },
            { label: "❌ Cancelar", value: "cancelar" },
          ]);
          session.estado = "REINTENTAR_CFDIUSE";
          return;
        }

        if (!msg.startsWith("uso_")) {
          await sendWhatsAppMessage(
            phone,
            "Opción inválida. Intenta nuevamente."
          );
          break;
        }

        const claveUso = msg.replace("uso_", "").toUpperCase();
        const descripcionUso = usosCfdi[claveUso];

        if (!descripcionUso) {
          await sendWhatsAppMessage(
            phone,
            "Uso CFDI no reconocido. Intenta de nuevo."
          );
          break;
        }

        session.datosFactura.cfdiUse = claveUso;

        await sendWhatsAppMessage(
          phone,
          `✅ Elegiste el uso CFDI ${claveUso}: ${descripcionUso}`
        );

        await sendWhatsAppMessage(
          phone,
          "Indica el total a facturar (solo número):"
        );
        session.estado = "PIDIENDO_TOTAL";
        break;

      case "PIDIENDO_TOTAL":
        const totalNum = parseFloat(msgText.replace(/[^0-9.]/g, "").trim());
        if (isNaN(totalNum) || totalNum <= 0) {
          await sendWhatsAppMessage(
            phone,
            "Por favor ingresa un número válido para el total."
          );
          break;
        }
        session.datosFactura.total = totalNum;
        await sendWhatsAppMessage(
          phone,
          `Resumen de factura:\n` +
            `RFC: ${session.datosFactura.rfc}\n` +
            `Nombre: ${session.datosFactura.nombre}\n` +
            `Régimen Fiscal: ${session.datosFactura.fiscalRegime}\n` +
            `Uso CFDI: ${session.datosFactura.cfdiUse}\n` +
            `Total: $${session.datosFactura.total.toFixed(2)}\n\n` +
            `Responde CONFIRMAR para generar la factura o CANCELAR para abortar.`
        );
        session.estado = "ESPERANDO_CONFIRMACION";
        break;

      case "ESPERANDO_CONFIRMACION":
        if (msg === "confirmar") {
          const datosFactura = session.datosFactura;
          if (!datosFactura.total || datosFactura.total <= 0) {
            await sendWhatsAppMessage(
              phone,
              "❌ El total debe ser mayor a $0."
            );
            delete sessions[phone];
            return res.sendStatus(200);
          }

          await sendWhatsAppMessage(
            phone,
            "Generando factura... Por favor espera."
          );

          try {
            const factura = await generarFactura({
              Receiver: {
                Rfc: datosFactura.rfc,
                CfdiUse: datosFactura.cfdiUse,
                Name: datosFactura.nombre,
                FiscalRegime: datosFactura.fiscalRegime,
                TaxZipCode: "78000",
              },
              Total: datosFactura.total,
              descripcion: "Servicio vía WhatsApp",
            });

            await sendWhatsAppMessage(
              phone,
              `✅ Factura generada con folio: ${factura.Folio || factura.Id}`
            );

            const { pdfPath } = await descargarFactura(factura.Id);
            const pdfMediaId = await uploadMediaToWhatsApp(
              pdfPath,
              "application/pdf"
            );
            await sendDocumentMessage(
              phone,
              pdfMediaId,
              `Factura-${factura.Folio || factura.Id}.pdf`
            );

            delete sessions[phone];
          } catch (error) {
            console.error("❌ Error generando factura:", error);

            let mensaje = "❌ Ocurrió un error generando la factura.";

            if (error.ModelState) {
              const detalles = Object.values(error.ModelState)
                .flat()
                .join("\n");
              mensaje += `\n\nDetalles:\n${detalles}`;
            } else if (error.message) {
              mensaje += `\n\n${error.message}`;
            }

            await sendWhatsAppMessage(phone, mensaje);

            if (
              error.ModelState &&
              Object.keys(error.ModelState).some((k) =>
                k.toLowerCase().includes("cfdiuse")
              )
            ) {
              session.estado = "PIDIENDO_CFDIUSE";
              await sendWhatsAppList(
                phone,
                "Selecciona un uso CFDI válido para el régimen fiscal:",
                "Usos disponibles",
                Object.entries(usosCfdi)
                  .map(([clave, label]) => ({
                    label,
                    value: clave,
                  }))
                  .slice(0, 10),
                "Uso CFDI"
              );
            } else {
              delete sessions[phone];
            }
          }
        } else if (msg === "cancelar") {
          await sendWhatsAppMessage(phone, "Generación de factura cancelada.");
          delete sessions[phone];
        } else {
          await sendWhatsAppMessage(
            phone,
            "Por favor responde CONFIRMAR o CANCELAR."
          );
        }
        break;

      case "REINTENTAR_REGIMEN":
        if (msg === "reintentar_regimen") {
          session.estado = "PIDIENDO_FISCALREGIME";
          const populares =
            session.tipoPersona === "personaFisica"
              ? popularesPersonaFisica
              : popularesPersonaMoral;

          const regimenes = Object.entries(
            regimenesFiscales[session.tipoPersona]
          )
            .filter(([clave]) => populares.includes(clave))
            .slice(0, 9)
            .map(([clave]) => ({
              label: `Régimen ${clave}`,
              value: `regimen_${clave}`,
            }));

          regimenes.push({
            label: "❓ No sé cuál es mi régimen",
            value: "regimen_ayuda",
          });

          await sendWhatsAppList(
            phone,
            "Selecciona el régimen fiscal:",
            "Regímenes disponibles",
            regimenes,
            "Régimen Fiscal"
          );
        } else {
          await sendWhatsAppMessage(phone, "Cancelado. Reiniciando...");
          delete sessions[phone];
        }
        break;

      case "REINTENTAR_CFDIUSE":
        if (msg === "reintentar_uso") {
          session.estado = "PIDIENDO_CFDIUSE";

          const usos = Object.entries(usosCfdi)
            .slice(0, 9)
            .map(([clave]) => ({
              label: `Uso ${clave}`,
              value: `uso_${clave}`,
            }));

          usos.push({
            label: "❓ No sé cuál es el uso CFDI",
            value: "uso_ayuda",
          });

          await sendWhatsAppList(
            phone,
            "Selecciona el uso del CFDI:",
            "Usos disponibles",
            usos,
            "Uso CFDI"
          );
        } else {
          await sendWhatsAppMessage(phone, "Cancelado. Reiniciando...");
          delete sessions[phone];
        }
        break;

      default:
        await sendWhatsAppMessage(phone, "Error inesperado, reiniciando...");
        delete sessions[phone];
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en flujo de factura:", error);
    await sendWhatsAppMessage(
      phone,
      "❌ Ocurrió un error, intenta nuevamente."
    );
    delete sessions[phone];
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
