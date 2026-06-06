import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    ],
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    }
},{ timestamps: true }
);

// Prevent duplicate conversations between the same two users
conversationSchema.index({ participants: 1 }, { unique: false });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;