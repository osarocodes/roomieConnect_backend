import User from "../models/user.model.js";
import UserActivity from "../models/userActivity.model.js";
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import cloudinary from '../lib/cloudinary.js';
import { parseRentRange } from "../lib/dataTransformer.js";
import { signupSchema } from "../validation/schemas/signupSchema.js";
import { generateToken } from "../lib/utils.js";
import { generateOTP, hashOTP } from '../lib/otpServer.js'
import { sendOtpEmail } from '../lib/emailService.js';
import { toClientUser } from '../lib/userSerializer.js';
import dotenv from 'dotenv';
dotenv.config();

export const signup = async (req, res) => {
    try {
        // Parse and transform the data from frontend
        const data = JSON.parse(req.body.data);
        const files = req.files;

        // Apply necessary transformations
        if (data.budget && data.budget.rentRange) {
            data.budget.rentRange = parseRentRange(data.budget.rentRange);
        }


        if (!files?.profilePic || !files?.admissionLetter) {
            return res.status(400).json({ message: "Files are missing." });
        }

        // 2. Validate everything BEFORE uploading to Cloudinary
        // Create a temporary object with placeholder URLs to check Zod
        const tempPayload = { ...data, 
            identity: { ...data.identity, profilePic: 'temp' },
            document: { admissionLetter: 'temp' }
        };
        
        const check = signupSchema.safeParse(tempPayload);
        if (!check.success) return res.status(400).json(check.error.flatten());
        const validatedData = check.data;

        // 3. Now upload to Cloudinary (since we know the data is valid)
        const profilePicResult = await cloudinary.uploader.upload(files.profilePic[0].path);
        const admissionLetterResult = await cloudinary.uploader.upload(files.admissionLetter[0].path);

        // 4. Save only validated signup fields and server-controlled account state
        const { confirmPassword, ...authData } = validatedData.auth;

        const salt = await bcrypt.genSalt(10);
        authData.password = await bcrypt.hash(authData.password, salt);
        
        const newUser = new User({
            ...validatedData,
            identity: {
                ...validatedData.identity,
                profilePic: profilePicResult.secure_url,
                role: "User",
            },
            auth: authData,
            university: {
                ...validatedData.university,
                verifiedStudentStatus: false,
            },
            document: {
                admissionLetter: admissionLetterResult.secure_url,
            },
        });
        await newUser.save();
        generateToken(newUser._id, res);
        await UserActivity.create({
            userId: newUser._id,
            activityType: 'New user registered'
        });

        res.status(201).json({
            _id: newUser._id,
            email: newUser.identity.email,
            message: "Signup successful! Please check your email to verify your account."
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Server error during signup.", error: error.message });
    }
}

export const login = async (req, res) => {
    
    try {
        const data = req.validated;
        const email = data?.identity?.email;
        const password = data?.auth?.password;
        
        const user = await User.findOne({ "identity.email": email });
        if (!user) return res.status(401).json({ message: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.auth.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

        generateToken(user._id, res)
        await UserActivity.create({
            userId: user._id,
            activityType: 'User logged in'
        });

        res.status(200).json(toClientUser(user));
    } catch(error) {
        console.error("Error during login:", error.message);
        res.status(500).json({ message: "Server error during login.", error: error.message });
    }
}

export const logout = async (req, res) => {
    try {
        // Validate that user is authenticated
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        // Log activity first (before clearing cookie)
        await UserActivity.create({
            userId: req.user._id,
            activityType: 'User logged out'
        });

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'none'
        });

        res.status(200).json({ message: "Logged out successfully" })
    } catch (error) {
        res.status(500).json({ message: "Server error during logout.", error: error.message })
    }
}

export const updateUser = async (req, res) => {
    try {
        // Parse JSON payload if frontend sent nested data as a JSON string (e.g., FormData with a 'data' field)
        let updates = {};
        if (req.body && req.body.data) {
            try {
                updates = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch {
                return res.status(400).json({ message: 'Invalid profile update data.' });
            }
        } else {
            updates = req.body || {};
        }

        if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
            return res.status(400).json({ message: 'Profile update data must be an object.' });
        }

        const allowedUpdatePaths = new Set([
            'identity.firstName',
            'identity.lastName',
            'identity.email',
            'identity.phone',
            'identity.gender',
            'identity.dob',
            'profile.about',
            'profile.interests',
            'university.level',
            'university.department',
            'university.yearOfCompletion',
            'lifestyleHabits.sleepSchedule',
            'lifestyleHabits.cleanliness',
            'lifestyleHabits.socialHabits',
            'lifestyleHabits.studyHabits',
            'lifestyleHabits.noiseTolerance',
            'lifestyleHabits.musicVolume',
            'lifestyleHabits.conflictManagement',
            'lifestyleHabits.alignmentTest',
            'preferences.preferredGender',
            'preferences.petPerson',
            'preferences.cigaretteSmoker',
            'preferences.guests',
            'preferences.spaceSharing',
            'preferences.musicVolume',
            'preferences.sharingPersonalItems',
            'budget.rentRange',
            'locationPreference.preferredArea',
            'locationPreference.houseOwnership',
        ]);
        const submittedUpdates = new Map();

        const flatten = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (value === undefined) continue;
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (allowedUpdatePaths.has(newKey)) {
                    submittedUpdates.set(newKey, value);
                } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, newKey);
                } else {
                    submittedUpdates.set(newKey, value);
                }
            }
        };

        flatten(updates);

        const disallowedPaths = [...submittedUpdates.keys()].filter(
            path => !allowedUpdatePaths.has(path)
        );
        if (disallowedPaths.length) {
            return res.status(400).json({
                message: 'One or more profile fields cannot be updated.',
                fields: disallowedPaths,
            });
        }

        const setObj = Object.fromEntries(submittedUpdates);

        // Apply known transforms on flattened values
        if (setObj['budget.rentRange']) {
            // Accept either a display string (e.g., "₦90,000 - ₦120,000") or an object {min, max}
            if (typeof setObj['budget.rentRange'] === 'string') {
                setObj['budget.rentRange'] = parseRentRange(setObj['budget.rentRange']);
            } else if (typeof setObj['budget.rentRange'] === 'object' && setObj['budget.rentRange'] !== null) {
                const { min, max } = setObj['budget.rentRange'];
                setObj['budget.rentRange'] = {
                    min: Number(min) || 0,
                    max: Number(max) || 999999999,
                    currency: 'NGN'
                };
            }
        }

        // Handle file upload (profile picture)
        if (req.files?.profilePic?.[0]) {
            const result = await cloudinary.uploader.upload(req.files.profilePic[0].path);
            setObj['identity.profilePic'] = result.secure_url;
        }

        if (Object.keys(setObj).length === 0) {
            return res.status(400).json({ message: 'No update fields provided.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: setObj },
            { new: true, runValidators: true }
        ).select("-auth.password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        await UserActivity.create({
            userId: req.user._id,
            activityType: 'User profile updated',
            details: { updatedFields: Object.keys(setObj) }
        });
        
        res.status(200).json(toClientUser(updatedUser));
    } catch (error) {
        console.error("Error updating user:", error.message);
        res.status(500).json({ message: "Server error during user update.", error: error.message });
    }
}

