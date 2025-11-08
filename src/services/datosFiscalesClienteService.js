// Servicio para datos fiscales completos de clientes en Firestore
const { db } = require("../config/firebase");

async function guardarDatosFiscalesCliente(negocioId, phone, datos) {
  try {
    const ref = db
      .collection("negocios")
      .doc(negocioId)
      .collection("clientes")
      .doc(phone);
    await ref.set({ ...datos, telefono: phone }, { merge: true });
    console.log(
      `[guardarDatosFiscalesCliente] Datos guardados correctamente para ${phone}`
    );
  } catch (error) {
    console.error(`[guardarDatosFiscalesCliente] Error:`, error);
    throw error;
  }
}

async function obtenerDatosFiscalesCliente(negocioId, phone) {
  try {
    const ref = db
      .collection("negocios")
      .doc(negocioId)
      .collection("clientes")
      .doc(phone);
    const doc = await ref.get();
    if (!doc.exists) {
      console.log(`[obtenerDatosFiscalesCliente] No existe cliente.`);
      return null;
    }
    const data = doc.data();
    console.log(`[obtenerDatosFiscalesCliente] Datos encontrados:`, data);
    return data;
  } catch (error) {
    console.error(`[obtenerDatosFiscalesCliente] Error:`, error);
    throw error;
  }
}

module.exports = { guardarDatosFiscalesCliente, obtenerDatosFiscalesCliente };
