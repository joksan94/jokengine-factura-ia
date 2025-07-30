const admin = require("firebase-admin"); // Importar Firebase Admin SDK
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { FACTURAMA_USER, FACTURAMA_PASS } = require("../config/env");
const { db } = require("../config/firebase"); // Firestore
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const BASE_URL = "https://apisandbox.facturama.mx/api-lite/3";

const getAuthHeader = () => {
  const token = Buffer.from(`${FACTURAMA_USER}:${FACTURAMA_PASS}`).toString(
    "base64"
  );
  return { Authorization: `Basic ${token}` };
};

async function obtenerDatosFiscalesDesdeNegocio(negocioId) {
  console.log("🔍 Obteniendo datos fiscales para el negocio:", negocioId);
  try {
    if (
      !negocioId ||
      typeof negocioId !== "string" ||
      negocioId.trim() === ""
    ) {
      throw new Error("El negocioId proporcionado no es válido.");
    }

    const configRef = db
      .collection("negocios")
      .doc(negocioId)
      .collection("config")
      .doc("global");
    const configDoc = await configRef.get();

    if (!configDoc.exists) {
      throw new Error(
        `No se encontraron datos fiscales para el negocio con ID: ${negocioId}`
      );
    }

    const datosFiscales = configDoc.data();
    console.log("✅ Datos fiscales obtenidos desde Firestore:", datosFiscales);
    return datosFiscales;
  } catch (error) {
    console.error("❌ Error al obtener datos fiscales:", error.message);
    throw error;
  }
}

// Modificar construirPayload para aceptar datos fiscales dinámicos
function construirPayload(
  datos,
  datosFiscales,
  descripcion = "Servicio general"
) {
  const base = Number(datos.Total);
  const baseFixed = Number(base.toFixed(2));
  const iva = Number((base * 0.16).toFixed(2));
  const totalConIva = Number((base + iva).toFixed(2));

  return {
    NameId: datosFiscales.NameId || "1", // Valor predeterminado
    Currency: datosFiscales.Currency || "MXN",
    Folio: datos.Folio || "100",
    Serie: datosFiscales.Serie || "FA",
    CfdiType: datosFiscales.CfdiType || "I",
    PaymentForm: datosFiscales.PaymentForm || "03",
    PaymentMethod: datosFiscales.PaymentMethod || "PUE",
    OrderNumber: "ORD-WHATSAPP",
    ExpeditionPlace: datosFiscales.ExpeditionPlace || "78000",
    Date: dayjs().tz("America/Mexico_City").format("YYYY-MM-DDTHH:mm:ss"),
    PaymentConditions:
      datosFiscales.PaymentConditions || "CREDITO A SIETE DIAS",
    Observations: datosFiscales.Observations || "Factura generada vía WhatsApp",
    Exportation: datosFiscales.Exportation || "01",
    LogoUrl: datosFiscales.LogoUrl || "http://tu_dominio.com/logo.jpg",
    Issuer: datosFiscales.Issuer,
    Receiver: datos.Receiver,
    Items: [
      {
        ProductCode: datosFiscales.ProductCode || "10101504",
        IdentificationNumber: datosFiscales.IdentificationNumber || "001",
        Description: descripcion,
        Unit: datosFiscales.Unit || "NO APLICA",
        UnitCode: datosFiscales.UnitCode || "E49",
        UnitPrice: baseFixed,
        Quantity: 1,
        Subtotal: baseFixed,
        Discount: 0,
        TaxObject: datosFiscales.TaxObject || "02",
        Taxes: [
          {
            Total: iva,
            Name: datosFiscales.TaxName || "IVA",
            Base: baseFixed,
            Rate: datosFiscales.TaxRate || 0.16,
            IsRetention: datosFiscales.IsRetention || false,
          },
        ],
        Total: totalConIva,
      },
    ],
  };
}

// Modificar generarFactura para usar datos fiscales dinámicos
const generarFactura = async (
  negocio,
  datos,
  descripcion = "Servicio general"
) => {
  console.log(
    "🔍 Generando factura para el negocio:",
    negocio.nombre || negocio.id
  );

  try {
    // Obtener los datos fiscales del negocio
    let datosFiscales = negocio.datosFiscales; // Intentar usar los datos fiscales del negocio
    if (!datosFiscales) {
      console.log(
        "⚠️ Datos fiscales no encontrados en el negocio. Consultando Firestore..."
      );
      datosFiscales = await obtenerDatosFiscalesDesdeNegocio(negocio.id); // Consultar Firestore si no están disponibles
    }

    if (!datosFiscales) {
      throw new Error("No se pudieron obtener los datos fiscales del negocio.");
    }

    console.log("✅ Datos fiscales obtenidos:", datosFiscales);

    // Construir el payload con los datos fiscales
    const payload = construirPayload(datos, datosFiscales, descripcion);
    console.log("🧾 Payload enviado:", JSON.stringify(payload, null, 2));

    // Enviar la solicitud para generar la factura
    const response = await axios.post(`${BASE_URL}/cfdis`, payload, {
      headers: {
        ...getAuthHeader(),
        "Content-Type": "application/json",
      },
    });

    const factura = response.data;
    const facturaId = factura?.Id || factura?.id;

    if (!facturaId) {
      throw new Error("Factura generada sin ID válido.");
    }

    console.log("✅ Factura generada con ID:", facturaId);
    return { ...factura, Id: facturaId };
  } catch (error) {
    console.error("❌ Error al generar factura:", error.message);
    throw error;
  }
};

