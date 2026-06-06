import express from 'express';
import authRoutes from './routes/auth.route.js';
import matchRoutes from './routes/match.route.js';
import messageRoutes from './routes/message.route.js';
import adminRoutes from './routes/admin.routes.js';
import { connectDB } from './lib/db.js';
import dotenv from "dotenv";
import cors from "cors";
import webpush from 'web-push';
import cookieParser from "cookie-parser";
dotenv.config()
import { app, server } from "./lib/socket.js"


const PORT = process.env.PORT || 3001;

webpush.setVapidDetails(
    process.env.VAPID_MAILTO,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:4173', process.env.CLIENT_URL ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json())
app.use(cookieParser())
app.use(express.urlencoded({ extended: true }))
app.use('/api/auth/', authRoutes);
app.use('/api/', matchRoutes);
app.use('/api/messages/', messageRoutes);
app.use('/api/admin/', adminRoutes);

app.use((req, res, next) => {
    res.status(404).json({ message: "Endpoint not found" });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: "Internal Server Error" });
});

(async () => {
    try {
        await connectDB();
        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to DB, exiting...", err);
        process.exit(1);
    }
})();