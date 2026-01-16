const { query } = require('../config/database');

const Review = {
  create: async (reviewData) => {
    const { order_id, reviewer_id, reviewee_id, rating, comment } = reviewData;
    const result = await query(
      `INSERT INTO reviews (order_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [order_id, reviewer_id, reviewee_id, rating, comment]
    );

    // Cập nhật reputation score của người được đánh giá
    await this.updateUserReputation(reviewee_id);

    return result.rows[0];
  },

  findByReviewee: async (revieweeId) => {
    const result = await query(
      `SELECT r.*, reviewer.full_name as reviewer_name, o.bike_id
      FROM reviews r
      JOIN users reviewer ON r.reviewer_id = reviewer.id
      JOIN orders o ON r.order_id = o.id
      WHERE r.reviewee_id = $1
      ORDER BY r.created_at DESC`,
      [revieweeId]
    );
    return result.rows;
  },

  updateUserReputation: async (userId) => {
    const result = await query(
      `SELECT AVG(rating)::DECIMAL(3,2) as avg_rating FROM reviews WHERE reviewee_id = $1`,
      [userId]
    );
    
    const avgRating = result.rows[0].avg_rating || 0;
    await query('UPDATE users SET reputation_score = $1 WHERE id = $2', [avgRating, userId]);
  },

  checkExistingReview: async (orderId, reviewerId) => {
    const result = await query(
      'SELECT * FROM reviews WHERE order_id = $1 AND reviewer_id = $2',
      [orderId, reviewerId]
    );
    return result.rows[0];
  }
};

module.exports = Review;
