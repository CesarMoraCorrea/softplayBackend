import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { protect, isAdminCancha } from "../middlewares/auth.js";

const router = Router();

router.get("/", protect, isAdminCancha, getDashboardStats);

export default router;
