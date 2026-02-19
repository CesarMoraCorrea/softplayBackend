import mongoose from "mongoose";

const canchaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: String,
  direccion: String,
  ubicacion: {
    lat: Number,
    lng: Number
  },
  precioHora: { type: Number, required: true, default: 0 },
  imagenes: [String], // URLs relativas de /uploads
  tipoCancha: {
    type: String,
    enum: ["Fútbol 5", "Fútbol 7", "Fútbol 11", "Tenis", "Padel", "Basquet"],
    default: ""
  },
  servicios: [{
    type: String,
    enum: ["aparcamiento", "iluminacion", "vestuarios", "duchas", "wifi", "cafeteria"]
  }],
  horarios: [{
    type: String,
    enum: ["Mañana (6-12h)", "Tarde (12-18h)", "Noche (18-24h)"]
  }],
  propietario: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  activa: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Cancha", canchaSchema);
