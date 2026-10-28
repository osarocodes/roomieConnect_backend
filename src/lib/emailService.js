import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOtpEmail = async (userEmail, otpCode) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Auth <onboarding@resend.dev>',
            to: [userEmail],
            subject: 'Your Password Reset OTP',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background-color: #f9fafb; border-radius: 8px; max-width: 480px; margin: 0 auto;">
                    <h2 style="color:#111827; font-size: 20px; font-weight: 700; margin-bottom: 8px;">Password Reset</h2>
                    <p style="color: #4b5563; font-size: 14px; margin-bottom: 24px;">Use the following 4-digit code to complete your password recovery:</p>
                    
                    <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827;">${otpCode}</span>
                    </div>

                    <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This code will expire in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
                </div>
            `,
        });

        if (error) {
            console.error('Resend Error:', error);
            throw new Error(error.message);
        }

        return data;
    } catch (err) {
        console.error('Failed to send OTP via Resend:', err);
        throw err;
    }
};