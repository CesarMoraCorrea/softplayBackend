import mongoose from "mongoose";
import dotenv from "dotenv";
import Sede from "../models/Sede.js";
import User from "../models/User.js";
import { ROLES } from "../utils/roles.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, "../../.env") });

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Conectado a MongoDB");

    // Buscar el usuario o crearlo
    const email = "propietario@gmail.com";
    let user = await User.findOne({ email });

    if (!user) {
      console.log(`Usuario ${email} no existe. Creando...`);
      user = new User({
        name: "Propietario de Prueba",
        email: email,
        password: "password123", // Será hasheado por el pre-save hook
        role: ROLES.ADMIN_CANCHA,
        mpAccessToken: process.env.MP_ACCESS_TOKEN,
        mpPublicKey: process.env.MP_PUBLIC_KEY
      });
      await user.save();
      console.log("Usuario creado con ID:", user._id);
    } else {
      console.log("Usuario encontrado con ID:", user._id);
      // Asegurarse de que tenga las credenciales de prueba por ahora para que funcione
      user.mpAccessToken = process.env.MP_ACCESS_TOKEN;
      user.mpPublicKey = process.env.MP_PUBLIC_KEY;
      await user.save();
    }

    // Actualizar todas las sedes que no tengan propietario
    const result = await Sede.updateMany(
      { propietario: { $exists: false } },
      { $set: { propietario: user._id } }
    );

    console.log(`Migración completada. Modificadas ${result.modifiedCount} sedes.`);
  } catch (error) {
    console.error("Error en migración:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Desconectado de MongoDB");
  }
};

migrate();
