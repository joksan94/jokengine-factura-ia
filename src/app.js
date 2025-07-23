const express = require("express");
const routes = require("./routes/whatsappRoutes");
require("dotenv").config({ debug: true }); // Para cargar variables de entorno

const app = express();
app.use(express.json());

// Cargar rutas
app.use("/", routes);

// Configurar el puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;
