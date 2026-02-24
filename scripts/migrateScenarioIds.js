import mongoose from "mongoose";
import dotenv from "dotenv";
import Sede from "../src/models/Sede.js";

dotenv.config();

const migrateScenarioIds = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/canchasdb";
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log("✓ Conectado a MongoDB\n");

    // Buscar todas las sedes
    const sedes = await Sede.find({});
    console.log(`Encontradas ${sedes.length} sedes para revisar\n`);

    let totalActualizadas = 0;
    let totalEscenariosMigrados = 0;

    for (const sede of sedes) {
      let updated = false;

      for (let i = 0; i < sede.escenarios.length; i++) {
        const escenario = sede.escenarios[i];
        
        // Verificar si NO tiene _id o si _id está vacío/undefined
        if (!escenario._id || String(escenario._id).trim() === "") {
          // Generar nuevo ObjectId
          escenario._id = new mongoose.Types.ObjectId();
          updated = true;
          totalEscenariosMigrados++;
          console.log(
            `  ✓ Agregado _id a escenario "${escenario.nombre}" en sede "${sede.nombre}"`
          );
        }
      }

      if (updated) {
        await sede.save();
        totalActualizadas++;
        console.log(
          `  ✓ Sede "${sede.nombre}" guardada\n`
        );
      }
    }

    console.log(`\n✅ Migración completada:`);
    console.log(`   Sedes actualizadas: ${totalActualizadas}`);
    console.log(`   Total escenarios migrados: ${totalEscenariosMigrados}`);
    console.log(`   Total de sedes procesadas: ${sedes.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error durante la migración:", error.message);
    console.error(error);
    process.exit(1);
  }
};

// Timeout global de 15 segundos
setTimeout(() => {
  console.error("\n❌ Timeout: No se pudo conectar a MongoDB en 15 segundos");
  process.exit(1);
}, 15000);

migrateScenarioIds();
