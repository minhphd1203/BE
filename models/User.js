const { query } = require('../config/database');

const User = {
  // Tạo user mới
  create: async (userData) => {
    const { email, password_hash, full_name, phone, role } = userData;
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, full_name, phone, role, created_at`,
      [email, password_hash, full_name, phone, role || 'buyer']
    );
    return result.rows[0];
  },

  // Tìm user theo email
  findByEmail: async (email) => {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  },

  // Tìm user theo ID
  findById: async (id) => {
    const result = await query(
      'SELECT id, email, full_name, phone, avatar_url, role, reputation_score, is_active, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Cập nhật profile
  update: async (id, updates) => {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    values.push(id);
    
    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, full_name, phone, avatar_url, role, reputation_score`,
      values
    );
    return result.rows[0];
  },

  // Lấy danh sách users (admin)
  findAll: async (filters = {}) => {
    let queryText = 'SELECT id, email, full_name, phone, role, is_active, reputation_score, created_at FROM users WHERE 1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.role) {
      queryText += ` AND role = $${paramIndex}`;
      values.push(filters.role);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      queryText += ` AND is_active = $${paramIndex}`;
      values.push(filters.is_active);
      paramIndex++;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query(queryText, values);
    return result.rows;
  },

  // Cập nhật reputation score
  updateReputation: async (userId, newScore) => {
    await query(
      'UPDATE users SET reputation_score = $1 WHERE id = $2',
      [newScore, userId]
    );
  },

  // Vô hiệu hóa/kích hoạt user
  toggleActive: async (id, isActive) => {
    const result = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active',
      [isActive, id]
    );
    return result.rows[0];
  }
};

module.exports = User;
