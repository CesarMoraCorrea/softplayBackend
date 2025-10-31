import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cancha from './models/Cancha.js';

dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');

async function updateSpecificCanchas() {
  try {
    console.log('Conectando a la base de datos...');
    
    // IDs específicos de las canchas con coordenadas inválidas
    const canchaIds = [
      '68c6441bbb9233b7f5e84361', // Tiro de esquina
      '68c62b09d114c9e9a8841be3'  // Camp Nou Sur
    ];
    
    // Coordenadas válidas para Cali, Colombia
    const coordenadasCali = [
      { lat: 3.4516, lng: -76.5320 }, // Centro de Cali
      { lat: 3.4372, lng: -76.5225 }, // Sur de Cali
    ];
    
    for (let i = 0; i < canchaIds.length; i++) {
      const canchaId = canchaIds[i];
      const coordenada = coordenadasCali[i];
      
      // Agregar una pequeña variación aleatoria
      const latVariacion = (Math.random() - 0.5) * 0.02;
      const lngVariacion = (Math.random() - 0.5) * 0.02;
      
      const nuevasCoordenadas = {
        lat: coordenada.lat + latVariacion,
        lng: coordenada.lng + lngVariacion
      };
      
      const result = await Cancha.findByIdAndUpdate(canchaId, {
        'ubicacion.lat': nuevasCoordenadas.lat,
        'ubicacion.lng': nuevasCoordenadas.lng
      }, { new: true });
      
      if (result) {
        console.log(`Actualizada cancha "${result.nombre}" con coordenadas: ${nuevasCoordenadas.lat.toFixed(6)}, ${nuevasCoordenadas.lng.toFixed(6)}`);
      } else {
        console.log(`No se encontró la cancha con ID: ${canchaId}`);
      }
    }
    
    console.log('¡Coordenadas actualizadas exitosamente!');
    
    // Verificar el resultado final
    const todasLasCanchas = await Cancha.find({});
    console.log(`\nTotal de canchas en la base de datos: ${todasLasCanchas.length}`);
    todasLasCanchas.forEach(cancha => {
      console.log(`- ${cancha.nombre}: ${cancha.ubicacion.lat}, ${cancha.ubicacion.lng}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateSpecificCanchas();