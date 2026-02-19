import svgCaptcha from 'svg-captcha';

// Almacén temporal para los captchas (en producción usar Redis)
const captchaStore = new Map();

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
    
    // Almacenar el texto del captcha con expiración de 5 minutos
    captchaStore.set(captchaId, {
      text: captcha.text.toLowerCase(),
      expires: Date.now() + 5 * 60 * 1000 // 5 minutos
    });
    
    // Limpiar captchas expirados
    cleanExpiredCaptchas();
    
    res.json({
      captchaId,
      captchaSvg: captcha.data
    });
  } catch (error) {
    console.error('Error generando CAPTCHA:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const validateCaptcha = (captchaId, userInput) => {
  if (!captchaId || !userInput) {
    return false;
  }
  
  const captchaData = captchaStore.get(captchaId);
  
  if (!captchaData) {
    return false; // CAPTCHA no encontrado
  }
  
  if (Date.now() > captchaData.expires) {
    captchaStore.delete(captchaId);
    return false; // CAPTCHA expirado
  }
  
  const isValid = captchaData.text === userInput.toLowerCase().trim();
  
  // Eliminar el captcha después de usarlo (un solo uso)
  captchaStore.delete(captchaId);
  
  return isValid;
};

// Verificación no destructiva para feedback de UI
export const checkCaptcha = async (req, res) => {
  try {
    const { captchaId, captchaInput } = req.body || {};
    if (!captchaId || !captchaInput) {
      return res.status(400).json({ valid: false, message: "Faltan parámetros" });
    }

    const captchaData = captchaStore.get(captchaId);
    if (!captchaData) {
      return res.status(400).json({ valid: false, message: "CAPTCHA no encontrado" });
    }

    if (Date.now() > captchaData.expires) {
      return res.status(400).json({ valid: false, message: "CAPTCHA expirado" });
    }

    const valid = captchaData.text === String(captchaInput).toLowerCase().trim();
    return res.json({ valid });
  } catch (error) {
    console.error('Error verificando CAPTCHA:', error);
    return res.status(500).json({ valid: false, message: 'Error interno del servidor' });
  }
};

// Función para limpiar captchas expirados
const cleanExpiredCaptchas = () => {
  const now = Date.now();
  for (const [id, data] of captchaStore.entries()) {
    if (now > data.expires) {
      captchaStore.delete(id);
    }
  }
};

// Limpiar captchas expirados cada 10 minutos
setInterval(cleanExpiredCaptchas, 10 * 60 * 1000);