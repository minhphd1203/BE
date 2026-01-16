const { query } = require('../config/database');

const Message = {
  create: async (messageData) => {
    const { sender_id, receiver_id, bike_id, content } = messageData;
    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, bike_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [sender_id, receiver_id, bike_id, content]
    );
    return result.rows[0];
  },

  // Lấy cuộc hội thoại giữa 2 users về 1 bike
  getConversation: async (user1Id, user2Id, bikeId) => {
    const result = await query(
      `SELECT m.*, 
        sender.full_name as sender_name,
        receiver.full_name as receiver_name
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
        AND m.bike_id = $3
      ORDER BY m.created_at ASC`,
      [user1Id, user2Id, bikeId]
    );
    return result.rows;
  },

  // Lấy tất cả cuộc hội thoại của user
  getUserConversations: async (userId) => {
    const result = await query(
      `SELECT DISTINCT ON (other_user_id, bike_id) 
        m.id, m.bike_id, m.content, m.is_read, m.created_at,
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as other_user_id,
        CASE WHEN m.sender_id = $1 THEN receiver.full_name ELSE sender.full_name END as other_user_name,
        b.title as bike_title
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      JOIN users receiver ON m.receiver_id = receiver.id
      LEFT JOIN bikes b ON m.bike_id = b.id
      WHERE m.sender_id = $1 OR m.receiver_id = $1
      ORDER BY other_user_id, bike_id, m.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  markAsRead: async (messageId) => {
    await query('UPDATE messages SET is_read = true WHERE id = $1', [messageId]);
  },

  markConversationAsRead: async (userId, otherUserId, bikeId) => {
    await query(
      `UPDATE messages SET is_read = true 
       WHERE receiver_id = $1 AND sender_id = $2 AND bike_id = $3`,
      [userId, otherUserId, bikeId]
    );
  }
};

module.exports = Message;
