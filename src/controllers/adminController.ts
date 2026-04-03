import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, users, transactions, reports, categories, reportReasons, inspections, messages } from '../db/schema';
import { desc, eq, and, or, isNotNull } from 'drizzle-orm';
import { UserPublic, ApiResponse } from '../models';

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
        }
      },
      orderBy: [desc(transactions.createdAt)]
    });
    
    const response: ApiResponse = {
      success: true,
      data: allTransactions,
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

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, notes, address } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (address !== undefined) {
      if (address === null || address === '') {
        updateData.address = null;
      } else {
        const t = String(address).trim();
        if (t.length > ADMIN_TX_ADDRESS_MAX_LEN) {
          return res.status(400).json({
            success: false,
            message: `Địa chỉ không quá ${ADMIN_TX_ADDRESS_MAX_LEN} ký tự`,
          });
        }
        updateData.address = t || null;
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
      data: updatedTransaction,
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
    const allReports = await db.query.reports.findMany({
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
        resolver: {
          columns: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: [desc(reports.createdAt)]
    });
    
    const response: ApiResponse = {
      success: true,
      data: allReports,
      message: 'Reports fetched successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
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

// ============= CONVERSATION MANAGEMENT =============

/**
 * Close a conversation with a buyer/seller
 * Once closed, they can no longer send messages to this admin/inspector
 */
export const closeConversation = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const userId = req.params.userId as string; // Buyer or seller ID
    const { bikeId, targetRole } = req.query;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Build filters for the specific conversation thread
    const filters: any[] = [
      or(
        and(eq(messages.senderId, adminId), eq(messages.receiverId, userId)),
        and(eq(messages.senderId, userId), eq(messages.receiverId, adminId))
      ),
    ];

    // Validate and apply targetRole if provided
    const validRoles = ['buyer', 'seller', 'inspector'];
    if (targetRole && !validRoles.includes(String(targetRole))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid target role' 
      });
    }

    // For buyer/seller conversations, role filtering is REQUIRED to separate conversations
    if (targetRole && targetRole !== 'inspector') {
      filters.push(
        or(
          and(eq(messages.senderId, adminId), eq(messages.receiverRole, String(targetRole))),
          and(eq(messages.senderId, userId), eq(messages.senderRole, String(targetRole)))
        )
      );
    } else if (targetRole === 'inspector') {
      filters.push(
        or(
          eq(messages.receiverRole, 'inspector'),
          eq(messages.senderRole, 'inspector')
        )
      );
    }

    // Apply bikeId filter if provided
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
    // If no bikeId provided, don't filter by bikeId - close ALL conversations with this user

    // Find messages in this specific conversation thread
    const conversationMessages = await db.query.messages.findMany({
      where: and(...filters),
    });

    if (conversationMessages.length === 0) {
      let context = 'with this user';
      if (bikeId) context = `with this user about bike ${bikeId}`;
      if (targetRole) context += ` (role: ${targetRole})`;
      return res.status(404).json({
        success: false,
        message: `No conversation found ${context}`
      });
    }

    // Update only messages in this specific conversation thread to closed status
    await db
      .update(messages)
      .set({
        conversationStatus: 'closed',
        conversationClosedAt: new Date(),
        conversationClosedBy: adminId,
      })
      .where(and(...filters));

    const response: ApiResponse = {
      success: true,
      data: {
        userId,
        bikeId: bikeId ? bikeId : 'all',
        targetRole: targetRole || 'all',
        conversationStatus: 'closed',
        totalMessagesInConversation: conversationMessages.length,
        closedAt: new Date(),
      },
      message: bikeId 
        ? `Conversation thread closed successfully (bikeId: ${bikeId}, role: ${targetRole || 'all'})`
        : `All conversation threads closed successfully. User can no longer send messages.`
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

// ============= SEND MESSAGE TO USER =============

/**
 * POST /api/admin/v1/messages/:userId
 * Admin sends a message to any user (buyer/seller/inspector)
 * Unrestricted: Admin can freely initiate conversations with anyone
 * If conversation already exists, adds to existing conversation (conversationStatus remains active or closed depends on last message)
 */
export const sendMessageToUser = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { content, bikeId } = req.body;
    const userIdFromParams = req.params.userId as string;
    const userIdFromBody = req.body.userId as string;
    const userId = userIdFromParams || userIdFromBody;
    const fileUrl = (req as any).fileUrl || null; // From messageUpload middleware

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Message content cannot be empty' 
      });
    }

    // At least one of userId or bikeId must be provided
    if (!userId && !bikeId) {
      return res.status(400).json({
        success: false,
        message: 'Either userId or bikeId must be provided'
      });
    }

    let resolvedUserId: string;
    let receiverRole: string;
    let resolvedBikeId: string | null = null;

    // Handle when both userId and bikeId are provided
    if (userId && bikeId) {
      const uid = String(userId);
      const bid = String(bikeId);
      
      if (!UUID_REGEX.test(uid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format'
        });
      }

      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bikeId format'
        });
      }

      // Verify bike exists
      const [bikeRow] = await db
        .select({ id: bikes.id, sellerId: bikes.sellerId })
        .from(bikes)
        .where(eq(bikes.id, bid))
        .limit(1);

      if (!bikeRow) {
        return res.status(400).json({
          success: false,
          message: 'Bike not found'
        });
      }

      resolvedUserId = uid;
      resolvedBikeId = bid;
      receiverRole = 'seller';
    } else if (bikeId) {
      // Handle bikeId only: auto-fill userId from bike seller
      const bid = String(bikeId);
      if (!UUID_REGEX.test(bid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid bikeId format'
        });
      }

      const [bikeRow] = await db
        .select({ id: bikes.id, sellerId: bikes.sellerId })
        .from(bikes)
        .where(eq(bikes.id, bid))
        .limit(1);

      if (!bikeRow) {
        return res.status(400).json({
          success: false,
          message: 'Bike not found'
        });
      }

      resolvedUserId = bikeRow.sellerId;
      resolvedBikeId = bid;
      receiverRole = 'seller';
    } else {
      // Handle userId only
      const uid = String(userId);
      if (!UUID_REGEX.test(uid)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format'
        });
      }

      resolvedUserId = uid;
      resolvedBikeId = null;
      
      // Lookup receiver to determine their role
      const [receiverRow] = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, resolvedUserId))
        .limit(1);

      if (!receiverRow) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }

      receiverRole = receiverRow.role === 'inspector' ? 'inspector' : 'seller';
    }

    if (resolvedUserId === adminId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send message to yourself'
      });
    }

    // Get receiver info for response
    const [receiverRow] = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, resolvedUserId))
      .limit(1);

    if (!receiverRow) {
      return res.status(400).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Create message (unrestricted - admin can freely message anyone)
    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: adminId,
        receiverId: resolvedUserId,
        bikeId: resolvedBikeId,
        content: content.trim(),
        fileUrl: fileUrl,
        isRead: false,
        conversationStatus: 'active', // Reopen closed conversation if it was closed
        senderRole: 'admin',
        receiverRole: receiverRole,
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

/**
 * GET /api/admin/v1/conversations
 * Admin retrieves all conversations (received and sent messages)
 */
export const getConversations = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const allMessages = await db.query.messages.findMany({
      where: or(eq(messages.receiverId, adminId), eq(messages.senderId, adminId)),
      with: {
        sender: { columns: { id: true, name: true, avatar: true, role: true } },
        receiver: { columns: { id: true, name: true, avatar: true, role: true } },
        bike: { columns: { id: true, title: true, brand: true, model: true, images: true } },
      },
      orderBy: [desc(messages.createdAt)],
    });

    // Group by conversation key (bikeId + partner + role) - separate conversations per role
    const conversationMap = new Map<string, any>();
    for (const msg of allMessages) {
      const partnerId = msg.senderId === adminId ? msg.receiverId : msg.senderId;
      const partnerData = msg.senderId === adminId ? msg.receiver : msg.sender;
      
      // Determine conversation role for grouping
      let partnerRole: string;
      
      if (partnerData?.role === 'inspector') {
        // Inspectors always use 'inspector' role
        partnerRole = 'inspector';
      } else {
        // For buyer/seller, message MUST have a role set
        const messageRole = msg.senderId === adminId ? msg.receiverRole : msg.senderRole;
        if (!messageRole) {
          // Skip messages with null roles to prevent cross-conversation leakage
          continue;
        }
        partnerRole = messageRole;
      }
      
      const key = `${msg.bikeId ?? 'general'}_${partnerId}_${partnerRole}`;
      if (!conversationMap.has(key)) {
        const partnerDataToStore = msg.senderId === adminId ? msg.receiver : msg.sender;
        conversationMap.set(key, {
          partner: {
            ...partnerDataToStore,
            conversationRole: partnerRole, // Show conversation role context
          },
          bike: msg.bike,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            fileUrl: msg.fileUrl,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
            isMine: msg.senderId === adminId,
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
 * GET /api/admin/v1/conversations/:userId
 * Admin retrieves message history with a specific user
 */
export const getMessageHistory = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const { userId } = req.params;
    const { bikeId, targetRole, page = 1, limit = 30 } = req.query;

    if (!adminId) {
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

    // Verify targetRole if provided
    const validRoles = ['buyer', 'seller', 'inspector'];
    if (targetRole && !validRoles.includes(String(targetRole))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid target role' 
      });
    }

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 30;
    const offset = (pageNum - 1) * limitNum;

    const filters: any[] = [
      or(
        and(eq(messages.senderId, adminId), eq(messages.receiverId, userId)),
        and(eq(messages.senderId, userId), eq(messages.receiverId, adminId))
      ),
    ];

    // For buyer/seller conversations, role filtering is REQUIRED to separate conversations
    if (targetRole && targetRole !== 'inspector') {
      // Both directions must match the target role - exclude messages with unset roles
      filters.push(
        or(
          // Admin sends to user: admin is sender, user is receiver with targetRole
          and(eq(messages.senderId, adminId), eq(messages.receiverRole, String(targetRole))),
          // User sends to admin: user is sender with targetRole, admin is receiver
          and(eq(messages.senderId, userId), eq(messages.senderRole, String(targetRole)))
        )
      );
    } else if (targetRole === 'inspector') {
      // For inspectors, accept messages with inspector role in either field
      filters.push(
        or(
          eq(messages.receiverRole, 'inspector'),
          eq(messages.senderRole, 'inspector')
        )
      );
    } else {
      // If no targetRole provided but user is not inspector, require at least one role field set
      // This prevents ambiguous messages from showing in wrong conversations
      filters.push(
        or(
          and(eq(messages.senderId, adminId), isNotNull(messages.receiverRole)),
          and(eq(messages.senderId, userId), isNotNull(messages.senderRole))
        )
      );
    }

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
      columns: {
        id: true,
        senderId: true,
        receiverId: true,
        content: true,
        fileUrl: true,
        bikeId: true,
        isRead: true,
        conversationStatus: true,
        senderRole: true,
        receiverRole: true,
        createdAt: true,
      },
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
      .where(and(eq(messages.receiverId, adminId), eq(messages.senderId, userId), eq(messages.isRead, false)));

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
