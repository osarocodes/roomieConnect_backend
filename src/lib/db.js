import mongoose from "mongoose"
import dotenv from "dotenv"
import Conversation from "../models/Conversation.model.js";
dotenv.config();

export const connectDB = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    await Conversation.createIndexes();
    console.log("connected to MongoDB");
};