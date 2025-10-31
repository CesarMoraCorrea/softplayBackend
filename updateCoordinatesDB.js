import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cancha from './models/Cancha.js';

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

async function updateCoordinatesDB() {
  try {
    console.log('Conectando a la base de datos...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');
    
    console.log('Buscando canchas con coordenadas inválidas...');
    const canchas = await Cancha.find({});
    
    console.log(`Encontradas ${canchas.length} canchas en total`);
    
    let updatedCount = 0;
    
    for (const cancha of canchas) {
      const { lat, lng } = cancha.ubicacion;
      
      if (!isValidCoordinate(lat, lng)) {
        console.log(`\nCancha "${cancha.nombre}" tiene coordenadas inválidas: lat=${lat}, lng=${lng}`);
        
        // Generar nuevas coordenadas válidas
        const newLat = CALI_COORDS.lat + getRandomOffset();
        const newLng = CALI_COORDS.lng + getRandomOffset();
        
        // Actualizar la cancha
        await Cancha.findByIdAndUpdate(cancha._id, {
          'ubicacion.lat': newLat,
          'ubicacion.lng': newLng
        });
        
        console.log(`✓ Actualizada con nuevas coordenadas: lat=${newLat.toFixed(6)}, lng=${newLng.toFixed(6)}`);
        updatedCount++;
      } else {
        console.log(`✓ Cancha "${cancha.nombre}" ya tiene coordenadas válidas: lat=${lat}, lng=${lng}`);
      }
    }
    
    console.log(`\n=== RESUMEN ===`);
    console.log(`Total de canchas: ${canchas.length}`);
    console.log(`Canchas actualizadas: ${updatedCount}`);
    
    // Verificar el estado final
    console.log('\nVerificando estado final...');
    const canchasFinales = await Cancha.find({});
    
    for (const cancha of canchasFinales) {
      const { lat, lng } = cancha.ubicacion;
      console.log(`- ${cancha.nombre}: lat=${lat}, lng=${lng} ${isValidCoordinate(lat, lng) ? '✓' : '✗'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConexión cerrada.');
  }
}

updateCoordinatesDB();