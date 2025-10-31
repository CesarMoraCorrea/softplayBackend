import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

// Conectar a la base de datos
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softplay');

async function checkAdminUser() {
  try {
    console.log('Verificando usuario administrador...');
    
    const adminUser = await User.findOne({ email: 'admin@softplay.com' });
    
    if (!adminUser) {
      console.log('❌ Usuario administrador no encontrado');
      return;
    }
    
    console.log('✓ Usuario administrador encontrado:');
    console.log('- ID:', adminUser._id);
    console.log('- Nombre:', adminUser.name);
    console.log('- Email:', adminUser.email);
    console.log('- Rol:', adminUser.role);
    console.log('- Activo:', adminUser.activo);
    console.log('- Creado:', adminUser.createdAt);
    
    // Verificar si el campo activo existe y está en true
    if (adminUser.activo === undefined) {
      console.log('⚠️ Campo "activo" no definido, actualizando...');
      await User.findByIdAndUpdate(adminUser._id, { activo: true });
      console.log('✓ Campo "activo" actualizado a true');
    } else if (!adminUser.activo) {
      console.log('⚠️ Usuario inactivo, activando...');
      await User.findByIdAndUpdate(adminUser._id, { activo: true });
      console.log('✓ Usuario activado');
    }
    
    // Verificar todos los usuarios
    const allUsers = await User.find({});
    console.log(`\nTotal de usuarios en la base de datos: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - Activo: ${user.activo}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
}

checkAdminUser();