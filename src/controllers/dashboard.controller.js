import mongoose from "mongoose";
import Reserva from "../models/Reserva.js";
import Sede from "../models/Sede.js";
import { ROLES } from "../utils/roles.js";

export const getDashboardStats = async (req, res) => {
  try {
    const { period = "weekly", sedeId } = req.query;

    // Calcular rango de fechas
    const endDate = new Date();
    const startDate = new Date();

    if (period === "weekly") {
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === "monthly") {
      startDate.setDate(endDate.getDate() - 30);
    } else if (period === "yearly") {
      startDate.setDate(endDate.getDate() - 365);
    } else {
      return res.status(400).json({ message: "Periodo inválido. Use: weekly, monthly o yearly." });
    }

    startDate.setHours(0, 0, 0, 0);

    // Obtener sedes asociadas al usuario según su rol
    let sedesFilter = [];
    let userSedes = [];

    if (req.user.role === ROLES.ADMIN_CANCHA) {
      userSedes = await Sede.find({ propietario: req.user._id }).select("_id nombre").lean();
      sedesFilter = userSedes.map(s => s._id);

      if (sedesFilter.length === 0) {
        return res.json({
          success: true,
          data: {
            global: { totalRevenue: 0, totalReservations: 0, averageTicket: 0 },
            topCanchas: [],
            daysDemand: [
              { name: "Lunes", reservationsCount: 0 },
              { name: "Martes", reservationsCount: 0 },
              { name: "Miércoles", reservationsCount: 0 },
              { name: "Jueves", reservationsCount: 0 },
              { name: "Viernes", reservationsCount: 0 },
              { name: "Sábado", reservationsCount: 0 },
              { name: "Domingo", reservationsCount: 0 }
            ],
            peakHours: [],
            evolution: [],
            sedes: []
          }
        });
      }
    } else if (req.user.role === ROLES.ADMIN_SISTEMA) {
      userSedes = await Sede.find({}).select("_id nombre").lean();
    }

    // Construir consulta de filtros para la agregación
    const matchQuery = {
      fecha: { $gte: startDate, $lte: endDate },
      paymentStatus: { $ne: "canceled" },
      estadoPago: { $ne: "bloqueado" }
    };

    // Aplicar filtro por sedeId si existe
    if (sedeId) {
      if (req.user.role === ROLES.ADMIN_CANCHA) {
        const hasAccess = sedesFilter.some(id => id.toString() === sedeId.toString());
        if (!hasAccess) {
          return res.status(403).json({ message: "No tienes permisos para ver las estadísticas de esta sede" });
        }
      }
      matchQuery.sede = new mongoose.Types.ObjectId(sedeId);
    } else if (req.user.role === ROLES.ADMIN_CANCHA) {
      matchQuery.sede = { $in: sedesFilter };
    }

    // Definición de evolución temporal según el período
    const formatStr = period === "yearly" ? "%Y-%m" : "%Y-%m-%d";

    // Pipeline de agregación
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
            { $limit: 10 },
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
          ],
          evolution: [
            {
              $group: {
                _id: { $dateToString: { format: formatStr, date: "$fecha", timezone: "America/Bogota" } },
                reservationsCount: { $sum: 1 },
                revenue: {
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
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const results = aggregationResult[0] || {};

    // Formatear métricas globales
    const globalRaw = results.globalMetrics?.[0] || { totalReservations: 0, totalRevenue: 0 };
    const global = {
      totalRevenue: globalRaw.totalRevenue || 0,
      totalReservations: globalRaw.totalReservations || 0,
      averageTicket: globalRaw.totalReservations > 0 ? (globalRaw.totalRevenue / globalRaw.totalReservations) : 0
    };

    // Formatear días de la semana (1 = Domingo, 2 = Lunes, ..., 7 = Sábado)
    const daysNameMap = {
      1: "Domingo",
      2: "Lunes",
      3: "Martes",
      4: "Miércoles",
      5: "Jueves",
      6: "Viernes",
      7: "Sábado"
    };

    const daysOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const rawDays = results.daysDemand || [];
    const daysMap = {};
    rawDays.forEach(day => {
      const name = daysNameMap[day._id];
      if (name) daysMap[name] = day.reservationsCount;
    });

    const daysDemand = daysOrder.map(name => ({
      name,
      reservationsCount: daysMap[name] || 0
    }));

    // Formatear horas pico
    const peakHours = (results.peakHours || []).map(h => ({
      hour: h._id,
      reservationsCount: h.reservationsCount
    }));

    // Formatear evolución temporal
    const evolution = (results.evolution || []).map(item => ({
      date: item._id,
      reservationsCount: item.reservationsCount,
      revenue: item.revenue
    }));

    res.json({
      success: true,
      data: {
        global,
        topCanchas: results.topCanchas || [],
        daysDemand,
        peakHours,
        evolution,
        sedes: userSedes
      }
    });

  } catch (error) {
    console.error("Error al calcular estadísticas:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor al calcular estadísticas." });
  }
};
