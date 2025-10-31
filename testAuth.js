import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const API_BASE = 'http://localhost:5000/api';

async function testAuth() {
  try {
    console.log('Probando autenticación JWT...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');
    
    // Buscar el usuario admin
    const adminUser = await User.findOne({ email: 'admin@softplay.com' });
    if (!adminUser) {
      throw new Error('Usuario administrador no encontrado');
    }
    
    console.log('Usuario encontrado:', adminUser.email, 'ID:', adminUser._id.toString());
    
    // Crear token JWT
    const token = jwt.sign(
      { id: adminUser._id.toString() }, 
      process.env.JWT_SECRET || 'devsecret', 
      { expiresIn: '7d' }
    );
    
    console.log('Token creado:', token.substring(0, 50) + '...');
    
    // Cerrar conexión
    await mongoose.connection.close();
    
    // Probar el endpoint /me para verificar autenticación
    console.log('Probando endpoint /me...');
    const meResponse = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (meResponse.ok) {
      const userData = await meResponse.json();
      console.log('✓ Autenticación exitosa:', userData);
    } else {
      const errorText = await meResponse.text();
      console.log('✗ Error en autenticación:', meResponse.status, errorText);
    }
    
    // Probar obtener canchas (endpoint público)
    console.log('Probando endpoint de canchas...');
    const canchasResponse = await fetch(`${API_BASE}/canchas`);
    const canchasData = await canchasResponse.json();
    console.log('Canchas obtenidas:', canchasData.length || 'Error');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAuth();