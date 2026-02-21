import mongoose from "mongoose";

const reservaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cancha: { type: mongoose.Schema.Types.ObjectId, ref: "Cancha", required: true },
  fecha: { type: Date, required: true },
  horas: { type: Number, required: true, min: 1 },
  total: { type: Number, required: true },
  estado: { type: String, enum: ["pendiente", "pagada", "cancelada"], default: "pendiente" },
  paymentIntentId: String,
  paymentMethod: { type: String, enum: ["stripe", "paypal", "test"], default: "stripe" },
  paymentStatus: { type: String, enum: ["pending", "processing", "succeeded", "failed", "canceled"], default: "pending" },
  transactionId: String,
  paymentDate: Date,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Reserva", reservaSchema);
