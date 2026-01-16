const { query } = require('../config/database');

const Order = {
  create: async (orderData) => {
    const { bike_id, buyer_id, seller_id, total_amount, deposit_amount, notes } = orderData;
    const result = await query(
      `INSERT INTO orders (bike_id, buyer_id, seller_id, total_amount, deposit_amount, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [bike_id, buyer_id, seller_id, total_amount, deposit_amount, notes]
    );
    return result.rows[0];
  },

  findById: async (id) => {
    const result = await query(
      `SELECT o.*, 
        b.title as bike_title, b.price as bike_price,
        buyer.full_name as buyer_name, buyer.phone as buyer_phone,
        seller.full_name as seller_name, seller.phone as seller_phone
      FROM orders o
      JOIN bikes b ON o.bike_id = b.id
      JOIN users buyer ON o.buyer_id = buyer.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE o.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  findByBuyer: async (buyerId) => {
    const result = await query(
      `SELECT o.*, b.title as bike_title, seller.full_name as seller_name
      FROM orders o
      JOIN bikes b ON o.bike_id = b.id
      JOIN users seller ON o.seller_id = seller.id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC`,
      [buyerId]
    );
    return result.rows;
  },

  findBySeller: async (sellerId) => {
    const result = await query(
      `SELECT o.*, b.title as bike_title, buyer.full_name as buyer_name
      FROM orders o
      JOIN bikes b ON o.bike_id = b.id
      JOIN users buyer ON o.buyer_id = buyer.id
      WHERE o.seller_id = $1
      ORDER BY o.created_at DESC`,
      [sellerId]
    );
    return result.rows;
  },

  updateStatus: async (id, status) => {
    const result = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }
};

module.exports = Order;
