import mongoose from 'mongoose';
import User from '../models/user.model.js';
import UserReport from '../models/userReports.model.js';
import UserActivity from '../models/userActivity.model.js';
import BlockUser from '../models/blockUser.model.js';
import ClearChatModel from '../models/clearChat.model.js';
import Conversation from '../models/Conversation.model.js';
import Message from '../models/message.model.js';
import PushSubscription from '../models/pushSubscription.model.js';
import PlatformSettings, { DEFAULT_MATCHING_SETTINGS } from '../models/platformSettings.model.js';

export const checkAdmin = async (req, res) => {
    try {
        res.status(200).json({ message: "You are an admin!" });
    } catch (error) {
        res.status(500).json({ message: "Server error during admin check.", error: error.message });
    }
}

export const getDashboardMetrics = async (req, res) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [totalUsers, matchSearches24h, pendingReports] = await Promise.all([
            User.countDocuments({ 'identity.role': 'User' }),
            UserActivity.countDocuments({ activityType: 'view_matches', timestamp: { $gte: since } }),
            UserReport.countDocuments({ status: 'pending' }),
        ]);

        res.status(200).json({ totalUsers, matchSearches24h, pendingReports });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching dashboard metrics.', error: error.message });
    }
};

export const getPlatformSettings = async (req, res) => {
    try {
        const settings = await PlatformSettings.findOneAndUpdate(
            { key: 'global' },
            { $setOnInsert: { key: 'global' } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).select('matching').lean();

        res.status(200).json({ matching: settings.matching });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching platform settings.', error: error.message });
    }
};

export const updatePlatformSettings = async (req, res) => {
    const matching = req.body?.matching;
    const allowedKeys = new Set(Object.keys(DEFAULT_MATCHING_SETTINGS));

    if (!matching || typeof matching !== 'object' || Array.isArray(matching)) {
        return res.status(400).json({ message: 'Matching settings must be an object.' });
    }

    const keys = Object.keys(matching);
    if (!keys.length || keys.some(key => !allowedKeys.has(key))) {
        return res.status(400).json({ message: 'Provide one or more supported matching settings.' });
    }
    if (
        ('resultLimit' in matching && (!Number.isInteger(matching.resultLimit) || matching.resultLimit < 1 || matching.resultLimit > 50)) ||
        ('minimumCompatibility' in matching && (!Number.isInteger(matching.minimumCompatibility) || matching.minimumCompatibility < 0 || matching.minimumCompatibility > 100)) ||
        ('requireVerifiedStudents' in matching && typeof matching.requireVerifiedStudents !== 'boolean')
    ) {
        return res.status(400).json({ message: 'Matching settings contain invalid values.' });
    }

    try {
        const updates = Object.fromEntries(keys.map(key => [`matching.${key}`, matching[key]]));
        const settings = await PlatformSettings.findOneAndUpdate(
            { key: 'global' },
            { $set: updates, $setOnInsert: { key: 'global' } },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        ).select('matching').lean();

        res.status(200).json({ matching: settings.matching });
    } catch (error) {
        res.status(500).json({ message: 'Server error updating platform settings.', error: error.message });
    }
};

export const updateUserReport = async (req, res) => {
    const { reportId } = req.params;
    const { status, adminNotes } = req.body ?? {};
    const updates = {};

    if (!mongoose.isObjectIdOrHexString(reportId)) {
        return res.status(400).json({ message: 'Invalid report ID.' });
    }
    if (status !== undefined) {
        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            return res.status(400).json({ message: 'Invalid report status.' });
        }
        updates.status = status;
    }
    if (adminNotes !== undefined) {
        if (typeof adminNotes !== 'string' || adminNotes.length > 2000) {
            return res.status(400).json({ message: 'Admin notes must be 2000 characters or fewer.' });
        }
        updates.adminNotes = adminNotes.trim();
    }
    if (!Object.keys(updates).length) {
        return res.status(400).json({ message: 'No report updates were provided.' });
    }

    try {
        const report = await UserReport.findByIdAndUpdate(
            reportId,
            { $set: updates },
            { new: true, runValidators: true }
        )
            .populate('reporter', 'identity.firstName identity.lastName identity.profilePic')
            .populate('reportedUser', 'identity.firstName identity.lastName identity.profilePic')
            .lean();

        if (!report) return res.status(404).json({ message: 'Report not found.' });
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ message: 'Server error updating report.', error: error.message });
    }
};

export const getAllUsersForAdmin = async (req, res) => {
    try {
        const users = await User.find({ 'identity.role': 'User' })
            .select('_id identity.firstName identity.lastName identity.email identity.profilePic identity.role university.verifiedStudentStatus')
            .lean();
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching users.", error: error.message });
    }
}
export const deleteUser = async (req, res) => {
    const { userId } = req.params;
    if (!mongoose.isObjectIdOrHexString(userId)) {
        return res.status(400).json({ message: "Invalid user ID." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const conversations = await Conversation.find({ participants: user._id }).select('_id');
        const conversationIds = conversations.map(conversation => conversation._id);

        await Message.deleteMany({ conversationId: { $in: conversationIds } });
        await ClearChatModel.deleteMany({
            $or: [
                { conversationId: { $in: conversationIds } },
                { clearedBy: user._id }
            ]
        });
        await Conversation.deleteMany({ participants: user._id });
        await BlockUser.deleteMany({
            $or: [{ blockerId: user._id }, { blockedId: user._id }]
        });
        await PushSubscription.deleteMany({ userId: user._id });
        await UserActivity.deleteMany({ userId: user._id });
        await UserReport.deleteMany({
            $or: [{ reporter: user._id }, { reportedUser: user._id }]
        });
        await User.deleteOne({ _id: user._id });

        res.status(200).json({ message: "User deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error while deleting user.", error: error.message });
    }
}
export const updateUserRole = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['User', 'Admin'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'User' or 'Admin'." });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.identity.role = role;
        await user.save();

        res.status(200).json({ message: "User role updated successfully.", user: { _id: user._id, identity: user.identity.role,  } });
    } catch (error) {
        res.status(500).json({ message: "Server error while updating user role.", error: error.message });
    }
}

export const verifyStudent = async (req, res) => {
    const { userId } = req.params;
    const { verifiedStudentStatus } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        user.university.verifiedStudentStatus = verifiedStudentStatus;
        await user.save();

        res.status(200).json({ message: "Student verification status updated successfully.", user: { _id: user._id, university: { verifiedStudentStatus: user.university.verifiedStudentStatus } } });
    } catch (error) {
        res.status(500).json({ message: "Server error while updating student verification status.", error: error.message });
    }
}

export const getUserReports = async (req, res) => {
    try {
        const reports = await UserReport.find()
            .populate('reporter', 'identity.firstName identity.lastName identity.profilePic')
            .populate('reportedUser', 'identity.firstName identity.lastName identity.profilePic')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        
        const validReports = reports.filter(report => report.reporter !== null && report.reportedUser !== null);

        res.status(200).json(validReports);
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ message: "Error fetching user reports" });
    }
};