import { Router } from "express";
import { 
  createPaymentIntent, 
  confirmPayment, 
  stripeWebhook, 
  getPaymentMethods 
} from "../controllers/payment.controller.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

// Rutas protegidas que requieren autenticación
router.post("/intent", protect, createPaymentIntent);
router.post("/confirm", protect, confirmPayment);
router.get("/methods", protect, getPaymentMethods);

// Webhook de Stripe (no requiere autenticación)
router.post("/webhook/stripe", stripeWebhook);

export default router;
