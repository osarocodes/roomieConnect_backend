import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    activityType: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed }
})

const UserActivity = mongoose.model('UserActivity', userActivitySchema);

export default UserActivity;