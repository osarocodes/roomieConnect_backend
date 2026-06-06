import Message from '../models/message.model.js';
import ClearChatModel from '../models/clearChat.model.js';
import User from '../models/user.model.js';
import BlockUser from '../models/blockUser.model.js';
import UserActivity from '../models/userActivity.model.js';
import UserReport from '../models/userReports.model.js';
import Conversation from '../models/Conversation.model.js';
import PushSubscription from "../models/pushSubscription.model.js"
import cloudinary from '../lib/cloudinary.js';
import { io, getRecipientSocketId } from '../lib/socket.js';
import mongoose from 'mongoose';

export const createOrGetConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { recipientId } = req.body;

    // Check if conversation already exists between these two
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, recipientId] }
    });

    // If not, create it
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, recipientId],
        initiatedBy: currentUserId
      });
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
    const { content, image } = req.body;
    const { conversationId } = req.params;
    const sender = req.user._id;

    console.log("Send Message Request - sender:", sender, "conversationId:", conversationId, "content:", content, "image:", image);

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
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
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

    const recipientSocketId = getRecipientSocketId(recipient.toString());
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('newMessage', savedMessage);
      io.to(recipientSocketId).emit('conversationUpdated', {
        _id: sender,
        lastMessage: savedMessage
      });
    }

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: savedMessage._id,
      updatedAt: new Date()
    });

    const pushSub = await PushSubscription.findOne({ userId: recipient });
    if (pushSub) {
      const senderUser = await User.findById(sender).select('identity.firstName');
      
      webpush.sendNotification(
        pushSub.subscription,
        JSON.stringify({
          title: `New message from ${senderUser.identity.firstName}`,
          body: content || '📷 Sent an image',
          url: `/chat/${conversationId}`
        })
      ).catch(err => {
        // If subscription is expired/invalid, clean it up
        if (err.statusCode === 410) {
          PushSubscription.deleteOne({ userId: recipient }).exec();
        }
      });
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

    const recipientSocketId = getRecipientSocketId(senderId.toString());
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('messageSeen', {
        recipient: userId
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
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          recipient: currentUserId,
          isRead: false,
          conversationId: { $in: conversationIds }
        }
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
    const { query } = req.query;
    const loggedInUserId = req.user._id;
    const blockedByMe = await BlockUser.find({ blockerId: loggedInUserId }).select('blockedId');
    const blockedByOthers = await BlockUser.find({ blockedId: loggedInUserId }).select('blockerId');
    const blockedIds = [...blockedByMe.map(b => b.blockedId), ...blockedByOthers.map(b => b.blockerId)];
    const adminId = process.env.ADMIN_USER_ID;

    if (adminId) {
      blockedIds.push(new mongoose.Types.ObjectId(adminId));
    }
    const baseFilter = { _id: { $ne: loggedInUserId, $nin: blockedIds } };

    if (query && query.trim() !== '') {
      const regex = new RegExp(query, 'i');
      const users = await User.find({
        $and: [
          baseFilter,
          {
            $or: [
              { "identity.firstName": regex },
              { "identity.lastName": regex },
              { "identity.email": regex }
            ]
          }
        ]
      })
      .select("identity.firstName identity.lastName identity.profilePic")
      .limit(10)
      .lean();

      res.status(200).json(users);
    } else {
      const users = await User.find(baseFilter).limit(10).lean();
      res.status(200).json(users);
    }
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
        { upsert: true, new: true }
      );

      res.status(200).json({ message: 'Subscription saved' })
    } catch (error) {
      res.status(500).json({ message: 'Error saving subcription', error: error.message })
    }
}