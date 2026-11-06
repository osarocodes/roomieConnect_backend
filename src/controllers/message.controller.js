import Message from '../models/message.model.js';
import ClearChatModel from '../models/clearChat.model.js';
import User from '../models/user.model.js';
import BlockUser from '../models/blockUser.model.js';
import UserActivity from '../models/userActivity.model.js';
import UserReport from '../models/userReports.model.js';
import Conversation from '../models/Conversation.model.js';
import PushSubscription from "../models/pushSubscription.model.js";
import webpush from 'web-push';
import cloudinary from '../lib/cloudinary.js';
import { io, getRecipientSocketIds } from '../lib/socket.js';
import { escapeRegExp } from '../lib/helperFunc.js';
import mongoose from 'mongoose';

const getUnreadCount = async (conversationId, userId) => {
  const clearRecord = await ClearChatModel.findOne({ conversationId, clearedBy: userId });
  const query = { conversationId, recipient: userId, isRead: false };

  if (clearRecord?.clearedAt) {
    query.createdAt = { $gt: clearRecord.clearedAt };
  }

  return Message.countDocuments(query);
};

const emitConversationUpdate = async (userId, conversationId, lastMessage) => {
  const socketIds = getRecipientSocketIds(userId.toString());
  if (!socketIds.length) return;

  const unreadCount = await getUnreadCount(conversationId, userId);
  io.to(socketIds).emit('conversationUpdated', {
    conversationId: conversationId.toString(),
    lastMessage,
    unreadCount,
    updatedAt: new Date(),
  });
};

export const createOrGetConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const recipientId = req.body.recipientId;

    
    if (typeof recipientId !== 'string' || !mongoose.isObjectIdOrHexString(recipientId)) {
      return res.status(400).json({ message: 'Invalid recipient ID format' });
    }
    
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);
    
    if (recipientObjectId.equals(currentUserId)) {
      return res.status(400).json({ message: 'Cannot create a conversation with yourself' });
    }
    
    const recipientUser = await User.findById(recipientObjectId).select("_id");
    if (!recipientUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    
    const block = await BlockUser.exists({
      $or: [
        { blockerId: currentUserId, blockedId: recipientObjectId },
        { blockerId: recipientObjectId, blockedId: currentUserId }
      ]
    });
    
    if (block) {
      return res.status(403).json({ message: 'You cannot start this conversation' });
    }
    
    // Check if conversation already exists between these two
    const participantsFilter = {
      participants: { $all: [currentUserId, recipientId], $size: 2 }
    };
    let conversation = await Conversation.findOne(participantsFilter);
    
    // If not, create it
    if (!conversation) {
      try {
        conversation = await Conversation.create({
          participants: [currentUserId, recipientObjectId],
          initiatedBy: currentUserId
        });
      } catch (error) {
        if (error?.code !== 11000) throw error;

        conversation = await Conversation.findOne(participantsFilter);
        if (!conversation) throw error;
      }
    }

    res.status(200).json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Server Error creating conversation', error: error.message });
  }
};

