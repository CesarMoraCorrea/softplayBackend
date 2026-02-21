import { Router } from "express";
import { upload, handleUpload, streamFile } from "../controllers/upload.controller.js";
import { protect, isAdminCancha } from "../middlewares/auth.js";

const router = Router();
router.post("/", protect, isAdminCancha, upload.array("files", 5), handleUpload);
router.get("/files/:id", streamFile);
export default router;
