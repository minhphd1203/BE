import { Bike as DrizzleBike } from '../db/schema';

// Export Drizzle type
export type Bike = DrizzleBike;

// Bike with seller info
export interface BikeWithSeller extends Bike {
  seller: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

// Create Bike DTO
export interface CreateBikeDTO {
  title: string;
  description: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  condition: string;
  mileage?: number;
  color?: string;
  images?: string[];
  sellerId: string;
}

// Update Bike DTO
export interface UpdateBikeDTO {
  title?: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: number;
  price?: number;
  condition?: string;
  mileage?: number;
  color?: string;
  images?: string[];
  status?: string;
}

// Bike filter/query params
export interface BikeQueryParams {
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  status?: string;
  search?: string;
}
