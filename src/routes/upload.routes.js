import { Router } from "express";
import { upload, handleUpload } from "../controllers/upload.controller.js";
import { protect, isAdminCancha } from "../middlewares/auth.js";

const router = Router();

// Subida de archivos (hasta 5 imágenes concurrentes en form-data "files")
router.post(
    "/",
    protect,
    isAdminCancha,
    (req, res, next) => {
        const uploadMiddleware = upload.array("files", 5);
        uploadMiddleware(req, res, (err) => {
            if (err) {
                console.error("❌ Error de Multer/S3 detectado en middleware:", err);
                return res.status(400).json({
                    message: "Error al comunicarse con Amazon S3",
                    error: err.message || err.toString()
                });
            }
            next();
        });
    },
    handleUpload
);

export default router;
