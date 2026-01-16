const Message = require('../models/Message');

// Gửi tin nhắn
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiver_id, bike_id, content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nội dung tin nhắn không được để trống.'
      });
    }

    const message = await Message.create({
      sender_id: req.user.id,
      receiver_id,
      bike_id,
      content
    });

    res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công!',
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// Lấy cuộc hội thoại
exports.getConversation = async (req, res, next) => {
  try {
    const { userId, bikeId } = req.params;

    const messages = await Message.getConversation(req.user.id, userId, bikeId);

    // Đánh dấu đã đọc
    await Message.markConversationAsRead(req.user.id, userId, bikeId);

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách cuộc hội thoại
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Message.getUserConversations(req.user.id);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    next(error);
  }
};
