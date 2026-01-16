const multer = require('multer');
const path = require('path');

// Cấu hình lưu trữ file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'images') {
      cb(null, 'uploads/bikes');
    } else if (file.fieldname === 'video') {
      cb(null, 'uploads/videos');
    } else if (file.fieldname === 'avatar') {
      cb(null, 'uploads/avatars');
    } else if (file.fieldname === 'report') {
      cb(null, 'uploads/reports');
    } else {
      cb(null, 'uploads/others');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filter file types
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'images' || file.fieldname === 'avatar') {
    // Chỉ chấp nhận ảnh
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
  } else if (file.fieldname === 'video') {
    // Chỉ chấp nhận video
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file video!'), false);
    }
  } else if (file.fieldname === 'report') {
    // Chấp nhận PDF và images
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file PDF hoặc ảnh!'), false);
    }
  } else {
    cb(null, true);
  }
};

// Giới hạn kích thước file
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  }
});

module.exports = upload;
