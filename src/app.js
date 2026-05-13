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
import mercadopagoRoutes from "./routes/mercadopago.routes.js";
import statsRoutes from "./routes/stats.routes.js";

// Cargar variables de entorno y conectar a la BD
dotenv.config();
connectDB();

const app = express();
const corsOptions = {
	origin: [
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'https://softplay.fit',       // Dominio personalizado en Vercel
		'https://www.softplay.fit',   // Variante con www
		/^https:\/\/.*\.vercel\.app$/, // Permite cualquier subdominio de Vercel (develop, main, previews)
		/^https:\/\/.*\.loca\.lt$/ // Permite subdominios de LocalTunnel
	],
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	credentials: true,
	optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
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
registerRoute("/mercadopago", mercadopagoRoutes);
registerRoute("/stats", statsRoutes);

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