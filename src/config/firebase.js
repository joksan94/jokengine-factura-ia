const admin = require("firebase-admin");
const serviceAccount = require("../../jokengineia-firebase-adminsdk-fbsvc-6bd04ac443.json"); // Ruta a tu archivo de credenciales

// Asegúrate de inicializar la aplicación de Firebase solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  admin.app(); // Si ya está inicializada, usa la aplicación existente
}

const db = admin.firestore();

module.exports = { db };
