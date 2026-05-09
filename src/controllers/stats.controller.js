import User from "../models/User.js";
import Sede from "../models/Sede.js";
import Reserva from "../models/Reserva.js";

export const getPublicStats = async (req, res) => {
  try {
    const [usersCount, sedesCount, reservasCount] = await Promise.all([
      User.countDocuments(),
      Sede.countDocuments(),
      Reserva.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        users: usersCount,
        sedes: sedesCount,
        reservas: reservasCount
      }
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
