import mongoose from "mongoose";

const reservaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sede: { type: mongoose.Schema.Types.ObjectId, ref: "Sede", required: true },
  escenario: { type: mongoose.Schema.Types.ObjectId, required: true },
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true },
  horaFin: { type: String, required: true },
  total: { type: Number, required: true, min: 0 },
  estadoPago: { type: String, enum: ["pendiente", "pagado", "bloqueado"], default: "pendiente" },
  paymentIntentId: String,
  paymentMethod: { type: String, enum: ["stripe", "paypal", "test", "mercadopago"], default: "stripe" },
  mpPreferenceId: String,
  mpPaymentId: String,
  paymentStatus: { type: String, enum: ["pending", "processing", "succeeded", "failed", "canceled"], default: "pending" },
  transactionId: String,
  paymentDate: Date,
  createdAt: { type: Date, default: Date.now }
});

reservaSchema.index({ sede: 1, escenario: 1, fecha: 1, horaInicio: 1, horaFin: 1 });
// TTL Index de Mongoose: Expira/Borra la reserva en 5 min (300 segs) si se quedó en "bloqueado"
reservaSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300, partialFilterExpression: { estadoPago: "bloqueado" } });

export default mongoose.model("Reserva", reservaSchema);
