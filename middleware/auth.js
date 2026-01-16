const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware xác thực JWT token
const authenticate = async (req, res, next) => {
  try {
    // Lấy token từ header
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Bạn chưa đăng nhập. Vui lòng cung cấp token.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Lấy thông tin user từ database
    const result = await query(
      'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token không hợp lệ hoặc user không tồn tại.' 
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        message: 'Tài khoản của bạn đã bị vô hiệu hóa.' 
      });
    }

    // Gán user vào request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token không hợp lệ.' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi xác thực.',
      error: error.message 
    });
  }
};

// Middleware phân quyền theo role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Bạn chưa đăng nhập.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Bạn không có quyền truy cập. Chỉ ${roles.join(', ')} mới được phép.` 
      });
    }

    next();
  };
};

// Middleware cho phép cả guest và authenticated user
const optional = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, email, full_name, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length > 0 && result.rows[0].is_active) {
        req.user = result.rows[0];
      }
    }
    
    next();
  } catch (error) {
    // Nếu lỗi, vẫn cho phép tiếp tục nhưng không set user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optional
};
