// ======================
// IMPORTS Y CONSTANTES
// ======================
// ======================
// IMPORTS Y CONSTANTES (únicos y agrupados)
// ======================
const {
  guardarDatosFiscalesCliente,
  obtenerDatosFiscalesCliente,
} = require("../services/datosFiscalesClienteService");
const {
  guardarRFCCliente,
  obtenerRFCCliente,
} = require("../services/rfcClienteService");
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

// --- Handler para CONFIRMAR_DATOS_FISCALES_GUARDADOS ---
async function handleConfirmarDatosFiscalesGuardados(phone, msg, session) {
  const negocioId = session.negocio?.id;
  const msgNorm = (msg || "").toLowerCase().replace(/\s+/g, "");
  if (msgNorm === "usar_todo_igual") {
    // Limpiar duplicados y unificar campos antes de guardar
    if (session.datosFactura) {
      session.datosFactura.regimenFiscal =
        session.datosFactura.regimenFiscal || session.datosFactura.fiscalRegime;
      session.datosFactura.usoCfdi =
        session.datosFactura.usoCfdi || session.datosFactura.cfdiUse;
      delete session.datosFactura.fiscalRegime;
      delete session.datosFactura.cfdiUse;
    }
    await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
    await sendWhatsAppMessage(
      phone,
      "Por favor, proporciona el *folio de la venta* para facturar:"
    );
    session.estado = "PIDIENDO_FOLIO_VENTA";
  } else if (msgNorm === "actualizar_rfc") {
    await sendWhatsAppMessage(phone, "Por favor, proporciona el nuevo *RFC*:");
    session.estado = "ACTUALIZANDO_RFC";
  } else if (msgNorm === "actualizar_nombre") {
    await sendWhatsAppMessage(
      phone,
      "Por favor, proporciona el nuevo *nombre del receptor*:"
    );
    session.estado = "ACTUALIZANDO_NOMBRE";
  } else if (msgNorm === "actualizar_tipo_persona") {
    await sendWhatsAppOptions(phone, "Selecciona el tipo de persona:", [
      { label: "Persona Física", value: "tipo_fisica" },
      { label: "Persona Moral", value: "tipo_moral" },
    ]);
    session.estado = "ACTUALIZANDO_TIPO_PERSONA";
  } else if (msgNorm === "actualizar_regimen") {
    const tipoPersona = session.datosFactura?.tipoPersona || "personaFisica";
    const regimenes = Object.entries(regimenesFiscales[tipoPersona])
      .filter(([clave]) =>
        tipoPersona === "personaFisica"
          ? popularesPersonaFisica.includes(clave)
          : popularesPersonaMoral.includes(clave)
      )
      .slice(0, 9)
      .map(([clave]) => ({
        label: `Régimen ${clave}`,
        value: `regimen_${clave}`,
      }));
    regimenes.push({ label: "Ayuda con mi régimen", value: "regimen_ayuda" });
    await sendWhatsAppList(
      phone,
      "Selecciona el nuevo régimen fiscal:",
      "Regímenes disponibles",
      regimenes,
      "Régimen Fiscal"
    );
    session.estado = "ACTUALIZANDO_REGIMEN";
  } else if (msgNorm === "actualizar_uso_cfdi") {
    // Mostrar listado de usos CFDI igual que el flujo normal
    // Limitar a máximo 10 filas (9 usos + ayuda)
    const usos = Object.entries(usosCfdi)
      .slice(0, 9)
      .map(([clave, nombre]) => ({
        label: `Uso ${clave} - ${nombre}`,
        value: `uso_${clave}`,
      }));
    usos.push({ label: "Ayuda con uso CFDI", value: "uso_ayuda" });
    await sendWhatsAppList(
      phone,
      "Selecciona el nuevo uso CFDI:",
      "Usos disponibles",
      usos,
      "Uso CFDI"
    );
    session.estado = "ACTUALIZANDO_USO_CFDI";
  } else {
    await sendWhatsAppMessage(
      phone,
      "Opción inválida. Selecciona una opción válida."
    );
  }
}

// ======================
// HELPERS
// ======================
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

async function validarAdmin(phone) {
  const negociosSnap = await db.collection("negocios").get();
  for (const doc of negociosSnap.docs) {
    const negocioId = doc.id;
    const usuariosSnap = await db
      .collection("negocios")
      .doc(negocioId)
      .collection("usuarios")
      .where("telefono", "==", phone)
      .limit(1)
      .get();
    if (!usuariosSnap.empty) {
      const usuario = usuariosSnap.docs[0].data();
      return { negocioId, usuario };
    }
  }
  return null;
}

// ======================
// HANDLERS DE FLUJO PRINCIPAL
// ======================

// --- MENÚ Y OPCIONES INICIALES ---
// handleMenuInicial
// handleEsperandoOpcion
// handleEsperandoFactura

// --- CAPTURA DE DATOS FISCALES INICIAL ---
// handlePidiendoRFC
// handlePidiendoNombre
// handlePidiendoTipoPersona
// handlePidiendoFiscalRegime
// handlePidiendoCFDIUse
// handlePidiendoTotal
// handleEsperandoConfirmacion

