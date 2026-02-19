import express from 'express';
import { generateCaptcha, checkCaptcha } from '../controllers/captcha.controller.js';

const router = express.Router();

// Ruta para generar un nuevo CAPTCHA
router.get('/generate', generateCaptcha);
router.post('/check', checkCaptcha);

export default router;