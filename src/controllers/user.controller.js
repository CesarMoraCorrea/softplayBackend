import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { ROLES } from "../utils/roles.js";

// Obtener todos los usuarios (solo admin sistema)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Obtener un usuario por ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Crear nuevo usuario (admin)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    
    // Verificar si el email ya existe
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "El correo ya está registrado" });
    
    // Crear usuario
    const user = await User.create({
      name,
      email,
      password,
      role: role || ROLES.USER,
      phone
    });
    
    // Retornar usuario sin contraseña
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      createdAt: user.createdAt
    };
    
    res.status(201).json(userResponse);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Actualizar usuario
export const updateUser = async (req, res) => {
  try {
    const { name, email, role, phone, password } = req.body;
    const updateData = { name, email, role, phone };
    
    // Si se proporciona nueva contraseña, hashearla
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");
    
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Cambiar estado activo/inactivo del usuario
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    
    // Agregar campo activo al modelo si no existe
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { activo: !user.activo },
      { new: true }
    ).select("-password");
    
    res.json(updatedUser);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Eliminar usuario
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};