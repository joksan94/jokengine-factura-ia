const {
  sendWhatsAppMessage,
  sendWhatsAppList,
  sendWhatsAppOptions,
  uploadMediaToWhatsApp,
  sendDocumentMessage,
} = require("../services/whatsappService");
const {
  generarFactura,
  descargarFactura,
  guardarFacturaEnFirestore,
  obtenerFacturasPorUsuario,
  obtenerSiguienteFolio,
} = require("../services/facturacionService");
const {
  regimenesFiscales,
  usosCfdi,
  popularesPersonaFisica,
  popularesPersonaMoral,
} = require("../constants/fiscalConstants");
const { deleteSession } = require("../utils/sessionManager");
const { db } = require("../config/firebase");

async function obtenerNegocioPorTelefono(phoneTo) {
  try {
    const negociosSnapshot = await db
      .collection("negocios")
      .where("telefono", "==", phoneTo)
      .get();

    if (negociosSnapshot.empty) {
      throw new Error(`No se encontró un negocio con el teléfono: ${phoneTo}`);
    }

    const negocioDoc = negociosSnapshot.docs[0];
    return { id: negocioDoc.id, ...negocioDoc.data() };
  } catch (error) {
    console.error("❌ Error al obtener negocio por teléfono:", error.message);
    throw error;
  }
}

async function handleMenuInicial(phone, session, phoneTo) {
  try {
    // Validar el número de teléfono del negocio
    const negocio = await obtenerNegocioPorTelefono(phoneTo);
    console.log("✅ Negocio encontrado:", negocio);

    // Guardar la información del negocio en la sesión
    session.negocio = negocio;
    console.log("✅ Negocio guardado en la sesión:", session.negocio);

    // Continuar con el flujo después de validar el negocio
    await sendWhatsAppMessage(
      phone,
      `Hola, bienvenido a ${negocio.nombre}.\n` +
        `¿Qué deseas hacer?\n` +
        `1️⃣ Consultar factura (no implementado)\n` +
        `2️⃣ Generar factura\n\n` +
        `Por favor responde con 1 o 2.`
    );

    session.estado = "ESPERANDO_OPCION";
  } catch (error) {
    console.error("❌ Error en handleMenuInicial:", error.message);

    // Enviar mensaje de error al usuario
    await sendWhatsAppMessage(
      phone,
      "❌ Ocurrió un error al validar el negocio. Por favor intenta más tarde."
    );
  }
}

async function handleEsperandoOpcion(phone, msg, session) {
  if (msg === "1" || msg.includes("consultar")) {
    const negocio = session.negocio; // Obtener el negocio desde la sesión

    if (!negocio) {
      console.error("❌ No se encontró información del negocio en la sesión.");
      await sendWhatsAppMessage(
        phone,
        "❌ No se pudo identificar el negocio. Por favor, reinicia el flujo."
      );
      return;
    }

    try {
      // Obtener las facturas del usuario
      const facturas = await obtenerFacturasPorUsuario(phone, negocio.id);

      if (facturas.length === 0) {
        await sendWhatsAppMessage(
          phone,
          "No se encontraron facturas asociadas a tu número de teléfono."
        );
      } else {
        // Construir la lista de facturas
        const listaFacturas = facturas
          .slice(0, 10) // Limitar a las primeras 10 facturas
          .map(
            (factura, index) =>
              `${index + 1}. Folio: ${
                factura.folio
              }, Total: $${factura.total.toFixed(2)}, Fecha: ${factura.fecha
                .toDate()
                .toLocaleDateString()}`
          )
          .join("\n");

        await sendWhatsAppMessage(
          phone,
          `📄 Tus facturas:\n\n${listaFacturas}\n\nResponde con el número de la factura para descargar el PDF.`
        );

        session.facturas = facturas; // Guardar las facturas en la sesión
        session.estado = "ESPERANDO_FACTURA";
      }
    } catch (error) {
      console.error("❌ Error al consultar facturas:", error.message);
      await sendWhatsAppMessage(
        phone,
        "❌ Ocurrió un error al consultar tus facturas. Por favor intenta más tarde."
      );
    }
  } else if (msg === "2" || msg.includes("generar")) {
    await sendWhatsAppMessage(
      phone,
      "Por favor proporciona el RFC del receptor:"
    );
    session.estado = "PIDIENDO_RFC";
  } else {
    await sendWhatsAppMessage(phone, "Opción no válida. Responde 1 o 2.");
  }
}

