import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    ],
    participantKey: {
        type: String,
        select: false
    },
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

conversationSchema.pre('validate', function () {
    if (this.participants?.length === 2) {
        this.participantKey = this.participants
            .map(participant => participant.toString())
            .sort()
            .join(':');
    }
});

conversationSchema.index(
    { participantKey: 1 },
    {
        unique: true,
        partialFilterExpression: { participantKey: { $type: 'string' } }
    }
);

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;