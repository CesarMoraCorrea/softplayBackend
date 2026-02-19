import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ROLES } from "../utils/roles.js";

export const protect = async (req,res,next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if(!token) return res.status(401).json({ message: "No autorizado" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    const user = await User.findById(decoded.id);
    if(!user) return res.status(401).json({ message: "Usuario no encontrado" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

export const authorize = (...roles) => (req,res,next) => {
  if(!req.user) return res.status(401).json({ message: "No autorizado" });
  if(!roles.includes(req.user.role)) return res.status(403).json({ message: "Sin permisos" });
  next();
};

export const isAdminSistema = authorize(ROLES.ADMIN_SISTEMA);
export const isAdminCancha = authorize(ROLES.ADMIN_CANCHA, ROLES.ADMIN_SISTEMA);
