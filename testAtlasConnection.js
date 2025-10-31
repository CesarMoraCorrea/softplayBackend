import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function main(){
  const uri = process.env.MONGO_URI;
  console.log('Probando conexión a MongoDB Atlas...');
  console.log('MONGO_URI:', uri ? uri.replace(/:\w+@/, ':****@') : '(no definido)');
  try{
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ Conectado a Atlas correctamente');
  }catch(e){
    console.error('❌ Error conectando a Atlas:', e.message);
    if(e.cause) console.error('Causa:', e.cause.message || e.cause);
    const reason = e.reason || e;
    if(reason && reason.code){
      console.error('Código:', reason.code);
    }
  }finally{
    try{ await mongoose.connection.close(); }catch{}
    console.log('Conexión cerrada.');
  }
}

main();