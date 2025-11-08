// Servicio para RFC de clientes en Firestore
const { db } = require("../config/firebase");

async function guardarRFCCliente(negocioId, phone, rfc, nombre = "") {
  try {
    console.log(`[guardarRFCCliente] phone: ${phone}, rfc: ${rfc}`);
    const ref = db
      .collection("negocios")
      .doc(negocioId)
      .collection("clientes")
      .doc(phone);
    await ref.set({ rfc }, { merge: true });
    await ref.set(
      { rfc: rfc, telefono: phone, nombre: nombre },
      { merge: true }
    );
    console.log(`[guardarRFCCliente] RFC guardado correctamente.`);
  } catch (error) {
    console.error(`[guardarRFCCliente] Error:`, error);
    throw error;
  }
}

async function obtenerRFCCliente(negocioId, phone) {
  try {
    console.log(`[obtenerRFCCliente] phone: ${phone}`);
    const ref = db
      .collection("negocios")
      .doc(negocioId)
      .collection("clientes")
      .doc(phone);
    const doc = await ref.get();
    if (!doc.exists) {
      console.log(`[obtenerRFCCliente] No existe cliente.`);
      return null;
    }
    const rfc = doc.data().rfc || null;
    console.log(`[obtenerRFCCliente] RFC encontrado: ${rfc}`);
    return rfc;
  } catch (error) {
    console.error(`[obtenerRFCCliente] Error:`, error);
    throw error;
  }
}

module.exports = { guardarRFCCliente, obtenerRFCCliente };
