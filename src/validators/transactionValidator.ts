import { z } from 'zod';
import { vietnamesePhoneValidator, emailValidator } from './commonValidators';

/**
 * Validation schema for creating a transaction
 * Ensures only expected fields are sent, catches unexpected fields early
 * Uses common validators for phone and email
 */
export const createTransactionSchema = z.object({
  bikeId: z.string().uuid('Invalid bike ID format'),
  amount: z.number().positive('Amount must be positive').optional(),
  transactionType: z.enum(['full_payment', 'deposit', 'remaining_payment']).default('full_payment'),
  paymentMethod: z.string().min(1).max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  fullName: z.string().min(2).max(255).optional().nullable(),
  buyerPhone: vietnamesePhoneValidator.optional().nullable(),
  buyerEmail: emailValidator.optional().nullable(),
  address: z.string().min(5).max(500).optional().nullable(),
}).strict(); // strict() prevents extra fields from being silently ignored

/**
 * Type inference for the validated input
 */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Validation schema for updating delivery status
 */
export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['preparing', 'delivering', 'delivered']),
  deliveryNotes: z.string().max(500).optional().nullable(),
}).strict();

export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
