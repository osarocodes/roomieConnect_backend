import crypto from 'crypto';

export const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

export const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};