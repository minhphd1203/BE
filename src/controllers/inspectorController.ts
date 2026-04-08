import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, inspections, users, categories, messages } from '../db/schema';
import { eq, desc, asc, and, or, sql } from 'drizzle-orm';
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
    reason: pickInspectionReasonFromBody(body),
  };
}

const INSPECTION_REASON_MAX_LEN = 10_000;
/** Khớp FE: khi failed, bắt buộc mô tả lý do đủ dài */
const INSPECTION_FAILED_REASON_MIN_LEN = 20;

function validateFailedInspectionReason(raw: string | null | undefined): { ok: true; value: string } | { ok: false; message: string } {
  const t = raw == null ? '' : String(raw).trim();
  if (t.length < INSPECTION_FAILED_REASON_MIN_LEN) {
    return {
      ok: false,
      message: `Khi kiểm định failed, trường reason là bắt buộc và phải có ít nhất ${INSPECTION_FAILED_REASON_MIN_LEN} ký tự (sau khi trim).`,
    };
  }
  if (t.length > INSPECTION_REASON_MAX_LEN) {
    return { ok: true, value: t.slice(0, INSPECTION_REASON_MAX_LEN) };
  }
  return { ok: true, value: t };
}

function pickInspectionReasonFromBody(body: Record<string, unknown>): string | undefined {
  const s = pickBodyStr(body, 'reason');
  if (s === undefined) return undefined;
  return s.length > INSPECTION_REASON_MAX_LEN ? s.slice(0, INSPECTION_REASON_MAX_LEN) : s;
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
  if (Object.prototype.hasOwnProperty.call(body, 'reason')) {
    const r = body.reason;
    if (r === null || r === undefined || r === '') out.reason = null;
    else {
      const t = String(r).trim();
      out.reason = t.length > INSPECTION_REASON_MAX_LEN ? t.slice(0, INSPECTION_REASON_MAX_LEN) : t || null;
    }
  }
  return out;
}

// ============= QUẢN LÝ KIỂM ĐỊNH XE ĐẠP =============

