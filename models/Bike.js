const { query } = require('../config/database');

const Bike = {
  // Tạo listing mới
  create: async (bikeData) => {
    const {
      seller_id, category_id, brand_id, title, description,
      price, condition, frame_size, year_of_manufacture,
      weight, color, location
    } = bikeData;

    const result = await query(
      `INSERT INTO bikes (
        seller_id, category_id, brand_id, title, description,
        price, condition, frame_size, year_of_manufacture,
        weight, color, location, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending_review')
      RETURNING *`,
      [seller_id, category_id, brand_id, title, description,
       price, condition, frame_size, year_of_manufacture,
       weight, color, location]
    );
    return result.rows[0];
  },

  // Tìm bike theo ID (với thông tin đầy đủ)
  findById: async (id) => {
    const result = await query(
      `SELECT b.*, 
        u.full_name as seller_name, u.phone as seller_phone, 
        u.reputation_score as seller_reputation,
        c.name as category_name, br.name as brand_name,
        (SELECT json_agg(json_build_object('id', bi.id, 'url', bi.image_url, 'is_primary', bi.is_primary))
         FROM bike_images bi WHERE bi.bike_id = b.id) as images,
        (SELECT json_agg(json_build_object('id', bv.id, 'url', bv.video_url))
         FROM bike_videos bv WHERE bv.bike_id = b.id) as videos,
        (SELECT row_to_json(bs.*) FROM bike_specs bs WHERE bs.bike_id = b.id) as specs
      FROM bikes b
      LEFT JOIN users u ON b.seller_id = u.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN brands br ON b.brand_id = br.id
      WHERE b.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  // Search và filter bikes
  search: async (filters = {}) => {
    let queryText = `
      SELECT b.id, b.title, b.price, b.condition, b.status, b.location, b.is_inspected, b.view_count, b.created_at,
        c.name as category_name, br.name as brand_name,
        u.full_name as seller_name, u.reputation_score as seller_reputation,
        (SELECT image_url FROM bike_images WHERE bike_id = b.id AND is_primary = true LIMIT 1) as primary_image
      FROM bikes b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN brands br ON b.brand_id = br.id
      LEFT JOIN users u ON b.seller_id = u.id
      WHERE b.status = 'active'
    `;
    
    const values = [];
    let paramIndex = 1;

    // Filter by category
    if (filters.category_id) {
      queryText += ` AND b.category_id = $${paramIndex}`;
      values.push(filters.category_id);
      paramIndex++;
    }

    // Filter by brand
    if (filters.brand_id) {
      queryText += ` AND b.brand_id = $${paramIndex}`;
      values.push(filters.brand_id);
      paramIndex++;
    }

    // Filter by condition
    if (filters.condition) {
      queryText += ` AND b.condition = $${paramIndex}`;
      values.push(filters.condition);
      paramIndex++;
    }

    // Filter by price range
    if (filters.min_price) {
      queryText += ` AND b.price >= $${paramIndex}`;
      values.push(filters.min_price);
      paramIndex++;
    }

    if (filters.max_price) {
      queryText += ` AND b.price <= $${paramIndex}`;
      values.push(filters.max_price);
      paramIndex++;
    }

    // Filter by inspected
    if (filters.is_inspected !== undefined) {
      queryText += ` AND b.is_inspected = $${paramIndex}`;
      values.push(filters.is_inspected);
      paramIndex++;
    }

    // Search by keyword
    if (filters.keyword) {
      queryText += ` AND (b.title ILIKE $${paramIndex} OR b.description ILIKE $${paramIndex})`;
      values.push(`%${filters.keyword}%`);
      paramIndex++;
    }

    // Sorting
    const sortBy = filters.sort_by || 'created_at';
    const order = filters.order === 'asc' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY b.${sortBy} ${order}`;

    // Pagination
    const limit = parseInt(filters.limit) || 20;
    const offset = (parseInt(filters.page) - 1) * limit || 0;
    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    const result = await query(queryText, values);
    return result.rows;
  },

  // Lấy bikes của seller
  findBySeller: async (sellerId) => {
    const result = await query(
      `SELECT b.*, c.name as category_name, br.name as brand_name,
        (SELECT image_url FROM bike_images WHERE bike_id = b.id AND is_primary = true LIMIT 1) as primary_image
      FROM bikes b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN brands br ON b.brand_id = br.id
      WHERE b.seller_id = $1
      ORDER BY b.created_at DESC`,
      [sellerId]
    );
    return result.rows;
  },

  // Cập nhật bike
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
      `UPDATE bikes SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // Xóa bike (soft delete bằng cách set status)
  delete: async (id) => {
    await query('DELETE FROM bikes WHERE id = $1', [id]);
  },

  // Tăng view count
  incrementView: async (id) => {
    await query('UPDATE bikes SET view_count = view_count + 1 WHERE id = $1', [id]);
  },

  // Thêm ảnh
  addImage: async (bikeId, imageUrl, isPrimary = false) => {
    const result = await query(
      'INSERT INTO bike_images (bike_id, image_url, is_primary) VALUES ($1, $2, $3) RETURNING *',
      [bikeId, imageUrl, isPrimary]
    );
    return result.rows[0];
  },

  // Xóa ảnh
  deleteImage: async (imageId) => {
    await query('DELETE FROM bike_images WHERE id = $1', [imageId]);
  },

  // Thêm specs
  addSpecs: async (bikeId, specs) => {
    const { frame_material, brake_type, gear_system, wheel_size, suspension_type, usage_history } = specs;
    const result = await query(
      `INSERT INTO bike_specs (bike_id, frame_material, brake_type, gear_system, wheel_size, suspension_type, usage_history)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [bikeId, frame_material, brake_type, gear_system, wheel_size, suspension_type, usage_history]
    );
    return result.rows[0];
  },

  // Cập nhật specs
  updateSpecs: async (bikeId, specs) => {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(specs).forEach(key => {
      if (specs[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(specs[key]);
        paramIndex++;
      }
    });

    values.push(bikeId);
    
    const result = await query(
      `UPDATE bike_specs SET ${fields.join(', ')} WHERE bike_id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }
};

module.exports = Bike;
