import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function updateCoordinatesViaAPI() {
  try {
    console.log('Obteniendo canchas del API...');
    
    // Obtener todas las canchas
    const response = await fetch(`${API_BASE}/canchas`);
    const canchas = await response.json();
    
    console.log(`Encontradas ${canchas.length} canchas`);
    
    // Coordenadas válidas para Cali, Colombia
    const coordenadasCali = [
      { lat: 3.4516, lng: -76.5320 }, // Centro de Cali
      { lat: 3.4372, lng: -76.5225 }, // Sur de Cali
      { lat: 3.4693, lng: -76.5197 }, // Norte de Cali
      { lat: 3.4234, lng: -76.5197 }, // Oeste de Cali
      { lat: 3.4693, lng: -76.5443 }, // Este de Cali
    ];
    
    // Actualizar cada cancha con coordenadas inválidas
    for (let i = 0; i < canchas.length; i++) {
      const cancha = canchas[i];
      
      // Verificar si las coordenadas son inválidas
      const lat = cancha.ubicacion.lat;
      const lng = cancha.ubicacion.lng;
      
      const coordenadasInvalidas = 
        lat > 90 || lat < -90 || 
        lng > 180 || lng < -180 || 
        (lat === 0 && lng === 0) ||
        lat > 10000 || lng > 10000; // Para casos como 155555
      
      if (coordenadasInvalidas) {
        console.log(`Actualizando cancha "${cancha.nombre}" con coordenadas inválidas: ${lat}, ${lng}`);
        
        const coordenada = coordenadasCali[i % coordenadasCali.length];
        
        // Agregar una pequeña variación aleatoria
        const latVariacion = (Math.random() - 0.5) * 0.02;
        const lngVariacion = (Math.random() - 0.5) * 0.02;
        
        const nuevasCoordenadas = {
          lat: coordenada.lat + latVariacion,
          lng: coordenada.lng + lngVariacion
        };
        
        // Actualizar la cancha
        const updateData = {
          ...cancha,
          ubicacion: nuevasCoordenadas
        };
        
        const updateResponse = await fetch(`${API_BASE}/canchas/${cancha._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
          console.log(`✓ Actualizada cancha "${cancha.nombre}" con coordenadas: ${nuevasCoordenadas.lat.toFixed(6)}, ${nuevasCoordenadas.lng.toFixed(6)}`);
        } else {
          console.log(`✗ Error al actualizar cancha "${cancha.nombre}": ${updateResponse.status}`);
        }
      } else {
        console.log(`✓ Cancha "${cancha.nombre}" ya tiene coordenadas válidas: ${lat}, ${lng}`);
      }
    }
    
    console.log('\n¡Proceso completado!');
    
    // Verificar el resultado final
    const finalResponse = await fetch(`${API_BASE}/canchas`);
    const canchasFinales = await finalResponse.json();
    
    console.log(`\nTotal de canchas: ${canchasFinales.length}`);
    canchasFinales.forEach(cancha => {
      console.log(`- ${cancha.nombre}: ${cancha.ubicacion.lat}, ${cancha.ubicacion.lng}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

updateCoordinatesViaAPI();