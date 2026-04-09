import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, brands, models, users, transactions, reports, categories, reportReasons, inspections, messages } from '../db/schema';
import { desc, eq, and, or, isNotNull, sql } from 'drizzle-orm';
import { UserPublic, ApiResponse } from '../models';
import { mapTransactionsWithShippingAlias, withShippingAddressAlias } from '../utils/transactionResponse';

// ============= QUẢN LÝ XE ĐẠP =============

// Lấy danh sách xe đạp
export const getAllBikes = async (req: Request, res: Response) => {
  try {
    const allBikes = await db.query.bikes.findMany({
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        category: {
          columns: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [desc(bikes.createdAt)]
    });
    
    const response: ApiResponse = {
      success: true,
      data: allBikes,
      message: 'Bikes fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching bikes', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * PUT /api/admin/v1/bike/:id/approve
 * Admin approves bike (OLD ENDPOINT - updated to require inspector verification)
 * Now checks if bike passed inspector verification (isVerified: verified)
 * before allowing approval
 */
export const approveBike = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Fetch bike to check verification status
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, id));

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    // Only allow approval if bike passed inspector verification
    if (bike.isVerified !== 'verified') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve. Bike verification status: ${bike.isVerified}. Must be 'verified' by inspector first.`,
      });
    }

    // Status should be pending (waiting for admin approval)
    if (bike.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Bike is in ${bike.status} status. Cannot approve bikes that are not pending.`,
      });
    }

    const [updatedBike] = await db
      .update(bikes)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(bikes.id, id))
      .returning();

    const response: ApiResponse = {
      success: true,
      data: updatedBike,
      message: 'Bike approved successfully! Now visible to public.',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving bike',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * PUT /api/admin/v1/bike/:id/reject
 * Admin rejects bike (OLD ENDPOINT - updated to require inspector verification)
 * Now checks if bike passed inspector verification (isVerified: verified)
 * before allowing rejection for business reasons
 */
export const rejectBike = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body; // Optional rejection reason

    // Fetch bike to check verification status
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, id));

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found',
      });
    }

    // Only allow rejection of verified bikes (inspector already passed it)
    if (bike.isVerified !== 'verified') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject. Bike verification status: ${bike.isVerified}. Only 'verified' bikes can be rejected by admin.`,
      });
    }

    // Status should be pending (waiting for admin decision)
    if (bike.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Bike is in ${bike.status} status. Cannot reject bikes that are not pending.`,
      });
    }

    const [updatedBike] = await db
      .update(bikes)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(bikes.id, id))
      .returning();

    const response: ApiResponse = {
      success: true,
      data: { ...updatedBike, rejectionReason: reason },
      message: 'Bike rejected. Seller must fix issues and resubmit.',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting bike',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/admin/v1/bikes/pending-approval
 * Get list of bikes waiting for admin approval
 * Shows only bikes that passed inspector verification (isVerified: verified, status: pending)
 */
export const getPendingApprovalBikes = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Build filters for verified bikes pending approval
    let countQuery = db
      .select({ id: bikes.id })
      .from(bikes)
      .where(
        and(
          eq(bikes.isVerified, 'verified'),
          eq(bikes.status, 'pending'),
          eq(bikes.inspectionStatus, 'completed')
        )
      );

    let dataQuery = db.query.bikes.findMany({
      where: and(
        eq(bikes.isVerified, 'verified'),
        eq(bikes.status, 'pending'),
        eq(bikes.inspectionStatus, 'completed')
      ),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
          },
        },
        inspections: {
          columns: {
            id: true,
            status: true,
            overallCondition: true,
            frameCondition: true,
            brakeCondition: true,
            drivetrainCondition: true,
            wheelCondition: true,
            inspectionNote: true,
            recommendation: true,
            reason: true,
            createdAt: true,
          },
          orderBy: [desc(bikes.createdAt)],
        },
      },
      orderBy: [desc(bikes.createdAt)],
    });

    const countResult = await countQuery;
    const total = countResult.length;

    const pendingBikes = await dataQuery;

    // Apply pagination manually since we're using query builder
    const paginatedData = pendingBikes.slice(offset, offset + limitNum);

    const response: ApiResponse = {
      success: true,
      data: paginatedData,
      message: `Found ${paginatedData.length} bikes pending admin approval`,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending approval bikes',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= QUẢN LÝ NGƯỜI DÙNG =============

// Lấy danh sách người dùng
export const getAllUser = async (req: Request, res: Response) => {
  try {
    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        password: false, // Không select password vì lý do bảo mật
      },
      orderBy: [desc(users.createdAt)]
    });
    
    const response: ApiResponse<UserPublic[]> = {
      success: true,
      data: allUsers as UserPublic[],
      message: 'Users fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching users', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Cập nhật thông tin người dùng
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, phone, avatar, role } = req.body;
    
    console.log('[UPDATE USER] ID:', id);
    console.log('[UPDATE USER] Body:', req.body);
    
    // Chỉ cập nhật các trường được phép
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (role !== undefined) updateData.role = role;

    console.log('[UPDATE USER] Update data:', updateData);

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        avatar: users.avatar,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updatedUser) {
      console.log('[UPDATE USER] User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('[UPDATE USER] Success:', updatedUser);

    const response: ApiResponse = {
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[UPDATE USER] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating user', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Xóa người dùng
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Kiểm tra xem có phải admin đang xóa chính mình không
    if (req.user && req.user.userId === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
      });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: deletedUser,
      message: 'User deleted successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error deleting user', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============= QUẢN LÝ GIAO DỊCH =============

export const getAllTransaction = async (req: Request, res: Response) => {
  try {
    const allTransactions = await db.query.transactions.findMany({
      columns: {
        id: true,
        bikeId: true,
        buyerId: true,
        sellerId: true,
        amount: true,
        transactionType: true,
        remainingBalance: true,
        status: true,
        paymentMethod: true,
        notes: true,
        address: true,
        fullName: true,
        buyerPhone: true,
        buyerEmail: true,
        deliveryId: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        bike: {
          columns: {
            id: true,
            title: true,
            price: true,
          }
        },
        buyer: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        delivery: {
          columns: {
            id: true,
            deliveryStatus: true,
            deliveryNotes: true,
            receiptConfirmedAt: true,
            createdAt: true,
            updatedAt: true,
          }
        }
      },
      orderBy: [desc(transactions.createdAt)]
    });
    
    const response: ApiResponse = {
      success: true,
      data: mapTransactionsWithShippingAlias(allTransactions),
      message: 'Transactions fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching transactions', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const ADMIN_TX_ADDRESS_MAX_LEN = 2000;
const ADMIN_TX_FULL_NAME_MAX_LEN = 255;

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, notes, address, shippingAddress, fullName } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const addrRaw = address !== undefined ? address : shippingAddress;
    if (addrRaw !== undefined) {
      if (addrRaw === null || addrRaw === '') {
        updateData.address = null;
      } else {
        const t = String(addrRaw).trim();
        if (t.length > ADMIN_TX_ADDRESS_MAX_LEN) {
          return res.status(400).json({
            success: false,
            message: `Địa chỉ không quá ${ADMIN_TX_ADDRESS_MAX_LEN} ký tự`,
          });
        }
        updateData.address = t || null;
      }
    }

    if (fullName !== undefined) {
      if (fullName === null || fullName === '') {
        updateData.fullName = null;
      } else {
        const t = String(fullName).trim();
        if (t.length > ADMIN_TX_FULL_NAME_MAX_LEN) {
          return res.status(400).json({
            success: false,
            message: `Họ tên không quá ${ADMIN_TX_FULL_NAME_MAX_LEN} ký tự`,
          });
        }
        updateData.fullName = t || null;
      }
    }

    const [updatedTransaction] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();

    if (!updatedTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: withShippingAddressAlias(updatedTransaction),
      message: 'Transaction updated successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error updating transaction', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============= QUẢN LÝ BÁO CÁO =============

export const getAllReports = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    console.log('[getAllReports] Fetching reports with status filter:', status);
    
    const where = status ? eq(reports.status, String(status)) : undefined;
    
    const allReports = await db.query.reports.findMany({
      where,
      with: {
        reporter: {
          columns: {
            id: true,
            name: true,
            email: true,
          }
        },
        reportedUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          }
        },
        reportedBike: {
          columns: {
            id: true,
            title: true,
          }
        },
        reason: {
          columns: {
            id: true,
            name: true,
            description: true,
          }
        },
        resolver: {
          columns: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [desc(reports.createdAt)]
    });
    
    console.log('[getAllReports] Found', allReports.length, 'reports');
    
    const response: ApiResponse = {
      success: true,
      data: allReports,
      message: 'Reports fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('[getAllReports] Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching reports', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const resolveReport = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { resolution, status } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Fetch report with reason to check for auto-resolution (outside transaction for read)
    const reportToResolve = await db.query.reports.findFirst({
      where: eq(reports.id, id),
      with: {
        reason: {
          columns: {
            autoResolveAction: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!reportToResolve) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if report is already resolved - specific error BEFORE transaction
    if (reportToResolve.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'This report has already been resolved'
      });
    }

    // Execute report update and auto-delete action in a transaction
    // If either operation fails, both are rolled back
    const result = await db.transaction(async (tx) => {
      // Step 1: Update report status to resolved
      const [resolvedReport] = await tx
        .update(reports)
        .set({
          status: status || 'resolved',
          resolution: resolution,
          resolvedBy: req.user!.userId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(reports.id, id))
        .returning();

      if (!resolvedReport) {
        throw new Error('Report not found during update');
      }

      // Step 2: Auto-delete bike if this is a quality violation
      let autoResolutionMessage = '';
      if (status === 'resolved' && reportToResolve.reason?.autoResolveAction === 'delete_bike') {
        if (resolvedReport.reportedBikeId) {
          // Fetch bike status within transaction
          const bike = await tx.query.bikes.findFirst({
            where: eq(bikes.id, resolvedReport.reportedBikeId),
            columns: { status: true },
          });

          if (bike && ['approved', 'reserved', 'sold'].includes(bike.status)) {
            // Delete related records first (cascade delete manually)
            // Delete transactions related to this bike
            await tx.delete(transactions).where(eq(transactions.bikeId, resolvedReport.reportedBikeId));
            
            // Delete inspections related to this bike
            await tx.delete(inspections).where(eq(inspections.bikeId, resolvedReport.reportedBikeId));
            
            // Clear bike references in messages (set to NULL since it's optional)
            await tx
              .update(messages)
              .set({ bikeId: null })
              .where(eq(messages.bikeId, resolvedReport.reportedBikeId));
            
            // Clear bike references in other reports
            await tx
              .update(reports)
              .set({ reportedBikeId: null })
              .where(eq(reports.reportedBikeId, resolvedReport.reportedBikeId));
            
            // Delete the bike itself
            await tx.delete(bikes).where(eq(bikes.id, resolvedReport.reportedBikeId));
            autoResolutionMessage = `[Auto] Bike deleted due to "${reportToResolve.reason.name}" violation`;
            console.log(`[Report Auto-Resolution] Bike ${resolvedReport.reportedBikeId} and related data deleted for report ${id}`);
          } else if (bike) {
            throw new Error(`Cannot auto-delete bike with status "${bike.status}". Only approved, reserved, or sold bikes can be deleted.`);
          }
        }
      }

      return { resolvedReport, autoResolutionMessage };
    });

    const response: ApiResponse = {
      success: true,
      data: {
        ...result.resolvedReport,
        autoResolutionAction: result.autoResolutionMessage || undefined,
      },
      message: result.autoResolutionMessage || 'Report resolved successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    // If transaction fails, status remains unchanged and bike is not deleted
    console.error('[Report Resolution Error]', error);
    res.status(500).json({ 
      success: false,
      message: 'Error resolving report. Transaction rolled back - report status unchanged', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============= QUẢN LÝ DANH MỤC XE =============

export const getAllCategory = async (req: Request, res: Response) => {
  try {
    const allCategories = await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)]
    });
    
    const response: ApiResponse = {
      success: true,
      data: allCategories,
      message: 'Categories fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error fetching categories', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        success: false,
        message: 'Name and slug are required'
      });
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name,
        description,
        slug,
      })
      .returning();

    const response: ApiResponse = {
      success: true,
      data: newCategory,
      message: 'Category created successfully'
    };
    
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error creating category', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, description, slug } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (slug !== undefined) updateData.slug = slug;

    const [updatedCategory] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();

    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: updatedCategory,
      message: 'Category updated successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error updating category', 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};;

export const deleteCategory = async (req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    message: 'Category management not implemented yet. Please create categories schema first.'
  });
};

// ============= QUẢN LÝ LOẠI KHIẾU NẠI (REPORT REASONS) =============

/**
 * GET /api/admin/v1/report-reasons
 * Get all report violation types
 */
export const getAllReportReasons = async (req: Request, res: Response) => {
  try {
    const allReasons = await db.query.reportReasons.findMany({
      orderBy: [desc(reportReasons.createdAt)],
    });

    const response: ApiResponse = {
      success: true,
      data: allReasons,
      message: 'Report reasons fetched successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching report reasons',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * POST /api/admin/v1/report-reasons
 * Create a new report violation type
 */
export const createReportReason = async (req: Request, res: Response) => {
  try {
    const { name, description, isSystemAutoResolvable, autoResolveAction } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Reason name is required'
      });
    }

    const [newReason] = await db
      .insert(reportReasons)
      .values({
        name,
        description,
        isSystemAutoResolvable: isSystemAutoResolvable || false,
        autoResolveAction,
      })
      .returning();

    const response: ApiResponse = {
      success: true,
      data: newReason,
      message: 'Report reason created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating report reason',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * PUT /api/admin/v1/report-reasons/:id
 * Update a report violation type
 */
export const updateReportReason = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isSystemAutoResolvable, autoResolveAction } = req.body;

    const [updatedReason] = await db
      .update(reportReasons)
      .set({
        name,
        description,
        isSystemAutoResolvable,
        autoResolveAction,
      })
      .where(eq(reportReasons.id, id))
      .returning();

    if (!updatedReason) {
      return res.status(404).json({
        success: false,
        message: 'Report reason not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: updatedReason,
      message: 'Report reason updated successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating report reason',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * DELETE /api/admin/v1/report-reasons/:id
 * Delete a report violation type
 */
export const deleteReportReason = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting system violations
    const reason = await db.query.reportReasons.findFirst({
      where: eq(reportReasons.id, id),
    });

    if (!reason) {
      return res.status(404).json({
        success: false,
        message: 'Report reason not found'
      });
    }

    if (reason.isSystemAutoResolvable) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete system auto-resolvable violation types'
      });
    }

    const [deletedReason] = await db
      .delete(reportReasons)
      .where(eq(reportReasons.id, id))
      .returning();

    const response: ApiResponse = {
      success: true,
      data: deletedReason,
      message: 'Report reason deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting report reason',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * DELETE /api/admin/v1/bikes/:bikeId
 * Admin can delete a bike (only if status is approved, reserved, or sold)
 */
export const deleteBike = async (req: Request, res: Response) => {
  try {
    const { bikeId } = req.params;

    const bike = await db.query.bikes.findFirst({
      where: eq(bikes.id, bikeId),
    });

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found'
      });
    }

    // Only allow deletion of bikes with specific statuses
    const allowedStatuses = ['approved', 'reserved', 'sold'];
    if (!allowedStatuses.includes(bike.status)) {
      return res.status(400).json({
        success: false,
        message: `Can only delete bikes with status: ${allowedStatuses.join(', ')}. Current status: ${bike.status}`
      });
    }

    // Delete related records first to avoid foreign key constraint violations
    await db.delete(messages).where(eq(messages.bikeId, bikeId));
    await db.delete(inspections).where(eq(inspections.bikeId, bikeId));
    await db.delete(reports).where(eq(reports.reportedBikeId, bikeId));
    await db.delete(transactions).where(eq(transactions.bikeId, bikeId));

    const [deletedBike] = await db
      .delete(bikes)
      .where(eq(bikes.id, bikeId))
      .returning();

    const response: ApiResponse = {
      success: true,
      data: {
        id: deletedBike.id,
        title: deletedBike.title,
        status: deletedBike.status,
        message: 'Bike deleted successfully (removed from listing)'
      },
      message: 'Bike deleted successfully'
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting bike',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Old message functions removed - use unified messageController instead
// Message operations are now handled by messageController:
// - getAllConversations() - GET /api/messages/conversations
// - getConversationDetails() - GET /api/messages/:partnerId
// - sendMessage() - POST /api/messages/:partnerId
// - closeConversation() - DELETE /api/messages/:partnerId/close

// ============= BRANDS CRUD =============

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Get all brands with optional search
 */
export const getAllBrands = async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    const brandsData = await (search
      ? db.query.brands.findMany({
          where: sql`LOWER(${brands.name}) LIKE LOWER(${`%${search}%`})`,
          orderBy: [brands.name],
          limit: limitNum,
          offset,
        })
      : db.query.brands.findMany({
          orderBy: [brands.name],
          limit: limitNum,
          offset,
        }));

    const total = (await db.select({ count: sql`count(*)` }).from(brands))[0].count;

    const response: ApiResponse = {
      success: true,
      data: brandsData,
      message: 'Brands retrieved successfully',
      meta: {
        total: Number(total),
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving brands',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get single brand by ID
 */
export const getBrandById = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    if (!UUID_REGEX.test(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID format',
      });
    }

    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId),
      with: {
        models: {
          columns: { id: true, name: true, description: true, createdAt: true },
        },
      },
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    res.status(200).json({
      success: true,
      data: brand,
      message: 'Brand retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving brand',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Create new brand
 */
export const createBrand = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Brand name is required and must be a non-empty string',
      });
    }

    const existingBrand = await db.query.brands.findFirst({
      where: sql`LOWER(${brands.name}) = LOWER(${name.toLowerCase()})`,
    });

    if (existingBrand) {
      return res.status(409).json({
        success: false,
        message: 'Brand with this name already exists',
      });
    }

    const [newBrand] = await db
      .insert(brands)
      .values({
        name: name.trim(),
        description: description || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newBrand,
      message: 'Brand created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating brand',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update brand
 */
export const updateBrand = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { name, description } = req.body;

    if (!UUID_REGEX.test(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID format',
      });
    }

    const existingBrand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId),
    });

    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    if (name && name !== existingBrand.name) {
      const conflict = await db.query.brands.findFirst({
        where: sql`LOWER(${brands.name}) = LOWER(${name.toLowerCase()})`,
      });
      if (conflict && conflict.id !== brandId) {
        return res.status(409).json({
          success: false,
          message: 'Brand with this name already exists',
        });
      }
    }

    const [updatedBrand] = await db
      .update(brands)
      .set({
        name: name || existingBrand.name,
        description: description !== undefined ? description : existingBrand.description,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, brandId))
      .returning();

    res.status(200).json({
      success: true,
      data: updatedBrand,
      message: 'Brand updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating brand',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete brand (only if no models exist)
 */
export const deleteBrand = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;

    if (!UUID_REGEX.test(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID format',
      });
    }

    const existingBrand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId),
      with: {
        models: {
          columns: { id: true },
        },
      },
    });

    if (!existingBrand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    if (existingBrand.models && existingBrand.models.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete brand with existing models. Delete models first.',
      });
    }

    await db.delete(brands).where(eq(brands.id, brandId));

    res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting brand',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ============= MODELS CRUD =============

/**
 * Get all models (global)
 */
export const getAllModels = async (req: Request, res: Response) => {
  try {
    const { search, brandId, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    let whereClause: any;

    if (brandId) {
      if (!UUID_REGEX.test(brandId as string)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid brand ID format',
        });
      }
      whereClause = search
        ? sql`${models.brandId} = ${brandId}::uuid AND LOWER(${models.name}) LIKE LOWER(${`%${search}%`})`
        : sql`${models.brandId} = ${brandId}::uuid`;
    } else {
      whereClause = search ? sql`LOWER(${models.name}) LIKE LOWER(${`%${search}%`})` : undefined;
    }

    const modelsData = await db.query.models.findMany({
      where: whereClause,
      with: {
        brand: {
          columns: { id: true, name: true },
        },
      },
      orderBy: [models.name],
      limit: limitNum,
      offset,
    });

    const total = (await db.select({ count: sql`count(*)` }).from(models))[0].count;

    const response: ApiResponse = {
      success: true,
      data: modelsData,
      message: 'Models retrieved successfully',
      meta: {
        total: Number(total),
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving models',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get models by specific brand
 */
export const getModelsByBrand = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const offset = (pageNum - 1) * limitNum;

    if (!UUID_REGEX.test(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID format',
      });
    }

    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId),
      columns: { id: true, name: true },
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    const modelsData = await db.query.models.findMany({
      where: search
        ? sql`${models.brandId} = ${brandId}::uuid AND LOWER(${models.name}) LIKE LOWER(${`%${search}%`})`
        : sql`${models.brandId} = ${brandId}::uuid`,
      orderBy: [models.name],
      limit: limitNum,
      offset,
    });

    const total = (
      await db.select({ count: sql`count(*)` }).from(models).where(sql`${models.brandId} = ${brandId}::uuid`)
    )[0].count;

    const response: ApiResponse = {
      success: true,
      data: modelsData,
      message: `Models for brand "${brand.name}" retrieved successfully`,
      meta: {
        total: Number(total),
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(Number(total) / limitNum),
        brandId,
        brandName: brand.name,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving models',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get single model by ID
 */
export const getModelById = async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;

    if (!UUID_REGEX.test(modelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model ID format',
      });
    }

    const model = await db.query.models.findFirst({
      where: eq(models.id, modelId),
      with: {
        brand: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!model) {
      return res.status(404).json({
        success: false,
        message: 'Model not found',
      });
    }

    res.status(200).json({
      success: true,
      data: model,
      message: 'Model retrieved successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving model',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Create new model for a brand
 */
export const createModel = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const { name, description } = req.body;

    if (!UUID_REGEX.test(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID format',
      });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Model name is required and must be a non-empty string',
      });
    }

    const brand = await db.query.brands.findFirst({
      where: eq(brands.id, brandId),
      columns: { id: true, name: true },
    });

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found',
      });
    }

    const existingModel = await db.query.models.findFirst({
      where: sql`${models.brandId} = ${brandId}::uuid AND LOWER(${models.name}) = LOWER(${name.trim()})`,
    });

    if (existingModel) {
      return res.status(409).json({
        success: false,
        message: `Model "${name}" already exists for brand "${brand.name}"`,
      });
    }

    const [newModel] = await db
      .insert(models)
      .values({
        brandId,
        name: name.trim(),
        description: description || null,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: newModel,
      message: 'Model created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating model',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Update model
 */
export const updateModel = async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const { name, description } = req.body;

    if (!UUID_REGEX.test(modelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model ID format',
      });
    }

    const existingModel = await db.query.models.findFirst({
      where: eq(models.id, modelId),
      with: {
        brand: {
          columns: { id: true, name: true },
        },
      },
    });

    if (!existingModel) {
      return res.status(404).json({
        success: false,
        message: 'Model not found',
      });
    }

    if (name && name !== existingModel.name) {
      const conflict = await db.query.models.findFirst({
        where: sql`${models.brandId} = ${existingModel.brandId}::uuid AND LOWER(${models.name}) = LOWER(${name.trim()})`,
      });
      if (conflict && conflict.id !== modelId) {
        return res.status(409).json({
          success: false,
          message: `Model "${name}" already exists for this brand`,
        });
      }
    }

    const [updatedModel] = await db
      .update(models)
      .set({
        name: name || existingModel.name,
        description: description !== undefined ? description : existingModel.description,
        updatedAt: new Date(),
      })
      .where(eq(models.id, modelId))
      .returning();

    res.status(200).json({
      success: true,
      data: updatedModel,
      message: 'Model updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating model',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete model
 */
export const deleteModel = async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;

    if (!UUID_REGEX.test(modelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid model ID format',
      });
    }

    const existingModel = await db.query.models.findFirst({
      where: eq(models.id, modelId),
    });

    if (!existingModel) {
      return res.status(404).json({
        success: false,
        message: 'Model not found',
      });
    }

    await db.delete(models).where(eq(models.id, modelId));

    res.status(200).json({
      success: true,
      message: 'Model deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting model',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
