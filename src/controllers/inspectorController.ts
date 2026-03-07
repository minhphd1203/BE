import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, inspections, users, categories } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { InspectionFormData, ApiResponse } from '../models';

// ============= QUẢN LÝ KIỂM ĐỊNH XE ĐẠP =============

// � 0. DASHBOARD - THỐNG KÊ TỔNG QUAN
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;

    // Đếm số xe chờ kiểm định (pending)
    const [pendingCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bikes)
      .where(eq(bikes.inspectionStatus, 'pending'));

    // Đếm số xe đang kiểm định (in_progress)
    const [inProgressCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bikes)
      .where(eq(bikes.inspectionStatus, 'in_progress'));

    // Đếm tổng số lần kiểm định của inspector này
    const [myInspectionsCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(inspections)
      .where(eq(inspections.inspectorId, inspectorId!));

    // Đếm số xe đã kiểm định PASSED
    const [passedCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(inspections)
      .where(
        and(
          eq(inspections.inspectorId, inspectorId!),
          eq(inspections.status, 'passed')
        )
      );

    // Đếm số xe đã kiểm định FAILED
    const [failedCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(inspections)
      .where(
        and(
          eq(inspections.inspectorId, inspectorId!),
          eq(inspections.status, 'failed')
        )
      );

    const response: ApiResponse = {
      success: true,
      data: {
        pending: pendingCount?.count || 0,
        inProgress: inProgressCount?.count || 0,
        completed: myInspectionsCount?.count || 0,
        passed: passedCount?.count || 0,
        failed: failedCount?.count || 0,
      },
      message: 'Dashboard statistics retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// �🔍 1. LẤY DANH SÁCH XE CHỜ KIỂM ĐỊNH
export const getPendingBikes = async (req: Request, res: Response) => {
  try {
    const { search, sort } = req.query;

    let query = db
      .select({
        id: bikes.id,
        title: bikes.title,
        brand: bikes.brand,
        model: bikes.model,
        year: bikes.year,
        price: bikes.price,
        condition: bikes.condition,
        images: bikes.images,
        status: bikes.status,
        isVerified: bikes.isVerified,
        inspectionStatus: bikes.inspectionStatus,
        sellerId: bikes.sellerId,
        sellerName: users.name,
        categoryName: categories.name,
        createdAt: bikes.createdAt,
      })
      .from(bikes)
      .leftJoin(users, eq(bikes.sellerId, users.id))
      .leftJoin(categories, eq(bikes.categoryId, categories.id))
      .$dynamic();

    // Base conditions
    const conditions = [
      eq(bikes.status, 'approved'), // Chỉ lấy xe đã được admin duyệt
      sql`${bikes.inspectionStatus} IN ('pending', 'in_progress')`
    ];

    // Search filter
    if (search && typeof search === 'string') {
      conditions.push(
        sql`(
          LOWER(${bikes.title}) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(${bikes.brand}) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(${bikes.model}) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(${users.name}) LIKE LOWER(${'%' + search + '%'})
        )`
      );
    }

    query = query.where(and(...conditions));

    // Sorting
    if (sort === 'oldest') {
      query = query.orderBy(bikes.createdAt);
    } else if (sort === 'price_asc') {
      query = query.orderBy(bikes.price);
    } else if (sort === 'price_desc') {
      query = query.orderBy(desc(bikes.price));
    } else {
      // Default: newest first
      query = query.orderBy(desc(bikes.createdAt));
    }

    const pendingBikes = await query;

    res.json({
      success: true,
      data: pendingBikes,
      message: `Found ${pendingBikes.length} bikes pending inspection`,
    });
  } catch (error) {
    console.error('Get pending bikes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending bikes',
    });
  }
};

// 📄 3. LẤY CHI TIẾT MỘT XE ĐỂ KIỂM ĐỊNH
export const getBikeDetail = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;

    const [bikeDetail] = await db
      .select({
        id: bikes.id,
        title: bikes.title,
        description: bikes.description,
        brand: bikes.brand,
        model: bikes.model,
        year: bikes.year,
        price: bikes.price,
        condition: bikes.condition,
        mileage: bikes.mileage,
        color: bikes.color,
        images: bikes.images,
        status: bikes.status,
        isVerified: bikes.isVerified,
        inspectionStatus: bikes.inspectionStatus,
        sellerId: bikes.sellerId,
        sellerName: users.name,
        sellerPhone: users.phone,
        sellerEmail: users.email,
        categoryName: categories.name,
        createdAt: bikes.createdAt,
      })
      .from(bikes)
      .leftJoin(users, eq(bikes.sellerId, users.id))
      .leftJoin(categories, eq(bikes.categoryId, categories.id))
      .where(eq(bikes.id, bikeId as string));

    if (!bikeDetail) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    // Lấy lịch sử kiểm định (nếu có)
    const inspectionHistory = await db
      .select()
      .from(inspections)
      .where(eq(inspections.bikeId, bikeId as string))
      .orderBy(desc(inspections.createdAt));

    res.json({
      success: true,
      data: {
        bike: bikeDetail,
        inspectionHistory,
      },
    });
  } catch (error) {
    console.error('Get bike detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bike detail',
    });
  }
};

// 🚀 4. BẮT ĐẦU KIỂM ĐỊNH (Cập nhật trạng thái sang "in_progress")
export const startInspection = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;

    // Kiểm tra xe tồn tại
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, bikeId as string));

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    if (bike.inspectionStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This bike has already been inspected',
      });
    }

    // Cập nhật trạng thái sang in_progress
    const [updatedBike] = await db
      .update(bikes)
      .set({
        inspectionStatus: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(bikes.id, bikeId as string))
      .returning();

    res.json({
      success: true,
      data: updatedBike,
      message: 'Inspection started successfully',
    });
  } catch (error) {
    console.error('Start inspection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start inspection',
    });
  }
};

