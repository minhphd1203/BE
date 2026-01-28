const User = require('../models/User');
const Bike = require('../models/Bike');
const { query } = require('../config/database');

// Lấy tất cả users
exports.getAllUsers = async (req, res, next) => {
  try {
    const filters = {
      role: req.query.role,
      is_active: req.query.is_active
    };

    const users = await User.findAll(filters);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// Vô hiệu hóa/kích hoạt user
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    const user = await User.toggleActive(userId, is_active);

    res.json({
      success: true,
      message: `${is_active ? 'Kích hoạt' : 'Vô hiệu hóa'} user thành công!`,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Kiểm duyệt tin đăng
exports.approveBike = async (req, res, next) => {
  try {
    const { bikeId } = req.params;
    const { status } = req.body; // 'active' hoặc 'hidden'

    const bike = await Bike.update(bikeId, { status });

    res.json({
      success: true,
      message: 'Cập nhật trạng thái tin đăng thành công!',
      data: bike
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tất cả bikes pending review
exports.getPendingBikes = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, u.full_name as seller_name, u.email as seller_email
      FROM bikes b
      JOIN users u ON b.seller_id = u.id
      WHERE b.status = 'pending_review'
      ORDER BY b.created_at ASC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// Thống kê tổng quan cho Dashboard
exports.getStatistics = async (req, res, next) => {
  try {
    const totalUsers = await query('SELECT COUNT(*) FROM users');
    const newListings = await query(
      "SELECT COUNT(*) FROM bikes WHERE created_at >= NOW() - INTERVAL '30 days'"
    );
    const pendingReviews = await query(
      "SELECT COUNT(*) FROM bikes WHERE status = 'pending_review'"
    );
    const reports = await query('SELECT COUNT(*) FROM reports WHERE status = $1', ['pending']);

    res.json({
      success: true,
      data: {
        total_users: parseInt(totalUsers.rows[0].count),
        new_listings: parseInt(newListings.rows[0].count),
        pending_reviews: parseInt(pendingReviews.rows[0].count),
        reports: parseInt(reports.rows[0].count)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách listing gần đây cho Dashboard
exports.getRecentListings = async (req, res, next) => {
  try {
    const limit = req.query.limit || 10;
    const result = await query(
      `SELECT 
        b.id,
        b.title,
        b.status,
        b.created_at,
        u.full_name as user_name
      FROM bikes b
      JOIN users u ON b.seller_id = u.id
      ORDER BY b.created_at DESC
      LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// Quản lý Listings với filter
exports.getAllListings = async (req, res, next) => {
  try {
    const { status, category, user, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      whereConditions.push(`b.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`b.category_id = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (user) {
      whereConditions.push(`u.full_name ILIKE $${paramIndex}`);
      params.push(`%${user}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countQuery = `SELECT COUNT(*) FROM bikes b JOIN users u ON b.seller_id = u.id ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        b.id,
        b.title,
        b.status,
        b.created_at,
        b.price,
        c.name as category,
        u.full_name as user_name
      FROM bikes b
      JOIN users u ON b.seller_id = u.id
      LEFT JOIN categories c ON b.category_id = c.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết listing để review
exports.getListingDetail = async (req, res, next) => {
  try {
    const { bikeId } = req.params;

    const bikeResult = await query(
      `SELECT 
        b.*,
        u.full_name as seller_name,
        u.email as seller_email,
        u.phone as seller_phone,
        c.name as category_name,
        br.name as brand_name
      FROM bikes b
      JOIN users u ON b.seller_id = u.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN brands br ON b.brand_id = br.id
      WHERE b.id = $1`,
      [bikeId]
    );

    if (bikeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy listing'
      });
    }

    // Lấy hình ảnh
    const imagesResult = await query(
      'SELECT * FROM bike_images WHERE bike_id = $1 ORDER BY display_order',
      [bikeId]
    );

    // Lấy thông số kỹ thuật
    const specsResult = await query(
      'SELECT * FROM bike_specs WHERE bike_id = $1',
      [bikeId]
    );

    res.json({
      success: true,
      data: {
        ...bikeResult.rows[0],
        images: imagesResult.rows,
        specs: specsResult.rows[0] || {}
      }
    });
  } catch (error) {
    next(error);
  }
};

// Approve/Reject listing
exports.reviewListing = async (req, res, next) => {
  try {
    const { bikeId } = req.params;
    const { action, reason } = req.body; // action: 'approve' hoặc 'reject'

    let status;
    if (action === 'approve') {
      status = 'active';
    } else if (action === 'reject') {
      status = 'hidden';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Action không hợp lệ'
      });
    }

    await query(
      'UPDATE bikes SET status = $1, admin_note = $2, updated_at = NOW() WHERE id = $3',
      [status, reason || null, bikeId]
    );

    // Tạo notification cho seller
    const bikeResult = await query('SELECT seller_id FROM bikes WHERE id = $1', [bikeId]);
    if (bikeResult.rows.length > 0) {
      const message = action === 'approve' 
        ? 'Tin đăng của bạn đã được phê duyệt'
        : `Tin đăng của bạn đã bị từ chối. Lý do: ${reason}`;
      
      await query(
        'INSERT INTO notifications (user_id, type, message, related_id) VALUES ($1, $2, $3, $4)',
        [bikeResult.rows[0].seller_id, 'listing_' + action, message, bikeId]
      );
    }

    res.json({
      success: true,
      message: action === 'approve' ? 'Đã phê duyệt listing' : 'Đã từ chối listing'
    });
  } catch (error) {
    next(error);
  }
};

// Quản lý Inspectors
exports.getAllInspectors = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.avatar_url,
        u.is_active,
        u.created_at,
        COUNT(i.id) as total_reviews,
        COUNT(CASE WHEN i.status = 'completed' THEN 1 END) as completed_reviews,
        ROUND(
          COUNT(CASE WHEN i.status = 'completed' THEN 1 END)::numeric / 
          NULLIF(COUNT(i.id), 0) * 100, 
          0
        ) as approval_rate
      FROM users u
      LEFT JOIN inspections i ON u.id = i.inspector_id
      WHERE u.role = 'inspector'
      GROUP BY u.id
      ORDER BY total_reviews DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// Tạo inspector mới
exports.createInspector = async (req, res, next) => {
  try {
    const { email, full_name, phone, password } = req.body;
    
    const user = await User.create({
      email,
      full_name,
      phone,
      password,
      role: 'inspector'
    });

    res.status(201).json({
      success: true,
      message: 'Tạo inspector thành công',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// Toggle inspector status
exports.toggleInspectorStatus = async (req, res, next) => {
  try {
    const { inspectorId } = req.params;
    const { is_active } = req.body;

    await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 AND role = $3',
      [is_active, inspectorId, 'inspector']
    );

    res.json({
      success: true,
      message: is_active ? 'Đã kích hoạt inspector' : 'Đã vô hiệu hóa inspector'
    });
  } catch (error) {
    next(error);
  }
};

// Lấy báo cáo/reports
exports.getReports = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const countResult = await query(
      'SELECT COUNT(*) FROM reports WHERE status = $1',
      [status]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        r.*,
        u.full_name as reporter_name,
        b.title as bike_title
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      LEFT JOIN bikes b ON r.bike_id = b.id
      WHERE r.status = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Xử lý report
exports.handleReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const { action, note } = req.body; // action: 'resolve', 'dismiss'

    await query(
      'UPDATE reports SET status = $1, admin_note = $2, resolved_at = NOW() WHERE id = $3',
      [action === 'resolve' ? 'resolved' : 'dismissed', note, reportId]
    );

    res.json({
      success: true,
      message: 'Đã xử lý report'
    });
  } catch (error) {
    next(error);
  }
};

// Quản lý categories
exports.getCategories = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;
    const result = await query(
      'INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, description]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// Quản lý brands
exports.getBrands = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM brands ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

exports.createBrand = async (req, res, next) => {
  try {
    const { name, slug, logo_url } = req.body;
    const result = await query(
      'INSERT INTO brands (name, slug, logo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, logo_url]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
