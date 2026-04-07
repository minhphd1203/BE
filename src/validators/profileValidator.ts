import { z } from 'zod';
import { vietnamesePhoneValidator, emailValidator, urlValidator, bankAccountNumberValidator, bankCodeValidator, bankAccountHolderValidator, nameValidator } from './commonValidators';

/**
 * Validation schema for updating user profile
 * Enforces field constraints and makes most fields optional
 * Uses common validators for phone, email, bank details
 */
export const updateProfileSchema = z.object({
  name: nameValidator.optional(),
  phone: vietnamesePhoneValidator.optional().nullable(),
  avatar: urlValidator.optional().nullable(),
  bankAccountNumber: bankAccountNumberValidator.optional(),
  bankAccountHolder: bankAccountHolderValidator.optional(),
  bankCode: bankCodeValidator.optional(),
  bankBranch: z.string().max(100, 'Bank branch cannot exceed 100 characters').optional().nullable(),
}).strict(); // strict() prevents extra fields from being silently ignored

/**
 * Refinement: If any bank field is provided, all required ones must be provided
 */
export const updateProfileSchemaWithBankValidation = updateProfileSchema.refine(
  (data) => {
    const bankFieldsProvided = [
      data.bankAccountNumber !== undefined,
      data.bankAccountHolder !== undefined,
      data.bankCode !== undefined,
      data.bankBranch !== undefined,
    ];
    
    const anyBankFieldProvided = bankFieldsProvided.some(x => x);
    
    if (!anyBankFieldProvided) {
      // No bank fields provided - this is valid
      return true;
    }
    
    // Some bank fields provided - check all required ones are present
    const allRequiredProvided = 
      data.bankAccountNumber !== undefined &&
      data.bankAccountHolder !== undefined &&
      data.bankCode !== undefined;
    
    return allRequiredProvided;
  },
  {
    message: 'Bank account number, holder name, and bank code are required when updating bank information',
    path: ['bankAccountNumber'], // Point to first required field
  }
);

/**
 * Type inference for the validated input
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchemaWithBankValidation>;
