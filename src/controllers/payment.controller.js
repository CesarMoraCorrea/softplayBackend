import Stripe from "stripe";
import Reserva from "../models/Reserva.js";

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
    
    if (reserva.estado === "pagada") {
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
        reserva.estado = "pagada";
        reserva.paymentStatus = "succeeded";
        reserva.transactionId = paymentIntent.id;
        reserva.paymentDate = new Date();
      } else {
        reserva.paymentStatus = "failed";
      }
    } else if (paymentMethod === "paypal") {
      // Simulación de confirmación de PayPal
      reserva.estado = "pagada";
      reserva.paymentStatus = "succeeded";
      reserva.transactionId = transactionId || reserva.paymentIntentId;
      reserva.paymentDate = new Date();
    } else if (paymentMethod === "test") {
      // Confirmación automática para modo de prueba
      reserva.estado = "pagada";
      reserva.paymentStatus = "succeeded";
      reserva.transactionId = transactionId || reserva.paymentIntentId;
      reserva.paymentDate = new Date();
    }
    
    await reserva.save();
    
    res.json({
      message: "Pago confirmado exitosamente",
      reserva: {
        _id: reserva._id,
        estado: reserva.estado,
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
          reserva.estado = "pagada";
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

// Obtener métodos de pago disponibles
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
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
