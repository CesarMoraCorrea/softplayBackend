import { Router } from "express";
import {
    crearReserva,
    crearReservaBloqueada,
    misReservas,
    reservasDeCancha,
    actualizarEstado,
    getReservaById,
    getHorariosOcupados,
    cancelarReservaFisica
} from "../controllers/reserva.controller.js";
import { protect, isAdminCancha } from "../middlewares/auth.js";

const router = Router();

router.get("/ocupados/:escenarioId", getHorariosOcupados);

router.post("/bloquear", protect, crearReservaBloqueada);
router.post("/", protect, crearReserva);
router.get("/mias", protect, misReservas);
router.get("/sede/:sedeId", protect, isAdminCancha, reservasDeCancha);
router.patch("/:id/estado", protect, actualizarEstado);
router.get("/:id", protect, getReservaById);
router.delete("/:id", protect, cancelarReservaFisica);

export default router;
