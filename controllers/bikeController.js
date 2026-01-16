const Joi = require('joi');
const Bike = require('../models/Bike');

// Validation schemas
const bikeSchema = Joi.object({
  category_id: Joi.number().integer().required(),
  brand_id: Joi.number().integer().required(),
  title: Joi.string().min(10).max(255).required(),
  description: Joi.string().min(20).required(),
  price: Joi.number().positive().required(),
  condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor').required(),
  frame_size: Joi.string().allow('', null),
  year_of_manufacture: Joi.number().integer().min(1900).max(new Date().getFullYear()),
  weight: Joi.number().positive(),
  color: Joi.string().allow('', null),
  location: Joi.string().required()
});

// Tạo listing mới
exports.createBike = async (req, res, next) => {
  try {
    // Validate
    const { error, value } = bikeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // Tạo bike
    const bike = await Bike.create({
      ...value,
      seller_id: req.user.id
    });

    // Nếu có specs
    if (req.body.specs) {
      await Bike.addSpecs(bike.id, req.body.specs);
    }

    res.status(201).json({
      success: true,
      message: 'Tạo tin đăng thành công! Đang chờ kiểm duyệt.',
      data: bike
    });
  } catch (error) {
    next(error);
  }
};

// Upload ảnh cho bike
exports.uploadImages = async (req, res, next) => {
  try {
    const { bikeId } = req.params;

    // Kiểm tra bike có tồn tại và thuộc về seller
    const bike = await Bike.findById(bikeId);
    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng.'
      });
    }

    if (bike.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền upload ảnh cho tin đăng này.'
      });
    }

    // Upload files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 ảnh.'
      });
    }

    const images = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageUrl = `/uploads/bikes/${file.filename}`;
      const isPrimary = i === 0; // Ảnh đầu tiên là ảnh chính

      const image = await Bike.addImage(bikeId, imageUrl, isPrimary);
      images.push(image);
    }

    res.json({
      success: true,
      message: 'Upload ảnh thành công!',
      data: images
    });
  } catch (error) {
    next(error);
  }
};

// Tìm kiếm và lọc bikes
exports.searchBikes = async (req, res, next) => {
  try {
    const filters = {
      category_id: req.query.category_id,
      brand_id: req.query.brand_id,
      condition: req.query.condition,
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      is_inspected: req.query.is_inspected === 'true',
      keyword: req.query.keyword,
      sort_by: req.query.sort_by || 'created_at',
      order: req.query.order || 'desc',
      page: req.query.page || 1,
      limit: req.query.limit || 20
    };

    const bikes = await Bike.search(filters);

    res.json({
      success: true,
      data: bikes,
      pagination: {
        page: parseInt(filters.page),
        limit: parseInt(filters.limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết bike
exports.getBikeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bike = await Bike.findById(id);

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng.'
      });
    }

    // Tăng view count nếu không phải seller
    if (!req.user || req.user.id !== bike.seller_id) {
      await Bike.incrementView(id);
    }

    res.json({
      success: true,
      data: bike
    });
  } catch (error) {
    next(error);
  }
};

// Lấy bikes của seller (chính mình)
exports.getMyBikes = async (req, res, next) => {
  try {
    const bikes = await Bike.findBySeller(req.user.id);

    res.json({
      success: true,
      data: bikes
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật bike
exports.updateBike = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Kiểm tra bike có tồn tại và thuộc về seller
    const bike = await Bike.findById(id);
    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng.'
      });
    }

    if (bike.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chỉnh sửa tin đăng này.'
      });
    }

    // Các field được phép update
    const allowedFields = ['title', 'description', 'price', 'condition', 'frame_size', 
                          'year_of_manufacture', 'weight', 'color', 'location', 'status'];
    const updates = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu để cập nhật.'
      });
    }

    const updatedBike = await Bike.update(id, updates);

    // Cập nhật specs nếu có
    if (req.body.specs) {
      await Bike.updateSpecs(id, req.body.specs);
    }

    res.json({
      success: true,
      message: 'Cập nhật tin đăng thành công!',
      data: updatedBike
    });
  } catch (error) {
    next(error);
  }
};

// Xóa bike
exports.deleteBike = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Kiểm tra bike có tồn tại và thuộc về seller
    const bike = await Bike.findById(id);
    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng.'
      });
    }

    if (bike.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa tin đăng này.'
      });
    }

    await Bike.delete(id);

    res.json({
      success: true,
      message: 'Xóa tin đăng thành công!'
    });
  } catch (error) {
    next(error);
  }
};

// Xóa ảnh
exports.deleteImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;

    // TODO: Kiểm tra quyền và xóa file vật lý
    await Bike.deleteImage(imageId);

    res.json({
      success: true,
      message: 'Xóa ảnh thành công!'
    });
  } catch (error) {
    next(error);
  }
};
