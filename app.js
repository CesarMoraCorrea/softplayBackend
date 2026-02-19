import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/auth.routes.js";
import canchaRoutes from "./src/routes/cancha.routes.js";
import reservaRoutes from "./src/routes/reserva.routes.js";
import uploadRoutes from "./src/routes/upload.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import captchaRoutes from "./src/routes/captcha.routes.js";

// Cargar variables de entorno y conectar a la BD
dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta estática para uploads (nota: en Vercel el FS es efímero)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/canchas", canchaRoutes);
app.use("/api/reservas", reservaRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/captcha", captchaRoutes);

// Healthcheck
app.get("/api/health", (req, res) => res.json({ ok: true, service: "canchas-backend" }));

export default app;