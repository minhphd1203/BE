import { Request, Response } from 'express';
import { db } from '../db';
import { bikes } from '../db/schema';
import { desc, eq, and, like, lte, gte } from 'drizzle-orm';
import { ApiResponse } from '../models';

// ============= SEARCH & BROWSE BIKES =============

/**
 * Search bikes with filters (brand, model, price range, condition, etc.)
 * Returns: minimal bike info for list view (title, price, images, status)
 * Only shows APPROVED bikes (admin approved, not yet verified by inspector)
 * Verification happens AFTER buyer decides to purchase
 * Query parameters:
 * - brand: string (partial match)
 * - model: string (partial match)
 * - minPrice: number
 * - maxPrice: number
 * - condition: string (excellent, good, fair, poor)
 * - color: string
 * - sortBy: string (price, year, mileage, createdAt) - default: createdAt
 * - sortOrder: asc | desc - default: desc
 * - page: number - default: 1
 * - limit: number - default: 10
 */
export const searchBikes = async (req: Request, res: Response) => {
  try {
    const {
      brand,
      model,
      minPrice,
      maxPrice,
      condition,
      color,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    // Build filters array
    const filters = [
      eq(bikes.status, 'approved') // Only show approved bikes
    ];

    // Add optional filters
    if (brand) {
      filters.push(like(bikes.brand, `%${brand}%`));
    }

    if (model) {
      filters.push(like(bikes.model, `%${model}%`));
    }

    if (minPrice) {
      filters.push(gte(bikes.price, parseFloat(minPrice as string)));
    }

    if (maxPrice) {
      filters.push(lte(bikes.price, parseFloat(maxPrice as string)));
    }

    if (condition) {
      filters.push(eq(bikes.condition, condition as string));
    }

    if (color) {
      filters.push(like(bikes.color, `%${color}%`));
    }

    // Determine sort field
    let sortField: any = bikes.createdAt;
    switch (sortBy) {
      case 'price':
        sortField = bikes.price;
        break;
      case 'year':
        sortField = bikes.year;
        break;
      case 'mileage':
        sortField = bikes.mileage;
        break;
      default:
        sortField = bikes.createdAt;
    }

    // Calculate offset for pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    // Fetch total count
    const countResult = await db
      .select({ count: bikes.id })
      .from(bikes)
      .where(and(...filters));

    const total = countResult.length;

    // Fetch bikes with minimal info for list view
    const bikesData = await db.query.bikes.findMany({
      where: and(...filters),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      columns: {
        // Include only necessary fields for list view
        id: true,
        title: true,
        brand: true,
        model: true,
        price: true,
        condition: true,
        year: true,
        images: true,
        status: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: [sortOrder === 'asc' ? sortField : desc(sortField)],
      limit: limitNum,
      offset: offset,
    });

    const response: ApiResponse = {
      success: true,
      data: bikesData,
      message: 'Bikes searched successfully',
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
      message: 'Error searching bikes',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get bike details by ID
 * Shows full details of APPROVED bikes (not yet verified by inspector)
 * Verification happens after buyer decides to purchase
 */
export const getBikeDetail = async (req: Request, res: Response) => {
  try {
    const bikeId = req.params.bikeId as string;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bikeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bike ID format',
      });
    }

    const bike = await db.query.bikes.findFirst({
      where: and(
        eq(bikes.id, bikeId),
        eq(bikes.status, 'approved')
      ),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
            createdAt: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
            slug: true,
            description: true,
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
        },
      },
    });

    if (!bike) {
      return res.status(404).json({
        success: false,
        message: 'Bike not found or not available',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: bike,
      message: 'Bike detail fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bike detail',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get recommended bikes (latest approved bikes)
 * Shows approved bikes that haven't been verified yet
 * Verification happens after buyer decides to buy
 */
export const getRecommendedBikes = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const recommendedBikes = await db.query.bikes.findMany({
      where: 
        eq(bikes.status, 'approved'),
      with: {
        seller: {
          columns: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        category: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(bikes.createdAt)],
      limit: parseInt(limit as string) || 10,
    });

    const response: ApiResponse = {
      success: true,
      data: recommendedBikes,
      message: 'Recommended bikes fetched successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recommended bikes',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
