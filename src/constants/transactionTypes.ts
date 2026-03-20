/**
 * Transaction type constants
 * Client must choose one of these when creating a transaction
 */

export const TRANSACTION_TYPES = {
  FULL_PAYMENT: 'full_payment',
  DEPOSIT: 'deposit',
  REMAINING_PAYMENT: 'remaining_payment',
} as const;

export const TRANSACTION_TYPE_OPTIONS = [
  TRANSACTION_TYPES.FULL_PAYMENT,
  TRANSACTION_TYPES.DEPOSIT,
];

// Note: REMAINING_PAYMENT is created internally only, not by user choice

export const TRANSACTION_TYPE_DESCRIPTIONS: Record<string, string> = {
  [TRANSACTION_TYPES.FULL_PAYMENT]: 'Pay full bike price immediately',
  [TRANSACTION_TYPES.DEPOSIT]: 'Pay a deposit to get priority, pay rest later',
  [TRANSACTION_TYPES.REMAINING_PAYMENT]: 'Pay remaining balance after deposit (internal)',
};
