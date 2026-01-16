const { query } = require('../config/database');

/**
 * Helper function để build WHERE clause động
 */
const buildWhereClause = (filters, startIndex = 1) => {
  const conditions = [];
  const values = [];
  let paramIndex = startIndex;

  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      conditions.push(`${key} = $${paramIndex}`);
      values.push(filters[key]);
      paramIndex++;
    }
  });

  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    values,
    nextParamIndex: paramIndex
  };
};

/**
 * Helper function để format response
 */
const successResponse = (data, message = null) => {
  return {
    success: true,
    ...(message && { message }),
    data
  };
};

const errorResponse = (message, statusCode = 400) => {
  return {
    success: false,
    message,
    statusCode
  };
};

/**
 * Pagination helper
 */
const paginate = (page = 1, limit = 20) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  return {
    limit: parseInt(limit),
    offset: offset < 0 ? 0 : offset
  };
};

/**
 * Slug generator (chuyển tiếng Việt thành slug)
 */
const generateSlug = (text) => {
  const from = "àáãảạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđùúủũụưừứửữựòóỏõọôồốổỗộơờớởỡợìíỉĩịäëïîöüûñçýỳỹỵỷ";
  const to = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeduuuuuuuuuuuoooooooooooooooooiiiiiaeiiouuncyyyyy";
  
  for (let i = 0, l = from.length; i < l; i++) {
    text = text.replace(RegExp(from[i], "gi"), to[i]);
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

/**
 * Format currency (VND)
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

/**
 * Validate UUID
 */
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Calculate reputation score
 */
const calculateReputationScore = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, rating) => acc + rating, 0);
  return (sum / ratings.length).toFixed(2);
};

module.exports = {
  buildWhereClause,
  successResponse,
  errorResponse,
  paginate,
  generateSlug,
  formatCurrency,
  isValidUUID,
  calculateReputationScore
};
