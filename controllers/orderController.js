const Order = require('../models/Order');
const Bike = require('../models/Bike');

// Tạo order mới (buyer đặt mua)
exports.createOrder = async (req, res, next) => {
  try {
    const { bike_id, deposit_amount, notes } = req.body;

    // Kiểm tra bike có tồn tại và đang active
    const bike = await Bike.findById(bike_id);
    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng xe.'
      });
    }

    if (bike.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Xe này không còn khả dụng.'
      });
    }

    if (bike.seller_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể đặt mua xe của chính mình.'
      });
    }

    const order = await Order.create({
      bike_id,
      buyer_id: req.user.id,
      seller_id: bike.seller_id,
      total_amount: bike.price,
      deposit_amount,
      notes
    });

    // Cập nhật status bike
    await Bike.update(bike_id, { status: 'sold' });

    res.status(201).json({
      success: true,
      message: 'Đặt mua thành công!',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Lấy orders của buyer
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.findByBuyer(req.user.id);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// Lấy orders của seller
exports.getSellerOrders = async (req, res, next) => {
  try {
    const orders = await Order.findBySeller(req.user.id);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết order
exports.getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng.'
      });
    }

    // Kiểm tra quyền xem
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem đơn hàng này.'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật trạng thái order
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng.'
      });
    }

    // Chỉ seller hoặc admin mới cập nhật được
    if (order.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật đơn hàng này.'
      });
    }

    const updatedOrder = await Order.updateStatus(id, status);

    res.json({
      success: true,
      message: 'Cập nhật trạng thái đơn hàng thành công!',
      data: updatedOrder
    });
  } catch (error) {
    next(error);
  }
};