async function handlePidiendoRFC(phone, msgText, session) {
  session.datosFactura.rfc = msgText.toUpperCase();
  await sendWhatsAppMessage(phone, "Ahora proporciona el nombre del receptor:");
  session.estado = "PIDIENDO_NOMBRE";
}

async function handlePidiendoNombre(phone, msgText, session) {
  session.datosFactura.nombre = msgText;
  session.estado = "PIDIENDO_TIPO_PERSONA";
  await sendWhatsAppOptions(phone, "¿Qué tipo de persona eres?", [
    { label: "Persona Física", value: "tipo_fisica" },
    { label: "Persona Moral", value: "tipo_moral" },
  ]);
}

async function handlePidiendoTipoPersona(phone, msg, session) {
  if (msg === "tipo_fisica") {
    session.tipoPersona = "personaFisica";
  } else if (msg === "tipo_moral") {
    session.tipoPersona = "personaMoral";
  } else {
    await sendWhatsAppMessage(phone, "Opción inválida. Intenta nuevamente.");
    return;
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
}

async function handlePidiendoFiscalRegime(phone, msg, session) {
  if (msg === "regimen_ayuda") {
    await sendWhatsAppMessage(
      phone,
      "Puedes consultar tu régimen fiscal en este enlace oficial del SAT:\n\n👉 https://www.cloudb.sat.gob.mx/datos_fiscales/regimen\n\n¿Deseas volver a ver la lista?"
    );

    await sendWhatsAppOptions(phone, "¿Qué deseas hacer?", [
      { label: "🔁 Mostrar lista de regímenes", value: "reintentar_regimen" },
      { label: "❌ Cancelar", value: "cancelar" },
    ]);
    session.estado = "REINTENTAR_REGIMEN";
    return;
  }

  if (!msg.startsWith("regimen_")) {
    await sendWhatsAppMessage(phone, "Opción inválida. Intenta nuevamente.");
    return;
  }

  const claveRegimen = msg.replace("regimen_", "").toUpperCase();
  const descripcionRegimen =
    regimenesFiscales[session.tipoPersona][claveRegimen];

  if (!descripcionRegimen) {
    await sendWhatsAppMessage(
      phone,
      "Régimen no reconocido. Intenta de nuevo."
    );
    return;
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
}

async function handlePidiendoCFDIUse(phone, msg, session) {
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
    await sendWhatsAppMessage(phone, "Opción inválida. Intenta nuevamente.");
    return;
  }

  const claveUso = msg.replace("uso_", "").toUpperCase();
  const descripcionUso = usosCfdi[claveUso];

  if (!descripcionUso) {
    await sendWhatsAppMessage(
      phone,
      "Uso CFDI no reconocido. Intenta de nuevo."
    );
    return;
  }

  session.datosFactura.cfdiUse = claveUso;

  await sendWhatsAppMessage(
    phone,
    `✅ Elegiste el uso CFDI ${claveUso}: ${descripcionUso}`
  );

  await sendWhatsAppMessage(phone, "Indica el total a facturar (solo número):");
  session.estado = "PIDIENDO_TOTAL";
}

async function handlePidiendoTotal(phone, msgText, session) {
  const totalNum = parseFloat(msgText.replace(/[^0-9.]/g, "").trim());
  if (isNaN(totalNum) || totalNum <= 0) {
    await sendWhatsAppMessage(
      phone,
      "Por favor ingresa un número válido para el total."
    );
    return;
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
}

async function handleEsperandoConfirmacion(phone, msg, session, phoneTo) {
  if (msg === "confirmar") {
    const datosFactura = session.datosFactura;
    const negocio = session.negocio; // Obtener el negocio desde la sesión

    if (!negocio) {
      console.error("❌ No se encontró información del negocio en la sesión.");
      await sendWhatsAppMessage(
        phone,
        "❌ No se pudo identificar el negocio. Por favor, reinicia el flujo."
      );
      return;
    }

    console.log("🔍 Generando factura para el negocio:", negocio);

    if (!datosFactura.total || datosFactura.total <= 0) {
      await sendWhatsAppMessage(phone, "❌ El total debe ser mayor a $0.");
      deleteSession(phone);
      return;
    }

    await sendWhatsAppMessage(phone, "Generando factura... Por favor espera.");

    try {
      // Obtener el siguiente folio
      const { nuevoFolio, folioSecuencial } = await obtenerSiguienteFolio(
        negocio.id,
        negocio.nombre
          .split(" ")
          .map((palabra) => palabra[0])
          .join("")
          .toUpperCase()
      );

      console.log(`📄 Generando factura con folio: ${nuevoFolio}`);

      // Generar la factura
      const factura = await generarFactura(
        negocio,
        {
          Receiver: {
            Rfc: datosFactura.rfc,
            CfdiUse: datosFactura.cfdiUse,
            Name: datosFactura.nombre,
            FiscalRegime: datosFactura.fiscalRegime,
            TaxZipCode: negocio.codigoPostal || "78000", // Usar datos del negocio
          },
          Total: datosFactura.total,
        },
        "Servicio vía WhatsApp"
      );

      // Descargar el PDF de la factura
      const { pdfPath } = await descargarFactura(factura.Id);

      // Guardar la factura en Firestore
      await guardarFacturaEnFirestore(
        negocio.id,
        factura,
        nuevoFolio,
        folioSecuencial,
        phone // Pasar el número del remitente
      );

      // Enviar la factura al usuario
      const pdfMediaId = await uploadMediaToWhatsApp(
        pdfPath,
        "application/pdf"
      );
      await sendDocumentMessage(
        phone,
        pdfMediaId,
        `Factura-${factura.Folio || factura.Id}.pdf`
      );

      await sendWhatsAppMessage(
        phone,
        `✅ Factura generada con folio: ${factura.Folio || factura.Id}`
      );

      deleteSession(phone);
    } catch (error) {
      console.error("❌ Error generando factura:", error);

      let mensaje = "❌ Ocurrió un error generando la factura.";

      if (error.ModelState) {
        const detalles = Object.values(error.ModelState).flat().join("\n");
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
        deleteSession(phone);
      }
    }
  } else if (msg === "cancelar") {
    await sendWhatsAppMessage(phone, "Generación de factura cancelada.");
    deleteSession(phone);
  } else {
    await sendWhatsAppMessage(
      phone,
      "Por favor responde CONFIRMAR o CANCELAR."
    );
  }
}

async function handleReintentarRegimen(phone, msg, session) {
  if (msg === "reintentar_regimen") {
    session.estado = "PIDIENDO_FISCALREGIME";
    const populares =
      session.tipoPersona === "personaFisica"
        ? popularesPersonaFisica
        : popularesPersonaMoral;

    const regimenes = Object.entries(regimenesFiscales[session.tipoPersona])
      .filter(([clave]) => populares.includes(clave))
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
  } else {
    await sendWhatsAppMessage(phone, "Cancelado. Reiniciando...");
    deleteSession(phone);
  }
}

async function handleReintentarCFDIUse(phone, msg, session) {
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
    deleteSession(phone);
  }
}

async function handleEsperandoFactura(phone, msg, session) {
  console.log("🔍 Manejo de estado: ESPERANDO_FACTURA", session);
  try {
    // Validar que las facturas estén en la sesión
    if (!session.facturas || session.facturas.length === 0) {
      console.error("❌ No hay facturas en la sesión.");
      await sendWhatsAppMessage(
        phone,
        "No se encontraron facturas en tu sesión. Por favor, reinicia el flujo."
      );
      session.estado = "MENU_INICIAL";
      return;
    }

    console.log("📄 Facturas en la sesión:", session.facturas);

    // Validar la selección del usuario
    const seleccion = parseInt(msg.trim(), 10);
    if (
      isNaN(seleccion) ||
      seleccion < 1 ||
      seleccion > session.facturas.length
    ) {
      console.error("❌ Selección inválida:", seleccion);
      await sendWhatsAppMessage(
        phone,
        "Opción inválida. Por favor responde con el número de la factura que deseas descargar."
      );
      return;
    }

    const facturaSeleccionada = session.facturas[seleccion - 1];
    console.log("✅ Factura seleccionada:", facturaSeleccionada);

    // Validar que el facturaId esté definido
    if (!facturaSeleccionada.facturaId) {
      console.error("❌ facturaId no definido en la factura seleccionada.");
      await sendWhatsAppMessage(
        phone,
        "No se pudo encontrar el identificador de la factura. Por favor, intenta más tarde."
      );
      session.estado = "MENU_INICIAL";
      return;
    }

    // Descargar el PDF desde Facturama usando el facturaId
    try {
      console.log("📥 Descargando PDF desde Facturama...");
      const { pdfPath, filename } = await descargarFactura(
        facturaSeleccionada.facturaId
      );

      console.log("✅ PDF descargado:", pdfPath);

      // Enviar el PDF al usuario
      console.log("📤 Enviando PDF al usuario...");
      const pdfMediaId = await uploadMediaToWhatsApp(
        pdfPath,
        "application/pdf"
      );
      await sendDocumentMessage(phone, pdfMediaId, filename);

      await sendWhatsAppMessage(
        phone,
        `✅ Factura con folio ${facturaSeleccionada.folio} enviada correctamente.`
      );

      session.estado = "MENU_INICIAL"; // Regresar al menú inicial
    } catch (error) {
      console.error("❌ Error al descargar o enviar el PDF:", error.message);
      await sendWhatsAppMessage(
        phone,
        "❌ Ocurrió un error al descargar la factura. Por favor intenta más tarde."
      );
      session.estado = "MENU_INICIAL";
    }
  } catch (error) {
    console.error("❌ Error en handleEsperandoFactura:", error.message);
    await sendWhatsAppMessage(phone, "❌ Error inesperado, reiniciando...");
    session.estado = "MENU_INICIAL"; // Reiniciar el flujo
  }
}

async function handleEsperandoOpcion(phone, msg, session) {
  if (msg === "1" || msg.includes("consultar")) {
    const negocio = session.negocio; // Obtener el negocio desde la sesión

    if (!negocio) {
      console.error("❌ No se encontró información del negocio en la sesión.");
      await sendWhatsAppMessage(
        phone,
        "❌ No se pudo identificar el negocio. Por favor, reinicia el flujo."
      );
      return;
    }

    try {
      // Obtener las facturas del usuario
      const facturas = await obtenerFacturasPorUsuario(phone, negocio.id);

      if (facturas.length === 0) {
        await sendWhatsAppMessage(
          phone,
          "No se encontraron facturas asociadas a tu número de teléfono."
        );
      } else {
        // Construir la lista de facturas
        const listaFacturas = facturas
          .slice(0, 10) // Limitar a las primeras 10 facturas
          .map(
            (factura, index) =>
              `${index + 1}. Folio: ${
                factura.folio
              }, Total: $${factura.total.toFixed(2)}, Fecha: ${factura.fecha
                .toDate()
                .toLocaleDateString()}`
          )
          .join("\n");

        await sendWhatsAppMessage(
          phone,
          `📄 Tus facturas:\n\n${listaFacturas}\n\nResponde con el número de la factura para descargar el PDF.`
        );

        session.facturas = facturas; // Guardar las facturas en la sesión
        session.estado = "ESPERANDO_FACTURA";
      }
    } catch (error) {
      console.error("❌ Error al consultar facturas:", error.message);
      await sendWhatsAppMessage(
        phone,
        "❌ Ocurrió un error al consultar tus facturas. Por favor intenta más tarde."
      );
    }
  } else if (msg === "2" || msg.includes("generar")) {
    await sendWhatsAppMessage(
      phone,
      "Por favor proporciona el RFC del receptor:"
    );
    session.estado = "PIDIENDO_RFC";
  } else {
    await sendWhatsAppMessage(phone, "Opción no válida. Responde 1 o 2.");
  }
}

module.exports = {
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
};
