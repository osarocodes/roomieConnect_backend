import mongoose from 'mongoose';

const clearChatSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
        index: 1
    },
    clearedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: 1
    },
    clearedAt: {
        type: Date,
        required: true,
        index: 1
    }
},
    { timestamps: true }
);
// mongoose/.createIndex({ conversationId: 1, clearedBy: 1, clearedAt: -1 });
export default mongoose.model('ClearChat', clearChatSchema);