const { query } = require('../config/database');

const Wishlist = {
  add: async (userId, bikeId) => {
    try {
      const result = await query(
        'INSERT INTO wishlists (user_id, bike_id) VALUES ($1, $2) RETURNING *',
        [userId, bikeId]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new Error('Xe đã có trong danh sách yêu thích');
      }
      throw error;
    }
  },

  remove: async (userId, bikeId) => {
    await query('DELETE FROM wishlists WHERE user_id = $1 AND bike_id = $2', [userId, bikeId]);
  },

  findByUser: async (userId) => {
    const result = await query(
      `SELECT w.*, 
        b.title, b.price, b.condition, b.status, b.location,
        c.name as category_name, br.name as brand_name,
        (SELECT image_url FROM bike_images WHERE bike_id = b.id AND is_primary = true LIMIT 1) as primary_image
      FROM wishlists w
      JOIN bikes b ON w.bike_id = b.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN brands br ON b.brand_id = br.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC`,
      [userId]
    );
    return result.rows;
  },

  checkExists: async (userId, bikeId) => {
    const result = await query(
      'SELECT * FROM wishlists WHERE user_id = $1 AND bike_id = $2',
      [userId, bikeId]
    );
    return result.rows.length > 0;
  }
};

module.exports = Wishlist;
