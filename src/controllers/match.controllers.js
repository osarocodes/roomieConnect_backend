
import User from '../models/user.model.js';
import BlockUser from '../models/blockUser.model.js';
import UserActivity from '../models/userActivity.model.js';
import { calculateScore } from '../lib/helperFunc.js';

export const getRecommendedMatches = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id);
        const blockedByMe = await BlockUser.find({ blockerId: currentUser._id }).select('blockedId');
        const blockedByOthers = await BlockUser.find({ blockedId: currentUser._id }).select('blockerId');
        const blockedIds = [...blockedByMe.map(b => b.blockedId), ...blockedByOthers.map(b => b.blockerId)];
        const adminId = process.env.ADMIN_USER_ID;
        blockedIds.push(adminId);

        const excludedIds = [
            currentUser._id,
            ...blockedIds,
        ];
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }
        
        // Hard constraints only
        const candidates = await User.find({
            _id: { $nin: excludedIds },
            "locationPreference.preferredArea": currentUser.locationPreference.preferredArea,
            "budget.rentRange.min": { $lte: currentUser.budget.rentRange.max },
            "budget.rentRange.max": { $gte: currentUser.budget.rentRange.min }
        }).select("-auth.password");
        
		console.log("candidate", candidates);
        const rankedMatches = candidates
        .map(candidate => {
            const matchResult = calculateScore(currentUser, candidate);
            return {
                    user: candidate,
                    ...matchResult
                };
            })
            // .filter(m => m.compatibility >= 80)
            .sort((a, b) => b.compatibility - a.compatibility)
            .slice(0, 20);

        await UserActivity.create({
            userId: currentUser._id,
            activityType: "view_matches",
            details: {
                candidateIds: candidates.map(c => c._id),
                returnedMatchIds: rankedMatches.map(m => m.user._id)
            }
        });

        res.status(200).json(rankedMatches);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching matches" });
    }
};

export const blockUser = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user._id;
        
        if (conversationId === currentUserId.toString()) {
            return res.status(400).json({ message: "You cannot block yourself" });
        }
        
        const userToBlock = await User.findById(conversationId);
        if (!userToBlock) {
            return res.status(404).json({ message: "User to block not found" });
        }
        const alreadyBlocked = await BlockUser.findOne({
            blockerId: currentUserId,
            blockedId: conversationId
        });
        if (alreadyBlocked) {
            return res.status(400).json({ message: "User is already blocked" });
        }
        
        const blockEntry = new BlockUser({
            blockerId: currentUserId,
            blockedId: conversationId
        });
        await blockEntry.save();

        await UserActivity.create({
            userId: currentUserId,
            activityType: "block_user",
            details: {
                blockedUserId: conversationId
            }
        });
        
        res.status(200).json({ message: "User blocked successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error blocking user" });
    }
};

export const unblockUser = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user._id;
        
        const blockEntry = await BlockUser.findOne({
            blockerId: currentUserId,
            blockedId: conversationId
        });
        if (!blockEntry) {
            return res.status(404).json({ message: "Block entry not found" });
        }
        await BlockUser.deleteOne({ _id: blockEntry._id });

        await UserActivity.create({
            userId: currentUserId,
            activityType: "unblock_user",
            details: {
                unblockedUserId: conversationId
            }
        });
        
        res.status(200).json({ message: "User unblocked successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error unblocking user" });
    }
};

export const checkBlockStatus = async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const currentUserId = req.user._id;

        const isBlocked = await BlockUser.findOne({
            $or: [
                { blockerId: currentUserId, blockedId: otherUserId },
                { blockerId: otherUserId, blockedId: currentUserId }
            ]
        });

        res.status(200).json({ isBlocked: !!isBlocked });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error checking block status" });
    }
};