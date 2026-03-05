import mongoose from "mongoose";

const descansoSchema = new mongoose.Schema({
  inicio: { type: String, required: true },
  fin: { type: String, required: true }
}, { _id: false });

const diaHorarioSchema = new mongoose.Schema({
  isAbierto: { type: Boolean, default: true },
  apertura: { type: String, default: "06:00" },
  cierre: { type: String, default: "22:00" },
  descansos: [descansoSchema]
}, { _id: false });

const configuracionHorarioSchema = new mongoose.Schema({
  horarioPorDia: {
    type: [diaHorarioSchema],
    validate: {
      validator: function (v) {
        return v && v.length === 7;
      },
      message: 'horarioPorDia debe tener exactamente 7 elementos (0=Domingo a 6=Sábado)'
    },
    default: () => Array(7).fill({
      isAbierto: true,
      apertura: "06:00",
      cierre: "22:00",
      descansos: []
    })
  },
  intervaloMinutos: { type: Number, enum: [30, 60], default: 60 }
}, { _id: false });

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
  activo: { type: Boolean, default: true },
  // Horario personalizado (opcional) que sobreescribirá el horario de la sede
  usarHorarioPersonalizado: { type: Boolean, default: false },
  configuracionHorario: {
    type: configuracionHorarioSchema,
    default: undefined
  },
  imagenes: [{ type: String }]
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
  configuracionHorario: {
    type: configuracionHorarioSchema,
    default: () => ({
      horarioPorDia: Array(7).fill({ isAbierto: true, apertura: "06:00", cierre: "22:00", descansos: [] }),
      intervaloMinutos: 60
    })
  },
  imagenes: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

sedeSchema.index({ "ubicacion.coordenadas": "2dsphere" });

export { escenarioSchema };
export default mongoose.model("Sede", sedeSchema);