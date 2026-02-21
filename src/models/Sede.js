import mongoose from "mongoose";

const escenarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  tipoDeporte: {
    type: String,
    required: true,
    enum: ["Fútbol", "Fútbol 5", "Fútbol 7", "Fútbol 11", "Tenis", "Padel", "Basquet", "Voley"]
  },
  superficie: {
    type: String,
    required: true,
    enum: ["Sintética", "Natural", "Polvo de ladrillo", "Cemento", "Madera", "Acrílica"]
  },
  precioPorHora: { type: Number, required: true, min: 0 },
  activo: { type: Boolean, default: true }
}, { _id: true });

const sedeSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, index: true },
  ubicacion: {
    direccion: { type: String, required: true, trim: true },
    barrio: { type: String, required: true, trim: true },
    coordenadas: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => Array.isArray(value) && value.length === 2,
          message: "Las coordenadas deben estar en formato [lng, lat]"
        }
      }
    }
  },
  servicios: [{ type: String, trim: true }],
  escenarios: [escenarioSchema],
  activa: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

sedeSchema.index({ "ubicacion.coordenadas": "2dsphere" });

export { escenarioSchema };
export default mongoose.model("Sede", sedeSchema);