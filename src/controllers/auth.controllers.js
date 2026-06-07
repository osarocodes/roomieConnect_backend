import User from "../models/user.model.js";
import UserActivity from "../models/userActivity.model.js";
import bcrypt from "bcryptjs";
import cloudinary from '../lib/cloudinary.js';
import { parseRentRange } from "../lib/dataTransformer.js";
import { signupSchema } from "../validation/schemas/signupSchema.js";
import { generateToken } from "../lib/utils.js";
import dotenv from 'dotenv';
dotenv.config();

export const signup = async (req, res) => {
    try {
        // 1. Parse and transform the data from frontend
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

        // 3. Now upload to Cloudinary (since we know the data is valid)
        const profilePicResult = await cloudinary.uploader.upload(files.profilePic[0].path);
        const admissionLetterResult = await cloudinary.uploader.upload(files.admissionLetter[0].path);

        // 4. Update object with real URLs and save
        data.identity.profilePic = profilePicResult.secure_url;
        if (!data.document) {
            data.document = {};
        }
        data.document.admissionLetter = admissionLetterResult.secure_url;

        //Todo: Move password hashing to a pre-save hook in the model
        const salt = await bcrypt.genSalt(10);
        data.auth.password = await bcrypt.hash(data.auth.password, salt);
        
        const newUser = new User(data);
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
        console.log("User fetched from db", user);
        console.log("User Information:", email);
        if (!user) return res.status(401).json({ message: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.auth.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

        generateToken(user._id, res)
        await UserActivity.create({
            userId: user._id,
            activityType: 'User logged in'
        });

        res.status(200).json(user);
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
        console.log(req.user)

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
        // Allow admin route with :id or self-update via protectRoute
        const userId = req.params.id || req.user._id;

        // Build a $set object that only sets provided fields (avoid clobbering nested objects)
        const setObj = {};

        // Handle file upload (profile picture)
        if (req.files?.profilePic?.[0]) {
            const result = await cloudinary.uploader.upload(req.files.profilePic[0].path);
            setObj['identity.profilePic'] = result.secure_url;
        }

        // Parse JSON payload if frontend sent nested data as a JSON string (e.g., FormData with a 'data' field)
        let updates = {};
        if (req.body && req.body.data) {
            try {
                updates = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            } catch (err) {
                console.warn('Could not parse req.body.data as JSON, falling back to raw body', err.message);
                updates = req.body;
            }
        } else {
            updates = req.body || {};
        }

        // Helper to flatten nested update fields into dotted keys for $set
        const flatten = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (value === undefined) continue;
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, newKey);
                } else {
                    setObj[newKey] = value;
                }
            }
        };

        if (updates && Object.keys(updates).length) flatten(updates);

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

        if (Object.keys(setObj).length === 0) {
            return res.status(400).json({ message: 'No update fields provided.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: setObj },
            { new: true, runValidators: true }
        ).select("-auth.password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found." });
        }

        await UserActivity.create({
            userId: userId,
            activityType: 'User profile updated',
            details: { updatedFields: Object.keys(setObj) }
        });
        
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Error updating user:", error.message);
        res.status(500).json({ message: "Server error during user update.", error: error.message });
    }
}

export const checkAuth = async (req, res) => {
    try {
        res.status(200).json(req.user);
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