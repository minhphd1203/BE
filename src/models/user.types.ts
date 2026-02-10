import { User as DrizzleUser } from '../db/schema';

// Export Drizzle types
export type User = DrizzleUser;

// User without password (for API responses)
export type UserPublic = Omit<User, 'password'>;

// User roles
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

// Create User DTO
export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
}

// Update User DTO
export interface UpdateUserDTO {
  name?: string;
  phone?: string;
  avatar?: string;
}

// Login DTO
export interface LoginDTO {
  email: string;
  password: string;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}
