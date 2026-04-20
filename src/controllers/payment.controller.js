import Stripe from "stripe";
import Reserva from "../models/Reserva.js";
import Sede from "../models/Sede.js";
import User from "../models/User.js";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const stripe = new Stripe(process.env.STRIPE_SECRET);

// Crear Payment Intent para Stripe
export const createPaymentIntent = async (req, res) => {
  try {
    const { reservaId, paymentMethod = "stripe" } = req.body;
    const reserva = await Reserva.findById(reservaId);
    
    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }
    
    // Verificar que la reserva pertenezca al usuario autenticado
    if (reserva.usuario.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No tienes permiso para pagar esta reserva" });
    }
    
    if (reserva.estadoPago === "pagado") {
      return res.status(400).json({ message: "Esta reserva ya está pagada" });
    }
    
    // Actualizar método de pago
    reserva.paymentMethod = paymentMethod;
    reserva.paymentStatus = "processing";
    
    if (paymentMethod === "stripe") {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(reserva.total * 100), // Convertir a centavos
        currency: "usd",
        metadata: { 
          reservaId: reserva._id.toString(),
          userId: req.user._id.toString()
        }
      });
      
      reserva.paymentIntentId = intent.id;
      await reserva.save();
      
      res.json({ 
        clientSecret: intent.client_secret,
        paymentMethod: "stripe"
      });
    } else if (paymentMethod === "mercadopago") {
      const sede = await Sede.findById(reserva.sede).populate("propietario");
      if (!sede || !sede.propietario || !sede.propietario.mpAccessToken) {
        return res.status(400).json({ message: "La sede no tiene configurado MercadoPago (MP Accesstoken missing)." });
      }

      const client = new MercadoPagoConfig({ accessToken: sede.propietario.mpAccessToken });
      const preference = new Preference(client);

      const prefData = {
        body: {
          items: [
            {
              id: reserva._id.toString(),
              title: `Reserva Cancha - ${sede.nombre}`,
              quantity: 1,
              unit_price: Number(reserva.total)
            }
          ],
          back_urls: {
            success: `${process.env.FRONTEND_URL || "http://localhost:5173"}/mis-reservas?status=success&reservaId=${reserva._id}`,
            failure: `${process.env.FRONTEND_URL || "http://localhost:5173"}/mis-reservas?status=failure&reservaId=${reserva._id}`,
            pending: `${process.env.FRONTEND_URL || "http://localhost:5173"}/mis-reservas?status=pending&reservaId=${reserva._id}`
          },
          auto_return: "approved",
          external_reference: reserva._id.toString(),
          notification_url: `${process.env.BACKEND_URL || "https://api.softplay.com"}/api/payments/webhook/mercadopago`
        }
      };

      const result = await preference.create(prefData);
      
      reserva.mpPreferenceId = result.id;
      await reserva.save();
      
      res.json({
        preferenceId: result.id,
        init_point: result.init_point,
        paymentMethod: "mercadopago"
      });
    } else if (paymentMethod === "paypal") {
      // PayPal Sandbox - simulación
      const paypalOrderId = `PAYPAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      reserva.paymentIntentId = paypalOrderId;
      await reserva.save();
      
      res.json({
        orderId: paypalOrderId,
        paymentMethod: "paypal",
        amount: reserva.total,
        currency: "USD"
      });
    } else if (paymentMethod === "test") {
      // Modo de prueba gratuito
      const testTransactionId = `TEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      reserva.paymentIntentId = testTransactionId;
      reserva.transactionId = testTransactionId;
      await reserva.save();
      
      res.json({
        transactionId: testTransactionId,
        paymentMethod: "test",
        message: "Modo de prueba activado - No se procesará pago real"
      });
    } else {
      return res.status(400).json({ message: "Método de pago no soportado" });
    }
  } catch (e) {
    console.error("Error creating payment intent:", e);
    res.status(500).json({ message: e.message });
  }
};

