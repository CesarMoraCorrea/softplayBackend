import 'dotenv/config';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import mongoose from 'mongoose';

await connectDB();

const result = await User.findOneAndUpdate(
  { email: 'admin@gmail.com' },
  {
    mpAccessToken: 'APP_USR-1895064702380382-050522-61bfa83fcfa5d5f224036071a51e2ef9-3275910298',
    mpPublicKey: 'APP_USR-6bcf8da9-9b71-484a-b133-b4666f3de6a6',
    mpUserId: '3275910298',
    mpConnected: true,
    mpTokenType: 'bearer',
    mpLiveMode: false,
    mpExpiresAt: new Date('2027-01-01'),
  },
  { new: true }
).select('nombre email rol mpConnected mpUserId');

console.log('Actualizado:', JSON.stringify(result, null, 2));
await mongoose.disconnect();
