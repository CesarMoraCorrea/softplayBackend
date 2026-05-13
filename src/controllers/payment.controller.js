import Stripe from "stripe";
import Reserva from "../models/Reserva.js";
import Sede from "../models/Sede.js";
import User from "../models/User.js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import {
  getOAuthUrl,
  exchangeCodeForToken,
  createReservationPreference,
  getPaymentForReservation,
} from "../services/mercadopago.service.js";

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
      if (!sede) return res.status(404).json({ message: "Sede no encontrada" });

      const propietario = sede.propietario;

      // Fallback en desarrollo: si no hay propietario conectado, usar token global
      let result, marketplaceFee;
      if (propietario && propietario.mpConnected) {
        ({ result, marketplaceFee } = await createReservationPreference({ reserva, sede, propietario }));
      } else {
        // Fallback solo en desarrollo con token global
        console.warn("[MP] Propietario sin MP conectado, usando token global de plataforma (solo dev)");
        const { MercadoPagoConfig: MPConfig, Preference } = await import("mercadopago");
        const globalToken = process.env.MP_ACCESS_TOKEN;
        if (!globalToken) return res.status(400).json({ message: "No hay token de MercadoPago configurado" });

        const client = new MPConfig({ accessToken: globalToken });
        const preferenceApi = new Preference(client);
        marketplaceFee = 0;

        result = await preferenceApi.create({
          body: {
            items: [{ id: reserva._id.toString(), title: `Reserva Cancha - ${sede.nombre}`, quantity: 1, unit_price: Number(reserva.total), currency_id: "COP" }],
            external_reference: reserva._id.toString(),
            metadata: { reservaId: reserva._id.toString(), userId: reserva.usuario.toString() },
            notification_url: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payments/webhook/mercadopago`,
            back_urls: {
              success: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pago-resultado?status=success&reservaId=${reserva._id}`,
              failure: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pago-resultado?status=failure&reservaId=${reserva._id}`,
              pending: `${process.env.FRONTEND_URL || "http://localhost:5173"}/pago-resultado?status=pending&reservaId=${reserva._id}`,
            },
          },
        });
      }

      reserva.mpPreferenceId = result.id;
      reserva.mpInitPoint = result.init_point;
      reserva.mpSandboxInitPoint = result.sandbox_init_point;
      reserva.mpMarketplaceFee = marketplaceFee;
      reserva.paymentMethod = "mercadopago";
      reserva.paymentStatus = "processing";
      await reserva.save();

      const checkoutUrl = result.sandbox_init_point || result.init_point;
      console.log(`[MP] Preferencia creada: ${result.id} | Fee: ${marketplaceFee} | URL: ${checkoutUrl}`);

      return res.json({
        preferenceId: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
        checkoutUrl,
        paymentMethod: "mercadopago",
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
  // Responder 200 inmediatamente para que MP no reintente
  res.status(200).send("OK");

  try {
    const { data, type } = req.body;
    const topic = type || req.query.topic;
    const paymentId = data?.id || req.query["data.id"] || req.query.id;

    if (topic !== "payment" || !paymentId) return;

    console.log(`[MP Webhook] topic=${topic} paymentId=${paymentId}`);

    // Buscar la reserva por preferenceId o external_reference
    // Primero intentamos con token global para consultar el pago
    let payment;
    const globalToken = process.env.MP_ACCESS_TOKEN;
    if (globalToken) {
      try {
        const client = new MercadoPagoConfig({ accessToken: globalToken });
        const paymentApi = new Payment(client);
        payment = await paymentApi.get({ id: paymentId });
      } catch (e) {
        console.warn("[MP Webhook] No se pudo consultar con token global:", e.message);
      }
    }

    // Determinar reservaId desde external_reference o metadata
    const reservaId = payment?.external_reference || payment?.metadata?.reservaId;
    if (!reservaId) {
      console.warn("[MP Webhook] No se encontró reservaId en el pago:", paymentId);
      return;
    }

    const reserva = await Reserva.findById(reservaId).populate({
      path: "sede",
      populate: { path: "propietario" },
    });

    if (!reserva) {
      console.warn("[MP Webhook] Reserva no encontrada:", reservaId);
      return;
    }

    // Si el propietario tiene token propio, re-consultar con él para validez
    const propietario = reserva.sede?.propietario;
    if (propietario?.mpConnected && propietario?.mpAccessToken) {
      try {
        payment = await getPaymentForReservation(paymentId, propietario);
      } catch (e) {
        console.warn("[MP Webhook] Re-consulta con token propietario falló, usando consulta global:", e.message);
      }
    }

    if (!payment) {
      console.warn("[MP Webhook] No se pudo obtener datos del pago:", paymentId);
      return;
    }

    const status = payment.status;
    console.log(`[MP Webhook] Reserva ${reservaId} | Estado pago: ${status}`);

    // Idempotente: no duplicar si ya está pagada
    if (reserva.estadoPago === "pagado" && status === "approved") return;

    if (status === "approved") {
      reserva.estadoPago = "pagado";
      reserva.paymentStatus = "succeeded";
      reserva.mpPaymentId = String(payment.id);
      reserva.transactionId = String(payment.id);
      reserva.paymentDate = new Date();
    } else if (status === "rejected" || status === "cancelled") {
      reserva.paymentStatus = "failed";
    } else if (status === "pending" || status === "in_process") {
      reserva.paymentStatus = "processing";
    }

    await reserva.save();
    console.log(`[MP Webhook] Reserva ${reservaId} actualizada a: ${reserva.paymentStatus}`);
  } catch (e) {
    console.error("[MP Webhook] Error:", e.message);
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

// GET /api/payments/mercadopago/oauth/url — URL de autorización para el vendedor
export const getMpOAuthUrl = (req, res) => {
  try {
    const url = getOAuthUrl(req.user._id);
    res.json({ url });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET /api/payments/mercadopago/oauth/callback — Callback de OAuth MP
export const mpOAuthCallback = async (req, res) => {
  const { code, state } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard?mp_connected=false&error=missing_params`);
  }

  try {
    const data = await exchangeCodeForToken(code);
    const expiresAt = new Date(Date.now() + (data.expires_in || 15552000) * 1000);

    await User.findByIdAndUpdate(state, {
      mpConnected: true,
      mpAccessToken: data.access_token,
      mpRefreshToken: data.refresh_token,
      mpPublicKey: data.public_key,
      mpUserId: String(data.user_id),
      mpTokenType: data.token_type,
      mpScope: data.scope,
      mpExpiresAt: expiresAt,
      mpLiveMode: data.live_mode || false,
    });

    console.log(`[MP OAuth] Vendedor ${state} conectado. UserId MP: ${data.user_id}`);
    res.redirect(`${FRONTEND_URL}/dashboard?mp_connected=true`);
  } catch (e) {
    console.error("[MP OAuth] Error en callback:", e.message);
    res.redirect(`${FRONTEND_URL}/dashboard?mp_connected=false&error=oauth_failed`);
  }
};

// GET /api/payments/mercadopago/status/:reservaId — Consultar estado de pago de reserva
export const getMpPaymentStatus = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.reservaId);
    if (!reserva) return res.status(404).json({ message: "Reserva no encontrada" });

    if (reserva.usuario.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Sin permisos" });
    }

    // Si sigue en processing, consultar MP directamente (necesario en localhost donde el webhook no llega)
    if (reserva.paymentStatus === "processing" && reserva.estadoPago !== "pagado") {
      try {
        const accessToken = process.env.MP_ACCESS_TOKEN;
        const searchRes = await fetch(
          `https://api.mercadopago.com/v1/payments/search?external_reference=${reserva._id}&sort=date_created&criteria=desc`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (searchRes.ok) {
          const mpData = await searchRes.json();
          const approvedPayment = (mpData.results || []).find(p => p.status === "approved");
          if (approvedPayment) {
            reserva.estadoPago = "pagado";
            reserva.paymentStatus = "succeeded";
            reserva.estado = "pagada";
            reserva.mpPaymentId = String(approvedPayment.id);
            reserva.transactionId = String(approvedPayment.id);
            reserva.paymentDate = new Date();
            await reserva.save();
            console.log(`[MP] Pago confirmado via polling: reserva ${reserva._id}, pago ${approvedPayment.id}`);
          }
        }
      } catch (mpErr) {
        console.error("[MP] Error consultando pagos en MP:", mpErr.message);
      }
    }

    res.json({
      reservaId: reserva._id,
      estadoPago: reserva.estadoPago,
      estado: reserva.estado,
      paymentStatus: reserva.paymentStatus,
      mpPaymentId: reserva.mpPaymentId,
      transactionId: reserva.transactionId,
      paymentDate: reserva.paymentDate,
      // Datos para mostrar en pantalla de éxito
      fecha: reserva.fecha,
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
      total: reserva.total,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