// Confirmar pago
export const confirmPayment = async (req, res) => {
  try {
    const { reservaId, paymentMethod, transactionId } = req.body;
    const reserva = await Reserva.findById(reservaId);
    
    if (!reserva) {
      return res.status(404).json({ message: "Reserva no encontrada" });
    }
    
    // Verificar que la reserva pertenezca al usuario autenticado
    if (reserva.usuario.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "No tienes permiso para confirmar esta reserva" });
    }
    
    if (paymentMethod === "stripe") {
      // Verificar el pago con Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(reserva.paymentIntentId);
      
      if (paymentIntent.status === "succeeded") {
        reserva.estadoPago = "pagado";
        reserva.paymentStatus = "succeeded";
        reserva.transactionId = paymentIntent.id;
        reserva.paymentDate = new Date();
      } else {
        reserva.paymentStatus = "failed";
      }
    } else if (paymentMethod === "mercadopago") {
      reserva.estadoPago = "pagado";
      reserva.paymentStatus = "succeeded";
      reserva.transactionId = transactionId || reserva.mpPaymentId;
      reserva.paymentDate = new Date();
    } else if (paymentMethod === "paypal") {
      // Simulación de confirmación de PayPal
      reserva.estadoPago = "pagado";
      reserva.paymentStatus = "succeeded";
      reserva.transactionId = transactionId || reserva.paymentIntentId;
      reserva.paymentDate = new Date();
    } else if (paymentMethod === "test") {
      // Confirmación automática para modo de prueba
      reserva.estadoPago = "pagado";
      reserva.paymentStatus = "succeeded";
      reserva.transactionId = transactionId || reserva.paymentIntentId;
      reserva.paymentDate = new Date();
    }
    
    await reserva.save();
    
    res.json({
      message: "Pago confirmado exitosamente",
      reserva: {
        _id: reserva._id,
        estadoPago: reserva.estadoPago,
        estado: reserva.estadoPago === "pagado" ? "pagada" : "pendiente",
        paymentStatus: reserva.paymentStatus,
        transactionId: reserva.transactionId,
        paymentDate: reserva.paymentDate
      }
    });
  } catch (e) {
    console.error("Error confirming payment:", e);
    res.status(500).json({ message: e.message });
  }
};

// Webhook para Stripe (opcional)
export const stripeWebhook = async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    let event;
    
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
    
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const reservaId = paymentIntent.metadata.reservaId;
      
      if (reservaId) {
        const reserva = await Reserva.findById(reservaId);
        if (reserva) {
          reserva.estadoPago = "pagado";
          reserva.paymentStatus = "succeeded";
          reserva.transactionId = paymentIntent.id;
          reserva.paymentDate = new Date();
          await reserva.save();
        }
      }
    }
    
    res.json({ received: true });
  } catch (e) {
    console.error("Webhook error:", e);
    res.status(400).json({ message: e.message });
  }
};

export const mpWebhook = async (req, res) => {
  try {
    const { action, data, type } = req.body;
    const paymentId = data?.id || req.query["data.id"] || req.query.id;
    const topic = type || req.query.topic;

    if (topic === "payment" && paymentId) {
      // Necesitamos buscar el pago. Podemos buscarlo usando el access token global de la plataforma, 
      // pero si el pago lo hizo el vendedor, tal vez nos rechace. 
      // Por ahora, como es webhook, lo marcaremos si nos envian algo valido (la verificacion real requiere el token del vendedor).
      // Buscar la reserva que tiene este paymentId (si lo guardamos en frontend), o confiar por ahora en una verificacion diferida.
      // Para integraciones maduras, MarketPlace Webhooks deberían identificar el user_id del vendedor.
      
      console.log(`Webhook MercadoPago - Pago actualizado: ${paymentId}`);
    }

    res.status(200).send("OK");
  } catch (e) {
    console.error("MP Webhook error:", e);
    res.status(400).json({ message: e.message });
  }
};

// Obtener métodos de pago disponibles
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: "mercadopago",
        name: "MercadoPago",
        description: "Paga de forma segura con MercadoPago",
        enabled: true,
        testMode: false
      },
      {
        id: "stripe",
        name: "Tarjeta de Crédito/Débito",
        description: "Paga con Visa, Mastercard, American Express",
        enabled: true,
        testMode: process.env.NODE_ENV !== "production"
      },
      {
        id: "paypal",
        name: "PayPal",
        description: "Paga con tu cuenta de PayPal",
        enabled: true,
        testMode: true
      },
      {
        id: "test",
        name: "Modo de Prueba",
        description: "Simular pago sin costo (solo para desarrollo)",
        enabled: process.env.NODE_ENV !== "production",
        testMode: true
      }
    ];
    
    res.json(methods.filter(method => method.enabled));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
