import mongoose from 'mongoose';

const userReportSchema = new mongoose.Schema({
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
    adminNotes: { type: String }
}, { timestamps: true });

const UserReport = mongoose.model('UserReport', userReportSchema);

export default UserReport;