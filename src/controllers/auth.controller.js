import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ROLES } from "../utils/roles.js";
import { validateCaptcha } from "./captcha.controller.js";

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET || "devsecret", { expiresIn: "7d" });

export const register = async (req,res) => {
  try{
    const { name, email, password, role, captchaId, captchaInput } = req.body;
    
    // Validar campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }
    
    // Validar CAPTCHA
    if (!validateCaptcha(captchaId, captchaInput)) {
      return res.status(400).json({ message: "CAPTCHA inválido o expirado" });
    }
    
    const exists = await User.findOne({ email });
    if(exists) return res.status(409).json({ message: "El correo ya está registrado" });
    
    const user = await User.create({ name, email, password, role: role || ROLES.USER });
    res.json({ token: sign(user._id), user: { id:user._id, name:user.name, email:user.email, role:user.role } });
  }catch(e){
    if (e.name === 'ValidationError') {
      return res.status(400).json({ message: "Datos de registro inválidos" });
    }
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const login = async (req,res) => {
  try{
    const { email, password, captchaId, captchaInput } = req.body;
    
    // Validar CAPTCHA
    if (!validateCaptcha(captchaId, captchaInput)) {
      return res.status(400).json({ message: "CAPTCHA inválido o expirado" });
    }
    
    const user = await User.findOne({ email }).select("+password");
    if(!user) return res.status(404).json({ message: "Usuario no registrado" });
    
    const ok = await user.comparePassword(password);
    if(!ok) return res.status(401).json({ message: "Contraseña incorrecta" });
    
    // Verificar si el usuario está activo
    if(!user.activo) return res.status(403).json({ message: "Usuario desactivado" });
    
    res.json({ token: sign(user._id), user: { id:user._id, name:user.name, email:user.email, role:user.role } });
  }catch(e){
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const me = async (req,res) => {
  const u = req.user;
  res.json({ id:u._id, name:u.name, email:u.email, role:u.role });
};
