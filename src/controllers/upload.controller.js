import multer from "multer";
import { Storage } from "@google-cloud/storage";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Inicializar cliente de Google Cloud Storage
// En Cloud Run, se autenticará automáticamente usando las credenciales del Service Account por defecto.
// Localmente se puede configurar usando la variable de entorno GOOGLE_APPLICATION_CREDENTIALS.
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && {
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  }),
});

const bucketName = process.env.GCS_BUCKET_NAME || "softplay-bucket-sedes";
const bucket = storage.bucket(bucketName);

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Solo se permiten imágenes"), false);
  }
  cb(null, true);
};

// Usamos almacenamiento en memoria (MemoryStorage) para procesar los streams con GCS
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
});

export const handleUpload = async (req, res) => {
  try {
    console.log("=== INICIANDO SUBIDA A GCS ===");
    console.log("Files:", req.files);
    console.log("Body:", req.body);

    const files = req.files || [];
    if (files.length === 0) {
      console.log("❌ No files received by multer");
      return res.status(400).json({ message: "No se subió ninguna imagen" });
    }

    const uploadPromises = files.map((file) => {
      return new Promise((resolve, reject) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const gcsFileName = `sedes/${uniqueSuffix}${path.extname(file.originalname)}`;
        const blob = bucket.file(gcsFileName);
        
        const blobStream = blob.createWriteStream({
          resumable: false,
          metadata: {
            contentType: file.mimetype,
          },
        });

        blobStream.on("error", (err) => {
          console.error("❌ Error de GCS en stream:", err);
          reject(err);
        });

        blobStream.on("finish", () => {
          // URL pública del archivo en GCS.
          // Nota: El bucket debe configurarse en GCP como de acceso de lectura público (Fine-grained or Uniform IAM).
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${gcsFileName}`;
          resolve(publicUrl);
        });

        blobStream.end(file.buffer);
      });
    });

    const urls = await Promise.all(uploadPromises);
    console.log("✅ URLs generadas GCS:", urls);

    res.json({ message: "Imágenes subidas exitosamente a GCS", urls });
  } catch (error) {
    console.error("❌ Error CRITICO al subir a GCS:", error);
    res.status(500).json({ message: "Error al subir imágenes a GCS", error: error.message });
  }
};
