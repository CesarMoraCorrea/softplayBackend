import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import sedeRoutes from "./routes/sede.routes.js";
import reservaRoutes from "./routes/reserva.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import userRoutes from "./routes/user.routes.js";
import captchaRoutes from "./routes/captcha.routes.js";

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
const registerRoute = (path, router) => {
	app.use(`/api${path}`, router);
	app.use(path, router);
};

registerRoute("/auth", authRoutes);
registerRoute("/sedes", sedeRoutes);
registerRoute("/reservas", reservaRoutes);
registerRoute("/upload", uploadRoutes);
registerRoute("/payments", paymentRoutes);
registerRoute("/users", userRoutes);
registerRoute("/captcha", captchaRoutes);

// Healthcheck
const healthPayload = () => ({
	ok: true,
	service: "sedes-backend",
	commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
	branch: process.env.VERCEL_GIT_COMMIT_REF || null
});

app.get("/api/health", (req, res) => res.json(healthPayload()));
app.get("/health", (req, res) => res.json(healthPayload()));

export default app;