// � 0. DASHBOARD - THỐNG KÊ TỔNG QUAN
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const inspectorId = req.user?.userId;

    /** Xe vào hàng chờ inspector: tin seller pending HOẶC rejected bikes being resubmitted (BEFORE admin approval) */
    const queueStatus = or(
      eq(bikes.status, 'pending'),  // New bikes
      eq(bikes.status, 'rejected')  // Resubmitted bikes
    );

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

    const pendingBikes = await db.query.bikes.findMany({
      where: and(
        or(
          eq(bikes.status, 'pending'),
          eq(bikes.status, 'rejected')
        ),
        or(
          eq(bikes.inspectionStatus, 'pending'),
          eq(bikes.inspectionStatus, 'in_progress')
        )
      ),
      columns: {
        id: true,
        title: true,
        description: true,
        year: true,
        price: true,
        condition: true,
        mileage: true,
        color: true,
        images: true,
        video: true,
        status: true,
        isVerified: true,
        inspectionStatus: true,
        sellerId: true,
        categoryId: true,
        createdAt: true,
      },
      with: {
        seller: {
          columns: { id: true, name: true, avatar: true, phone: true },
        },
        brand: {
          columns: { id: true, name: true },
        },
        model: {
          columns: { id: true, name: true },
        },
        category: {
          columns: { id: true, name: true },
        },
      },
      orderBy: sort === 'oldest'
        ? asc(bikes.createdAt)
        : sort === 'price_asc'
          ? asc(bikes.price)
          : sort === 'price_desc'
            ? desc(bikes.price)
            : desc(bikes.createdAt),
    });

    // Apply search filter on the results
    let filtered = pendingBikes;
    if (search && typeof search === 'string') {
      const searchLower = (search as string).toLowerCase();
      filtered = pendingBikes.filter(bike =>
        bike.title.toLowerCase().includes(searchLower) ||
        bike.brand?.name.toLowerCase().includes(searchLower) ||
        bike.model?.name.toLowerCase().includes(searchLower) ||
        bike.seller?.name.toLowerCase().includes(searchLower)
      );
    }

    res.json({
      success: true,
      data: filtered,
      message: `Found ${filtered.length} bikes pending inspection`,
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

    const bikeDetail = await db.query.bikes.findFirst({
      where: eq(bikes.id, bikeId as string),
      columns: {
        id: true,
        title: true,
        description: true,
        year: true,
        price: true,
        condition: true,
        mileage: true,
        color: true,
        images: true,
        video: true,
        status: true,
        isVerified: true,
        inspectionStatus: true,
        sellerId: true,
        categoryId: true,
        createdAt: true,
      },
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
          },
        },
        brand: {
          columns: {
            id: true,
            name: true,
          },
        },
        model: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

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
    if (!inspectionData.overallCondition) {
      return res.status(400).json({
        success: false,
        message: 'Overall condition is required (determines pass/fail result)',
      });
    }
    
    // Status is auto-derived from overallCondition
    // Inspector doesn't choose status - it's determined automatically
    const derivedStatus = ['excellent', 'good', 'fair'].includes(inspectionData.overallCondition) ? 'passed' : 'failed';
    
    // VALIDATION: Poor condition cannot be passed
    if (inspectionData.overallCondition === 'poor' && inspectionData.status === 'passed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot pass inspection with "poor" overall condition. Overall condition must be "fair" or above (fair, good, excellent) to pass.',
      });
    }
    
    // For fair/good/excellent: use inspector's choice if provided, otherwise default to passed
    let finalStatus: 'passed' | 'failed' = derivedStatus;
    if (inspectionData.status && ['passed', 'failed'].includes(inspectionData.status)) {
      finalStatus = inspectionData.status as 'passed' | 'failed';
    }

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

    // On resubmit: Inspector CAN freely update ALL condition fields based on current bike state
    // This allows inspector to re-assess if seller made repairs or if condition changed
    // Previously locked condition fields are now allowed to change

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

    let resolvedReason: string | null = null;
    if (finalStatus === 'failed') {
      const r = inspectionData.reason;
      const checked = validateFailedInspectionReason(r === undefined ? null : String(r));
      if (!checked.ok) {
        return res.status(400).json({ success: false, message: checked.message });
      }
      resolvedReason = checked.value;
    }

    // Tạo bản ghi inspection
    const [newInspection] = await db
      .insert(inspections)
      .values({
        bikeId: bikeId as string,
        inspectorId: inspectorId!,
        status: finalStatus,
        overallCondition: finalInspectionData.overallCondition,
        frameCondition: finalInspectionData.frameCondition,
        brakeCondition: finalInspectionData.brakeCondition,
        drivetrainCondition: finalInspectionData.drivetrainCondition,
        wheelCondition: finalInspectionData.wheelCondition,
        inspectionNote: finalInspectionData.inspectionNote,
        recommendation: finalInspectionData.recommendation,
        inspectionImages: finalInspectionData.inspectionImages,
        reportFile: finalInspectionData.reportFile,
        reason: resolvedReason,
      })
      .returning();

    // Determine verification status and bike status based on final status
    const isVerifiedStatus = finalStatus === 'passed' ? 'verified' : 'failed';
    
    // If FAILED: auto-set bike status to rejected (no admin approval needed)
    // If PASSED: keep status as pending (waiting for admin approval)
    const bikeStatus = finalStatus === 'failed' ? 'rejected' : 'pending';

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

    const message = finalStatus === 'passed'
      ? previousInspection 
        ? `Resubmission inspection passed! Overall condition improved to "${finalInspectionData.overallCondition}". Bike awaiting admin approval.`
        : `Inspection passed! Overall condition: ${finalInspectionData.overallCondition}. Bike awaiting admin approval to go public.`
      : previousInspection
        ? `Resubmission inspection failed. Overall condition still "${finalInspectionData.overallCondition}". Seller must fix and resubmit.`
        : `Inspection failed. Overall condition: ${finalInspectionData.overallCondition}. Bike automatically rejected. Seller must fix and resubmit.`;

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

    let conditions = [eq(inspections.inspectorId, inspectorId!)];

    // Status filter (passed/failed)
    if (status && (status === 'passed' || status === 'failed')) {
      conditions.push(eq(inspections.status, status));
    }

    const inspectionResults = await db.query.inspections.findMany({
      where: and(...conditions),
      with: {
        bike: {
          columns: {
            id: true,
            title: true,
            price: true,
            condition: true,
            images: true,
            sellerId: true,
          },
          with: {
            brand: { columns: { id: true, name: true } },
            model: { columns: { id: true, name: true } },
            seller: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        inspector: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: sort === 'oldest' 
        ? inspections.createdAt 
        : sort === 'price_asc' 
          ? inspections.bikeId 
          : desc(inspections.createdAt),
    });

    // Apply search filter on the results (since we can't filter on related table's columns in ORM easily)
    let filtered = inspectionResults;
    if (search && typeof search === 'string') {
      const searchLower = (search as string).toLowerCase();
      filtered = inspectionResults.filter(item => 
        item.bike?.title.toLowerCase().includes(searchLower) ||
        item.bike?.brand?.name.toLowerCase().includes(searchLower) ||
        item.bike?.seller?.name.toLowerCase().includes(searchLower)
      );
    }

    // Map to response format
    const myInspections = filtered.map(item => ({
      inspection: item,
      bikeTitle: item.bike?.title,
      bikeBrand: item.bike?.brand?.name,
      bikeModel: item.bike?.model?.name,
      bikePrice: item.bike?.price,
      bikeCondition: item.bike?.condition,
      bikeImages: item.bike?.images,
      sellerName: item.bike?.seller?.name,
    }));

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
    
    // If overallCondition is being updated, derive status from it
    let finalUpdateData = { ...rest };
    if (updateData.overallCondition !== undefined) {
      // Auto-derive status from overallCondition
      finalUpdateData.status = ['excellent', 'good', 'fair'].includes(updateData.overallCondition) ? 'passed' : 'failed';
    }

    const setRow: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    const inspectionPatchKeys: (keyof InspectionFormData)[] = [
      'status',
      'overallCondition',
      'frameCondition',
      'brakeCondition',
      'drivetrainCondition',
      'wheelCondition',
      'inspectionNote',
      'recommendation',
      'reportFile',
      'inspectionImages',
      'reason',
    ];
    const patch = finalUpdateData as Record<string, unknown>;
    for (const key of inspectionPatchKeys) {
      const v = patch[key as string];
      if (v !== undefined) setRow[key as string] = v;
    }
    if (finalUpdateData.status === 'passed') {
      setRow.reason = null;
    }

    const nextStatus = (setRow.status as string | undefined) ?? inspection.status;
    if (nextStatus === 'failed') {
      const reasonForCheck =
        Object.prototype.hasOwnProperty.call(setRow, 'reason') ? (setRow.reason as string | null | undefined) : inspection.reason;
      const checked = validateFailedInspectionReason(reasonForCheck);
      if (!checked.ok) {
        return res.status(400).json({ success: false, message: checked.message });
      }
      if (Object.prototype.hasOwnProperty.call(setRow, 'reason')) {
        setRow.reason = checked.value;
      }
    }

    const [updatedInspection] = await db
      .update(inspections)
      .set(setRow as Partial<typeof inspections.$inferInsert>)
      .where(eq(inspections.id, inspectionId as string))
      .returning();

    // If status is being changed (derived from overallCondition), update bike status accordingly
    if (finalUpdateData.status) {
      const newBikeStatus = finalUpdateData.status === 'failed' ? 'rejected' : 'pending';
      await db
        .update(bikes)
        .set({
          status: newBikeStatus,
          isVerified: finalUpdateData.status === 'passed' ? 'verified' : 'failed',
          updatedAt: new Date(),
        })
        .where(eq(bikes.id, inspection.bikeId));
    }

    res.json({
      success: true,
      data: updatedInspection,
      message: 'Inspection updated successfully' + (finalUpdateData.status ? ` and bike status updated to ${finalUpdateData.status === 'failed' ? 'rejected' : 'pending'} based on overall condition` : ''),
    });
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inspection',
    });
  }
};

// Old message functions removed - use unified messageController instead
// Message operations are now handled by messageController:
// - getAllConversations() - GET /api/messages/conversations
// - getConversationDetails() - GET /api/messages/:partnerId  
// - sendMessage() - POST /api/messages/:partnerId
// - closeConversation() - DELETE /api/messages/:partnerId/close
