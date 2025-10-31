import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function debugAuth() {
  try {
    console.log('Debuggeando autenticación...');
    
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');
    
    // Buscar el usuario admin
    const adminUser = await User.findOne({ email: 'admin@softplay.com' });
    if (!adminUser) {
      throw new Error('Usuario administrador no encontrado');
    }
    
    console.log('Usuario encontrado:');
    console.log('- _id:', adminUser._id);
    console.log('- _id tipo:', typeof adminUser._id);
    console.log('- _id toString():', adminUser._id.toString());
    console.log('- email:', adminUser.email);
    console.log('- role:', adminUser.role);
    
    // Crear token con diferentes formatos de ID
    const tokenWithObjectId = jwt.sign(
      { id: adminUser._id }, 
      process.env.JWT_SECRET || 'devsecret', 
      { expiresIn: '7d' }
    );
    
    const tokenWithStringId = jwt.sign(
      { id: adminUser._id.toString() }, 
      process.env.JWT_SECRET || 'devsecret', 
      { expiresIn: '7d' }
    );
    
    console.log('\nTokens creados:');
    console.log('Con ObjectId:', tokenWithObjectId.substring(0, 50) + '...');
    console.log('Con String ID:', tokenWithStringId.substring(0, 50) + '...');
    
    // Verificar tokens
    console.log('\nVerificando tokens:');
    
    try {
      const decodedObjectId = jwt.verify(tokenWithObjectId, process.env.JWT_SECRET || 'devsecret');
      console.log('Token ObjectId decodificado:', decodedObjectId);
      
      // Buscar usuario con el ID decodificado
      const foundUser1 = await User.findById(decodedObjectId.id);
      console.log('Usuario encontrado con ObjectId token:', foundUser1 ? 'SÍ' : 'NO');
      
    } catch (e) {
      console.log('Error verificando token ObjectId:', e.message);
    }
    
    try {
      const decodedStringId = jwt.verify(tokenWithStringId, process.env.JWT_SECRET || 'devsecret');
      console.log('Token String decodificado:', decodedStringId);
      
      // Buscar usuario con el ID decodificado
      const foundUser2 = await User.findById(decodedStringId.id);
      console.log('Usuario encontrado con String token:', foundUser2 ? 'SÍ' : 'NO');
      
    } catch (e) {
      console.log('Error verificando token String:', e.message);
    }
    
    // Verificar JWT_SECRET
    console.log('\nJWT_SECRET:', process.env.JWT_SECRET || 'devsecret');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

debugAuth();