const descargarFactura = async (id) => {
  try {
    if (!id)
      throw new Error(
        "❌ Error: Id no proporcionado para descargar la factura."
      );

    console.log(`📥 Iniciando descarga del PDF para el ID: ${id}`);

    const authHeader = getAuthHeader();
    const tempDir = path.join(__dirname, "../../temp");

    // Crear el directorio temporal si no existe
    if (!fs.existsSync(tempDir)) {
      console.log("📂 Creando directorio temporal:", tempDir);
      fs.mkdirSync(tempDir);
    }

    // Solicitar el PDF al endpoint de Facturama
    const pdfResponse = await axios.get(
      `https://apisandbox.facturama.mx/api/Cfdi/pdf/issuedLite/${id}`,
      { headers: authHeader }
    );

    const { Content, ContentEncoding, ContentType } = pdfResponse.data;

    // Validar el contenido de la respuesta
    if (!Content) {
      throw new Error("❌ Error: El contenido del PDF está vacío.");
    }
    if (ContentEncoding !== "base64") {
      throw new Error(
        "❌ Error: El contenido del PDF no está codificado en base64."
      );
    }
    if (ContentType !== "pdf") {
      throw new Error(
        "❌ Error: El contenido descargado no es un archivo PDF."
      );
    }

    // Convertir el contenido base64 a un buffer y guardar el archivo
    const pdfBuffer = Buffer.from(Content, "base64");
    const pdfPath = path.join(tempDir, `${id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log("✅ PDF descargado exitosamente:", pdfPath);
    return { pdfPath, filename: `Factura-${id}.pdf` };
  } catch (error) {
    console.error(
      "❌ Error al descargar el PDF:",
      error.response?.data || error.message
    );
    throw error;
  }
};

async function guardarFacturaEnFirestore(
  negocioId,
  factura,
  folio,
  folioSecuencial,
  phoneFrom // Agregar phoneFrom como parámetro
) {
  console.log("📥 Guardando factura en Firestore...");
  try {
    if (!factura || !factura.Id) {
      console.error("❌ El objeto factura no contiene un ID válido:", factura);
      throw new Error("El objeto factura no contiene un ID válido.");
    }

    if (!folio || !folioSecuencial) {
      throw new Error("El folio o folioSecuencial no están definidos.");
    }

    const facturasRef = db
      .collection("negocios")
      .doc(negocioId)
      .collection("facturas");

    const facturaData = {
      negocioId,
      facturaId: factura.Id || factura.id,
      folio, // Folio generado (por ejemplo, "FS-1")
      folioSecuencial, // Número secuencial (por ejemplo, 1)
      total: factura.Total || 0,
      receptor: factura.Receiver || {},
      phoneFrom, // Guardar el número de teléfono del remitente
      fecha: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log("📥 Datos de la factura a guardar:", facturaData);

    await facturasRef.add(facturaData);
    console.log("✅ Factura guardada con folio:", folio);
  } catch (error) {
    console.error(
      "❌ Error al guardar la factura en Firestore:",
      error.message
    );
    throw error;
  }
}

async function obtenerFacturasPorUsuario(phoneFrom, negocioId) {
  console.log("🔍 Buscando facturas para el usuario:", phoneFrom);
  try {
    if (!phoneFrom || !negocioId) {
      throw new Error("Faltan datos para buscar las facturas.");
    }

    const facturasSnapshot = await db
      .collection("negocios")
      .doc(negocioId)
      .collection("facturas")
      .where("phoneFrom", "==", phoneFrom) // Filtrar por phoneFrom
      .orderBy("fecha", "desc")
      .get();

    if (facturasSnapshot.empty) {
      console.log("⚠️ No se encontraron facturas para el usuario:", phoneFrom);
      return [];
    }

    const facturas = facturasSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Se encontraron ${facturas.length} facturas.`);
    return facturas;
  } catch (error) {
    console.error("❌ Error al obtener facturas:", error.message);
    throw error;
  }
}

async function obtenerSiguienteFolio(negocioId, inicialesNegocio) {
  const facturasRef = db
    .collection("negocios")
    .doc(negocioId)
    .collection("facturas");

  return db.runTransaction(async (transaction) => {
    // Consultar el último folio generado
    const snapshot = await transaction.get(
      facturasRef.orderBy("folioSecuencial", "desc").limit(1)
    );

    let siguienteFolio = 1; // Valor inicial si no hay facturas previas
    if (!snapshot.empty) {
      const ultimaFactura = snapshot.docs[0].data();
      siguienteFolio = (ultimaFactura.folioSecuencial || 0) + 1;
    }

    // Generar el nuevo folio con el prefijo del negocio
    const nuevoFolio = `${inicialesNegocio}-${siguienteFolio}`;
    return { nuevoFolio, folioSecuencial: siguienteFolio };
  });
}

module.exports = {
  generarFactura,
  descargarFactura,
  guardarFacturaEnFirestore,
  obtenerFacturasPorUsuario,
  obtenerSiguienteFolio,
};
