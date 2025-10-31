import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cancha from './models/Cancha.js';

dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');

async function fixExistingCoordinates() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Buscar canchas con coordenadas inválidas
    const canchasInvalidas = await Cancha.find({
      $or: [
        { 'ubicacion.lat': { $gt: 90 } },
        { 'ubicacion.lat': { $lt: -90 } },
        { 'ubicacion.lng': { $gt: 180 } },
        { 'ubicacion.lng': { $lt: -180 } },
        { 'ubicacion.lat': 0, 'ubicacion.lng': 0 }
      ]
    });
    
    console.log(`Encontradas ${canchasInvalidas.length} canchas con coordenadas inválidas`);
    
    // Coordenadas válidas para diferentes zonas de Cali, Colombia
    const coordenadasCali = [
      { lat: 3.4516, lng: -76.5320 }, // Centro de Cali
      { lat: 3.4372, lng: -76.5225 }, // Sur de Cali
      { lat: 3.4693, lng: -76.5197 }, // Norte de Cali
      { lat: 3.4234, lng: -76.5197 }, // Oeste de Cali
      { lat: 3.4693, lng: -76.5443 }, // Este de Cali
    ];
    
    // Actualizar cada cancha con coordenadas válidas
    for (let i = 0; i < canchasInvalidas.length; i++) {
      const cancha = canchasInvalidas[i];
      const coordenada = coordenadasCali[i % coordenadasCali.length];
      
      // Agregar una pequeña variación aleatoria
      const latVariacion = (Math.random() - 0.5) * 0.02;
      const lngVariacion = (Math.random() - 0.5) * 0.02;
      
      const nuevasCoordenadas = {
        lat: coordenada.lat + latVariacion,
        lng: coordenada.lng + lngVariacion
      };
      
      await Cancha.findByIdAndUpdate(cancha._id, {
        'ubicacion.lat': nuevasCoordenadas.lat,
        'ubicacion.lng': nuevasCoordenadas.lng
      });
      
      console.log(`Actualizada cancha "${cancha.nombre}" con coordenadas: ${nuevasCoordenadas.lat.toFixed(6)}, ${nuevasCoordenadas.lng.toFixed(6)}`);
    }
    
    console.log('¡Coordenadas corregidas exitosamente!');
    
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

fixExistingCoordinates();