const Wishlist = require('../models/Wishlist');

// Thêm vào wishlist
exports.addToWishlist = async (req, res, next) => {
  try {
    const { bike_id } = req.body;

    const wishlistItem = await Wishlist.add(req.user.id, bike_id);

    res.status(201).json({
      success: true,
      message: 'Đã thêm vào danh sách yêu thích!',
      data: wishlistItem
    });
  } catch (error) {
    if (error.message === 'Xe đã có trong danh sách yêu thích') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

// Xóa khỏi wishlist
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const { bikeId } = req.params;

    await Wishlist.remove(req.user.id, bikeId);

    res.json({
      success: true,
      message: 'Đã xóa khỏi danh sách yêu thích!'
    });
  } catch (error) {
    next(error);
  }
};

// Lấy wishlist
exports.getWishlist = async (req, res, next) => {
  try {
    const wishlist = await Wishlist.findByUser(req.user.id);

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    next(error);
  }
};

// Kiểm tra bike có trong wishlist không
exports.checkWishlist = async (req, res, next) => {
  try {
    const { bikeId } = req.params;

    const exists = await Wishlist.checkExists(req.user.id, bikeId);

    res.json({
      success: true,
      data: { exists }
    });
  } catch (error) {
    next(error);
  }
};
