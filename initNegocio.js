const { db } = require("./src/config/firebase"); // Ajusta la ruta según tu estructura de proyecto
const admin = require("firebase-admin");
const dayjs = require("dayjs");

async function initNegocio(negocioId) {
  const negocioRef = db.collection("negocios").doc(negocioId);

  const negocioData = {
    nombre: "Saludable S.A. de C.V.",
    telefono: "+527471304879",
    email: "contacto@saludable.mx",
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    activo: true,
  };

  // Obtener el último folio registrado
  const lastFolioSnapshot = await db
    .collection("negocios")
    .orderBy("Folio", "desc")
    .limit(1)
    .get();

  let nextFolio = 100; // Valor inicial por defecto
  if (!lastFolioSnapshot.empty) {
    const lastFolioData = lastFolioSnapshot.docs[0].data();
    nextFolio = parseInt(lastFolioData.Folio || 100) + 1;
  }

  const configFiscal = {
    Serie: "FA",
    Folio: nextFolio.toString(),
    CfdiType: "I",
    Currency: "MXN",
    ExpeditionPlace: "78000",
    PaymentMethod: "PUE",
    PaymentForm: "03",
    Exportation: "01",
    PaymentConditions: "CREDITO A SIETE DIAS",
    Observations: "Factura generada vía WhatsApp",
    LogoUrl: "https://tu_dominio.com/logo.jpg",
    Issuer: {
      Rfc: "EKU9003173C9",
      Name: "ESCUELA KEMPER URGATE",
      FiscalRegime: "601",
    },
  };

  const batch = db.batch();

  // Crear documento principal del negocio
  batch.set(negocioRef, negocioData);

  // Configuración fiscal en /negocios/{id}/config/global
  const configRef = negocioRef.collection("config").doc("global");
  batch.set(configRef, configFiscal);

  // Crear subcolecciones vacías
  const placeholder = {
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  };

  const clientesRef = negocioRef.collection("clientes").doc("_init");
  batch.set(clientesRef, placeholder);

  const facturasRef = negocioRef.collection("facturas").doc("_init");
  batch.set(facturasRef, placeholder);

  const usuariosRef = negocioRef.collection("usuarios").doc("_init");
  batch.set(usuariosRef, { ...placeholder, nombre: "Admin", rol: "admin" });

  await batch.commit();
  console.log(
    `✅ Negocio '${negocioId}' inicializado correctamente con folio ${nextFolio}`
  );
}

// Ejecutar script
initNegocio("saludable-test").catch(console.error);
