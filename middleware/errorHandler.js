// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Database errors
  if (err.code && err.code.startsWith('23')) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Dữ liệu đã tồn tại (trùng lặp).'
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu tham chiếu không hợp lệ.'
      });
    }
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Đã xảy ra lỗi server.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Không tìm thấy đường dẫn API này.'
  });
};

module.exports = {
  errorHandler,
  notFound
};
