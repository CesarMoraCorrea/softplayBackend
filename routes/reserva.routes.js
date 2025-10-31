import { Router } from "express";
import { crearReserva, misReservas, reservasDeCancha, actualizarEstado, getReservaById } from "../controllers/reserva.controller.js";
import { protect, isAdminCancha } from "../middleware/auth.js";

const router = Router();
router.post("/", protect, crearReserva);
router.get("/mias", protect, misReservas);
router.get("/cancha/:canchaId", protect, isAdminCancha, reservasDeCancha);
router.patch("/:id/estado", protect, actualizarEstado);
router.get("/:id", protect, getReservaById);
export default router;
