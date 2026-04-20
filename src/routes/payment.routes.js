import { Router } from "express";
import { 
  createPaymentIntent, 
  confirmPayment, 
  stripeWebhook, 
  mpWebhook,
  getPaymentMethods 
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

// Rutas protegidas que requieren autenticación
router.post("/intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/methods", protect, getPaymentMethods);

// Webhooks (no requieren autenticación)
router.post("/webhook/stripe", stripeWebhook);
router.post("/webhook/mercadopago", mpWebhook);

export default router;
