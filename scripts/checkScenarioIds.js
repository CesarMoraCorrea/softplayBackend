import mongoose from "mongoose";
import dotenv from "dotenv";
import Sede from "../src/models/Sede.js";

dotenv.config();

const checkScenarioIds = async () => {
  try {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/canchasdb";
    
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    console.log("✓ Conectado a MongoDB\n");

    const sedes = await Sede.find({});
    console.log(`Revisando ${sedes.length} sedes...\n`);

    let totalScenarios = 0;
    let scenariosWithId = 0;
    let scenariosWithoutId = 0;

    sedes.forEach((sede) => {
      console.log(`📍 Sede: ${sede.nombre}`);
      console.log(`   ID: ${sede._id}`);
      
      if (sede.escenarios.length === 0) {
        console.log(`   ⚠️  Sin escenarios\n`);
        return;
      }

      sede.escenarios.forEach((esc, idx) => {
        totalScenarios++;
        if (esc._id) {
          scenariosWithId++;
          console.log(
            `   ✓ Escenario ${idx + 1}: "${esc.nombre}" - ID: ${esc._id}`
          );
        } else {
          scenariosWithoutId++;
          console.log(
            `   ✗ Escenario ${idx + 1}: "${esc.nombre}" - SIN ID ⚠️`
          );
        }
      });
      console.log();
    });

    console.log("\n📊 RESUMEN:");
    console.log(`   Total de escenarios: ${totalScenarios}`);
    console.log(`   ✓ Con ID: ${scenariosWithId}`);
    console.log(`   ✗ Sin ID: ${scenariosWithoutId}`);

    if (scenariosWithoutId > 0) {
      console.log("\n⚠️  ACCIÓN REQUERIDA:");
      console.log("   Ejecuta: npm run migrate:scenario-ids");
    } else {
      console.log("\n✅ Todos los escenarios tienen ID correctamente");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
};

// Timeout global de 15 segundos
setTimeout(() => {
  console.error("\n❌ Timeout: No se pudo conectar a MongoDB en 15 segundos");
  process.exit(1);
}, 15000);

checkScenarioIds();
