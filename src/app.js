const express = require("express");
const routes = require("./routes/whatsappRoutes");
require("dotenv").config({ override: true });
console.log("📂 process.env.VERIFY_TOKEN:", process.env.VERIFY_TOKEN);

const app = express();
app.use(express.json());

// Cargar rutas
app.use("/", routes);

// Configurar el puerto
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

module.exports = app;
