import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const migrateScenarioIdsRaw = async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/canchasdb";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("✓ Conectado a MongoDB Atlas\n");

    const db = client.db("softplaydb");
    const sedesCollection = db.collection("sedes");

    // Buscar todas las sedes
    const sedes = await sedesCollection.find({}).toArray();
    console.log(`📍 Encontradas ${sedes.length} sedes\n`);

    let totalActualizadas = 0;
    let totalEscenariosMigrados = 0;

    for (const sede of sedes) {
      let updated = false;
      const escenarios = sede.escenarios || [];

      for (let i = 0; i < escenarios.length; i++) {
        const escenario = escenarios[i];

        // Si no tiene _id, agregarlo
        if (!escenario._id) {
          escenarios[i]._id = new ObjectId();
          updated = true;
          totalEscenariosMigrados++;
          console.log(
            `  ✓ Agregado _id a: "${escenario.nombre}" en "${sede.nombre}"`
          );
        }
      }

      if (updated) {
        // Actualizar la sede completa en BD
        await sedesCollection.updateOne(
          { _id: sede._id },
          { $set: { escenarios: escenarios } }
        );
        totalActualizadas++;
        console.log(
          `  ✓ Sede "${sede.nombre}" actualizada en BD\n`
        );
      }
    }

    console.log(`\n✅ Migración completada:`);
    console.log(`   Sedes actualizadas: ${totalActualizadas}`);
    console.log(`   Total escenarios migrados: ${totalEscenariosMigrados}`);
    console.log(`   Total de sedes procesadas: ${sedes.length}`);

    if (totalActualizadas === 0) {
      console.log("\n⚠️  No se encontraron sedes sin migrar.");
      console.log("   Posibles razones:");
      console.log("   - Todos los escenarios ya tienen _id");
      console.log("   - La BD está vacía");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
};

// Timeout global de 20 segundos
setTimeout(() => {
  console.error(
    "\n❌ Timeout: No se pudo conectar a MongoDB en 20 segundos"
  );
  process.exit(1);
}, 20000);

migrateScenarioIdsRaw();
