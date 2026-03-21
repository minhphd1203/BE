import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, users, transactions, reports, categories } from '../db/schema';
import { desc, eq, and } from 'drizzle-orm';
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

    const [resolvedReport] = await db
      .update(reports)
      .set({
        status: status || 'resolved',
        resolution: resolution,
        resolvedBy: req.user.userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (!resolvedReport) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const response: ApiResponse = {
      success: true,
      data: resolvedReport,
      message: 'Report resolved successfully'
    };
    
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error resolving report', 
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
