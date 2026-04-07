import { z } from 'zod';

/**
 * Common reusable validators for the application
 * Provides standardized validation patterns for email, phone, URL, etc.
 */

/**
 * Vietnamese phone number validator
 * Pattern: 0 followed by 9 digits (e.g., 0901234567)
 * Accepts numbers starting with 0 and having exactly 10 digits total
 */
export const vietnamesePhoneValidator = z
  .string()
  .regex(/^0\d{9}$/, 'Phone must be a valid Vietnamese number (0 followed by 9 digits)')
  .describe('Vietnamese phone number (10 digits starting with 0)');

/**
 * Alternative: International flexible phone validator
 * Pattern: 10-20 characters, allows +, digits, spaces, dashes, parentheses
 * Use this if supporting multiple countries is needed
 */
export const internationalPhoneValidator = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]{9,19}$/, 'Phone must be between 10-20 characters with valid format')
  .describe('International phone number');

/**
 * Email validator (standard)
 * Validates email format
 */
export const emailValidator = z
  .string()
  .email('Invalid email format')
  .describe('Valid email address');

/**
 * URL validator (standard)
 * Validates URL format for avatars, images, etc.
 */
export const urlValidator = z
  .string()
  .url('Must be a valid URL')
  .describe('Valid URL');

/**
 * Bank account number validator
 * Pattern: 1-50 alphanumeric characters (flexible for different countries)
 */
export const bankAccountNumberValidator = z
  .string()
  .min(1, 'Bank account number cannot be empty')
  .max(50, 'Bank account number cannot exceed 50 characters')
  .regex(/^[a-zA-Z0-9]+$/, 'Bank account number can only contain letters and numbers')
  .describe('Bank account number');

/**
 * Bank code validator
 * Pattern: 1-10 uppercase letters (e.g., VCB, ACB, MB, TCB)
 */
export const bankCodeValidator = z
  .string()
  .min(1, 'Bank code cannot be empty')
  .max(10, 'Bank code cannot exceed 10 characters')
  .regex(/^[A-Z0-9]+$/, 'Bank code must be uppercase letters or numbers')
  .describe('Bank code (e.g., VCB, ACB, MB)');

/**
 * Bank account holder validator
 * Pattern: 1-255 characters, allows letters, numbers, spaces, hyphens
 */
export const bankAccountHolderValidator = z
  .string()
  .min(1, 'Bank account holder name cannot be empty')
  .max(255, 'Bank account holder name cannot exceed 255 characters')
  .regex(/^[a-zA-Z0-9\s\-àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$/, 'Bank account holder can contain letters, numbers, spaces, and hyphens')
  .describe('Bank account holder name');

/**
 * Name validator (for user profile)
 * Pattern: 1-255 characters, allows letters, numbers, spaces, common punctuation
 */
export const nameValidator = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(255, 'Name cannot exceed 255 characters')
  .describe('User name');
