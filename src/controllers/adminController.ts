import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, users, transactions, reports, categories, reportReasons, inspections, messages } from '../db/schema';
import { desc, eq, and, or } from 'drizzle-orm';
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

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, notes } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

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

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Find all messages in this conversation
    const conversationMessages = await db.query.messages.findMany({
      where: or(
        and(eq(messages.senderId, adminId), eq(messages.receiverId, userId)),
        and(eq(messages.senderId, userId), eq(messages.receiverId, adminId))
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
        conversationClosedBy: adminId,
      })
      .where(
        or(
          and(eq(messages.senderId, adminId), eq(messages.receiverId, userId)),
          and(eq(messages.senderId, userId), eq(messages.receiverId, adminId))
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
    const userId = req.params.userId as string;
    const { content, bikeId } = req.body;
    const fileUrl = (req as any).fileUrl || null; // From messageUpload middleware

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

    if (!content || content.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Message content cannot be empty' 
      });
    }

    if (userId === adminId) {
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

    // Create message (unrestricted - admin can freely message anyone)
    const [newMessage] = await db
      .insert(messages)
      .values({
        senderId: adminId,
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
