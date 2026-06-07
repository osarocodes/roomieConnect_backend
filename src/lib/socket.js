import { Server } from "socket.io";
import http from "http";
import express from "express";
import BlockUser from "../models/blockUser.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:4173", "https://roomie-connect-frontend.vercel.app"],
    },
});

export function getRecipientSocketId(recipientId) {
    return userSocketMap[recipientId];
}
const userSocketMap = {};

io.on("connection", async (socket) => {
    const userId = socket.handshake.query.userId;
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