import { Request, Response } from 'express';
import { db } from '../db';
import { users, transactions, bikes } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { ApiResponse } from '../models';

/**
 * POST /api/profile/v1/upgrade-seller
 * Buyer upgrades their account to become a seller
 */
export const upgradeToSeller = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check current user role
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only buyers can upgrade to seller
    if (user.role !== 'buyer') {
      return res.status(400).json({
        success: false,
        message: `Cannot upgrade: you are already a ${user.role}. Only buyers can upgrade to seller.`,
        currentRole: user.role,
      });
    }

    // Update role to seller
    const [updatedUser] = await db
      .update(users)
      .set({ role: 'seller', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        avatar: users.avatar,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    const response: ApiResponse = {
      success: true,
      data: updatedUser,
      message: 'Successfully upgraded to seller! You can now start selling bikes.',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error upgrading to seller',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/profile/v1/downgrade-seller
 * Seller downgrades their account back to buyer
 * All active listings will be hidden (not deleted)
 * Cannot downgrade if they have pending transactions
 */
export const downgradeFromSeller = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check current user role
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Only sellers can downgrade to buyer
    if (user.role !== 'seller') {
      return res.status(400).json({
        success: false,
        message: `Cannot downgrade: you are a ${user.role}. Only sellers can downgrade to buyer.`,
        currentRole: user.role,
      });
    }

    // Check for pending transactions (seller side)
    const pendingTransactions = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.sellerId, userId),
        eq(transactions.status, 'pending')
      ),
    });

    if (pendingTransactions) {
      return res.status(400).json({
        success: false,
        message: 'Cannot downgrade: you have pending transactions. Please complete or cancel them first.',
        pendingTransactionId: pendingTransactions.id,
      });
    }

    // Hide all active listings (don't delete)
    await db
      .update(bikes)
      .set({ status: 'hidden', updatedAt: new Date() })
      .where(
        and(
          eq(bikes.sellerId, userId),
          ne(bikes.status, 'sold')
        )
      );

    // Update role to buyer
    const [updatedUser] = await db
      .update(users)
      .set({ role: 'buyer', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
        avatar: users.avatar,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    const response: ApiResponse = {
      success: true,
      data: updatedUser,
      message: 'Successfully downgraded to buyer. Your listings have been hidden but can be reactivated if you become a seller again.',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error downgrading from seller',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/profile/v1/info
 * Get current user's own profile information (full details with email, phone)
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        password: false, // Do not return password
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: user,
      message: 'Profile fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/profile/v1/:userId
 * View another user's profile (limited public info - no email/phone for privacy)
 * Only works for buyer/seller profiles
 * Blocks access to inspector/admin profiles with 403 Forbidden
 */
export const getOtherProfile = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };

    // Check if target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Block access to inspector/admin profiles (403 Forbidden)
    if (targetUser.role === 'inspector' || targetUser.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Cannot view this profile',
      });
    }

    // Return public info only (hide email and phone for privacy/safety)
    const response: ApiResponse = {
      success: true,
      data: {
        id: targetUser.id,
        name: targetUser.name,
        avatar: targetUser.avatar,
        role: targetUser.role,
        createdAt: targetUser.createdAt,
        updatedAt: targetUser.updatedAt,
      },
      message: 'Profile fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
