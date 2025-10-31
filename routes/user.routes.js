import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser
} from "../controllers/user.controller.js";
import { protect, authorize } from "../middleware/auth.js";
import { ROLES } from "../utils/roles.js";

const router = Router();

// Todas las rutas requieren autenticación y rol de admin sistema
router.use(protect);
router.use(authorize(ROLES.ADMIN_SISTEMA));

// Rutas CRUD para usuarios
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/toggle-status", toggleUserStatus);
router.delete("/:id", deleteUser);

export default router;