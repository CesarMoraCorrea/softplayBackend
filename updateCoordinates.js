import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Cancha from './models/Cancha.js';

dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');

async function createSampleCanchas() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Verificar si ya existen canchas
    const existingCanchas = await Cancha.find({});
    console.log(`Canchas existentes: ${existingCanchas.length}`);
    
    if (existingCanchas.length > 0) {
      console.log('Actualizando coordenadas de canchas existentes...');
      
      // Coordenadas válidas para diferentes zonas de Cali, Colombia
      const coordenadasCali = [
        { lat: 3.4516, lng: -76.5320 }, // Centro de Cali
        { lat: 3.4372, lng: -76.5225 }, // Sur de Cali
        { lat: 3.4693, lng: -76.5197 }, // Norte de Cali
        { lat: 3.4234, lng: -76.5197 }, // Oeste de Cali
        { lat: 3.4693, lng: -76.5443 }, // Este de Cali
      ];
      
      // Actualizar cada cancha con coordenadas válidas
      for (let i = 0; i < existingCanchas.length; i++) {
        const cancha = existingCanchas[i];
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
    } else {
      console.log('No hay canchas existentes. Creando canchas de ejemplo...');
      
      const canchasEjemplo = [
         {
           nombre: "Cancha Deportiva El Estadio",
           descripcion: "Cancha de fútbol con césped sintético y excelente iluminación",
           direccion: "Calle 5 #36-08, San Fernando, Cali",
           ubicacion: { lat: 3.4516, lng: -76.5320 },
           precioHora: 50000,
           imagenes: [],
           tipoCancha: "Fútbol 5",
           servicios: ["iluminacion", "vestuarios", "aparcamiento"],
           horarios: ["Mañana (6-12h)", "Tarde (12-18h)", "Noche (18-24h)"],
           activa: true
         },
         {
           nombre: "Complejo Deportivo Sur",
           descripcion: "Múltiples canchas para diferentes deportes",
           direccion: "Carrera 100 #15-25, Ciudad Jardín, Cali",
           ubicacion: { lat: 3.4372, lng: -76.5225 },
           precioHora: 45000,
           imagenes: [],
           tipoCancha: "Fútbol 7",
           servicios: ["cafeteria", "vestuarios", "duchas"],
           horarios: ["Mañana (6-12h)", "Tarde (12-18h)"],
           activa: true
         },
         {
           nombre: "Cancha Norte Premium",
           descripcion: "Cancha de tenis y fútbol de alta calidad",
           direccion: "Avenida 6N #23-45, Granada, Cali",
           ubicacion: { lat: 3.4693, lng: -76.5197 },
           precioHora: 60000,
           imagenes: [],
           tipoCancha: "Tenis",
           servicios: ["wifi", "vestuarios", "iluminacion"],
           horarios: ["Mañana (6-12h)", "Tarde (12-18h)", "Noche (18-24h)"],
           activa: true
         }
       ];
      
      for (const canchaData of canchasEjemplo) {
        const cancha = new Cancha(canchaData);
        await cancha.save();
        console.log(`Creada cancha: ${cancha.nombre} en ${cancha.ubicacion.lat}, ${cancha.ubicacion.lng}`);
      }
    }
    
    console.log('¡Proceso completado exitosamente!');
    
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

createSampleCanchas();