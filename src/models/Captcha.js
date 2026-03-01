import mongoose from 'mongoose';

const captchaSchema = new mongoose.Schema({
    captchaId: {
        type: String,
        required: true,
        unique: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        expires: '5m',
        default: Date.now
    }
});

export default mongoose.model('Captcha', captchaSchema);
