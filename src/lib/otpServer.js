import crypto from 'crypto';

export const generateOTP = () => {
    return crypto.randomInt(1000, 10000).toString();
};

export const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};