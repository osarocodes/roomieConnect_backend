import express from "express";
import { protectRoute } from "../middlewares/auth.middleware.js";
import { sendMessages,
    getMessages, 
    getConversations, 
    markMessageAsRead, 
    searchUsers, 
    clearChat, 
    setUserReport,
    createOrGetConversation,
    saveSubscription
} from "../controllers/message.controller.js";
import { canCommunicate } from "../middlewares/blockUser.middleware.js";
import { get } from "mongoose";

const router = express.Router();

// router.get("/users", protectRoute, getConversations);
router.get("/conversations", protectRoute, getConversations);
router.get("/search/users", protectRoute, searchUsers);
router.get("/:conversationId", protectRoute, canCommunicate, getMessages);
router.post("/conversations", protectRoute, createOrGetConversation);

router.post("/send/:conversationId", protectRoute, canCommunicate, sendMessages);
router.post("/read/:conversationId", protectRoute, markMessageAsRead);
router.post("/clear/:conversationId", protectRoute, clearChat);

router.post("/report/new", protectRoute, setUserReport);
router.post("/notifications/subscribe", protectRoute, saveSubscription);
export default router;