import multer from "multer";
import { S3Client } from "@aws-sdk/client-s3";
import multerS3 from "multer-s3";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Configuración del cliente S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Solo se permiten imágenes"), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      // Retornar a la categoría 'sedes' que prefiere el usuario
      cb(null, `sedes/${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const handleUpload = async (req, res) => {
  try {
    console.log("=== INICIANDO SUBIDA S3 ===");
    console.log("Files:", req.files);
    console.log("Body:", req.body);

    const files = req.files || [];
    if (files.length === 0) {
      console.log("❌ No files received by multer");
      return res.status(400).json({ message: "No se subió ninguna imagen" });
    }

    // multer-s3 añade la propiedad 'location' a cada archivo (URL pública)
    const urls = files.map((file) => file.location);
    console.log("✅ URLs generadas:", urls);

    res.json({ message: "Imágenes subidas exitosamente", urls });
  } catch (error) {
    console.error("❌ Error CRITICO al subir a S3:", error);
    res.status(500).json({ message: "Error al subir imágenes", error: error.message });
  }
};