// --- ACTUALIZACIÓN DE DATOS FISCALES ---
// handleConfirmarDatosFiscalesGuardados
// handleActualizandoRFC
// handleActualizandoNombre
// handleActualizandoTipoPersona
// handleActualizandoRegimen
// handleActualizandoUsoCFDI

// --- REINTENTOS Y FLUJOS DE AYUDA ---
// handleReintentarRegimen
// handleReintentarCFDIUse

// --- CONFIRMACIÓN DE RFC GUARDADO ---
// handleConfirmarRFCGuardado

// ======================
// HANDLERS IMPLEMENTADOS
// ======================
// ...existing code...

// Handlers para cada actualización individual
async function handleActualizandoRFC(phone, msgText, session) {
  session.datosFactura.rfc = msgText.toUpperCase();
  // Guardar en Firestore
  const negocioId = session.negocio?.id;
  if (negocioId) {
    await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
  }
  await sendWhatsAppMessage(
    phone,
    "RFC actualizado. ¿Deseas actualizar otro dato o continuar?"
  );
  const items = [
    { label: "Continuar con estos datos", value: "usar_todo_igual" },
    { label: "Actualizar nombre", value: "actualizar_nombre" },
    { label: "Actualizar régimen fiscal", value: "actualizar_regimen" },
    { label: "Actualizar RFC", value: "actualizar_rfc" },
    { label: "Actualizar tipo de persona", value: "actualizar_tipo_persona" },
    { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
  ];
  await sendWhatsAppList(
    phone,
    "¿Deseas actualizar otro dato o continuar?",
    "Opciones de actualización",
    items,
    "Opciones"
  );
  session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
}

async function handleActualizandoNombre(phone, msgText, session) {
  session.datosFactura.nombre = msgText;
  // Guardar en Firestore
  const negocioId = session.negocio?.id;
  if (negocioId) {
    await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
  }
  await sendWhatsAppMessage(
    phone,
    "Nombre actualizado. ¿Deseas actualizar otro dato o continuar?"
  );
  const items = [
    { label: "Continuar con estos datos", value: "usar_todo_igual" },
    { label: "Actualizar nombre", value: "actualizar_nombre" },
    { label: "Actualizar régimen fiscal", value: "actualizar_regimen" },
    { label: "Actualizar RFC", value: "actualizar_rfc" },
    { label: "Actualizar tipo de persona", value: "actualizar_tipo_persona" },
    { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
  ];
  await sendWhatsAppList(
    phone,
    "¿Deseas actualizar otro dato o continuar?",
    "Opciones de actualización",
    items,
    "Opciones"
  );
  session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
}

async function handleActualizandoTipoPersona(phone, msg, session) {
  if (msg === "tipo_fisica") {
    session.datosFactura.tipoPersona = "Persona Física";
  } else if (msg === "tipo_moral") {
    session.datosFactura.tipoPersona = "Persona Moral";
  } else {
    await sendWhatsAppMessage(phone, "Opción inválida. Intenta nuevamente.");
    return;
  }
  await sendWhatsAppMessage(
    phone,
    "Tipo de persona actualizado. ¿Deseas actualizar otro dato o continuar?"
  );
  const items = [
    { label: "Continuar con estos datos", value: "usar_todo_igual" },
    { label: "Actualizar nombre", value: "actualizar_nombre" },
    { label: "Actualizar régimen fiscal", value: "actualizar_regimen" },
    { label: "Actualizar RFC", value: "actualizar_rfc" },
    { label: "Actualizar tipo de persona", value: "actualizar_tipo_persona" },
    { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
  ];
  await sendWhatsAppList(
    phone,
    "¿Deseas actualizar otro dato o continuar?",
    "Opciones de actualización",
    items,
    "Opciones"
  );
  session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
}

async function handleActualizandoRegimen(phone, msgText, session) {
  if (!msgText || typeof msgText !== "string") {
    console.log("[LOG] handleActualizandoRegimen: msgText inválido", msgText);
    await sendWhatsAppMessage(
      phone,
      "Opción inválida. Selecciona un régimen fiscal del listado."
    );
    return;
  }
  console.log("[LOG] handleActualizandoRegimen: msgText recibido:", msgText);
  let tipoPersonaRaw = session.datosFactura?.tipoPersona || "personaFisica";
  let tipoPersona = "personaFisica";
  if (typeof tipoPersonaRaw === "string") {
    const norm = tipoPersonaRaw.trim().toLowerCase();
    if (norm === "persona moral" || norm === "personamoral")
      tipoPersona = "personaMoral";
    else if (norm === "persona física" || norm === "personafisica")
      tipoPersona = "personaFisica";
    else if (norm === "personamoral") tipoPersona = "personaMoral";
    else if (norm === "personafisica") tipoPersona = "personaFisica";
  }
  const catalogo = regimenesFiscales[tipoPersona];
  console.log("[LOG] handleActualizandoRegimen: tipoPersona:", tipoPersona);
  console.log(
    "[LOG] handleActualizandoRegimen: catálogo:",
    Object.keys(catalogo)
  );
  const labelsValidos = Object.entries(catalogo)
    .filter(([c]) =>
      tipoPersona === "personaFisica"
        ? popularesPersonaFisica.includes(c)
        : popularesPersonaMoral.includes(c)
    )
    .slice(0, 9)
    .map(([c]) => `Régimen ${c}`.toLowerCase());
  console.log("[LOG] handleActualizandoRegimen: labelsValidos:", labelsValidos);
  if (labelsValidos.includes(msgText.trim().toLowerCase())) {
    const match = msgText
      .trim()
      .toLowerCase()
      .match(/régimen\s*(\d{3})/);
    if (match) {
      msgText = `regimen_${match[1]}`;
      console.log(
        "[LOG] handleActualizandoRegimen: msgText convertido a value:",
        msgText
      );
    }
  }
  const limpio = msgText
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  console.log("[LOG] handleActualizandoRegimen: limpio:", limpio);
  let clave = null;
  if (limpio.startsWith("regimen_")) {
    clave = limpio.replace("regimen_", "").replace(/[^0-9]/g, "");
    console.log("[LOG] handleActualizandoRegimen: clave por value:", clave);
  } else if (/^regimen\s*\d{3}$/.test(limpio)) {
    const match = limpio.match(/regimen\s*(\d{3})$/);
    if (match) clave = match[1];
    console.log("[LOG] handleActualizandoRegimen: clave por regex 2:", clave);
  } else if (/regimen\s*\d{3}/.test(limpio)) {
    const match = limpio.match(/regimen\s*(\d{3})/);
    if (match) clave = match[1];
    console.log("[LOG] handleActualizandoRegimen: clave por regex 3:", clave);
  } else if (/^\d{3}$/.test(limpio)) {
    clave = limpio;
    console.log(
      "[LOG] handleActualizandoRegimen: clave por solo número:",
      clave
    );
  } else {
    const match = limpio.match(/(\d{3})/);
    if (match) clave = match[1];
    console.log("[LOG] handleActualizandoRegimen: clave por regex 5:", clave);
  }
  if (!clave) {
    let tipoPersonaRaw = session.datosFactura?.tipoPersona || "personaFisica";
    let tipoPersona = "personaFisica";
    if (typeof tipoPersonaRaw === "string") {
      const norm = tipoPersonaRaw.trim().toLowerCase();
      if (norm === "persona moral" || norm === "personamoral")
        tipoPersona = "personaMoral";
      else if (norm === "persona física" || norm === "personafisica")
        tipoPersona = "personaFisica";
      else if (norm === "personamoral") tipoPersona = "personaMoral";
      else if (norm === "personafisica") tipoPersona = "personaFisica";
    }
    const catalogo = regimenesFiscales[tipoPersona];
    for (const [k, v] of Object.entries(catalogo)) {
      const nombreRegimen = v
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (limpio === nombreRegimen) {
        clave = k;
        console.log(
          "[LOG] handleActualizandoRegimen: clave por nombreRegimen:",
          clave
        );
        break;
      }
    }
    console.log(
      "[LOG] handleActualizandoRegimen: clave después de buscar por nombre:",
      clave
    );
  }
  if (clave) clave = String(clave).trim();
  console.log(
    "[LOG] handleActualizandoRegimen: clave final antes de validar:",
    clave
  );
  if (clave && clave.length === 3 && /^[0-9]{3}$/.test(clave)) {
    if (clave)
      clave = String(clave)
        .replace(/[^0-9]/g, "")
        .trim();
    console.log("[LOG] handleActualizandoRegimen: clave validada:", clave);
    if (!clave || clave.length !== 3 || !catalogo[clave]) {
      console.log(
        "[LOG] handleActualizandoRegimen: clave recibida:",
        clave,
        "| catálogo:",
        Object.keys(catalogo)
      );
      let motivo = "";
      if (!clave) motivo = "No se pudo extraer el número de régimen.";
      else if (!catalogo[clave])
        motivo = `El régimen ${clave} no está en el catálogo.`;
      await sendWhatsAppMessage(
        phone,
        `Opción inválida. ${motivo} Selecciona un régimen fiscal del listado.`
      );
      const regimenes = Object.entries(catalogo).map(([c]) => ({
        label: `Régimen ${c} - ${catalogo[c]}`,
        value: `regimen_${c}`,
      }));
      regimenes.push({ label: "Ayuda con mi régimen", value: "regimen_ayuda" });
      await sendWhatsAppList(
        phone,
        "Selecciona el régimen fiscal:",
        "Regímenes disponibles",
        regimenes,
        "Régimen Fiscal"
      );
      session.estado = "PIDIENDO_FISCALREGIME";
      return;
    }
    session.datosFactura.regimenFiscal = clave;
    delete session.datosFactura.fiscalRegime;
    const negocioId = session.negocio?.id;
    if (negocioId) {
      await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
    }
    const resumen =
      `Ya tenemos tus datos fiscales guardados:\n` +
      `RFC: ${session.datosFactura.rfc}\n` +
      `Nombre: ${session.datosFactura.nombre}\n` +
      `Tipo de persona: ${session.datosFactura.tipoPersona}\n` +
      `Régimen Fiscal: ${session.datosFactura.regimenFiscal}\n` +
      `Uso CFDI: ${session.datosFactura.usoCfdi}\n`;
    await sendWhatsAppMessage(phone, resumen);
    const items = [
      { label: "Usar estos datos", value: "usar_todo_igual" },
      { label: "Actualizar nombre", value: "actualizar_nombre" },
      { label: "régimen fiscal", value: "actualizar_regimen" },
      { label: "Actualizar RFC", value: "actualizar_rfc" },
      { label: "tipo de persona", value: "actualizar_tipo_persona" },
      { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
    ];
    await sendWhatsAppList(
      phone,
      "¿Qué deseas hacer?",
      "Opciones de actualización",
      items,
      "Opciones"
    );
    session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
  }
}

async function handleActualizandoUsoCFDI(phone, msgText, session) {
  console.log("[LOG] handleActualizandoUsoCFDI: msgText recibido:", msgText);
  let limpio = (msgText || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  console.log("[LOG] handleActualizandoUsoCFDI: limpio:", limpio);
  let clave = null;
  if (limpio.startsWith("uso_")) {
    clave = limpio.replace("uso_", "").toUpperCase();
    console.log("[LOG] handleActualizandoUsoCFDI: clave por value:", clave);
  } else if (/^g0[1-3]$|^i0[1-4]$|^d0[1-4]$|^p01$|^s01$/.test(limpio)) {
    clave = limpio.toUpperCase();
    console.log("[LOG] handleActualizandoUsoCFDI: clave por regex:", clave);
  } else {
    // Buscar por nombre
    for (const [k, v] of Object.entries(usosCfdi)) {
      const nombreUso = v
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (limpio === nombreUso || limpio.includes(nombreUso)) {
        clave = k;
        console.log(
          "[LOG] handleActualizandoUsoCFDI: clave por nombreUso:",
          clave
        );
        break;
      }
    }
  }
  console.log(
    "[LOG] handleActualizandoUsoCFDI: clave final antes de validar:",
    clave
  );
  if (clave && usosCfdi[clave]) {
    session.datosFactura.usoCfdi = clave;
    delete session.datosFactura.cfdiUse;
    // Guardar en Firestore
    const negocioId = session.negocio?.id;
    if (negocioId) {
      await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
    }
    await sendWhatsAppMessage(
      phone,
      `✅ Uso CFDI actualizado: ${clave} - ${usosCfdi[clave]}\n¿Deseas actualizar otro dato o continuar?`
    );
    const items = [
      { label: "Continuar con estos datos", value: "usar_todo_igual" },
      { label: "Actualizar nombre", value: "actualizar_nombre" },
      { label: "Actualizar régimen fiscal", value: "actualizar_regimen" },
      { label: "Actualizar RFC", value: "actualizar_rfc" },
      { label: "Actualizar tipo de persona", value: "actualizar_tipo_persona" },
      { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
    ];
    await sendWhatsAppList(
      phone,
      "¿Deseas actualizar otro dato o continuar?",
      "Opciones de actualización",
      items,
      "Opciones"
    );
    session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
  } else {
    let motivo = "";
    if (!clave) motivo = "No se pudo extraer la clave de uso CFDI.";
    else if (!usosCfdi[clave])
      motivo = `El uso CFDI ${clave} no está en el catálogo.`;
    await sendWhatsAppMessage(
      phone,
      `Opción inválida. ${motivo} Selecciona un uso CFDI del listado.`
    );
    const usos = Object.entries(usosCfdi).map(([c, v]) => ({
      label: `Uso ${c} - ${v}`,
      value: `uso_${c}`,
    }));
    usos.push({ label: "Ayuda con uso CFDI", value: "uso_ayuda" });
    await sendWhatsAppList(
      phone,
      "Selecciona el uso CFDI:",
      "Usos disponibles",
      usos,
      "Uso CFDI"
    );
    session.estado = "ACTUALIZANDO_USO_CFDI";
  }
}
// --- FIN DE IMPORTS ---

// ======================
// HANDLERS IMPLEMENTADOS
// ======================

async function handleConfirmarRFCGuardado(phone, msg, session) {
  const negocioId = session.negocio?.id;
  const msgNorm = (msg || "").toLowerCase().replace(/\s+/g, "");
  console.log(
    "[handleConfirmarRFCGuardado] msg recibido:",
    msg,
    "| normalizado:",
    msgNorm
  );
  const rfcGuardado = await obtenerRFCCliente(negocioId, phone);
  if (rfcGuardado) {
    session.datosFactura.rfc = rfcGuardado;
    await sendWhatsAppMessage(
      phone,
      "Perfecto, continuamos con tu RFC guardado: *" +
        session.datosFactura.rfc +
        "*\nAhora proporciona el nombre del receptor:"
    );
    session.estado = "PIDIENDO_NOMBRE";
  } else if (msgNorm === "actualizar_rfc") {
    // Actualizar RFC en Firestore
    const nuevoRFC = session.datosFactura.rfc;
    if (!negocioId) {
      await sendWhatsAppMessage(
        phone,
        "No se pudo identificar el negocio. Intenta más tarde."
      );
      return;
    }
    await guardarRFCCliente(negocioId, phone, nuevoRFC);
    await sendWhatsAppMessage(
      phone,
      "✅ RFC actualizado correctamente. Ahora proporciona el nombre del receptor:"
    );
    session.estado = "PIDIENDO_NOMBRE";
  } else {
    await sendWhatsAppMessage(
      phone,
      "Opción inválida. Selecciona una opción válida."
    );
  }
}
// ...imports ya agrupados arriba...

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

async function validarAdmin(phone) {
  const negociosSnap = await db.collection("negocios").get();

  for (const doc of negociosSnap.docs) {
    const negocioId = doc.id;
    const usuariosSnap = await db
      .collection("negocios")
      .doc(negocioId)
      .collection("usuarios")
      .where("telefono", "==", phone)
      .limit(1)
      .get();

    if (!usuariosSnap.empty) {
      const usuario = usuariosSnap.docs[0].data();
      return { negocioId, usuario };
    }
  }

  return null; // No es un usuario interno
}

async function handleMenuInicial(phone, session, phoneTo) {
  try {
    // Validar el número de teléfono del negocio
    const negocio = await obtenerNegocioPorTelefono(phoneTo);
    console.log("✅ Negocio encontrado:", negocio);

    // Guardar la información del negocio en la sesión
    session.negocio = negocio;
    console.log("✅ Negocio guardado en la sesión:", session.negocio);

    // Enviar mensaje de bienvenida con botones
    await sendWhatsAppOptions(
      phone,
      `👋 ¡Hola! Bienvenido a ${negocio.nombre}.\n¿Qué deseas hacer hoy?`,
      [
        { label: "Consultar facturas", value: "1" },
        { label: "Generar factura", value: "2" },
      ]
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
        // Folio y total juntos en el label para máxima visibilidad
        const items = facturas.slice(0, 10).map((factura, index) => {
          const folio = factura.folio;
          const total = factura.total.toLocaleString("es-MX", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          return {
            label: `${folio} $${total}`,
            value: `factura_${index}`,
          };
        });
        await sendWhatsAppList(
          phone,
          "Selecciona la factura que deseas descargar:",
          "Tus facturas",
          items,
          "Facturas"
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
    // Validar datos fiscales guardados en clientes del negocio antes de pedirlos
    const negocioId = session.negocio?.id;
    if (!negocioId) {
      await sendWhatsAppMessage(
        phone,
        "No se pudo identificar el negocio. Intenta más tarde."
      );
      return;
    }
    const datosGuardados = await obtenerDatosFiscalesCliente(negocioId, phone);
    // Unificar nombres de campos para aceptar ambos posibles (cfdiUse/usoCfdi y fiscalRegime/regimenFiscal)
    const rfc = datosGuardados?.rfc;
    const nombre = datosGuardados?.nombre;
    const tipoPersona = datosGuardados?.tipoPersona;
    const regimenFiscal =
      datosGuardados?.regimenFiscal || datosGuardados?.fiscalRegime;
    const usoCfdi = datosGuardados?.usoCfdi || datosGuardados?.cfdiUse;
    if (rfc && nombre && tipoPersona && regimenFiscal && usoCfdi) {
      // Mostrar resumen y opciones
      const resumen =
        `Ya tenemos tus datos fiscales guardados:\n` +
        `RFC: ${rfc}\n` +
        `Nombre: ${nombre}\n` +
        `Tipo de persona: ${tipoPersona}\n` +
        `Régimen Fiscal: ${regimenFiscal}\n` +
        `Uso CFDI: ${usoCfdi}\n`;
      await sendWhatsAppMessage(phone, resumen);
      const items = [
        { label: "Usar estos datos", value: "usar_todo_igual" },
        { label: "Actualizar nombre", value: "actualizar_nombre" },
        { label: "régimen fiscal", value: "actualizar_regimen" },
        { label: "Actualizar RFC", value: "actualizar_rfc" },
        {
          label: "tipo de persona",
          value: "actualizar_tipo_persona",
        },
        { label: "Actualizar uso CFDI", value: "actualizar_uso_cfdi" },
      ];
      await sendWhatsAppList(
        phone,
        "¿Qué deseas hacer?",
        "Opciones de actualización",
        items,
        "Opciones"
      );
      session.datosFactura = {
        rfc,
        nombre,
        tipoPersona,
        regimenFiscal,
        usoCfdi,
      };
      session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
    } else {
      // Preguntar solo por los datos faltantes
      session.datosFactura = session.datosFactura || {};
      if (!datosGuardados || !datosGuardados.rfc) {
        await sendWhatsAppMessage(
          phone,
          "Por favor, proporciona tu *RFC* para continuar con la factura:"
        );
        session.estado = "PIDIENDO_RFC";
      } else if (!datosGuardados.nombre) {
        session.datosFactura.rfc = datosGuardados.rfc;
        await sendWhatsAppMessage(
          phone,
          "Por favor, proporciona el *nombre del receptor* para la factura:"
        );
        session.estado = "PIDIENDO_NOMBRE";
      } else if (!tipoPersona && rfc && nombre && regimenFiscal && usoCfdi) {
        // Si solo falta tipoPersona, pedir solo ese campo
        session.datosFactura = {
          rfc,
          nombre,
          regimenFiscal,
          usoCfdi,
        };
        await sendWhatsAppOptions(phone, "Selecciona el tipo de persona:", [
          { label: "Persona Física", value: "tipo_fisica" },
          { label: "Persona Moral", value: "tipo_moral" },
        ]);
        session.estado = "PIDIENDO_TIPO_PERSONA";
      } else if (!datosGuardados.regimenFiscal) {
        session.datosFactura.rfc = datosGuardados.rfc;
        session.datosFactura.nombre = datosGuardados.nombre;
        session.datosFactura.tipoPersona = datosGuardados.tipoPersona;
        // Mostrar lista de regímenes fiscales
        const regimenes = Object.entries(
          regimenesFiscales[
            datosGuardados.tipoPersona === "personaFisica"
              ? "personaFisica"
              : "personaMoral"
          ]
        )
          .filter(([clave]) =>
            datosGuardados.tipoPersona === "personaFisica"
              ? popularesPersonaFisica.includes(clave)
              : popularesPersonaMoral.includes(clave)
          )
          .slice(0, 9)
          .map(([clave]) => ({
            label: `Régimen ${clave}`,
            value: `regimen_${clave}`,
          }));
        regimenes.push({
          label: "Ayuda con mi régimen",
          value: "regimen_ayuda",
        });
        await sendWhatsAppList(
          phone,
          "Selecciona el régimen fiscal:",
          "Regímenes disponibles",
          regimenes,
          "Régimen Fiscal"
        );
        session.estado = "PIDIENDO_FISCALREGIME";
      } else if (!datosGuardados.usoCfdi && !datosGuardados.cfdiUse) {
        session.datosFactura.rfc = datosGuardados.rfc;
        session.datosFactura.nombre = datosGuardados.nombre;
        session.datosFactura.tipoPersona = datosGuardados.tipoPersona;
        session.datosFactura.regimenFiscal =
          datosGuardados.regimenFiscal || datosGuardados.fiscalRegime;
        // Aquí podrías mostrar la lista de usos CFDI
        // ...
        session.estado = "PIDIENDO_CFDIUSE";
      }
    }
  } else {
    // Si el usuario está en ESPERANDO_FACTURA, mostrar la lista de facturas
    if (
      session.estado === "ESPERANDO_FACTURA" &&
      session.facturas &&
      session.facturas.length > 0
    ) {
      await sendWhatsAppMessage(
        phone,
        "Opción inválida. Por favor selecciona una factura del listado."
      );
      const items = session.facturas.slice(0, 10).map((factura, index) => {
        const folio = factura.folio;
        const total = factura.total.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return {
          label: `${folio} $${total}`,
          value: `factura_${index}`,
        };
      });
      await sendWhatsAppList(
        phone,
        "Selecciona la factura que deseas descargar:",
        "Tus facturas",
        items,
        "Facturas"
      );
    } else {
      await sendWhatsAppMessage(
        phone,
        "Opción no válida. Por favor selecciona una opción del menú."
      );
      await sendWhatsAppOptions(
        phone,
        "👋 ¡Hola! Bienvenido a " +
          (session.negocio?.nombre || "el negocio") +
          ".\n¿Qué deseas hacer hoy?",
        [
          { label: "Consultar facturas", value: "1" },
          { label: "Generar factura", value: "2" },
        ]
      );
    }
  }
}
// const { guardarRFCCliente, obtenerRFCCliente } = require("../services/rfcClienteService");

async function handlePidiendoRFC(phone, msgText, session) {
  try {
    const rfc = msgText.toUpperCase();
    session.datosFactura.rfc = rfc;
    const negocioId = session.negocio?.id;
    if (!negocioId) {
      await sendWhatsAppMessage(
        phone,
        "No se pudo identificar el negocio. Intenta más tarde."
      );
      return;
    }
    // Buscar si ya existe el RFC para este cliente en el negocio
    const rfcGuardado = await obtenerRFCCliente(negocioId, phone);
    if (!rfcGuardado) {
      // Primera vez: guardar RFC
      await guardarRFCCliente(negocioId, phone, rfc);
      await sendWhatsAppMessage(
        phone,
        "✅ RFC guardado correctamente. Ahora proporciona el nombre del receptor:"
      );
      session.estado = "PIDIENDO_NOMBRE";
    } else if (rfcGuardado === rfc) {
      // Ya existe y es el mismo
      await sendWhatsAppMessage(
        phone,
        "Ya tenemos tu RFC registrado. ¿Deseas actualizarlo o continuar con el actual?"
      );
      await sendWhatsAppOptions(phone, "Selecciona una opción:", [
        { label: "Continuar con este RFC", value: "continuar_rfc" },
        { label: "Actualizar RFC", value: "actualizar_rfc" },
      ]);
      session.estado = "CONFIRMAR_RFC_GUARDADO";
    } else {
      // Ya existe pero es diferente
      await sendWhatsAppMessage(
        phone,
        `Ya tienes un RFC guardado: *${rfcGuardado}*. ¿Deseas actualizarlo por el nuevo?`
      );
      await sendWhatsAppOptions(phone, "Selecciona una opción:", [
        { label: "Sí, actualizar RFC", value: "actualizar_rfc" },
        { label: "No, mantener el anterior", value: "mantener_rfc" },
      ]);
      session.estado = "CONFIRMAR_RFC_GUARDADO";
    }
  } catch (error) {
    console.error("[handlePidiendoRFC] Error:", error);
    await sendWhatsAppMessage(
      phone,
      "❌ Error al guardar o consultar tu RFC. Intenta más tarde."
    );
  }
  // --- Fin de handlePidiendoRFC ---
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
    if (!msgText || typeof msgText !== "string") {
      await sendWhatsAppMessage(
        phone,
        "Opción inválida. Selecciona un régimen fiscal del listado."
      );
      return;
    }
    // Determinar tipoPersona y catálogo solo una vez
    let tipoPersonaRaw = session.datosFactura?.tipoPersona || "personaFisica";
    let tipoPersona = "personaFisica";
    if (typeof tipoPersonaRaw === "string") {
      const norm = tipoPersonaRaw.trim().toLowerCase();
      if (norm === "persona moral" || norm === "personamoral")
        tipoPersona = "personaMoral";
      else if (norm === "persona física" || norm === "personafisica")
        tipoPersona = "personaFisica";
      else if (norm === "personamoral") tipoPersona = "personaMoral";
      else if (norm === "personafisica") tipoPersona = "personaFisica";
    }
    const catalogo = regimenesFiscales[tipoPersona];
    // Generar los labels válidos
    const labelsValidos = Object.entries(catalogo)
      .filter(([c]) =>
        tipoPersona === "personaFisica"
          ? popularesPersonaFisica.includes(c)
          : popularesPersonaMoral.includes(c)
      )
      .slice(0, 9)
      .map(([c]) => `Régimen ${c}`.toLowerCase());
    // Si el texto coincide con algún label, convertirlo al value
    if (labelsValidos.includes(msgText.trim().toLowerCase())) {
      const match = msgText
        .trim()
        .toLowerCase()
        .match(/régimen\s*(\d{3})/);
      if (match) {
        msgText = `regimen_${match[1]}`;
      }
    }
    session.estado = "CONFIRMAR_DATOS_FISCALES_GUARDADOS";
    return;
  }

  // Si no, continuar con el flujo normal
  session.estado = "PIDIENDO_FISCALREGIME";

  const regimenes = Object.entries(
    regimenesFiscales[session.datosFactura.tipoPersona]
  )
    .filter(([clave]) =>
      session.datosFactura.tipoPersona === "personaFisica"
        ? popularesPersonaFisica.includes(clave)
        : popularesPersonaMoral.includes(clave)
    )
    .slice(0, 9)
    .map(([clave]) => ({
      label: `Régimen ${clave}`,
      value: `regimen_${clave}`,
    }));

  regimenes.push({
    label: "Ayuda con mi régimen",
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
  // Usar el tipoPersona correcto desde datosFactura
  const tipoPersona = session.datosFactura.tipoPersona;
  if (!tipoPersona || !regimenesFiscales[tipoPersona]) {
    await sendWhatsAppMessage(
      phone,
      "Error: tipo de persona no definido. Por favor selecciona el tipo de persona primero."
    );
    session.estado = "PIDIENDO_TIPO_PERSONA";
    return;
  }
  const descripcionRegimen = regimenesFiscales[tipoPersona][claveRegimen];
  if (!descripcionRegimen) {
    await sendWhatsAppMessage(
      phone,
      "Régimen no reconocido. Intenta de nuevo."
    );
    return;
  }
  session.datosFactura.regimenFiscal = claveRegimen;
  // Eliminar duplicado si existe
  delete session.datosFactura.fiscalRegime;

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
    label: "No sé mi CFDI",
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

  session.datosFactura.usoCfdi = claveUso;
  // Eliminar duplicado si existe
  delete session.datosFactura.cfdiUse;

  // Guardar todos los datos fiscales en Firestore al terminar la captura inicial
  const negocioId = session.negocio?.id;
  if (negocioId) {
    const {
      guardarDatosFiscalesCliente,
    } = require("../services/datosFiscalesClienteService");
    await guardarDatosFiscalesCliente(negocioId, phone, session.datosFactura);
  }

  await sendWhatsAppMessage(
    phone,
    `✅ Elegiste el uso CFDI ${claveUso}: ${descripcionUso}`
  );

  await sendWhatsAppMessage(phone, "Indica el total a facturar (solo número):");
  session.estado = "PIDIENDO_TOTAL";
}

async function handlePidiendoTotal(phone, msgText, session) {
  console.log("[LOG] handlePidiendoTotal: msgText recibido:", msgText);
  const totalNum = parseFloat((msgText || "").replace(/[^0-9.]/g, "").trim());
  if (isNaN(totalNum) || totalNum <= 0) {
    console.log("[LOG] handlePidiendoTotal: total inválido:", msgText);
    await sendWhatsAppMessage(
      phone,
      "Por favor ingresa un número válido para el total."
    );
    // Mantener el estado para que el usuario vuelva a intentar
    session.estado = "PIDIENDO_TOTAL";
    return;
  }
  session.datosFactura.total = totalNum;
  const resumen =
    `Resumen de factura:\n` +
    `RFC: ${session.datosFactura.rfc}\n` +
    `Nombre: ${session.datosFactura.nombre}\n` +
    `Régimen Fiscal: ${session.datosFactura.fiscalRegime}\n` +
    `Uso CFDI: ${session.datosFactura.cfdiUse}\n` +
    `Total: $${session.datosFactura.total.toFixed(2)}\n\n`;
  await sendWhatsAppOptions(phone, resumen + "¿Qué deseas hacer?", [
    { label: "CONFIRMAR", value: "confirmar" },
    { label: "CANCELAR", value: "cancelar" },
  ]);
  session.estado = "ESPERANDO_CONFIRMACION";
}

async function handleEsperandoConfirmacion(phone, msg, session) {
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

      // Unificar campos para Facturama
      // Unificar y limpiar campos antes de enviar a Facturama
      const CfdiUse = datosFactura.usoCfdi || datosFactura.cfdiUse;
      const FiscalRegime =
        datosFactura.regimenFiscal || datosFactura.fiscalRegime;
      const receiver = {
        Rfc: datosFactura.rfc,
        CfdiUse,
        Name: datosFactura.nombre,
        FiscalRegime,
        TaxZipCode: negocio.codigoPostal || "78000",
      };

      // Generar la factura
      const factura = await generarFactura(
        negocio,
        {
          Receiver: receiver,
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

      // Si hay ticket de Airtable en sesión, actualizar estado de facturación
      if (session.ticketAirtable && session.ticketAirtable.Folio) {
        try {
          const {
            actualizarEstadoFacturacion,
          } = require("../services/airtableUpdateService");
          await actualizarEstadoFacturacion(
            session.ticketAirtable.Folio,
            "Facturado"
          );
          console.log(
            `✅ Estado de facturación actualizado en Airtable para folio ${session.ticketAirtable.Folio}`
          );
        } catch (err) {
          console.error(
            "❌ Error actualizando estado de facturación en Airtable:",
            err
          );
        }
      }

      deleteSession(phone);
    } catch (error) {
      console.error("❌ Error generando factura:", error);

      let mensaje = "❌ Ocurrió un error generando la factura.";

      if (
        error.response &&
        error.response.data &&
        error.response.data.Message
      ) {
        // Si el error viene del endpoint y contiene un mensaje en data.Message
        mensaje += `\n\nDetalles del error: ${error.response.data.Message}`;
      } else if (error.ModelState) {
        // Si el error contiene un ModelState
        const detalles = Object.values(error.ModelState).flat().join("\n");
        mensaje += `\n\nDetalles:\n${detalles}`;
      } else if (error.message) {
        // Si el error contiene un mensaje general
        mensaje += `\n\n${error.message}`;
      }

      console.error(mensaje);

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
      label: "Ayuda con uso CFDI",
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

    // Validar la selección del usuario (por valor del listado)
    let facturaSeleccionada = null;
    if (msg.startsWith("factura_")) {
      const index = parseInt(msg.replace("factura_", ""), 10);
      if (!isNaN(index) && index >= 0 && index < session.facturas.length) {
        facturaSeleccionada = session.facturas[index];
      }
    }
    if (!facturaSeleccionada) {
      console.error("❌ Selección inválida:", msg);
      await sendWhatsAppMessage(
        phone,
        "Opción inválida. Por favor selecciona una factura del listado."
      );
      // Volver a mostrar la lista de facturas
      const items = session.facturas.slice(0, 10).map((factura, index) => {
        const folio = factura.folio;
        const total = factura.total.toLocaleString("es-MX", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return {
          label: `${folio} $${total}`,
          value: `factura_${index}`,
        };
      });
      await sendWhatsAppList(
        phone,
        "Selecciona la factura que deseas descargar:",
        "Tus facturas",
        items,
        "Facturas"
      );
      return;
    }
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
  handleConfirmarRFCGuardado,
  handleConfirmarDatosFiscalesGuardados,
  handleActualizandoRFC,
  handleActualizandoNombre,
  handleActualizandoTipoPersona,
  handleActualizandoRegimen,
  handleActualizandoUsoCFDI,
};
