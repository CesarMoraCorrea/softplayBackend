import mongoose from "mongoose";

const reservaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sede: { type: mongoose.Schema.Types.ObjectId, ref: "Sede", required: true },
  escenario: { type: mongoose.Schema.Types.ObjectId, required: true },
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true },
  horaFin: { type: String, required: true },
  total: { type: Number, required: true, min: 0 },
  estadoPago: { type: String, enum: ["pendiente", "pagado"], default: "pendiente" },
  paymentIntentId: String,
  paymentMethod: { type: String, enum: ["stripe", "paypal", "test"], default: "stripe" },
  paymentStatus: { type: String, enum: ["pending", "processing", "succeeded", "failed", "canceled"], default: "pending" },
  transactionId: String,
  paymentDate: Date,
  createdAt: { type: Date, default: Date.now }
});

reservaSchema.index({ sede: 1, escenario: 1, fecha: 1, horaInicio: 1, horaFin: 1 });

export default mongoose.model("Reserva", reservaSchema);
