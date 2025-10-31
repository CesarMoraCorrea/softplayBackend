import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Coordenadas válidas para Cali, Colombia
const CALI_COORDS = {
  lat: 3.4516,
  lng: -76.5320
};

function getRandomOffset() {
  // Generar un offset aleatorio pequeño para variar las coordenadas
  return (Math.random() - 0.5) * 0.02; // ±0.01 grados aproximadamente
}

function isValidCoordinate(lat, lng) {
  // Verificar si las coordenadas están en rangos válidos
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && 
         !(lat === 0 && lng === 0) && // No permitir 0,0
         Math.abs(lat) < 1000 && Math.abs(lng) < 1000; // No permitir valores extremos
}

async function updateCanchasDB() {
  try {
    console.log('Conectando a la base de datos canchasdb...');
    
    // Conectar específicamente a la base de datos canchasdb
    const uri = 'mongodb://localhost:27017/canchasdb';
    await mongoose.connect(uri);
    
    const db = mongoose.connection.db;
    const canchasCollection = db.collection('canchas');
    
    console.log('Buscando canchas con coordenadas inválidas...');
    const canchas = await canchasCollection.find({}).toArray();
    
    console.log(`Encontradas ${canchas.length} canchas en total`);
    
    let updatedCount = 0;
    
    for (const cancha of canchas) {
      const { lat, lng } = cancha.ubicacion || {};
      
      console.log(`\nCancha "${cancha.nombre}": lat=${lat}, lng=${lng}`);
      
      if (!isValidCoordinate(lat, lng)) {
        console.log(`  ✗ Coordenadas inválidas`);
        
        // Generar nuevas coordenadas válidas
        const newLat = CALI_COORDS.lat + getRandomOffset();
        const newLng = CALI_COORDS.lng + getRandomOffset();
        
        // Actualizar la cancha
        await canchasCollection.updateOne(
          { _id: cancha._id },
          { 
            $set: { 
              'ubicacion.lat': newLat,
              'ubicacion.lng': newLng
            }
          }
        );
        
        console.log(`  ✓ Actualizada con nuevas coordenadas: lat=${newLat.toFixed(6)}, lng=${newLng.toFixed(6)}`);
        updatedCount++;
      } else {
        console.log(`  ✓ Coordenadas válidas`);
      }
    }
    
    console.log(`\n=== RESUMEN ===`);
    console.log(`Total de canchas: ${canchas.length}`);
    console.log(`Canchas actualizadas: ${updatedCount}`);
    
    // Verificar el estado final
    console.log('\nVerificando estado final...');
    const canchasFinales = await canchasCollection.find({}).toArray();
    
    for (const cancha of canchasFinales) {
      const { lat, lng } = cancha.ubicacion || {};
      const valid = isValidCoordinate(lat, lng);
      console.log(`- ${cancha.nombre}: lat=${lat}, lng=${lng} ${valid ? '✓' : '✗'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConexión cerrada.');
  }
}

updateCanchasDB();