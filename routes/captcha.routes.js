import express from 'express';
import { generateCaptcha } from '../controllers/captcha.controller.js';

const router = express.Router();

// Ruta para generar un nuevo CAPTCHA
router.get('/generate', generateCaptcha);

export default router;