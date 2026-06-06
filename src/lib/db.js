import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config();

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
};