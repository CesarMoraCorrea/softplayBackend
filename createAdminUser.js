import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');

async function createAdminUser() {
  try {
    console.log('Conectando a la base de datos...');
    
    // Verificar si ya existe un admin
    const existingAdmin = await User.findOne({ email: 'admin@softplay.com' });
    
    if (existingAdmin) {
      console.log('✓ Usuario administrador ya existe:', existingAdmin.email);
      console.log('Rol:', existingAdmin.role);
      return existingAdmin;
    }
    
    // Crear nuevo usuario administrador
    console.log('Creando usuario administrador...');
    const adminUser = await User.create({
      name: 'Admin',
      email: 'admin@softplay.com',
      password: 'admin123',
      phone: '1234567890',
      role: 'admin_cancha'
    });
    
    console.log('✓ Usuario administrador creado exitosamente:');
    console.log('- Email:', adminUser.email);
    console.log('- Rol:', adminUser.role);
    console.log('- ID:', adminUser._id);
    
    return adminUser;
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 11000) {
      console.log('El usuario ya existe en la base de datos');
    }
  } finally {
    mongoose.connection.close();
  }
}

createAdminUser();