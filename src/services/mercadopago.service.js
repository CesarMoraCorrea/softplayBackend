import { MercadoPagoConfig, Preference, Payment, OAuth } from "mercadopago";
import User from "../models/User.js";

const MP_CLIENT_ID = process.env.MP_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI || "http://localhost:5000/api/payments/mercadopago/oauth/callback";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const MP_MARKETPLACE_FEE_PERCENT = parseFloat(process.env.MP_MARKETPLACE_FEE_PERCENT || "10");
const MP_MARKETPLACE_FEE_FIXED = parseFloat(process.env.MP_MARKETPLACE_FEE_FIXED || "0");

// Obtener URL de autorización OAuth para que el vendedor conecte su cuenta
export function getOAuthUrl(userId) {
  const params = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: MP_REDIRECT_URI,
    state: userId.toString(),
  });
  return `https://auth.mercadopago.com/authorization?${params.toString()}`;
}

// Intercambiar código de autorización por tokens del vendedor
export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    client_secret: MP_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: MP_REDIRECT_URI,
  });

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error OAuth MP: ${err.message || JSON.stringify(err)}`);
  }
  return res.json();
}

// Refrescar el token del vendedor si está vencido
export async function refreshSellerToken(userId) {
  const user = await User.findById(userId).select("+mpRefreshToken");
  if (!user || !user.mpRefreshToken) throw new Error("No hay refresh token guardado");

  const body = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    client_secret: MP_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: user.mpRefreshToken,
  });

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Error refresh token MP: ${err.message || JSON.stringify(err)}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in || 15552000) * 1000);

  await User.findByIdAndUpdate(userId, {
    mpAccessToken: data.access_token,
    mpRefreshToken: data.refresh_token || user.mpRefreshToken,
    mpExpiresAt: expiresAt,
  });

  return data.access_token;
}

// Obtener el access token vigente de un vendedor, refrescándolo si venció
export async function getValidSellerToken(propietario) {
  if (!propietario.mpConnected || !propietario.mpAccessToken) {
    throw new Error("El propietario no tiene Mercado Pago conectado");
  }

  const now = new Date();
  if (propietario.mpExpiresAt && propietario.mpExpiresAt <= now) {
    console.log("[MP] Token vencido, refrescando...");
    return refreshSellerToken(propietario._id);
  }

  return propietario.mpAccessToken;
}

// Crear preferencia marketplace para una reserva
export async function createReservationPreference({ reserva, sede, propietario }) {
  const accessToken = await getValidSellerToken(propietario);
  const client = new MercadoPagoConfig({ accessToken });
  const preferenceApi = new Preference(client);

  const marketplaceFee = MP_MARKETPLACE_FEE_FIXED + (reserva.total * MP_MARKETPLACE_FEE_PERCENT) / 100;

  const result = await preferenceApi.create({
    body: {
      items: [
        {
          id: reserva._id.toString(),
          title: `Reserva Cancha - ${sede.nombre}`,
          quantity: 1,
          unit_price: Number(reserva.total),
          currency_id: "COP",
        },
      ],
      // marketplace_fee deshabilitado: requiere app registrada como Marketplace con OAuth real
      // marketplace_fee: marketplaceFee,
      external_reference: reserva._id.toString(),
      metadata: {
        reservaId: reserva._id.toString(),
        userId: reserva.usuario.toString(),
        sedeId: sede._id.toString(),
        propietarioId: propietario._id.toString(),
      },
      notification_url: `${BACKEND_URL}/api/payments/webhook/mercadopago`,
      back_urls: {
        success: `${FRONTEND_URL}/mis-reservas?status=success&reservaId=${reserva._id}`,
        failure: `${FRONTEND_URL}/mis-reservas?status=failure&reservaId=${reserva._id}`,
        pending: `${FRONTEND_URL}/mis-reservas?status=pending&reservaId=${reserva._id}`,
      },
    },
  });

  return { result, marketplaceFee };
}

// Consultar un pago real en MP usando el token del propietario
export async function getPaymentForReservation(paymentId, propietario) {
  const accessToken = await getValidSellerToken(propietario);
  const client = new MercadoPagoConfig({ accessToken });
  const paymentApi = new Payment(client);
  return paymentApi.get({ id: paymentId });
}