export const clearChat = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const myId = req.user._id;

    await ClearChatModel.updateOne(
      { conversationId, clearedBy: myId },
      { $set: { clearedAt: new Date() } },
      { upsert: true }
    );
    const unreadCount = await getUnreadCount(conversationId, myId);
    const socketIds = getRecipientSocketIds(myId.toString());
    if (socketIds.length) {
      io.to(socketIds).emit('conversationUpdated', {
        conversationId,
        unreadCount,
      });
    }
    await UserActivity.create({
      userId: myId,
      activityType: "clear_chat",
      details: {
        conversationId
      }
    });

    res.status(200).json({ message: 'Chat cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error clearing chat', error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const myId = req.user._id;
    const clearChatRecord = await ClearChatModel.findOne({ conversationId, clearedBy: myId });

    const query = { conversationId };

    if (clearChatRecord && clearChatRecord.clearedAt) {
      query.createdAt = { $gt: clearChatRecord.clearedAt };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server Error fetching messages', error: error.message });
  }
};

export const sendMessages = async (req, res) => {
  try {
    const rawContent = req.body.content;
    if (rawContent !== undefined && typeof rawContent !== 'string') {
      return res.status(400).json({ message: 'Message content must be a string.' });
    }

    const content = rawContent ?? '';
    const { conversationId } = req.params;
    const sender = req.user._id;

    if (content.trim() === '' && !req.file) {
      return res.status(400).json({ message: 'A message or image is required.' });
    }

    if (req.body.image !== undefined) {
      return res.status(400).json({ message: 'Upload images as a multipart image file.' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    if (!conversation.participants.some(p => p.toString() === sender.toString())) {
      return res.status(403).json({ message: 'Not part of this conversation' });
    }

    const recipient = conversation.participants.find(p => p.toString() !== sender.toString());
    if (!recipient) {
      return res.status(400).json({ message: 'Recipient not determined from conversation' });
    }

    let imageUrl = null;
    if (req.file) {
      const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploadResponse = await cloudinary.uploader.upload(imageData, {
        folder: 'roomieconnect/messages',
      });
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      conversationId,
      sender,
      recipient,
      content,
      image: imageUrl,
    });

    const savedMessage = await newMessage.save();

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: savedMessage._id,
      updatedAt: new Date()
    });

    const recipientSocketIds = getRecipientSocketIds(recipient.toString());
    if (recipientSocketIds.length) {
      io.to(recipientSocketIds).emit('newMessage', savedMessage);
    }

    const conversationNotifications = await Promise.allSettled([
      emitConversationUpdate(recipient, conversation._id, savedMessage),
      emitConversationUpdate(sender, conversation._id, savedMessage),
    ]);
    for (const notification of conversationNotifications) {
      if (notification.status === 'rejected') {
        console.error('Failed to emit conversation update:', notification.reason);
      }
    }

    try {
      const pushSub = await PushSubscription.findOne({ userId: recipient });
      if (pushSub) {
        const senderUser = await User.findById(sender).select('identity.firstName');

        await webpush.sendNotification(
          pushSub.subscription,
          JSON.stringify({
            title: `New message from ${senderUser?.identity?.firstName || 'Someone'}`,
            body: content || '📷 Sent an image',
            url: `/chat/${conversationId}`
          })
        );
      }
    } catch (pushError) {
      console.error("Push notification failed after message was saved:", pushError);
      if (pushError.statusCode === 404 || pushError.statusCode === 410) {
        try {
          await PushSubscription.deleteOne({ userId: recipient });
        } catch (cleanupError) {
          console.error("Failed to remove expired push subscription:", cleanupError);
        }
      }
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server Error sending message', error: error.message });
  }
};

export const markMessageAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const senderId = conversation.participants.find(p => p.toString() !== userId.toString());
    if (!senderId) {
      return res.status(400).json({ message: 'Could not determine message sender from conversation' });
    }

    await Message.updateMany(
      { conversationId, sender: senderId, recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    const unreadCount = await getUnreadCount(conversation._id, userId);
    const userSocketIds = getRecipientSocketIds(userId.toString());
    if (userSocketIds.length) {
      io.to(userSocketIds).emit('conversationUpdated', {
        conversationId: conversation._id.toString(),
        unreadCount,
      });
    }

    const recipientSocketIds = getRecipientSocketIds(senderId.toString());
    if (recipientSocketIds.length) {
      io.to(recipientSocketIds).emit('messageSeen', {
        recipient: userId.toString(),
        conversationId: conversation._id.toString(),
      });
    }

    res.status(200).json({ message: "Messages marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const conversations = await Conversation.find({
      participants: { $in: [currentUserId] }
    })
    .populate('lastMessage')
    .populate('participants', 'identity.firstName identity.lastName identity.profilePic')
    .sort({ updatedAt: -1 });

    if (!conversations.length) return res.status(200).json([]);

    const clearChatRecords = await ClearChatModel.find({ clearedBy: currentUserId });
    const clearChatMap = {};
    clearChatRecords.forEach(record => {
      clearChatMap[record.conversationId.toString()] = record.clearedAt;
    });

    const conversationIds = conversations.map(conv => conv._id);
    const unreadMatch = {
      recipient: currentUserId,
      isRead: false,
      conversationId: { $in: conversationIds }
    };
    if (clearChatRecords.length) {
      unreadMatch.$or = [
        { conversationId: { $nin: clearChatRecords.map(record => record.conversationId) } },
        ...clearChatRecords.map(record => ({
          conversationId: record.conversationId,
          createdAt: { $gt: record.clearedAt }
        }))
      ];
    }
    const unreadCounts = await Message.aggregate([
      {
        $match: unreadMatch
      },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 }
        }
      }
    ]);

    const unreadMap = {};
    unreadCounts.forEach(item => {
      unreadMap[item._id.toString()] = item.count;
    });

    const result = conversations
      .filter(conv => {
        const clearedAt = clearChatMap[conv._id.toString()];
        if (!clearedAt) return true;
        if (!conv.lastMessage) return true;
        return conv.lastMessage.createdAt && conv.lastMessage.createdAt > clearedAt;
      })
      .map(conv => {
        const otherParticipant = conv.participants.find(p => p._id.toString() !== currentUserId.toString());

        return {
          conversationId: conv._id,
          user: {
            _id: otherParticipant._id,
            firstName: otherParticipant.identity.firstName,
            lastName: otherParticipant.identity.lastName,
            profilePic: otherParticipant.identity.profilePic
          },
          lastMessage: conv.lastMessage ? {
            content: conv.lastMessage.content,
            image: conv.lastMessage.image,
            createdAt: conv.lastMessage.createdAt
          } : null,
          unreadCount: unreadMap[conv._id.toString()] || 0,
          updatedAt: conv.updatedAt
        };
      });

      res.status(200).json(result);
    } catch (error) {
      console.log("Error fetching conversations: ", error);
      res.status(500).json({ message: 'Server Error fetching conversations', error: error.message });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const rawQuery = req.query.query;
    if (rawQuery !== undefined && typeof rawQuery !== 'string') {
      return res.status(400).json({ message: 'Search query must be a string.' });
    }

    const query = rawQuery?.trim() ?? '';
    const loggedInUserId = req.user._id;
    const blockedByMe = await BlockUser.find({ blockerId: loggedInUserId }).select('blockedId');
    const blockedByOthers = await BlockUser.find({ blockedId: loggedInUserId }).select('blockerId');
    const blockedIds = [...blockedByMe.map(b => b.blockedId), ...blockedByOthers.map(b => b.blockerId)];

    if (query.length > 25) {
      return res.status(400).json({ message: 'Query too long' });
    }

    const safeQuery = escapeRegExp(query);
    const conversations = await Conversation.find({ participants: loggedInUserId })
      .populate('participants', 'identity.firstName identity.lastName identity.email identity.profilePic')
      .sort({ updatedAt: -1 })
      .lean();
    const regex = query ? new RegExp(safeQuery, 'i') : null;
    const blockedIdSet = new Set(blockedIds.map(id => id.toString()));
    const results = conversations.flatMap(conversation => {
      const participant = conversation.participants.find(
        person => person._id.toString() !== loggedInUserId.toString()
      );

      if (!participant || blockedIdSet.has(participant._id.toString())) return [];

      const identity = participant.identity;
      if (regex && !regex.test(`${identity.firstName} ${identity.lastName} ${identity.email}`)) {
        return [];
      }

      return [{
        conversationId: conversation._id.toString(),
        user: {
          _id: participant._id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          profilePic: identity.profilePic,
        },
      }];
    }).slice(0, 10);

    res.status(200).json(results);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ message: "Error searching users", error: error.message });
  }
};

export const setUserReport = async (req, res) => {
  try {
    const { reportedUser, reason } = req.body;

    if (reportedUser === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot report Yourself" });
    }

    const userReport = await UserReport.create({
      reporter: req.user._id,
      reportedUser,
      reason
    });

    await UserActivity.create({
      userId: req.user._id,
      activityType: "Reported User",
      details: {
        reason
      }
    });

    res.status(201).json(userReport);
  } catch (error) {
    console.log("Report upload Error: ", error);
    res.status(500).json({ message: "Error adding report to database" });
  }
};

export const saveSubscription = async (req, res) => {
    try {
      const { subscription } = req.body;
      const userId = req.user._id

      await PushSubscription.findOneAndUpdate(
        { userId },
        { subscription },
        { upsert: true, returnDocument: 'after' }
      );

      res.status(200).json({ message: 'Subscription saved' })
    } catch (error) {
      res.status(500).json({ message: 'Error saving subcription', error: error.message })
    }
}