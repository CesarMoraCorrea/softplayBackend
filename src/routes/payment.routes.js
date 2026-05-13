import { Router } from "express";
import { 
  createPaymentIntent, 
  confirmPayment, 
  stripeWebhook, 
  mpWebhook,
  getPaymentMethods,
  getMpOAuthUrl,
  mpOAuthCallback,
  getMpPaymentStatus,
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

// OAuth MercadoPago para vendedores/propietarios
router.get("/mercadopago/oauth/url", protect, getMpOAuthUrl);
router.get("/mercadopago/oauth/callback", mpOAuthCallback);
router.get("/mercadopago/status/:reservaId", protect, getMpPaymentStatus);

// Rutas protegidas
router.post("/intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/methods", protect, getPaymentMethods);

// Webhooks (sin autenticación)
router.post("/webhook/stripe", stripeWebhook);
router.post("/webhook/mercadopago", mpWebhook);

export default router;
