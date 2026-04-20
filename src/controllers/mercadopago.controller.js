import fetch from "node-fetch";
import User from "../models/User.js";
import { MercadoPagoConfig, Preference } from "mercadopago";

// Para usar fetch nativo en Node 18+ o instalar node-fetch si es menor.
// Asumiendo que pueden tener Node 18+, usamos fetch nativo. Si falla, importamos node-fetch u axios.
const fetchApi = global.fetch || fetch;

export const getAuthorizationUrl = (req, res) => {
  const { redirectUri } = req.query;

  if (!redirectUri) {
    return res.status(400).json({ message: "redirectUri es requerido" });
  }

  const clientId = process.env.MP_CLIENT_ID;
  const url = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.json({ url });
};

export const linkAccount = async (req, res) => {
  try {
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ message: "code y redirectUri son requeridos" });
    }

    const response = await fetchApi("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`
      },
      body: new URLSearchParams({
        client_id: process.env.MP_CLIENT_ID,
        client_secret: process.env.MP_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error MercadoPago OAuth:", data);
      return res.status(response.status).json({ message: "Error al vincular cuenta de MercadoPago", details: data });
    }

    // Guardar en el usuario
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    user.mpAccessToken = data.access_token;
    user.mpPublicKey = data.public_key;
    user.mpRefreshToken = data.refresh_token;
    user.mpUserId = data.user_id;

    await user.save();

    res.json({ message: "Cuenta vinculada exitosamente", mpUserId: data.user_id });
  } catch (error) {
    console.error("Link Account Error:", error);
    res.status(500).json({ message: error.message });
  }
};
