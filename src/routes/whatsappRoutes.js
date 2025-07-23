const express = require("express");
const {
  handleWhatsAppWebhook,
  verifyWebhook,
} = require("../controllers/whatsappController");

const router = express.Router();

router.post("/webhook-pedidos", handleWhatsAppWebhook);
router.get("/webhook-pedidos", verifyWebhook);
router.get("/test", (req, res) => res.send("✅ Servicio activo"));

module.exports = router;
