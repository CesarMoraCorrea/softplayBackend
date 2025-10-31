import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function updateCoordinatesWithAuth() {
  try {
    console.log('Iniciando proceso de actualización de coordenadas...');
    
    // Paso 1: Autenticarse como administrador
    console.log('1. Autenticándose...');
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@softplay.com', // Asumiendo que existe un admin
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      // Si no existe el admin, intentemos con otro usuario o creemos uno
      console.log('Admin no encontrado, intentando registrar...');
      const registerResponse = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Admin',
          email: 'admin@softplay.com',
          password: 'admin123',
          phone: '1234567890',
          role: 'admin_cancha'
        })
      });
      
      if (!registerResponse.ok) {
        throw new Error('No se pudo crear el usuario administrador');
      }
      
      // Intentar login nuevamente
      const secondLoginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@softplay.com',
          password: 'admin123'
        })
      });
      
      if (!secondLoginResponse.ok) {
        throw new Error('No se pudo autenticar después del registro');
      }
      
      const loginData = await secondLoginResponse.json();
      var token = loginData.token;
    } else {
      const loginData = await loginResponse.json();
      var token = loginData.token;
    }
    
    console.log('✓ Autenticación exitosa');
    
    // Paso 2: Obtener todas las canchas
    console.log('2. Obteniendo canchas...');
    const canchasResponse = await fetch(`${API_BASE}/canchas`);
    const canchasData = await canchasResponse.json();
    const canchas = canchasData.canchas || canchasData;
    
    console.log(`Encontradas ${canchas.length} canchas`);
    
    // Paso 3: Identificar canchas con coordenadas inválidas
    const canchasInvalidas = canchas.filter(cancha => {
      const lat = cancha.ubicacion?.lat || cancha.lat;
      const lng = cancha.ubicacion?.lng || cancha.lng;
      
      return !lat || !lng || 
             lat === 0 || lng === 0 ||
             lat < -90 || lat > 90 ||
             lng < -180 || lng > 180 ||
             Math.abs(lat) > 1000 || Math.abs(lng) > 1000;
    });
    
    console.log(`Canchas con coordenadas inválidas: ${canchasInvalidas.length}`);
    
    if (canchasInvalidas.length === 0) {
      console.log('✓ Todas las canchas tienen coordenadas válidas');
      return;
    }
    
    // Coordenadas válidas para diferentes zonas de Cali, Colombia
    const coordenadasCali = [
      { lat: 3.4516, lng: -76.5320 }, // Centro de Cali
      { lat: 3.4372, lng: -76.5225 }, // Sur de Cali
      { lat: 3.4693, lng: -76.5197 }, // Norte de Cali
      { lat: 3.4234, lng: -76.5197 }, // Oeste de Cali
      { lat: 3.4693, lng: -76.5443 }, // Este de Cali
    ];
    
    // Paso 4: Actualizar cada cancha con coordenadas inválidas
    console.log('3. Actualizando coordenadas...');
    
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
      
      // Preparar datos de actualización
      const updateData = {
        ...cancha,
        ubicacion: {
          lat: nuevasCoordenadas.lat,
          lng: nuevasCoordenadas.lng
        }
      };
      
      // Actualizar la cancha
      const updateResponse = await fetch(`${API_BASE}/canchas/${cancha._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      });
      
      if (updateResponse.ok) {
        console.log(`✓ Actualizada "${cancha.nombre}": ${nuevasCoordenadas.lat.toFixed(6)}, ${nuevasCoordenadas.lng.toFixed(6)}`);
      } else {
        const errorText = await updateResponse.text();
        console.log(`✗ Error actualizando "${cancha.nombre}": ${updateResponse.status} - ${errorText}`);
      }
    }
    
    // Paso 5: Verificar el resultado final
    console.log('4. Verificando resultado final...');
    const finalResponse = await fetch(`${API_BASE}/canchas`);
    const finalData = await finalResponse.json();
    const finalCanchas = finalData.canchas || finalData;
    
    console.log('\n=== ESTADO FINAL ===');
    finalCanchas.forEach(cancha => {
      const lat = cancha.ubicacion?.lat || cancha.lat;
      const lng = cancha.ubicacion?.lng || cancha.lng;
      console.log(`${cancha.nombre}: ${lat}, ${lng}`);
    });
    
    console.log('\n✓ Proceso completado exitosamente!');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

updateCoordinatesWithAuth();