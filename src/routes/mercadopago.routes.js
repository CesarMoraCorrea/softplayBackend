import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { getAuthorizationUrl, linkAccount } from "../controllers/mercadopago.controller.js";

const router = Router();

// Endpoint para obtener la URL de autorización
router.get("/oauth-url", protect, getAuthorizationUrl);

// Endpoint para vincular la cuenta con el código de MP
router.post("/link-account", protect, linkAccount);

export default router;
