import { Router } from "express";
import { createCancha, listCanchas, getCancha, updateCancha, deleteCancha } from "../controllers/cancha.controller.js";
import { protect, isAdminCancha, isAdminSistema } from "../middlewares/auth.js";

const router = Router();
router.get("/", listCanchas);
router.get("/:id", getCancha);
router.post("/", protect, isAdminCancha, createCancha);
router.put("/:id", protect, isAdminCancha, updateCancha);
router.delete("/:id", protect, isAdminSistema, deleteCancha);
export default router;
