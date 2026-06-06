import BlockUser from "../models/blockUser.model.js";
import Conversation from "../models/Conversation.model.js";

export const canCommunicate = async (req, res, next) => {
    try {
        const sender = req.user._id;
        const conversationId = req.params.conversationId || req.body.conversationId;

        if (!conversationId) {
            return res.status(400).json({ success: false, message: 'Conversation ID is required' });
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        if (!conversation.participants.some(p => p.toString() === sender.toString())) {
            return res.status(403).json({ success: false, message: 'Not part of this conversation' });
        }

        const recipient = conversation.participants.find(p => p.toString() !== sender.toString());
        if (!recipient) {
            return res.status(400).json({ success: false, message: 'Recipient not found' });
        }

        const isBlocked = await BlockUser.findOne({
            $or: [
                { blockerId: sender, blockedId: recipient },
                { blockerId: recipient, blockedId: sender }
            ]
        });

        if (isBlocked) {
            return res.status(403).json({ success: false, message: 'Communication blocked between these users' });
        }

        next();
    } catch (error) {
        console.error("BlockUser Middleware Error:", error.message);
        return res.status(500).json({ success: false, message: 'Server error checking communication permissions' });
    }
}