import express from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { getRecommendedMatches, blockUser, unblockUser, checkBlockStatus } from '../controllers/match.controllers.js';
const router = express.Router();


router.get('/users/block-status/:otherUserId', protectRoute, checkBlockStatus);
router.get('/matches', protectRoute, getRecommendedMatches);
router.post('/users/block/:conversationId', protectRoute, blockUser);
router.post('/users/unblock/:conversationId', protectRoute, unblockUser);

export default router;