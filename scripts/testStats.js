import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno del backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error("MONGO_URI no definido en .env");
  process.exit(1);
}

// Modelos mínimos para que Mongoose funcione
const Schema = mongoose.Schema;
const SedeSchema = new Schema({
  nombre: String,
  propietario: Schema.Types.ObjectId,
  escenarios: [{
    nombre: String,
    activo: Boolean
  }]
});
const Sede = mongoose.models.Sede || mongoose.model("Sede", SedeSchema);

const ReservaSchema = new Schema({
  usuario: Schema.Types.ObjectId,
  sede: Schema.Types.ObjectId,
  escenario: Schema.Types.ObjectId,
  fecha: Date,
  horaInicio: String,
  horaFin: String,
  total: Number,
  estadoPago: String,
  paymentStatus: String
});
const Reserva = mongoose.models.Reserva || mongoose.model("Reserva", ReservaSchema);

async function testAggregation() {
  try {
    console.log("Conectando a MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Conectado exitosamente.");

    const period = "weekly";
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30); // 30 días para asegurar que agarre datos si es que hay

    const matchQuery = {
      fecha: { $gte: startDate, $lte: endDate },
      paymentStatus: { $ne: "canceled" },
      estadoPago: { $ne: "bloqueado" }
    };

    console.log("Corriendo consulta de agregación...");
    const aggregationResult = await Reserva.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          globalMetrics: [
            {
              $group: {
                _id: null,
                totalReservations: { $sum: 1 },
                totalRevenue: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$estadoPago", "pagado"] },
                          { $eq: ["$paymentStatus", "succeeded"] }
                        ]
                      },
                      "$total",
                      0
                    ]
                  }
                }
              }
            }
          ],
          topCanchas: [
            {
              $group: {
                _id: { escenario: "$escenario", sede: "$sede" },
                reservationsCount: { $sum: 1 }
              }
            },
            { $sort: { reservationsCount: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "sedes",
                localField: "_id.sede",
                foreignField: "_id",
                as: "sedeDoc"
              }
            },
            { $unwind: "$sedeDoc" },
            {
              $project: {
                _id: "$_id.escenario",
                reservationsCount: 1,
                name: {
                  $let: {
                    vars: {
                      esc: {
                        $filter: {
                          input: "$sedeDoc.escenarios",
                          as: "e",
                          cond: { $eq: ["$$e._id", "$_id.escenario"] }
                        }
                      }
                    },
                    in: {
                      $concat: [
                        "$sedeDoc.nombre",
                        " - ",
                        { $ifNull: [{ $arrayElemAt: ["$$esc.nombre", 0] }, "Cancha"] }
                      ]
                    }
                  }
                }
              }
            }
          ],
          daysDemand: [
            {
              $group: {
                _id: { $dayOfWeek: { date: "$fecha", timezone: "America/Bogota" } },
                reservationsCount: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          peakHours: [
            {
              $group: {
                _id: "$horaInicio",
                reservationsCount: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    console.log("Resultado de la agregación:");
    console.log(JSON.stringify(aggregationResult[0], null, 2));

    await mongoose.disconnect();
    console.log("Conexión cerrada.");
  } catch (error) {
    console.error("Error en test de agregación:", error);
  }
}

testAggregation();
