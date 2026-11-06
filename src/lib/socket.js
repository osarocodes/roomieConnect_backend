import { Server } from "socket.io";
import User from '../models/user.model.js'
import jwt from "jsonwebtoken";
import http from "http";
import express from "express";
import mongoose from "mongoose";
import BlockUser from "../models/blockUser.model.js";
import cookieParser from "cookie-parser";
import { isAllowedOrigin } from './cors.js';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    },
});

const parseCookies = cookieParser();

export function getRecipientSocketIds(recipientId) {
    return [...(userSocketMap.get(recipientId) ?? [])];
}
const userSocketMap = new Map();
const blockedUsersByUser = new Map();

export const refreshOnlineUsers = async (userIds = []) => {
    await Promise.all(userIds.map(async userId => {
        const normalizedUserId = userId.toString();
        if (!userSocketMap.has(normalizedUserId)) return;

        const [blockedByMe, blockedByOthers] = await Promise.all([
            BlockUser.find({ blockerId: normalizedUserId }).select('blockedId'),
            BlockUser.find({ blockedId: normalizedUserId }).select('blockerId'),
        ]);
        if (!userSocketMap.has(normalizedUserId)) return;

        blockedUsersByUser.set(normalizedUserId, new Set([
            ...blockedByMe.map(block => block.blockedId.toString()),
            ...blockedByOthers.map(block => block.blockerId.toString()),
        ]));
    }));

    const onlineUserIds = [...userSocketMap.keys()];
    for (const [userId, socketIds] of userSocketMap) {
        const blockedUserIds = blockedUsersByUser.get(userId) ?? new Set();
        const visibleUserIds = onlineUserIds.filter(id => !blockedUserIds.has(id));
        io.to([...socketIds]).emit("onlineUsers", visibleUserIds);
    }
};

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
    if (!socket.connected) return;
    
    if (userId && userId !== "undefined") {
        const socketIds = userSocketMap.get(userId) ?? new Set();
        socketIds.add(socket.id);
        userSocketMap.set(userId, socketIds);
    }

    socket.on("disconnect", () => {
        if (userId) {
            const socketIds = userSocketMap.get(userId);
            socketIds?.delete(socket.id);

            if (socketIds?.size === 0) {
                userSocketMap.delete(userId);
                blockedUsersByUser.delete(userId);
            }
        }
        refreshOnlineUsers().catch(error => {
            console.error("Failed to refresh online-user presence:", error);
        });
    });

    try {
        await refreshOnlineUsers([userId]);
    } catch (error) {
        console.error("Failed to refresh online-user presence:", error);
    }
});
export { app, server, io };