import { Server } from "socket.io";
import User from '../models/user.model.js'
import jwt from "jsonwebtoken";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import BlockUser from "../models/blockUser.model.js";
import cookieParser from "cookie-parser";

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:4173", 
    "https://roomie-connect-frontend.vercel.app"
]

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});

const parseCookies = cookieParser();

export function getRecipientSocketId(recipientId) {
    return userSocketMap[recipientId];
}
const userSocketMap = {};

io.use((socket, next) => {
    parseCookies(socket.request, {}, async (parseError) => {
        if (parseError) {
            return next(new Error("Unauthorized"));
        }

        try {
            const token = socket.request.cookies?.token;
            if (!token) {
                return next(new Error("Unauthorized"));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (typeof decoded !== "object" || !decoded.id) {
                return next(new Error("Unauthorized"));
            }

            const user = await User.findById(decoded.id).select("_id");
            if (!user) {
                return next(new Error("Unauthorized"));
            }

            socket.data.userId = user._id.toString();
            next();
        } catch (error) {
            console.error("Socket authenticated failed:", error.message);
            next(new Error("Unauthorized"));
        }
    });
});

io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    if (!mongoose.isValidObjectId(userId)) {
        console.error("Invalid or missing user ID in the socket handshake query.");
        socket.disconnect(true);
        return;
    }
    const blockedByMe = await BlockUser.find({ blockerId: userId }).select('blockedId');
    const blockedByOthers = await BlockUser.find({ blockedId: userId }).select('blockerId');
    const blockedSet = new Set([...blockedByMe.map(b => b.blockedId), ...blockedByOthers.map(b => b.blockerId)]);
    const allowed = Object.keys(userSocketMap).filter(id => !blockedSet.has(id));
    
    if (userId && userId !== "undefined") {
        userSocketMap[userId] = socket.id;
    }

    // Tell everyone who is online
    socket.emit("onlineUsers", allowed);

    socket.on("sendMessage", (newMessage) => {
        const recipientSocketId = userSocketMap[newMessage.recipient];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("newMessage", newMessage);
        }
    });

    socket.on("disconnect", () => {
        // We use the userId from the handshake closure
        if (userId) {
            delete userSocketMap[userId];
        }
        io.emit("onlineUsers", Object.keys(userSocketMap));
    });
});
export { app, server, io };