const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { FACTURAMA_USER, FACTURAMA_PASS } = require("../config/env");
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

function construirPayload(datos, descripcion = "Servicio general") {
  const base = Number(datos.Total);
  const baseFixed = Number(base.toFixed(2));
  const iva = Number((base * 0.16).toFixed(2));
  const totalConIva = Number((base + iva).toFixed(2));

  return {
    NameId: "1",
    Currency: "MXN",
    Folio: "100",
    Serie: "FA",
    CfdiType: "I",
    PaymentForm: "03",
    PaymentMethod: "PUE",
    OrderNumber: "ORD-WHATSAPP",
    ExpeditionPlace: "78000",
    Date: dayjs().tz("America/Mexico_City").format("YYYY-MM-DDTHH:mm:ss"),
    PaymentConditions: "CREDITO A SIETE DIAS",
    Observations: "Factura generada vía WhatsApp",
    Exportation: "01",
    LogoUrl: "http://tu_dominio.com/imagen.jpg",
    Issuer: {
      Rfc: "EKU9003173C9",
      Name: "ESCUELA KEMPER URGATE",
      FiscalRegime: "601",
    },
    Receiver: datos.Receiver,
    Items: [
      {
        ProductCode: "10101504",
        IdentificationNumber: "001",
        Description: descripcion,
        Unit: "NO APLICA",
        UnitCode: "E49",
        UnitPrice: baseFixed,
        Quantity: 1,
        Subtotal: baseFixed,
        Discount: 0,
        TaxObject: "02",
        Taxes: [
          {
            Total: iva,
            Name: "IVA",
            Base: baseFixed,
            Rate: 0.16,
            IsRetention: false,
          },
        ],
        Total: totalConIva,
      },
    ],
  };
}

const generarFactura = async (datos, descripcion = "Servicio general") => {
  try {
    const payload = construirPayload(datos, descripcion);
    console.log("🧾 Payload enviado:", JSON.stringify(payload, null, 2));

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

    console.log("✅ Factura generada:", facturaId);
    return { ...factura, Id: facturaId };
  } catch (error) {
    const apiError = error.response?.data;

    console.error("❌ Error al generar factura:", apiError || error.message);

    const customError = new Error(
      apiError?.Message || error.message || "Error al generar factura"
    );
    if (apiError?.ModelState) {
      customError.ModelState = apiError.ModelState;
    }

    throw customError;
  }
};

const descargarFactura = async (id) => {
  try {
    if (!id) throw new Error("Id no proporcionado");

    const authHeader = getAuthHeader();
    const tempDir = path.join(__dirname, "../../temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const pdfResponse = await axios.get(
      `https://apisandbox.facturama.mx/api/Cfdi/pdf/issuedLite/${id}`,
      { headers: authHeader }
    );

    const { Content, ContentEncoding, ContentType } = pdfResponse.data;

    if (!Content || ContentEncoding !== "base64" || ContentType !== "pdf") {
      throw new Error("Contenido PDF inválido o no encontrado.");
    }

    const pdfBuffer = Buffer.from(Content, "base64");
    const pdfPath = path.join(tempDir, `${id}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    console.log("✅ PDF descargado:", pdfPath);
    return { pdfPath, filename: `Factura-${id}.pdf` };
  } catch (error) {
    console.error(
      "❌ Error al descargar PDF:",
      error.response?.data || error.message
    );
    throw error;
  }
};

module.exports = {
  generarFactura,
  descargarFactura,
};
