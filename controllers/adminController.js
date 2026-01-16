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

// Thống kê tổng quan
exports.getStatistics = async (req, res, next) => {
  try {
    const totalUsers = await query('SELECT COUNT(*) FROM users');
    const totalBikes = await query('SELECT COUNT(*) FROM bikes');
    const totalOrders = await query('SELECT COUNT(*) FROM orders');
    const pendingBikes = await query("SELECT COUNT(*) FROM bikes WHERE status = 'pending_review'");
    const activeBikes = await query("SELECT COUNT(*) FROM bikes WHERE status = 'active'");

    res.json({
      success: true,
      data: {
        total_users: parseInt(totalUsers.rows[0].count),
        total_bikes: parseInt(totalBikes.rows[0].count),
        total_orders: parseInt(totalOrders.rows[0].count),
        pending_bikes: parseInt(pendingBikes.rows[0].count),
        active_bikes: parseInt(activeBikes.rows[0].count)
      }
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
