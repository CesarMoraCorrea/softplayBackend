import { Router } from "express";
import {
  createSede,
  listSedes,
  getSede,
  getEscenario,
  updateSede,
  deleteSede
} from "../controllers/sede.controller.js";
import { protect, isAdminCancha, isAdminSistema } from "../middlewares/auth.js";

const router = Router();

router.get("/", listSedes);
router.get("/escenarios/:id", getEscenario);
router.get("/:id", getSede);
router.post("/", protect, isAdminCancha, createSede);
router.put("/:id", protect, isAdminCancha, updateSede);
router.delete("/:id", protect, isAdminSistema, deleteSede);

export default router;