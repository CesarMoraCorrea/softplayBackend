import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabases() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');
    
    const db = mongoose.connection.db;
    
    // Listar todas las bases de datos
    console.log('\n=== BASES DE DATOS DISPONIBLES ===');
    const admin = db.admin();
    const dbs = await admin.listDatabases();
    
    for (const database of dbs.databases) {
      console.log(`- ${database.name} (${(database.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    }
    
    // Verificar la base de datos actual
    console.log(`\n=== BASE DE DATOS ACTUAL: ${db.databaseName} ===`);
    
    // Listar todas las colecciones
    const collections = await db.listCollections().toArray();
    console.log('\nColecciones disponibles:');
    
    for (const collection of collections) {
      console.log(`- ${collection.name}`);
      
      // Si es la colección de canchas, mostrar documentos
      if (collection.name === 'canchas') {
        const canchasCollection = db.collection('canchas');
        const canchas = await canchasCollection.find({}).toArray();
        console.log(`  └─ Documentos: ${canchas.length}`);
        
        for (const cancha of canchas) {
          console.log(`     • ${cancha.nombre} - lat: ${cancha.ubicacion?.lat}, lng: ${cancha.ubicacion?.lng}`);
        }
      }
    }
    
    // Verificar si hay otras bases de datos con canchas
    console.log('\n=== VERIFICANDO OTRAS BASES DE DATOS ===');
    
    for (const database of dbs.databases) {
      if (database.name !== db.databaseName && database.name !== 'admin' && database.name !== 'local' && database.name !== 'config') {
        try {
          console.log(`\nVerificando base de datos: ${database.name}`);
          await mongoose.connection.close();
          
          const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/softplay';
          const newUri = uri.replace(/\/[^\/]*$/, `/${database.name}`);
          
          await mongoose.connect(newUri);
          const otherDb = mongoose.connection.db;
          
          const otherCollections = await otherDb.listCollections().toArray();
          const canchasCollection = otherCollections.find(c => c.name === 'canchas');
          
          if (canchasCollection) {
            const canchasCol = otherDb.collection('canchas');
            const canchas = await canchasCol.find({}).toArray();
            console.log(`  └─ Encontradas ${canchas.length} canchas:`);
            
            for (const cancha of canchas) {
              console.log(`     • ${cancha.nombre} - lat: ${cancha.ubicacion?.lat}, lng: ${cancha.ubicacion?.lng}`);
            }
          } else {
            console.log(`  └─ No hay colección 'canchas'`);
          }
        } catch (error) {
          console.log(`  └─ Error accediendo a ${database.name}: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConexión cerrada.');
  }
}

checkDatabases();