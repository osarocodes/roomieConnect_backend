import User from '../models/user.model.js';
import UserReport from '../models/userReports.model.js';

export const checkAdmin = async (req, res) => {
    try {
        res.status(200).json({ message: "You are an admin!" });
    } catch (error) {
        res.status(500).json({ message: "Server error during admin check.", error: error.message });
    }
}

export const getAllUsersForAdmin = async (req, res) => {
    try {
        const users = await User.find({'auth.role': 'user' }, { 'auth.password': 0 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Server error while fetching users.", error: error.message });
    }
}
export const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
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