// ✅ 5. HOÀN TẤT KIỂM ĐỊNH (Submit form kiểm định)
export const submitInspection = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;
    const inspectorId = req.user?.userId;
    const inspectionData: InspectionFormData = req.body;

    // Validate required fields
    if (!inspectionData.status || !inspectionData.overallCondition) {
      return res.status(400).json({
        success: false,
        message: 'Status and overall condition are required',
      });
    }

    // Kiểm tra xe tồn tại
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, bikeId as string));

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    // Tạo bản ghi inspection
    const [newInspection] = await db
      .insert(inspections)
      .values({
        bikeId: bikeId as string,
        inspectorId: inspectorId!,
        status: inspectionData.status,
        overallCondition: inspectionData.overallCondition,
        frameCondition: inspectionData.frameCondition,
        brakeCondition: inspectionData.brakeCondition,
        drivetrainCondition: inspectionData.drivetrainCondition,
        wheelCondition: inspectionData.wheelCondition,
        inspectionNote: inspectionData.inspectionNote,
        recommendation: inspectionData.recommendation,
        inspectionImages: inspectionData.inspectionImages || [],
        reportFile: inspectionData.reportFile,
      })
      .returning();

    // Cập nhật trạng thái xe
    const verificationStatus = inspectionData.status === 'passed' ? 'verified' : 'failed';

    await db
      .update(bikes)
      .set({
        isVerified: verificationStatus,
        inspectionStatus: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(bikes.id, bikeId as string));

    res.json({
      success: true,
      data: newInspection,
      message: `Inspection completed. Bike status: ${verificationStatus}`,
    });
  } catch (error) {
    console.error('Submit inspection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit inspection',
    });
  }
};

// 📋 6. LẤY LỊCH SỬ KIỂM ĐỊNH CỦA INSPECTOR
export const getMyInspections = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;
    const { search, sort, status } = req.query;

    let query = db
      .select({
        inspection: inspections,
        bikeTitle: bikes.title,
        bikeBrand: bikes.brand,
        bikeModel: bikes.model,
        bikePrice: bikes.price,
        bikeCondition: bikes.condition,
        bikeImages: bikes.images,
        sellerName: users.name,
      })
      .from(inspections)
      .leftJoin(bikes, eq(inspections.bikeId, bikes.id))
      .leftJoin(users, eq(bikes.sellerId, users.id))
      .$dynamic();

    // Base condition
    const conditions = [eq(inspections.inspectorId, inspectorId!)];

    // Search filter
    if (search && typeof search === 'string') {
      conditions.push(
        sql`(
          LOWER(${bikes.title}) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(${bikes.brand}) LIKE LOWER(${'%' + search + '%'}) OR
          LOWER(${users.name}) LIKE LOWER(${'%' + search + '%'})
        )`
      );
    }

    // Status filter (passed/failed)
    if (status && (status === 'passed' || status === 'failed')) {
      conditions.push(eq(inspections.status, status));
    }

    query = query.where(and(...conditions));

    // Sorting
    if (sort === 'oldest') {
      query = query.orderBy(inspections.createdAt);
    } else if (sort === 'price_asc') {
      query = query.orderBy(bikes.price);
    } else if (sort === 'price_desc') {
      query = query.orderBy(desc(bikes.price));
    } else {
      // Default: newest first
      query = query.orderBy(desc(inspections.createdAt));
    }

    const myInspections = await query;

    res.json({
      success: true,
      data: myInspections,
    });
  } catch (error) {
    console.error('Get my inspections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inspection history',
    });
  }
};

// 📊 7. LẤY CHI TIẾT MỘT BÁO CÁO KIỂM ĐỊNH
export const getInspectionDetail = async (req: Request, res: Response) => {
  try {
    const inspectionId = req.params.inspectionId as string;

    const [inspection] = await db
      .select({
        inspection: inspections,
        bike: bikes,
        inspector: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(inspections)
      .leftJoin(bikes, eq(inspections.bikeId, bikes.id))
      .leftJoin(users, eq(inspections.inspectorId, users.id))
      .where(eq(inspections.id, inspectionId as string));

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection report not found',
      });
    }

    res.json({
      success: true,
      data: inspection,
    });
  } catch (error) {
    console.error('Get inspection detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get inspection detail',
    });
  }
};

// 🔄 8. CẬP NHẬT BÁO CÁO KIỂM ĐỊNH (Nếu cần sửa)
export const updateInspection = async (req: Request, res: Response) => {
  try {
    const inspectionId = req.params.inspectionId as string;
    const inspectorId = req.user?.userId;
    const updateData: Partial<InspectionFormData> = req.body;

    // Kiểm tra inspection tồn tại và thuộc về inspector này
    const [inspection] = await db
      .select()
      .from(inspections)
      .where(eq(inspections.id, inspectionId as string));

    if (!inspection) {
      return res.status(404).json({
        success: false,
        message: 'Inspection not found',
      });
    }

    if (inspection.inspectorId !== inspectorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own inspections',
      });
    }

    // Cập nhật
    const [updatedInspection] = await db
      .update(inspections)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(inspections.id, inspectionId as string))
      .returning();

    res.json({
      success: true,
      data: updatedInspection,
      message: 'Inspection updated successfully',
    });
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inspection',
    });
  }
};
