import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, inspections, users, categories, messages } from '../db/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import { InspectionFormData, ApiResponse } from '../models';
import {
  mergeInspectionProofUrls,
  publicInspectionImageUrl,
  type InspectionProofFiles,
} from '../middleware/inspectionUploadMiddleware';

function pickBodyStr(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

/** inspectionImages trong multipart: có thể là JSON string */
function parseInspectionImagesFromBody(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(String) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Form kiểm định từ multipart (field text) */
function inspectionFormFromMultipart(body: Record<string, unknown>, bikeId: string): InspectionFormData {
  return {
    bikeId,
    status: pickBodyStr(body, 'status') as InspectionFormData['status'],
    overallCondition: pickBodyStr(body, 'overallCondition') as InspectionFormData['overallCondition'],
    frameCondition: pickBodyStr(body, 'frameCondition'),
    brakeCondition: pickBodyStr(body, 'brakeCondition'),
    drivetrainCondition: pickBodyStr(body, 'drivetrainCondition'),
    wheelCondition: pickBodyStr(body, 'wheelCondition'),
    inspectionNote: pickBodyStr(body, 'inspectionNote'),
    recommendation: pickBodyStr(body, 'recommendation'),
    reportFile: pickBodyStr(body, 'reportFile'),
    inspectionImages: parseInspectionImagesFromBody(body.inspectionImages),
  };
}

const INSPECTION_UPDATE_KEYS = [
  'status',
  'overallCondition',
  'frameCondition',
  'brakeCondition',
  'drivetrainCondition',
  'wheelCondition',
  'inspectionNote',
  'recommendation',
  'reportFile',
] as const;

function partialInspectionFromMultipart(body: Record<string, unknown>): Partial<InspectionFormData> {
  const out: Partial<InspectionFormData> = {};
  for (const key of INSPECTION_UPDATE_KEYS) {
    const s = pickBodyStr(body, key);
    if (s !== undefined) (out as Record<string, string>)[key] = s;
  }
  const imgs = parseInspectionImagesFromBody(body.inspectionImages);
  if (imgs !== undefined) out.inspectionImages = imgs;
  return out;
}

// ============= QUẢN LÝ KIỂM ĐỊNH XE ĐẠP =============

// � 0. DASHBOARD - THỐNG KÊ TỔNG QUAN
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;

    /** Xe vào hàng chờ inspector: tin seller pending (BEFORE admin approval) */
    const queueStatus = eq(bikes.status, 'pending');

    // Đếm số xe chờ kiểm định (pending)
    const [pendingCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bikes)
      .where(and(queueStatus, eq(bikes.inspectionStatus, 'pending')));

    // Đếm số xe đang kiểm định (in_progress)
    const [inProgressCount] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bikes)
      .where(and(queueStatus, eq(bikes.inspectionStatus, 'in_progress')));

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
        video: bikes.video,
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

    // Inspector inspects BEFORE admin approval: only pending bikes (NOT admin-approved yet)
    const conditions = [
      eq(bikes.status, 'pending'), // Get bikes awaiting inspection (NOT yet admin-approved)
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
        video: bikes.video,
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

    // Get latest inspection for prefilling (on resubmission)
    // If bike was resubmitted, inspector can see what failed before and what needs fixing
    const latestInspection = inspectionHistory.length > 0 ? inspectionHistory[0] : null;

    res.json({
      success: true,
      data: {
        bike: bikeDetail,
        inspectionHistory,
        // If this is a resubmitted bike, latestInspection shows PREVIOUS inspection findings
        // Inspector can compare new condition vs previous findings to verify seller fixed issues
        latestInspection: latestInspection ? {
          inspectionId: latestInspection.id,
          previousStatus: latestInspection.status, // 'passed' or 'failed'
          frameCondition: latestInspection.frameCondition,
          brakeCondition: latestInspection.brakeCondition,
          drivetrainCondition: latestInspection.drivetrainCondition,
          wheelCondition: latestInspection.wheelCondition,
          overallCondition: latestInspection.overallCondition,
          inspectionNote: latestInspection.inspectionNote,
          recommendation: latestInspection.recommendation,
          inspectedAt: latestInspection.createdAt,
        } : null,
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
/**
 * Workflow:
 * - If inspection PASSED: isVerified=verified, keep status=pending (await admin approval)
 * - If inspection FAILED: isVerified=failed, auto-set status=rejected (no admin needed)
 *
 * RESUBMISSION AUTO-FILL:
 * - Inspector's findings reflect ACTUAL bike reality, which doesn't change just because seller corrected info
 * - On resubmit: condition fields AUTO-FILL from previous inspection by default
 * - Inspector only needs to change status (pass ↔ fail), doesn't need to re-enter all conditions
 * - Inspector CAN override values if they notice something different on re-inspection
 * 
 * Example:
 * - First inspection: frameCondition = "poor" (that's what inspector saw)
 * - Seller corrects listing to match inspector's findings (stops claiming "excellent")
 * - Resubmit: frameCondition auto-fills as "poor" (same reality) - inspector only sets status
 * 
 * CONSTRAINT: Inspector CANNOT mark as PASSED unless overall condition is 'good' or 'excellent'
 */
export const submitInspection = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;
    const inspectorId = req.user?.userId;
    const multipart = (req.headers['content-type'] || '').includes('multipart/form-data');
    const inspectionData: InspectionFormData = multipart
      ? inspectionFormFromMultipart(req.body as Record<string, unknown>, bikeId)
      : { ...req.body, bikeId: (req.body as InspectionFormData).bikeId || bikeId };

    // Validate required fields
    if (!inspectionData.status || !inspectionData.overallCondition) {
      return res.status(400).json({
        success: false,
        message: 'Status and overall condition are required',
      });
    }
    
    // inspectionImages can be empty - no validation required

    // Kiểm tra xe tồn tại
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, bikeId as string));

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    // PRIORITY 1: Check if bike inspection already completed
    // This error should show FIRST before any other validation
    if (bike.inspectionStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This bike inspection already completed. Cannot submit duplicate inspection. Awaiting admin action or seller resubmit.',
      });
    }

    // REQUIRE: Inspection must be in progress to submit
    if (bike.inspectionStatus !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit inspection. Inspection status is '${bike.inspectionStatus}'. Must call startInspection first to set status to 'in_progress'.`,
      });
    }

    // Get previous inspection (if resubmitted) to auto-fill all fields
    // Inspector's findings reflect ACTUAL bike condition, which doesn't change just because seller corrected info
    const [previousInspection] = await db
      .select()
      .from(inspections)
      .where(eq(inspections.bikeId, bikeId as string))
      .orderBy(desc(inspections.createdAt))
      .limit(1);

    // On resubmit: LOCK condition fields - inspector cannot change them
    // These fields represent actual bike reality, which doesn't change
    if (previousInspection) {
      // Resubmission detected - validate that condition fields are NOT being changed
      if (inspectionData.frameCondition !== undefined && inspectionData.frameCondition !== previousInspection.frameCondition) {
        return res.status(400).json({
          success: false,
          message: `frameCondition is locked on resubmit. Cannot change from "${previousInspection.frameCondition}" to "${inspectionData.frameCondition}". Only status can change.`,
        });
      }
      if (inspectionData.brakeCondition !== undefined && inspectionData.brakeCondition !== previousInspection.brakeCondition) {
        return res.status(400).json({
          success: false,
          message: `brakeCondition is locked on resubmit. Cannot change from "${previousInspection.brakeCondition}" to "${inspectionData.brakeCondition}". Only status can change.`,
        });
      }
      if (inspectionData.drivetrainCondition !== undefined && inspectionData.drivetrainCondition !== previousInspection.drivetrainCondition) {
        return res.status(400).json({
          success: false,
          message: `drivetrainCondition is locked on resubmit. Cannot change from "${previousInspection.drivetrainCondition}" to "${inspectionData.drivetrainCondition}". Only status can change.`,
        });
      }
      if (inspectionData.wheelCondition !== undefined && inspectionData.wheelCondition !== previousInspection.wheelCondition) {
        return res.status(400).json({
          success: false,
          message: `wheelCondition is locked on resubmit. Cannot change from "${previousInspection.wheelCondition}" to "${inspectionData.wheelCondition}". Only status can change.`,
        });
      }
      if (inspectionData.overallCondition !== undefined && inspectionData.overallCondition !== previousInspection.overallCondition) {
        return res.status(400).json({
          success: false,
          message: `overallCondition is locked on resubmit. Cannot change from "${previousInspection.overallCondition}" to "${inspectionData.overallCondition}". Only status can change.`,
        });
      }
    }

    // PRIORITY 2: Check constraint (only after bike status is validated)
    // CONSTRAINT: If status is 'passed', overall condition must be 'fair' or above (not 'poor')
    if (inspectionData.status === 'passed') {
      const acceptableConditions = ['excellent', 'good', 'fair'];
      if (!acceptableConditions.includes(inspectionData.overallCondition)) {
        return res.status(400).json({
          success: false,
          message: `Cannot mark inspection as PASSED with overall condition "${inspectionData.overallCondition}". To pass, overall condition must be "fair", "good" or "excellent". Only bikes with "poor" condition must be marked as FAILED.`,
          acceptableConditionsForPass: acceptableConditions,
          receivedCondition: inspectionData.overallCondition,
        });
      }
    }

    // Ảnh minh chứng: upload file (field inspectionImages) + URL trong body/JSON → lưu vào inspectionImages (schema)
    // On resubmission: Allow explicit empty array to clear images (don't fallback to previous)
    // - If inspectionData.inspectionImages is explicitly set (even if empty []), use it as-is
    // - Only fallback to previous images if inspectionData.inspectionImages is undefined
    const proofFallback =
      inspectionData.inspectionImages !== undefined 
        ? inspectionData.inspectionImages 
        : (previousInspection?.inspectionImages as string[] | undefined) ?? [];
    const mergedProofUrls = mergeInspectionProofUrls(req, proofFallback);

    // Build inspection data with auto-fill from previous inspection
    const finalInspectionData = {
      frameCondition: inspectionData.frameCondition ?? previousInspection?.frameCondition,
      brakeCondition: inspectionData.brakeCondition ?? previousInspection?.brakeCondition,
      drivetrainCondition: inspectionData.drivetrainCondition ?? previousInspection?.drivetrainCondition,
      wheelCondition: inspectionData.wheelCondition ?? previousInspection?.wheelCondition,
      overallCondition: inspectionData.overallCondition ?? previousInspection?.overallCondition,
      inspectionNote: inspectionData.inspectionNote ?? previousInspection?.inspectionNote,
      recommendation: inspectionData.recommendation ?? previousInspection?.recommendation,
      inspectionImages: mergedProofUrls,
      reportFile: inspectionData.reportFile ?? previousInspection?.reportFile,
    };

    // Tạo bản ghi inspection
    const [newInspection] = await db
      .insert(inspections)
      .values({
        bikeId: bikeId as string,
        inspectorId: inspectorId!,
        status: inspectionData.status,
        overallCondition: finalInspectionData.overallCondition,
        frameCondition: finalInspectionData.frameCondition,
        brakeCondition: finalInspectionData.brakeCondition,
        drivetrainCondition: finalInspectionData.drivetrainCondition,
        wheelCondition: finalInspectionData.wheelCondition,
        inspectionNote: finalInspectionData.inspectionNote,
        recommendation: finalInspectionData.recommendation,
        inspectionImages: finalInspectionData.inspectionImages,
        reportFile: finalInspectionData.reportFile,
      })
      .returning();

    // Determine verification status and bike status based on inspection result
    const isVerifiedStatus = inspectionData.status === 'passed' ? 'verified' : 'failed';
    
    // If FAILED: auto-set bike status to rejected (no admin approval needed)
    // If PASSED: keep status as pending (waiting for admin approval)
    const bikeStatus = inspectionData.status === 'failed' ? 'rejected' : 'pending';

    // Update bike with verification result and status
    await db
      .update(bikes)
      .set({
        isVerified: isVerifiedStatus,
        inspectionStatus: 'completed',
        status: bikeStatus,
        updatedAt: new Date(),
      })
      .where(eq(bikes.id, bikeId as string));

    const message = inspectionData.status === 'passed'
      ? previousInspection 
        ? 'Resubmission inspection passed! Info now matches actual bike condition. Bike awaiting admin approval.'
        : 'Inspection passed! Bike awaiting admin approval to go public.'
      : previousInspection
        ? 'Resubmission inspection failed. Bike condition still not acceptable. Seller must fix more and resubmit.'
        : 'Inspection failed. Bike automatically rejected. Seller must fix and resubmit.';

    res.json({
      success: true,
      data: newInspection,
      message,
      autoFilledFrom: previousInspection ? 'Previous inspection (condition remains same as reality)' : null,
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
/**
 * Used to FIX MISTAKES after submission (typos, misclicks, incorrect data entry)
 * 
 * Requirements to edit inspection - BOTH must be true:
 * 1. Inspection belongs to current inspector
 * 2. Bike has NOT been resubmitted yet (inspectionStatus must still be 'completed')
 * 3. Bike has NOT been approved by admin yet (status must NOT be 'approved')
 * 
 * Status Change Behavior:
 * - If updating inspection status from "passed" to "failed" → bike status changes "pending" → "rejected"
 * - If updating inspection status from "failed" to "passed" → bike status changes "rejected" → "pending"
 * - Only updating other fields (notes, condition) → bike status unchanged
 * 
 * Timeline:
 * - First inspection submitted → inspectionStatus='completed' → CAN EDIT ✓
 * - Admin approves bike → status='approved' → CANNOT EDIT ✗
 * - OR Seller resubmits → inspectionStatus='pending' → CANNOT EDIT OLD INSPECTION ✗
 *   (New inspection will be submitted for the new cycle)
 * 
 * Example scenarios:
 * - Inspector accidentally submitted "failed" instead of "passed" - use this to fix (before seller resubmits)
 * - Typo in inspection notes - fix it here (before seller resubmits)
 * - Incorrectly filled condition field - correct it (before seller resubmits)
 */
export const updateInspection = async (req: Request, res: Response) => {
  try {
    const inspectionId = req.params.inspectionId as string;
    const inspectorId = req.user?.userId;
    const multipart = (req.headers['content-type'] || '').includes('multipart/form-data');
    let updateData: Partial<InspectionFormData> = multipart
      ? partialInspectionFromMultipart(req.body as Record<string, unknown>)
      : { ...req.body };

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

    // PREVENT EDITING IF ADMIN ALREADY APPROVED: Get bike to check admin approval status
    const [bike] = await db
      .select()
      .from(bikes)
      .where(eq(bikes.id, inspection.bikeId));

    if (bike?.status === 'approved') {
      // Bike already approved by admin - cannot edit inspection anymore
      return res.status(403).json({
        success: false,
        message: 'Cannot edit inspection - bike has already been approved by admin. Inspection is finalized.',
      });
    }

    // PREVENT EDITING AFTER RESUBMISSION: Check if bike has been resubmitted
    // When seller resubmits, inspectionStatus resets from 'completed' back to 'pending'
    // This locks the old inspection from further edits
    if (bike?.inspectionStatus !== 'completed') {
      return res.status(403).json({
        success: false,
        message: 'Cannot edit inspection - bike inspection status does not allow editing at this time.',
      });
    }

    const proofFiles = ((req as any).files as InspectionProofFiles | undefined)?.inspectionImages;
    if (proofFiles && proofFiles.length > 0) {
      // Only allow updating images when inspectionStatus is 'completed' (already verified above)
      // When new files uploaded: APPEND to old images (stack them)
      const newUrls = proofFiles.map((f) => publicInspectionImageUrl(f.filename));
      const extraUrls = parseInspectionImagesFromBody((req.body as Record<string, unknown>).inspectionImages);
      updateData.inspectionImages = extraUrls && extraUrls.length > 0 ? [...newUrls, ...extraUrls] : newUrls;
    }
    // If no new files uploaded but inspectionImages already in updateData from body: use as-is (from multipart parser)
    // If no new files and no body field: updateData.inspectionImages stays undefined → old images preserved

    // Cập nhật (chỉ field hợp lệ của bảng inspections)
    const { bikeId: _b, ...rest } = updateData as Partial<InspectionFormData> & { bikeId?: string };
    const [updatedInspection] = await db
      .update(inspections)
      .set({
        ...rest,
        updatedAt: new Date(),
      })
      .where(eq(inspections.id, inspectionId as string))
      .returning();

    // If inspection status is being changed, update bike status accordingly
    if (updateData.status) {
      const newBikeStatus = updateData.status === 'failed' ? 'rejected' : 'pending';
      await db
        .update(bikes)
        .set({
          status: newBikeStatus,
          isVerified: updateData.status === 'passed' ? 'verified' : 'failed',
          updatedAt: new Date(),
        })
        .where(eq(bikes.id, inspection.bikeId));
    }

    res.json({
      success: true,
      data: updatedInspection,
      message: 'Inspection updated successfully' + (updateData.status ? ` and bike status updated to ${updateData.status === 'failed' ? 'rejected' : 'pending'}` : ''),
    });
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inspection',
    });
  }
};

// ============= MESSAGING =============

/**
 * POST /api/inspector/v1/messages/:userId
 * Inspector sends a message to any user (buyer/seller/admin)
 * Unrestricted: Inspector can freely initiate conversations with anyone (same as admin)
 */
export const sendMessageToUser = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;
    const userId = req.params.userId as string;
    const { content, bikeId } = req.body;
    const fileUrl = (req as any).fileUrl || null; // From messageUpload middleware

    if (!inspectorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!UUID_REGEX.test(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID format' 
      });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Message content cannot be empty' 
      });
    }

    if (userId === inspectorId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send message to yourself' 
      });
    }

    // Verify receiver exists
    const [receiverRow] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!receiverRow) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Validate bikeId if provided
    let resolvedBikeId: string | null = null;
    if (bikeId !== undefined && bikeId !== null && bikeId !== '') {
      const bid = String(bikeId);
      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid bikeId format' 
        });
      }

      const [bikeRow] = await db
        .select({ id: bikes.id })
        .from(bikes)
        .where(eq(bikes.id, bid))
        .limit(1);

      if (!bikeRow) {
        return res.status(400).json({ 
          success: false, 
          message: 'Bike not found' 
        });
      }

      resolvedBikeId = bid;
    }

    // Import messages table at runtime to avoid circular import
    const { messages } = await import('../db/schema');

    // Create message (unrestricted - inspector can freely message anyone)
    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: inspectorId,
        receiverId: userId,
        bikeId: resolvedBikeId,
        content: content.trim(),
        fileUrl: fileUrl,
        isRead: false,
        conversationStatus: 'active', // Default to active
      })
      .returning();

    const response: ApiResponse = {
      success: true,
      data: {
        ...newMessage,
        receiver: {
          id: receiverRow.id,
          name: receiverRow.name,
          role: receiverRow.role
        }
      },
      message: `Message sent successfully to ${receiverRow.name}`
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============= CLOSE CONVERSATION =============

/**
 * Close a conversation with a buyer/seller/admin
 * Once closed, they can no longer send messages to this inspector
 */
export const closeConversation = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;
    const userId = req.params.userId as string; // Buyer, seller, or admin ID

    if (!inspectorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Find all messages in this conversation
    const conversationMessages = await db.query.messages.findMany({
      where: or(
        and(eq(messages.senderId, inspectorId), eq(messages.receiverId, userId)),
        and(eq(messages.senderId, userId), eq(messages.receiverId, inspectorId))
      ),
    });

    if (conversationMessages.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No conversation found with this user'
      });
    }

    // Update all messages in this conversation to closed status
    await db
      .update(messages)
      .set({
        conversationStatus: 'closed',
        conversationClosedAt: new Date(),
        conversationClosedBy: inspectorId,
      })
      .where(
        or(
          and(eq(messages.senderId, inspectorId), eq(messages.receiverId, userId)),
          and(eq(messages.senderId, userId), eq(messages.receiverId, inspectorId))
        )
      );

    const response: ApiResponse = {
      success: true,
      data: {
        userId,
        conversationStatus: 'closed',
        totalMessagesInConversation: conversationMessages.length,
        closedAt: new Date(),
      },
      message: 'Conversation closed successfully. User can no longer send messages.'
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error closing conversation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/inspector/v1/conversations
 * Inspector retrieves all conversations (received and sent messages)
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;

    if (!inspectorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const allMessages = await db.query.messages.findMany({
      where: or(eq(messages.receiverId, inspectorId), eq(messages.senderId, inspectorId)),
      with: {
        sender: { columns: { id: true, name: true, avatar: true, role: true } },
        receiver: { columns: { id: true, name: true, avatar: true, role: true } },
        bike: { columns: { id: true, title: true, brand: true, model: true, images: true } },
      },
      orderBy: [desc(messages.createdAt)],
    });

    // Group by conversation key (bikeId + partner)
    const conversationMap = new Map<string, any>();
    for (const msg of allMessages) {
      const partnerId = msg.senderId === inspectorId ? msg.receiverId : msg.senderId;
      const key = `${msg.bikeId ?? 'general'}_${partnerId}`;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          partner: msg.senderId === inspectorId ? msg.receiver : msg.sender,
          bike: msg.bike,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
            isMine: msg.senderId === inspectorId,
          },
          conversationStatus: msg.conversationStatus,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: Array.from(conversationMap.values()),
      message: 'Conversations retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * GET /api/inspector/v1/conversations/:userId
 * Inspector retrieves message history with a specific user
 */
export const getMessageHistory = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;
    const { userId } = req.params;
    const { bikeId, page = 1, limit = 30 } = req.query;

    if (!inspectorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!UUID_REGEX.test(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID format' 
      });
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 30;
    const offset = (pageNum - 1) * limitNum;

    const filters: any[] = [
      or(
        and(eq(messages.senderId, inspectorId), eq(messages.receiverId, userId)),
        and(eq(messages.senderId, userId), eq(messages.receiverId, inspectorId))
      ),
    ];

    if (bikeId) {
      const bid = String(bikeId);
      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid bikeId format' 
        });
      }
      filters.push(eq(messages.bikeId, bid));
    }

    const history = await db.query.messages.findMany({
      where: and(...filters),
      with: {
        sender: { columns: { id: true, name: true, avatar: true } },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limitNum,
      offset,
    });

    // Mark unreceived messages as read
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.receiverId, inspectorId), eq(messages.senderId, userId), eq(messages.isRead, false)));

    res.status(200).json({
      success: true,
      data: history.reverse(),
      message: 'Message history fetched successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching message history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
