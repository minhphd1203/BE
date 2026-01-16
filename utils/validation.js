// Validation schemas cho các endpoints

const Joi = require('joi');

// User validation
const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Email không hợp lệ',
      'any.required': 'Email là bắt buộc'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
      'any.required': 'Mật khẩu là bắt buộc'
    }),
    full_name: Joi.string().min(2).max(255).required().messages({
      'string.min': 'Tên phải có ít nhất 2 ký tự',
      'any.required': 'Họ tên là bắt buộc'
    }),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/).messages({
      'string.pattern.base': 'Số điện thoại phải có 10-11 chữ số'
    }),
    role: Joi.string().valid('buyer', 'seller').default('buyer')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    full_name: Joi.string().min(2).max(255),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/),
    avatar_url: Joi.string().uri()
  })
};

// Bike validation
const bikeSchemas = {
  create: Joi.object({
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
    location: Joi.string().required(),
    specs: Joi.object({
      frame_material: Joi.string(),
      brake_type: Joi.string(),
      gear_system: Joi.string(),
      wheel_size: Joi.string(),
      suspension_type: Joi.string(),
      usage_history: Joi.string()
    })
  }),

  update: Joi.object({
    category_id: Joi.number().integer(),
    brand_id: Joi.number().integer(),
    title: Joi.string().min(10).max(255),
    description: Joi.string().min(20),
    price: Joi.number().positive(),
    condition: Joi.string().valid('new', 'like_new', 'good', 'fair', 'poor'),
    frame_size: Joi.string().allow('', null),
    year_of_manufacture: Joi.number().integer().min(1900).max(new Date().getFullYear()),
    weight: Joi.number().positive(),
    color: Joi.string().allow('', null),
    location: Joi.string(),
    status: Joi.string().valid('active', 'sold', 'hidden', 'pending_review')
  })
};

// Order validation
const orderSchemas = {
  create: Joi.object({
    bike_id: Joi.string().uuid().required(),
    deposit_amount: Joi.number().positive(),
    notes: Joi.string().allow('', null)
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('pending', 'deposit_paid', 'completed', 'cancelled').required()
  })
};

// Message validation
const messageSchemas = {
  create: Joi.object({
    receiver_id: Joi.string().uuid().required(),
    bike_id: Joi.string().uuid(),
    content: Joi.string().min(1).max(2000).required()
  })
};

// Review validation
const reviewSchemas = {
  create: Joi.object({
    order_id: Joi.string().uuid().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().max(1000).allow('', null)
  })
};

// Inspection validation
const inspectionSchemas = {
  create: Joi.object({
    bike_id: Joi.string().uuid().required()
  }),

  update: Joi.object({
    status: Joi.string().valid('pending', 'in_progress', 'completed', 'rejected'),
    frame_condition: Joi.string().valid('excellent', 'good', 'fair', 'poor'),
    brake_condition: Joi.string().valid('excellent', 'good', 'fair', 'poor'),
    drivetrain_condition: Joi.string().valid('excellent', 'good', 'fair', 'poor'),
    overall_rating: Joi.number().min(1).max(10),
    notes: Joi.string().max(2000),
    report_url: Joi.string().uri()
  })
};

module.exports = {
  userSchemas,
  bikeSchemas,
  orderSchemas,
  messageSchemas,
  reviewSchemas,
  inspectionSchemas
};
