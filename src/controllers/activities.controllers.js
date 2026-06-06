import UserActivity from '../models/userActivity.model.js';
import UserReport from '../models/userReports.model.js';

export const getUserActivities = async (req, res) => {
    try {
        const activities = await UserActivity.find()
            .populate('userId', 'identity.firstName identity.lastName identity.profilePic')
            .sort({ timestamp: -1 })
            .limit(100)
            .lean();
        
        const validActivities = activities.filter(activity => activity.userId !== null);

        res.status(200).json(validActivities);
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ message: "Error fetching user activities" });
    }
};
