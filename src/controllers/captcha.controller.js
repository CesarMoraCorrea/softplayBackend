import svgCaptcha from 'svg-captcha';
import Captcha from '../models/Captcha.js';

// Configuración del CAPTCHA
const captchaConfig = {
  size: 5, // Número de caracteres
  noise: 2, // Nivel de ruido
  color: true, // Usar colores
  background: '#f0f0f0', // Color de fondo
  width: 150,
  height: 50,
  fontSize: 50,
  ignoreChars: '0o1il' // Caracteres que pueden confundirse
};

export const generateCaptcha = async (req, res) => {
  try {
    // Generar CAPTCHA
    const captcha = svgCaptcha.create(captchaConfig);

    // Generar ID único para el captcha
    const captchaId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Almacenar el texto del captcha en MongoDB
    await Captcha.create({
      captchaId,
      text: captcha.text.toLowerCase()
    });

    res.json({
      captchaId,
      captchaSvg: captcha.data
    });
  } catch (error) {
    console.error('Error generando CAPTCHA:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const validateCaptcha = async (captchaId, userInput) => {
  if (!captchaId || !userInput) {
    return false;
  }

  // Buscar y eliminar el captcha al mismo tiempo para un solo uso
  const captchaData = await Captcha.findOneAndDelete({ captchaId });

  if (!captchaData) {
    return false; // CAPTCHA no encontrado o expirado por TTL
  }

  const isValid = captchaData.text === userInput.toLowerCase().trim();

  return isValid;
};

// Verificación no destructiva para feedback de UI
export const checkCaptcha = async (req, res) => {
  try {
    const { captchaId, captchaInput } = req.body || {};
    if (!captchaId || !captchaInput) {
      return res.status(400).json({ valid: false, message: "Faltan parámetros" });
    }

    const captchaData = await Captcha.findOne({ captchaId });
    if (!captchaData) {
      return res.status(400).json({ valid: false, message: "CAPTCHA no encontrado o expirado" });
    }

    const valid = captchaData.text === String(captchaInput).toLowerCase().trim();
    return res.json({ valid });
  } catch (error) {
    console.error('Error verificando CAPTCHA:', error);
    return res.status(500).json({ valid: false, message: 'Error interno del servidor' });
  }
};