import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import dotenv from 'dotenv';
dotenv.config();

export const protectRoute = async (req, res, next) => {
    try {
        // 1. Get token from multiple sources (Headers or Cookies)
        const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }
        // 2. Verify Token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Find User & Exclude Sensitive Fields
        const user = await User.findById(decoded.id).select("-auth.password");

        if (!user) {
            return res.status(404).json({ success: false, message: 'User no longer exists' });
        }

        // 4. Attach user to request object
        req.user = user;
        
        next();
    } catch (error) {
        // Distinguishing between expired and invalid tokens for better Frontend UX
        const message = error.name === 'TokenExpiredError' 
            ? 'Session expired, please login again' 
            : 'Invalid token';
            
        console.error("Auth Middleware Error:", error.message);
        return res.status(401).json({ success: false, message });
    }
};