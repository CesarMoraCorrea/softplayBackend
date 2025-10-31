import multer from "multer";
import mongoose from "mongoose";
import { Readable } from "stream";

// Validación de tipo y límite de tamaño
const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) return cb(new Error("Solo imágenes"), false);
  cb(null, true);
};
const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB

// Obtener bucket GridFS (asegurando conexión)
const getBucket = async () => {
  if (!mongoose.connection.db || mongoose.connection.readyState !== 1) {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/canchasdb";
    await mongoose.connect(uri);
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
};

export const upload = multer({ storage: multer.memoryStorage(), fileFilter, limits });

export const handleUpload = async (req, res) => {
  try {
    const bucket = await getBucket();
    const files = req.files || [];

    const saveOne = (file) =>
      new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(file.originalname, {
          contentType: file.mimetype,
        });
        Readable.from(file.buffer)
          .pipe(uploadStream)
          .on("error", reject)
          .on("finish", () => {
            const id = uploadStream.id;
            resolve({ id: typeof id === "string" ? id : id?.toString() });
          });
      });

    const results = await Promise.all(files.map(saveOne));
    const ids = results.map((r) => r.id);
    const apiBase = "/api/upload/files";
    const urls = ids.map((id) => `${apiBase}/${id}`);

    res.json({ files: ids, urls });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

export const streamFile = async (req, res) => {
  try {
    const bucket = await getBucket();
    const id = new mongoose.Types.ObjectId(req.params.id);

    const docs = await bucket.find({ _id: id }).toArray();
    if (!docs || docs.length === 0) {
      return res.status(404).json({ message: "Archivo no encontrado" });
    }
    const doc = docs[0];

    if (doc.contentType) res.set("Content-Type", doc.contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");

    bucket
      .openDownloadStream(id)
      .on("error", () => res.status(404).end())
      .pipe(res);
  } catch (e) {
    res.status(400).json({ message: "ID inválido" });
  }
};