export const checkAuth = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        res.status(200).json(toClientUser(user));
    } catch (error) {
        console.error("Error during auth check:", error.message);
        res.status(500).json({ message: "Server error during authentication check.", error: error.message })
    }
}

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-auth.password");
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching all users:", error.message);
        res.status(500).json({ message: "Server error fetching all users.", error: error.message });
    }
}

export const requestOtp = async (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({ "identity.email": cleanEmail });

        if (!user) {
            return res.status(200).json({ message: 'If an account exists, an OTP has been sent.' });
        }

        const otp = generateOTP();
        const hashedOtp = hashOTP(otp);
        const otpExpires = Date.now() + 10 * 60 * 1000;

        user.identity.resetOtp = hashedOtp;
        user.identity.resetOtpExpiry = otpExpires;
        await user.save();

        await sendOtpEmail(cleanEmail, otp);

        return res.status(200).json({ message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('Request OTP Error:', error);
        return res.status(500).json({ error: 'Failed to send OTP code.' });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const cleanEmail = email.trim().toLowerCase();
        const user = await User.findOne({ "identity.email": cleanEmail });

        if (!user || !user.identity.resetOtp || !user.identity.resetOtpExpiry) {
            return res.status(400).json({ error: 'Invalid request or OTP expired.' });
        }

        if (Date.now() > user.identity.resetOtpExpiry) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        const inputHashedOtp = hashOTP(otp);
        if (inputHashedOtp !== user.identity.resetOtp) {
            return res.status(400).json({ error: 'Invalid OTP code.' });
        }

        user.identity.resetOtp = undefined;
        user.identity.resetOtpExpiry = undefined;

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.identity.resetPasswordToken = hashOTP(resetToken);
        await user.save();

        return res.status(200).json({
            message: 'OTP verified successfully.',
            resetToken
        });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to verify OTP.' })
    }
};

export const updatePassword = async (req, res) => {
    try {
        const { email, newPassword, resetToken } = req.body;
        const cleanEmail = email.trim().toLowerCase();
        const user = await User.findOne({ "identity.email": cleanEmail });

        if (!user || !user.identity.resetPasswordToken) {
            return res.status(400).json({ error: 'Invalid request or token expired.' });
        }

        const hashedResetToken = hashOTP(resetToken);
        if (hashedResetToken !== user.identity.resetPasswordToken) {
            return res.status(400).json({ error: 'Invalid reset token.' });
        }

        const salt = await bcrypt.genSalt(10);
        user.auth.password = await bcrypt.hash(newPassword, salt);
        user.identity.resetPasswordToken = undefined;
        await user.save();

        return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update password.' });
    }
};