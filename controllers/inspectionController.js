const Inspection = require('../models/Inspection');
const Bike = require('../models/Bike');

// Tạo yêu cầu kiểm định (seller request)
exports.requestInspection = async (req, res, next) => {
  try {
    const { bike_id } = req.body;

    // Kiểm tra bike có tồn tại và thuộc về seller
    const bike = await Bike.findById(bike_id);
    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tin đăng xe.'
      });
    }

    if (bike.seller_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền yêu cầu kiểm định xe này.'
      });
    }

    // Tạo inspection request (inspector_id sẽ được assign sau)
    const inspection = await Inspection.create({
      bike_id,
      inspector_id: req.user.id // Tạm thời, admin sẽ assign inspector sau
    });

    res.status(201).json({
      success: true,
      message: 'Yêu cầu kiểm định đã được gửi!',
      data: inspection
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách inspection của inspector
exports.getInspectorInspections = async (req, res, next) => {
  try {
    const inspections = await Inspection.findByInspector(req.user.id);

    res.json({
      success: true,
      data: inspections
    });
  } catch (error) {
    next(error);
  }
};

// Lấy pending inspections
exports.getPendingInspections = async (req, res, next) => {
  try {
    const inspections = await Inspection.getPending();

    res.json({
      success: true,
      data: inspections
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật kết quả kiểm định
exports.updateInspection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, frame_condition, brake_condition, drivetrain_condition, overall_rating, notes, report_url } = req.body;

    const inspection = await Inspection.findById(id);
    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu kiểm định.'
      });
    }

    // Chỉ inspector được assign hoặc admin mới update được
    if (inspection.inspector_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật kiểm định này.'
      });
    }

    const updates = {
      status,
      frame_condition,
      brake_condition,
      drivetrain_condition,
      overall_rating,
      notes,
      report_url
    };

    if (status === 'completed') {
      updates.inspection_date = new Date();
    }

    const updatedInspection = await Inspection.update(id, updates);

    res.json({
      success: true,
      message: 'Cập nhật kiểm định thành công!',
      data: updatedInspection
    });
  } catch (error) {
    next(error);
  }
};

// Lấy inspection history của bike
exports.getBikeInspections = async (req, res, next) => {
  try {
    const { bikeId } = req.params;

    const inspections = await Inspection.findByBike(bikeId);

    res.json({
      success: true,
      data: inspections
    });
  } catch (error) {
    next(error);
  }
};
