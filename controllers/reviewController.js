const Review = require('../models/Review');
const Order = require('../models/Order');

// Tạo đánh giá
exports.createReview = async (req, res, next) => {
  try {
    const { order_id, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating phải từ 1 đến 5.'
      });
    }

    // Kiểm tra order có tồn tại
    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng.'
      });
    }

    // Kiểm tra user có phải buyer của order không
    if (order.buyer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá đơn hàng này.'
      });
    }

    // Kiểm tra order đã completed chưa
    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá sau khi giao dịch hoàn tất.'
      });
    }

    // Kiểm tra đã đánh giá chưa
    const existingReview = await Review.checkExistingReview(order_id, req.user.id);
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá đơn hàng này rồi.'
      });
    }

    const review = await Review.create({
      order_id,
      reviewer_id: req.user.id,
      reviewee_id: order.seller_id,
      rating,
      comment
    });

    res.status(201).json({
      success: true,
      message: 'Đánh giá thành công!',
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// Lấy đánh giá của seller
exports.getSellerReviews = async (req, res, next) => {
  try {
    const { sellerId } = req.params;

    const reviews = await Review.findByReviewee(sellerId);

    res.json({
      success: true,
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};
